import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
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
   * Checks codes against the currently selected edition in a single
   * expansion: returns the edition's display for each active code and the
   * set of codes it did not return.
   */
  checkInSelectedEdition(codes: string[]): Observable<EditionCheckResult> {
    const uniqueCodes = [...new Set(codes)];
    if (!uniqueCodes.length) {
      return of({ displays: new Map<string, string>(), notActive: new Set<string>() });
    }

    return this.terminologyService
      .expandValueSet(uniqueCodes.join(' OR '), '', 0, uniqueCodes.length + 50)
      .pipe(
        map((res: any) => {
          if (!res?.expansion) {
            throw new Error('Failed to fetch displays from current edition');
          }
          const displays = new Map<string, string>();
          for (const item of res.expansion.contains ?? []) {
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
      concatMap(refset =>
        this.terminologyService.translate(refset.id, code, undefined, true).pipe(
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
