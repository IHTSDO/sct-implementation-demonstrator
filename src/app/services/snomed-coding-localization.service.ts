import { Injectable } from '@angular/core';
import { firstValueFrom, from, Observable, of } from 'rxjs';
import { catchError, concatMap, finalize, map, shareReplay, tap, toArray } from 'rxjs/operators';
import { TerminologyService } from './terminology.service';

export interface CodingOrigin {
  isExtension: boolean;
  moduleId?: string;
  /** Edition the coding was recorded against, e.g. http://snomed.info/sct/11000221109 */
  editionFhirUrl?: string;
}

export interface ConceptAlternative {
  code: string;
  display: string;
  system: string;
}

export interface HistoricalReplacement extends ConceptAlternative {
  equivalence: string;
}

export interface EditionCheckResult {
  /** code → display in the target edition and language, for active concepts */
  displays: Map<string, string>;
  /** requested codes not returned by the target edition (inactive or absent) */
  notActive: Set<string>;
}

export type CodingAdaptationReason = 'display-localized' | 'extension-concept' | 'inactive' | 'not-found';

export interface CodingToAdapt {
  code: string;
  display?: string;
  version?: string;
}

export interface CodingAdaptation {
  code: string;
  reason: CodingAdaptationReason;
  /** Display of `code` in the selected edition (set when the concept is active there) */
  localizedDisplay?: string;
  /** Concepts active in the selected edition that can stand in for `code`, displays localized */
  alternatives: Array<ConceptAlternative & { equivalence?: string }>;
}

/**
 * Adapts SNOMED CT codings recorded in one edition so they can be used in
 * another: works out where each code really comes from, finds International
 * alternatives for extension concepts, localized displays and historical
 * replacements for inactive concepts.
 *
 * Every request is sent sequentially to respect terminology server rate limits.
 */
@Injectable({
  providedIn: 'root'
})
export class SnomedCodingLocalizationService {
  static readonly INTERNATIONAL_MODULE_ID = '900000000000207008';
  static readonly SNOMED_SYSTEM = 'http://snomed.info/sct';

  private readonly INACTIVE_REFSETS = [
    { id: '900000000000526001', label: 'REPLACED BY' },
    { id: '900000000000527005', label: 'SAME AS' },
    { id: '900000000000530003', label: 'ALTERNATIVE' },
    { id: '900000000000523009', label: 'POSSIBLY EQUIVALENT TO' },
  ];

  private historicalCache = new Map<string, HistoricalReplacement[]>();
  private historicalInFlight = new Map<string, Observable<HistoricalReplacement[]>>();
  private ancestorCache = new Map<string, ConceptAlternative[]>();
  private ancestorInFlight = new Map<string, Observable<ConceptAlternative[]>>();

  constructor(private terminologyService: TerminologyService) {}

  isSnomedSystem(system: string | undefined): boolean {
    return !!system && system.includes('snomed.info/sct');
  }

  extractModuleId(uri: string | undefined): string | null {
    if (!uri) return null;
    const match = uri.match(/snomed\.info\/sct\/(\d+)/);
    return match ? match[1] : null;
  }

  /** Edition name for an edition/version URI or module id, from the server's edition list. */
  getEditionName(uriOrModuleId: string | undefined): string | undefined {
    const moduleId = /^\d+$/.test(uriOrModuleId ?? '') ? uriOrModuleId : this.extractModuleId(uriOrModuleId);
    if (!moduleId) return undefined;
    for (const editionGroup of this.terminologyService.editionsDetails$.value ?? []) {
      const match = editionGroup.editions?.some((e: any) =>
        `${e?.resource?.version || ''}`.includes(`snomed.info/sct/${moduleId}/version/`)
      );
      if (match) return editionGroup.editionName;
    }
    return moduleId;
  }

  /**
   * First-pass classification from the coding alone. `version` names the
   * edition the concept was selected from, so an extension edition here only
   * means the concept *may* be an extension concept; confirm with
   * `resolveInternationalCodes`.
   */
  classifyCoding(system: string, version?: string): CodingOrigin {
    if (!this.isSnomedSystem(system)) {
      return { isExtension: false };
    }

    const moduleId = this.extractModuleId(version || system);
    if (!moduleId || moduleId === SnomedCodingLocalizationService.INTERNATIONAL_MODULE_ID) {
      return { isExtension: false };
    }

    return {
      isExtension: true,
      moduleId,
      editionFhirUrl: `${SnomedCodingLocalizationService.SNOMED_SYSTEM}/${moduleId}`
    };
  }

