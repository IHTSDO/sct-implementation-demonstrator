import { Injectable } from '@angular/core';
import { firstValueFrom, from, Observable, of, throwError } from 'rxjs';
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

/** Thrown when the terminology server starts limiting or blocking requests; the flow stops. */
export class TerminologyThrottledError extends Error {
  constructor(override readonly cause?: unknown) {
    super('The terminology server is limiting requests');
    this.name = 'TerminologyThrottledError';
  }
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
  /** server|edition|language|code → display in that edition, or null when not returned */
  private editionCheckCache = new Map<string, string | null>();
  /** server|edition|code → 'in' (International), 'missing' (unknown) or 'out' (other module) */
  private moduleCheckCache = new Map<string, 'in' | 'missing' | 'out'>();

  constructor(private terminologyService: TerminologyService) {}

  isSnomedSystem(system: string | undefined): boolean {
    return !!system && system.includes('snomed.info/sct');
  }

  extractModuleId(uri: string | undefined): string | null {
    if (!uri) return null;
    const match = uri.match(/snomed\.info\/sct\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Label for a CodeableConcept in the selected edition: the display of a
   * SNOMED CT coding recorded in that edition (same module, any release)
   * when there is one, otherwise the concept text. `original` carries the
   * text when it differs from the label, e.g. for a tooltip.
   */
  getConceptLabel(concept: { text?: string; coding?: Array<{ system?: string; version?: string; display?: string }> } | undefined): { label: string; original?: string } {
    const text = concept?.text?.trim();
    const coding = this.findSelectedEditionCoding(concept);

    if (coding?.display) {
      const label = coding.display.trim();
      return { label, original: text && text !== label ? text : undefined };
    }
    return { label: text || concept?.coding?.[0]?.display || '' };
  }

  /** A SNOMED CT coding with a display recorded in the selected edition (same module, any release). */
  findSelectedEditionCoding<T extends { system?: string; version?: string; display?: string }>(
    concept: { coding?: T[] } | undefined
  ): T | undefined {
    const selectedModule = this.extractModuleId(this.terminologyService.getSelectedEditionVersion());
    if (!selectedModule) return undefined;
    return concept?.coding?.find(c => this.isSnomedSystem(c.system) && !!c.display && this.extractModuleId(c.version) === selectedModule);
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
    let requested = false;
    for (const [editionUrl, codes] of codesByEdition) {
      const inModule = new Set<string>();
      const missing = new Set<string>();
      const key = (code: string) => `${fhirBase}|${editionUrl}|${code}`;
      const uncached = [...new Set(codes)].filter(code => !this.moduleCheckCache.has(key(code)));

      if (uncached.length) {
        if (requested) await this.terminologyService.pace();
        requested = true;
        const found = await this.terminologyService
          .findCodesInModule(fhirBase, editionUrl, uncached, SnomedCodingLocalizationService.INTERNATIONAL_MODULE_ID)
          .catch(err => { throw this.toThrottled(err); });
        for (const code of uncached) {
          this.moduleCheckCache.set(key(code), found.inModule.has(code) ? 'in' : found.missing.has(code) ? 'missing' : 'out');
        }
      }

      for (const code of codes) {
        const state = this.moduleCheckCache.get(key(code));
        if (state === 'in') inModule.add(code);
        if (state === 'missing') missing.add(code);
      }
      results.set(editionUrl, { inModule, missing });
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
      .expandValueSetFromServerRaw(
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
    const context = [
      this.terminologyService.getSnowstormFhirBase(),
      this.terminologyService.getFhirUrlParam(),
      this.terminologyService.getComputedLanguageContext()
    ].join('|');
    const key = (code: string) => `${context}|${code}`;
    const uncached = uniqueCodes.filter(code => !this.editionCheckCache.has(key(code)));

    const fetch$: Observable<unknown> = uncached.length
      ? from(this.terminologyService.expandCodesInSelectedEdition(uncached)).pipe(
          tap(({ contains }) => {
            const returned = new Map<string, string>();
            for (const item of contains) {
              if (item.code && item.display) returned.set(item.code, item.display);
            }
            uncached.forEach(code => this.editionCheckCache.set(key(code), returned.get(code) ?? null));
          }),
          catchError(err => throwError(() => this.toThrottled(err)))
        )
      : of(null);

    return fetch$.pipe(
      map(() => {
        const displays = new Map<string, string>();
        for (const code of uniqueCodes) {
          const display = this.editionCheckCache.get(key(code));
          if (display) displays.set(code, display);
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
    const key = `${this.terminologyService.getSnowstormFhirBase()}|${code}`;
    const cached = this.historicalCache.get(key);
    if (cached) return of(cached);
    const inFlight = this.historicalInFlight.get(key);
    if (inFlight) return inFlight;

    const request$ = from(this.INACTIVE_REFSETS).pipe(
      concatMap((refset, index) =>
        from(index > 0 ? this.terminologyService.pace() : Promise.resolve()).pipe(
          concatMap(() => this.terminologyService.translate(refset.id, code, undefined, true)),
          map((res: any) => this.parseTranslateResult(res)),
          // A refset with no match is fine; a blocked server stops the whole lookup
          catchError(err => this.terminologyService.isThrottlingError(err)
            ? throwError(() => new TerminologyThrottledError(err))
            : of([] as HistoricalReplacement[]))
        )
      ),
      toArray(),
      map(results => results.flat()),
      tap(result => this.historicalCache.set(key, result)),
      finalize(() => this.historicalInFlight.delete(key)),
      shareReplay(1)
    );
    this.historicalInFlight.set(key, request$);
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
      ? await this.resolveInternationalCodes(extensionCandidates).catch(err => {
          if (err instanceof TerminologyThrottledError) throw err;
          return new Map<string, { inModule: Set<string>; missing: Set<string> }>();
        })
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
          this.findInternationalAncestors(coding.code, origin.editionFhirUrl!).pipe(
            catchError(err => this.terminologyService.isThrottlingError(err)
              ? throwError(() => new TerminologyThrottledError(err))
              : of([] as ConceptAlternative[]))
          )
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
        catchError(err => err instanceof TerminologyThrottledError
          ? throwError(() => err)
          : of({ displays: null as Map<string, string> | null, notActive: new Set<string>() }))
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

  /** Wraps throttling errors so callers can stop the flow; other errors pass through. */
  private toThrottled(err: unknown): unknown {
    if (err instanceof TerminologyThrottledError) return err;
    return this.terminologyService.isThrottlingError(err) ? new TerminologyThrottledError(err) : err;
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