  /**
   * For each edition, finds which of its codes are actually International
   * concepts and which the server reports as unknown in that edition.
   * Editions are processed one after another.
   */
  async resolveInternationalCodes(
    codesByEdition: Map<string, string[]>
  ): Promise<Map<string, { inModule: Set<string>; missing: Set<string> }>> {
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const results = new Map<string, { inModule: Set<string>; missing: Set<string> }>();
    for (const [editionUrl, codes] of codesByEdition) {
      if (results.size) await this.terminologyService.pace();
      results.set(
        editionUrl,
        await this.terminologyService.findCodesInModule(
          fhirBase,
          editionUrl,
          codes,
          SnomedCodingLocalizationService.INTERNATIONAL_MODULE_ID
        )
      );
    }
    return results;
  }

  /** ECL for the closest International ancestors of an extension concept. */
  internationalAncestorsEcl(code: string): string {
    const intl = SnomedCodingLocalizationService.INTERNATIONAL_MODULE_ID;
    return `((> ${code} {{ C moduleId = ${intl} }} ) MINUS (> (> ${code} {{ C moduleId = ${intl} }} )))`;
  }

  /** Closest International ancestors of `code`, evaluated in the edition that defines it. */
  findInternationalAncestors(code: string, editionFhirUrl: string): Observable<ConceptAlternative[]> {
    const key = `${this.terminologyService.getSnowstormFhirBase()}|${editionFhirUrl}|${code}`;
    const cached = this.ancestorCache.get(key);
    if (cached) return of(cached);
    const inFlight = this.ancestorInFlight.get(key);
    if (inFlight) return inFlight;

    const request$ = this.terminologyService
      .expandValueSetFromServer(
        this.terminologyService.getSnowstormFhirBase(),
        editionFhirUrl,
        this.internationalAncestorsEcl(code),
        '',
        0,
        50
      )
      .pipe(
        map((res: any) => {
          if (!res?.expansion) {
            throw new Error('Failed to expand ECL — check the server and edition availability');
          }
          return (res.expansion.contains ?? []).map((c: any) => ({
            code: c.code,
            display: c.display,
            system: c.system || SnomedCodingLocalizationService.SNOMED_SYSTEM
          }));
        }),
        tap(result => this.ancestorCache.set(key, result)),
        finalize(() => this.ancestorInFlight.delete(key)),
        shareReplay(1)
      );
    this.ancestorInFlight.set(key, request$);
    return request$;
  }

  /**
   * Checks codes against the currently selected edition: returns the edition's
   * display for each active code and the set of codes it did not return
   * (inactive, or unknown on that server — those no longer fail the whole check).
   */
  checkInSelectedEdition(codes: string[]): Observable<EditionCheckResult> {
    const uniqueCodes = [...new Set(codes)];
    if (!uniqueCodes.length) {
      return of({ displays: new Map<string, string>(), notActive: new Set<string>() });
    }

    return from(this.terminologyService.expandCodesInSelectedEdition(uniqueCodes)).pipe(
      map(({ contains }) => {
        const displays = new Map<string, string>();
        for (const item of contains) {
          if (item.code && item.display) displays.set(item.code, item.display);
        }
        return {
          displays,
          notActive: new Set(uniqueCodes.filter(c => !displays.has(c)))
        };
      })
    );
  }

  /** Historical association targets for an inactive concept, one refset at a time. */
  findHistoricalReplacements(code: string): Observable<HistoricalReplacement[]> {
    const cached = this.historicalCache.get(code);
    if (cached) return of(cached);
    const inFlight = this.historicalInFlight.get(code);
    if (inFlight) return inFlight;

    const request$ = from(this.INACTIVE_REFSETS).pipe(
      concatMap((refset, index) =>
        from(index > 0 ? this.terminologyService.pace() : Promise.resolve()).pipe(
          concatMap(() => this.terminologyService.translate(refset.id, code, undefined, true)),
          map((res: any) => this.parseTranslateResult(res)),
          catchError(() => of([] as HistoricalReplacement[]))
        )
      ),
      toArray(),
      map(results => results.flat()),
      tap(result => this.historicalCache.set(code, result)),
      finalize(() => this.historicalInFlight.delete(code)),
      shareReplay(1)
    );
    this.historicalInFlight.set(code, request$);
    return request$;
  }

  /**
   * Works out how each SNOMED CT coding has to change to be used in the
   * currently selected edition:
   * - active there with a different display → `display-localized`
   * - extension concept the edition does not contain → `extension-concept`,
   *   alternatives are its closest International ancestors
   * - otherwise absent → `inactive` (historical replacements) or `not-found`
   *
   * Alternatives are re-checked against the selected edition so only active
   * concepts are offered, with displays in the edition's language.
   * Requests run one after another. Codings that need no change are omitted.
   */
  async adaptToSelectedEdition(codings: CodingToAdapt[]): Promise<Map<string, CodingAdaptation>> {
    const adaptations = new Map<string, CodingAdaptation>();
    const snomedCodings = codings.filter(c => !!c.code);
    if (!snomedCodings.length) return adaptations;

    const { displays, notActive } = await firstValueFrom(
      this.checkInSelectedEdition(snomedCodings.map(c => c.code))
    );

    for (const coding of snomedCodings) {
      const localizedDisplay = displays.get(coding.code);
      if (localizedDisplay && coding.display && coding.display.trim() !== localizedDisplay.trim()) {
        adaptations.set(coding.code, {
          code: coding.code,
          reason: 'display-localized',
          localizedDisplay,
          alternatives: []
        });
      }
    }

    // Absent codes recorded against an extension edition: confirm which are extension concepts
    const absent = [...new Map(snomedCodings.filter(c => notActive.has(c.code)).map(c => [c.code, c])).values()];
    const extensionCandidates = new Map<string, string[]>();
    for (const coding of absent) {
      const origin = this.classifyCoding(SnomedCodingLocalizationService.SNOMED_SYSTEM, coding.version);
      if (origin.isExtension && origin.editionFhirUrl) {
        extensionCandidates.set(origin.editionFhirUrl, [...(extensionCandidates.get(origin.editionFhirUrl) ?? []), coding.code]);
      }
    }
    if (extensionCandidates.size) await this.terminologyService.pace();
    const resolved = extensionCandidates.size
      ? await this.resolveInternationalCodes(extensionCandidates).catch(() => new Map())
      : new Map<string, { inModule: Set<string>; missing: Set<string> }>();

    for (const coding of absent) {
      await this.terminologyService.pace();
      const origin = this.classifyCoding(SnomedCodingLocalizationService.SNOMED_SYSTEM, coding.version);
      const editionResult = origin.editionFhirUrl ? resolved.get(origin.editionFhirUrl) : undefined;
      const isExtensionConcept = !!editionResult
        && !editionResult.inModule.has(coding.code)
        && !editionResult.missing.has(coding.code);

      if (isExtensionConcept) {
        const alternatives = await firstValueFrom(
          this.findInternationalAncestors(coding.code, origin.editionFhirUrl!).pipe(catchError(() => of([])))
        );
        adaptations.set(coding.code, { code: coding.code, reason: 'extension-concept', alternatives });
      } else {
        const alternatives = await firstValueFrom(this.findHistoricalReplacements(coding.code));
        adaptations.set(coding.code, {
          code: coding.code,
          reason: alternatives.length ? 'inactive' : 'not-found',
          alternatives
        });
      }
    }

    if ([...adaptations.values()].some(a => a.alternatives.length)) {
      await this.terminologyService.pace();
    }
    await this.localizeAlternatives([...adaptations.values()]);
    return adaptations;
  }

  /** Keeps only alternatives active in the selected edition, with its displays. */
  private async localizeAlternatives(adaptations: CodingAdaptation[]): Promise<void> {
    const codes = adaptations.flatMap(a => a.alternatives.map(alt => alt.code));
    if (!codes.length) return;

    const { displays } = await firstValueFrom(
      this.checkInSelectedEdition(codes).pipe(
        catchError(() => of({ displays: null as Map<string, string> | null, notActive: new Set<string>() }))
      )
    );
    if (!displays) return;

    for (const adaptation of adaptations) {
      adaptation.alternatives = adaptation.alternatives
        .filter(alt => displays.has(alt.code))
        .map(alt => ({ ...alt, display: displays.get(alt.code)! }));
      if (adaptation.reason === 'inactive' && !adaptation.alternatives.length) {
        adaptation.reason = 'not-found';
      }
    }
  }

  private parseTranslateResult(res: any): HistoricalReplacement[] {
    const out: HistoricalReplacement[] = [];
    if (!res?.parameter) return out;
    for (const param of res.parameter) {
      if (param.name !== 'match') continue;
      const item: any = {};
      for (const part of param.part ?? []) {
        if (part.name === 'concept' && part.valueCoding) {
          item.code = part.valueCoding.code;
          item.display = part.valueCoding.display;
          item.system = part.valueCoding.system;
        }
        if (part.name === 'equivalence' && part.valueCode) {
          item.equivalence = part.valueCode;
        }
      }
      if (item.code) out.push(item);
    }
    return out;
  }
}
