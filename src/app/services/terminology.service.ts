import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from '../alerts/snack-alert';
import { BehaviorSubject } from 'rxjs';


type ConceptType = {
  code: string;
  display: string;
};

type Relationship = {
  type: ConceptType;
  target: ConceptType;
};

type NormalForm = {
  groups: Relationship[][];
};

interface CodeDisplay {
  code: string;
  display?: string;
}

/** Canonical FHIR ValueSet summary for picker UIs (`url` is authoritative). */
export interface ValueSetSummary {
  url: string;
  title: string;
}

@Injectable({
  providedIn: 'root'
})

export class TerminologyService {
  
  
  snowstormFhirBase = '';
  defaultFhirUrlParam = 'http://snomed.info/sct'; // 'http://snomed.info/sct/11000221109/version/20211130'
  fhirUrlParam = this.defaultFhirUrlParam;
  lang = 'en';
  languageRefsetConcept: any = null;

  private snowstormFhirBaseSubject = new BehaviorSubject<string>(this.snowstormFhirBase);
  private fhirUrlParamSubject = new BehaviorSubject<string>(this.fhirUrlParam);
  private langSubject = new BehaviorSubject<string>(this.lang);
  private languageRefsetConceptSubject = new BehaviorSubject<any>(this.languageRefsetConcept);
  private context!: any;
  private contextSubject = new BehaviorSubject<any>(this.context);
  private editionNameSubject = new BehaviorSubject<string>('Edition');

  private expandValuesetCache = new Map<string, { timestamp: number, data: any }>();
  private readonly CACHE_LIMIT = 100;
  private readonly CACHE_DURATION = 20 * 60 * 60 * 1000; // 20 hours in milliseconds
  private readonly CACHE_KEY = 'valueSetCache';

  /** Session cache and in-flight deduplication for `GET ValueSet` list (sandbox picker). */
  private valueSetsListCache = new Map<string, ValueSetSummary[]>();
  private valueSetsListInFlight = new Map<string, Observable<ValueSetSummary[]>>();

  public editionsDetails$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  public languages$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>(['da', 'de', 'en', 'es', 'et', 'fi', 'fr', 'nl', 'no', 'sv']);
  public filteredLanguageMetadata$: BehaviorSubject<any> = new BehaviorSubject<any>({ contexts: [] });
  public contexts$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  
  /** Full language metadata for all editions (used for on-the-fly context calculation) */
  private languageMetadata: any = { editions: [] };


  // For external components to subscribe to
  snowstormFhirBase$ = this.snowstormFhirBaseSubject.asObservable();
  fhirUrlParam$ = this.fhirUrlParamSubject.asObservable();
  lang$ = this.langSubject.asObservable();
  languageRefsetConcept$ = this.languageRefsetConceptSubject.asObservable();
  context$ = this.contextSubject.asObservable();
  editionName$ = this.editionNameSubject.asObservable();


  constructor(private http: HttpClient, private _snackBar: MatSnackBar) { 
    this.loadCache();
    this.loadLanguageMetadata();
  }

  /** Load language metadata for on-the-fly context calculation */
  private loadLanguageMetadata(): void {
    this.http.get('assets/language/national-language-metadata.json').subscribe({
      next: (data: any) => {
        this.languageMetadata = data || { editions: [] };
      },
      error: () => {
        this.languageMetadata = { editions: [] };
      }
    });
  }

  setSnowstormFhirBase(url: string) {
    this.snowstormFhirBase = url;
    this.snowstormFhirBaseSubject.next(url);
    this.languageRefsetConcept = null;
  }
  
  setFhirUrlParam(url: string) {
    this.fhirUrlParam = url;
    this.fhirUrlParamSubject.next(url);
    this.languageRefsetConcept = null;
    
    // Update edition name when URL changes
    this.getCodeSystem(url).subscribe((response: any) => {
      const editionName = response?.entry?.[0]?.resource?.title?.replace('SNOMED CT release ', '') || 'Edition';
      this.editionNameSubject.next(editionName);
    });
  }

  setFhirUrlParamLocal(url: string) {
    this.fhirUrlParam = url;
    this.languageRefsetConcept = null;
  }
  
  setLang(lang: string) {
    this.lang = lang;
    this.langSubject.next(lang);
    this.setLanguageRefsetConcept(null);
    this.setContext(null);
  }

  setLanguageRefsetConcept(languageRefsetConcept: any) {
    this.languageRefsetConcept = languageRefsetConcept;
    this.languageRefsetConceptSubject.next(languageRefsetConcept);
    this.setContext(null);
  }

  setContext(context: any) {
    this.context = context;
    this.contextSubject.next(context);
  }

  getSnowstormFhirBase() {
    return this.snowstormFhirBase;
  }

  getFhirUrlParam() {
    return this.fhirUrlParam;
  }

  getLang() {
    return this.lang;
  }

  getLanguageRefsetConcept() {
    return this.languageRefsetConcept;
  }

  getContext() {
    return this.context;
  }

  getComputedLanguageContext(): string {
    if (this.context) {
      const dialects = this.context.languageDialects;
      if (this.isOntoserver() && dialects && this.isSnowstormLanguageFormat(dialects)) {
        const { lang, refsetCode } = this.parseSnowstormLanguageFormat(dialects);
        return this.toLanguageCode(lang, refsetCode);
      }
      return dialects ?? this.lang;
    } else if (this.languageRefsetConcept) {
      const code = String(this.languageRefsetConcept.code);
      if (this.isOntoserver()) {
        return this.toLanguageCode(this.lang, code);
      }
      return this.lang + '-X-' + code;
    } else return this.lang;
  }

  getComputedLanguageContextForSelection(
    lang: string,
    languageRefsetConcept?: any,
    context?: any,
    fhirBase?: string
  ): string {
    const effectiveLang = lang || this.lang;
    const effectiveFhirBase = fhirBase || this.snowstormFhirBase;

    if (context) {
      const dialects = context.languageDialects;
      if (this.isOntoserverBase(effectiveFhirBase) && dialects && this.isSnowstormLanguageFormat(dialects)) {
        const { lang, refsetCode } = this.parseSnowstormLanguageFormat(dialects);
        return this.toLanguageCode(lang, refsetCode);
      }
      return dialects ?? effectiveLang;
    }

    if (languageRefsetConcept) {
      const code = String(languageRefsetConcept.code);
      if (this.isOntoserverBase(effectiveFhirBase)) {
        return this.toLanguageCode(effectiveLang, code);
      }
      return effectiveLang + '-X-' + code;
    }

    return effectiveLang;
  }

  /** True when the configured FHIR base URL is an Ontoserver (different language refset format). */
  private isOntoserver(): boolean {
    return this.snowstormFhirBase.toLowerCase().includes('ontoserver');
  }

  private isOntoserverBase(fhirBase: string): boolean {
    return (fhirBase || '').toLowerCase().includes('ontoserver');
  }

  /** Matches Snowstorm format e.g. en-X-900000000000509007 (lang-X-refsetCode). */
  private isSnowstormLanguageFormat(value: string): boolean {
    return /^[a-z]{2}-X-\d+$/i.test(value);
  }

  /** Parses Snowstorm format en-X-900000000000509007 into { lang, refsetCode }. */
  private parseSnowstormLanguageFormat(value: string): { lang: string; refsetCode: string } {
    const match = value.match(/^([a-z]{2})-X-(\d+)$/i);
    if (match) {
      return { lang: match[1], refsetCode: match[2] };
    }
    return { lang: this.lang, refsetCode: '' };
  }

  /** Ontoserver-style language dialect: e.g. en-x-sctlang-00000000-00000000-00000000 */
  private toLanguageCode(lang: string, langRefset: string): string {
    if (langRefset.length > 16) {
      return `${lang}-x-sctlang-${langRefset.substring(0, 8)}-${langRefset.substring(8, 16)}-${langRefset.substring(16)}`;
    } else if (langRefset.length > 8) {
      return `${lang}-x-sctlang-${langRefset.substring(0, 8)}-${langRefset.substring(8)}`;
    } else {
      return `${lang}-x-sctlang-${langRefset}`;
    }
  }

  getCodeSystems() {
    if (!this.snowstormFhirBase) return of({});
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem`;
    if (this.isOntoserver()) {
      requestUrl += `?system=http://snomed.info/sct`;
    }
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getCodeSystems', {}))
      );
  }

  getCodeSystemsFromServer(fhirBase: string, editionUri?: string) {
    let requestUrl = `${fhirBase}/CodeSystem`;
    if (editionUri) {
      requestUrl += `?system=${editionUri}`;
    }
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('getCodeSystemsFromServer', {}))
      );
  }

  getCodeSystemFromServer(fhirBase: string, versionedUri: string) {
    const requestUrl = `${fhirBase}/CodeSystem?version=${versionedUri}`;
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('getCodeSystemFromServer', {}))
      );
  }

  /**
   * Resolve the latest versioned CodeSystem URI for a specific edition-level URI
   * on the provided FHIR server.
   * Example:
   * - editionUri:  http://snomed.info/sct/11010000107
   * - versionedUri: http://snomed.info/sct/11010000107/version/20250321
   */
  getLatestCodeSystemVersionFromServer(fhirBase: string, editionUri: string, fallbackVersion?: string): Observable<string> {
    const knownVersionedUri = fallbackVersion || editionUri;
    return this.getCodeSystemsFromServer(fhirBase).pipe(
      map((response: any) => {
        const entries = response?.entry || [];
        const matchingEntries = entries.filter((entry: any) => {
          const version = `${entry?.resource?.version || ''}`;
          return version.startsWith(`${editionUri}/version/`);
        });

        const latestEntry = [...matchingEntries].sort((a: any, b: any) => {
          const aVersion = `${a?.resource?.version || ''}`;
          const bVersion = `${b?.resource?.version || ''}`;
          const aReleaseDate = aVersion.split('/version/')[1] || '';
          const bReleaseDate = bVersion.split('/version/')[1] || '';

          return bReleaseDate.localeCompare(aReleaseDate) || bVersion.localeCompare(aVersion);
        })[0];

        return latestEntry?.resource?.version || knownVersionedUri;
      }),
      catchError(() => of(knownVersionedUri))
    );
  }

  getCodeSystem(version: string) {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem?version=${version}`;
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getCodeSystem', {}))
      );
  }

  getValueSetExpansionUrl(ecl: string, terms: string, offset?: number, count?:number) {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (typeof terms != 'string') {
      terms = '';
    }
    let langParam = this.getComputedLanguageContext();
    return `${this.snowstormFhirBase}/ValueSet/$expand?url=${this.fhirUrlParam}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${langParam}&displayLanguage=${langParam}`;
  }

  getDerivativesValueSetExpansionUrl(ecl: string, terms: string, offset?: number, count?:number) {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (typeof terms != 'string') {
      terms = '';
    }
    let langParam = this.getComputedLanguageContext();
    const derivativesUri = 'http://snomed.info/sct/705115006';
    return `${this.snowstormFhirBase}/ValueSet/$expand?url=${derivativesUri}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${langParam}&displayLanguage=${langParam}`;
  }

  expandDerivativesValueSet(ecl: string, terms: string, offset?: number, count?:number): Observable<any> {
    let requestUrl = this.getDerivativesValueSetExpansionUrl(ecl, terms, offset, count);
    const headers = new HttpHeaders({
      'Accept-Language': this.getComputedLanguageContext()
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  expandValueSet(ecl: string, terms: string, offset?: number, count?:number): Observable<any> {
    let requestUrl = this.getValueSetExpansionUrl(ecl, terms, offset, count);
    const headers = new HttpHeaders({
      'Accept-Language': this.getComputedLanguageContext()
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  getAlternateIdentifiers(conceptId: string, fhirBase?: string) {
    // This uses the native API
    // Use provided fhirBase or default to snowstormFhirBase
    const baseUrl = fhirBase || this.snowstormFhirBase;
    let requestUrl = baseUrl.replace('fhir', 'snowstorm/snomed-ct/browser/MAIN/LOINC/concepts/' + conceptId);
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(map(response => response.alternateIdentifiers || []), // Extract only alternateIdentifiers, default to empty array
        catchError(this.handleError<any>('getAlternateIdentifiers', [])) // Handle errors and return an empty array if needed
      );
  }

  getValueSetFromExpansion(expansion: any): any {
    let valueset: { resourceType: string; parameter: any[] } = {
      resourceType: 'Parameters',
      parameter: []
    };

    // Initialize the ValueSet structure
    let valueSetResource = {
      resourceType: 'ValueSet',
      status: 'draft',
      experimental: true,
      compose: {
        include: [
          {
            system: 'http://snomed.info/sct',
            version: this.fhirUrlParam,
            concept: [] as { code: string; }[] // Explicitly define the type
          }
        ]
      }
    };

    // Add all concepts from the expansion to the concept array
    if (expansion?.contains) {
      expansion.contains.forEach((concept: any) => {
        valueSetResource.compose.include[0].concept.push({
          code: concept.code
        });
      });
    }

    // Add the ValueSet resource to the parameters
    valueset.parameter.push({
      name: 'valueSet',
      resource: valueSetResource
    });

    return valueset; // Return the valueset object
  }

  expandInlineValueSet(inlineValueSet: any): Observable<any> {
    // For inline expansion, the edition is carried in compose.include.version
    // inside the posted ValueSet payload.
    const requestUrl = `${this.snowstormFhirBase}/ValueSet/$expand`;
    const acceptLanguage = this.getComputedLanguageContext();
    const httpOptions = {
      headers: new HttpHeaders({
          'Content-Type': 'application/fhir+json', // FHIR JSON content type
          'Accept-Language': acceptLanguage,
      })
  };
    return this.http.post<any>(requestUrl, inlineValueSet, httpOptions)
      .pipe(
        catchError(this.handleError<any>('expandInlineValueSet', {}))
      );
  }

  expandInlineValueSetFromServer(fhirBase: string, inlineValueSet: any, acceptLanguage?: string): Observable<any> {
    const requestUrl = `${fhirBase || this.snowstormFhirBase}/ValueSet/$expand`;
    const resolvedLanguage = acceptLanguage || this.getComputedLanguageContext();
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/fhir+json',
        'Accept-Language': resolvedLanguage,
      })
    };

    return this.http.post<any>(requestUrl, inlineValueSet, httpOptions)
      .pipe(
        catchError(this.handleError<any>('expandInlineValueSetFromServer', {}))
      );
  }

  getLanguageRefsets(moduleId?: string) {
    let requestUrl = `${this.snowstormFhirBase}/ValueSet/$expand?url=${this.fhirUrlParam}?fhir_vs=ecl/<< 900000000000506000`;
    if (moduleId) {
      requestUrl += ` {{ C moduleId = ${moduleId} }}`;
    }
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getLanguageRefsets', {}))
      );
  }

  expandValueSetUsingCache(ecl: string, terms: string, offset?: number, count?: number): Observable<any> {
      const requestUrl = this.getValueSetExpansionUrl(ecl, terms, offset, count); 
      const cachedResponse = this.expandValuesetCache.get(requestUrl);

      if (cachedResponse && (Date.now() - cachedResponse.timestamp) < this.CACHE_DURATION) {
        // Move accessed item to end (LRU behavior)
        this.expandValuesetCache.delete(requestUrl);
        this.expandValuesetCache.set(requestUrl, cachedResponse);
        this.saveCache(); // Save changes
        return of(cachedResponse.data);
      }
      const headers = new HttpHeaders({
        'Accept-Language': this.getComputedLanguageContext()
      });
      return this.http.get<any>(requestUrl, { headers }).pipe(
        tap((response: any) => {
          this.manageCacheLimit();
          this.expandValuesetCache.set(requestUrl, { timestamp: Date.now(), data: response });
          this.saveCache(); // Persist cache to localStorage
        }),
        catchError(this.handleError<any>('expandValueSet', {}))
      );
    }
  
    private manageCacheLimit(): void {
      if (this.expandValuesetCache.size >= this.CACHE_LIMIT) {
        // Remove the oldest entry
        const oldestKey = this.expandValuesetCache.keys().next().value;
        if (oldestKey) this.expandValuesetCache.delete(oldestKey);
      }
    }
  
    private saveCache(): void {
      try {
        const cacheArray = Array.from(this.expandValuesetCache.entries());
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheArray));
      } catch (error) {
        // Cache save failed - continue without caching
      }
    }
  
    private loadCache(): void {
      try {
        const cacheData = localStorage.getItem(this.CACHE_KEY);
        if (cacheData) {
          const parsedData: [string, { timestamp: number, data: any }][] = JSON.parse(cacheData);
          this.expandValuesetCache = new Map(parsedData);
        }
      } catch (error) {
        // Cache load failed - continue without cache
      }
    }

  translate(conceptMapId: string, code: string, system?: string) {
    if (!system) system = this.defaultFhirUrlParam;
    let requestUrl = `${this.snowstormFhirBase}/ConceptMap/$translate?url=http://snomed.info/sct?fhir_cm=${conceptMapId}&code=${code}&system=${system}`;
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('translate', {}))
      );
  }

  expandValueSetFromServer(
    fhirBase: string,
    fhirUrl: string,
    ecl: string,
    terms: string,
    offset?: number,
    count?:number,
    languageOverride?: string
  ): Observable<any> {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (!fhirBase) fhirBase = this.snowstormFhirBase;
    if (!fhirUrl) fhirUrl = this.fhirUrlParam;
    if (typeof terms != 'string') {
      terms = '';
    }
    // Calculate language context on-the-fly based on the edition being queried
    let langParam = languageOverride || this.computedLanguageContextForUri(fhirUrl);
    // For LOINC SNOMED server, use simpler language parameter (just 'en' instead of language refset)
    const isLoincSnomedServer = fhirBase.includes('loincsnomed');
    const languageParam = isLoincSnomedServer ? 'en' : langParam;
    let requestUrl = `${fhirBase}/ValueSet/$expand?url=${encodeURIComponent(fhirUrl)}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${encodeURIComponent(terms)}&language=${languageParam}&displayLanguage=${languageParam}`;
    const headers = new HttpHeaders({
      'Accept-Language': languageParam
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  /**
   * Expands a FHIR ValueSet by canonical `url=` (no ECL). Defaults to this app terminology base when omitted.
   */
  expandValueSetByUrl(valuesetUrl: string, fhirBase?: string, filter?: string, offset?: number, count?: number): Observable<any> {
    if (!offset) offset = 0;
    if (!count) count = 1000;
    if (!fhirBase) fhirBase = this.snowstormFhirBase || 'https://tx.fhir.org/r4';
    if (!filter) filter = '';

    const base = fhirBase.replace(/\/$/, '');
    let requestUrl = `${base}/ValueSet/$expand?url=${encodeURIComponent(valuesetUrl)}&count=${count}&offset=${offset}`;
    if (filter) {
      requestUrl += `&filter=${encodeURIComponent(filter)}`;
    }

    const lang = this.getComputedLanguageContext();
    const headers = new HttpHeaders({
      Accept: 'application/fhir+json',
      'Accept-Language': lang,
    });

    return this.http.get<any>(requestUrl, { headers }).pipe(
      catchError(this.handleError<any>('expandValueSetByUrl', {}))
    );
  }

  /**
   * Expands answer options for a sandbox binding (ECL-backed or canonical ValueSet URL).
   */
  expandBindingAnswerValueSet(
    binding: { ecl?: string; valueSetUrl?: string },
    filter: string,
    offset?: number,
    count?: number,
    terminologyServer?: string,
    editionUri?: string,
    useExpansionCache?: boolean
  ): Observable<any> {
    if (!offset) offset = 0;
    if (!count) count = 20;
    const vsUrl = binding?.valueSetUrl?.trim();
    if (vsUrl) {
      const fhirBase = (terminologyServer || this.snowstormFhirBase || '').replace(/\/$/, '');
      if (!fhirBase) {
        return of({});
      }
      return this.expandValueSetByUrl(vsUrl, fhirBase, filter, offset, count);
    }
    const ecl = binding?.ecl ?? '';
    if (!ecl) {
      return of({});
    }
    const terms = typeof filter === 'string' ? filter : '';
    if (terminologyServer || editionUri) {
      return this.expandValueSetFromServer(
        terminologyServer || '',
        editionUri || '',
        ecl,
        terms,
        offset,
        count
      );
    }
    if (useExpansionCache && !terms && offset === 0) {
      return this.expandValueSetUsingCache(ecl, terms, offset, count);
    }
    return this.expandValueSet(ecl, terms, offset, count);
  }

  /**
   * Lists ValueSet resources (`url`, `title`) from a FHIR server. Session-scoped cache; one in-flight request per key.
   * @param refresh When true, drops cache and in-flight entry for this key and fetches from the server again.
   */
  fetchValueSets(fhirBase?: string, maxCount = 500, refresh = false): Observable<ValueSetSummary[]> {
    const base = (fhirBase || this.snowstormFhirBase || '').replace(/\/$/, '');
    if (!base) {
      return of([]);
    }
    const cacheKey = `${base}|${maxCount}`;
    if (refresh) {
      this.valueSetsListCache.delete(cacheKey);
      this.valueSetsListInFlight.delete(cacheKey);
    }
    if (!refresh && this.valueSetsListCache.has(cacheKey)) {
      return of(this.valueSetsListCache.get(cacheKey)!);
    }
    const existing = this.valueSetsListInFlight.get(cacheKey);
    if (existing && !refresh) {
      return existing;
    }
    const headers = new HttpHeaders({
      Accept: 'application/fhir+json',
      'Accept-Language': this.lang,
    });
    const requestUrl = `${base}/ValueSet?_count=${maxCount}&_elements=url,title,name`;
    const shared$ = this.http.get<any>(requestUrl, { headers }).pipe(
      map((bundle) => this.parseValueSetBundle(bundle)),
      tap((list) => {
        this.valueSetsListCache.set(cacheKey, list);
      }),
      catchError(() => of([])),
      finalize(() => {
        this.valueSetsListInFlight.delete(cacheKey);
      }),
      shareReplay(1)
    );
    this.valueSetsListInFlight.set(cacheKey, shared$);
    return shared$;
  }

  private parseValueSetBundle(bundle: any): ValueSetSummary[] {
    const out: ValueSetSummary[] = [];
    const seen = new Set<string>();
    for (const entry of bundle?.entry || []) {
      const r = entry?.resource;
      if (!r || r.resourceType !== 'ValueSet' || !r.url) {
        continue;
      }
      if (seen.has(r.url)) {
        continue;
      }
      seen.add(r.url);
      const title = (r.title || r.name || r.url) as string;
      out.push({ url: r.url, title });
    }
    return out;
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5 * 1000,
        data: error.message,
        panelClass: ['red-snackbar']
      });
      // TODO: send the error to remote logging infrastructure
      // TODO: better job of transforming error for user consumption
  
      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  private conceptCache = new Map<string, any>();

  lookupConcept(conceptId: string, version?: string) {
    if (!version) version = this.fhirUrlParam;
    const cacheKey = `${version}:${conceptId}`;
    const cachedConcept = this.conceptCache.get(cacheKey);
    if (cachedConcept) {
      return of(cachedConcept);
    }
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/$lookup?system=http://snomed.info/sct&code=${conceptId}&property=normalForm`;
    if (version != 'http://snomed.info/sct') {
      requestUrl += `&version=${version}`;
    }
    // Define HttpHeaders, including Accept-Language
    const httpOptions = {
      headers: new HttpHeaders({
        'Accept-Language': this.lang // Set the desired language here
      })
    };
  
    return this.http.get<any>(requestUrl, httpOptions).pipe( // Add httpOptions to the request
      tap((concept: any) => {
        this.conceptCache.set(cacheKey, concept);
      }),
      catchError(this.handleError<any>('lookupConcept', {}))
    );
  }
  

  getMRCMAttributes(conceptId: string) {
    // https://snowstorm.ihtsdotools.org/snowstorm/snomed-ct/mrcm/MAIN/domain-attributes?parentIds=195967001&proximalPrimitiveModeling=false&contentType=POSTCOORDINATED
    let requestUrl = `${this.snowstormFhirBase.replace('fhir','snowstorm/snomed-ct')}mrcm/MAIN/domain-attributes?parentIds=${conceptId}&proximalPrimitiveModeling=false&contentType=POSTCOORDINATED`;
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
    .pipe(
      catchError(this.handleError<any>('getMRCMAttributes', {}))
    );
  }

  addPostcoordinatedExpression(expression: string) {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/sct_11000003104_EXP`;
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/fhir+json',
        'Accept-Language': this.lang
      })
    };
    return this.http.patch<any>(requestUrl, {resourceType: "CodeSystem", concept: [ { code: expression} ] }, httpOptions)
    .pipe(
      catchError(this.handleError<any>('addPostcoordinatedExpression', {}))
    );
  }

  runEclLegacy(ecl: string) {
    // https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-ES/2022-10-31/concepts?offset=0&limit=100&termActive=true&ecl=%5E%5B*%5D%20447562003%20%7CICD-10%20complex%20map%20reference%20set%7C%20%7B%7B%20M%20referencedComponentId%20%3D%20%22782513000%22%20%7D%7D
    // https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-ES/2022-10-31/concepts?offset=0&limit=100&termActive=true&ecl=^[*]%20447562003%20|ICD-10%20complex%20map%20reference%20set|%20{{%20M%20referencedComponentId%20=%20%22195967001%22%20}}
    let requestUrl = `https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-ES/2022-10-31/concepts?offset=0&limit=100&termActive=true&ecl=${encodeURIComponent(ecl)}`
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  getIcd10MapTargets(code: string) {
    let requestUrl = `${this.snowstormFhirBase}/ConceptMap/$translate?code=${code}&system=http://snomed.info/sct&targetSystem=http://hl7.org/fhir/sid/icd-10`
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('translate', {}))
      );
  }

  getMedraMapTargets(code: string) {
    // Use native Snowstorm API for MedDRA mappings from SNOMED CT derivatives
    // Reference set 816210007 contains MedDRA mappings
    const baseUrl = 'https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-DERIVATIVES/2025-01-01/members';
    let requestUrl = `${baseUrl}?referencedComponentId=${code}&referenceSet=816210007&active=true&limit=100`;
    
    const headers = new HttpHeaders({
      'Accept': 'application/json'
    });
    
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        map(response => this.transformMedraResponse(response)),
        catchError(this.handleError<any>('medra-mappings', { items: [] }))
      );
  }

  private transformMedraResponse(response: any): any {
    // Transform Snowstorm API response to match expected format
    
    if (!response || !response.items || !Array.isArray(response.items)) {
      return { parameter: [] };
    }

    const parameters = response.items
      .filter((item: any) => {
        const hasMapping = item.additionalFields?.mapTarget;
        return hasMapping;
      })
      .map((item: any) => {
        const transformed = {
          name: 'concept',
          valueCoding: {
            code: item.additionalFields.mapTarget,
            display: item.referencedComponent?.pt?.term || item.referencedComponent?.fsn?.term || 'Unknown MedDRA term',
            system: 'http://www.meddra.org'
          }
        };
        return transformed;
      });

    return { parameter: parameters };
  }

  lookupOtherCodeSystems(system: string, code: string) {
    // {{url}}/CodeSystem/$lookup?system=http://hl7.org/fhir/sid/icd-10&code=A01.0
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/$lookup?system=${system}&code=${code}`
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('lookup', {}))
      );
  }

  lookupConceptFromServer(fhirBase: string, system: string, code: string, version?: string, properties?: string[]): Observable<any> {
    if (!fhirBase) fhirBase = this.snowstormFhirBase;
    if (!system) system = 'http://snomed.info/sct';
    
    let requestUrl = `${fhirBase}/CodeSystem/$lookup?system=${encodeURIComponent(system)}&code=${encodeURIComponent(code)}`;
    
    if (version && version !== 'http://snomed.info/sct') {
      requestUrl += `&version=${encodeURIComponent(version)}`;
    }
    
    // For SNOMED CT, always add normalForm property
    if (system === 'http://snomed.info/sct') {
      requestUrl += `&property=normalForm`;
    }
    
    // Add additional properties if specified
    if (properties && properties.length > 0) {
      properties.forEach(property => {
        requestUrl += `&property=${encodeURIComponent(property)}`;
      });
    }
    
    // For LOINC SNOMED server, use simpler language parameter (just 'en' instead of language refset)
    const isLoincSnomedServer = fhirBase.includes('loincsnomed');
    const languageParam = isLoincSnomedServer ? 'en' : this.getComputedLanguageContext();
    
    const headers = new HttpHeaders({
      'Accept-Language': languageParam,
      'Accept': 'application/fhir+json'
    });
    
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('lookupConceptFromServer', {}))
      );
  }

  getNormalForm(concept: any): string {
    if (concept.parameter) {
      for (let param of concept.parameter) {
        let found = false;
        if (param.name == 'property') {
          for (let part of param.part) {
            if (part.name == 'code' && part.valueString == 'normalForm') {
              found = true;
            }
          }
          if (found) {
            for (let part of param.part) {
              if (part.name == 'valueString') {
                return part.valueString;
              }
            }
          }
        }
      }
    }
    return '';
  }

  parseNormmalForm(input: string): NormalForm {
    const groups: Relationship[][] = [];
    const relationshipBlocks = input.split('} {');
  
    relationshipBlocks.forEach((block) => {
      const relationships = block.match(/\d+\|[^\|]+\|\s*=\s*\d+\|[^\|]+\|/g);
      if (!relationships) return;
  
      const group: Relationship[] = relationships.map((relationship) => {
        const [typePart, targetPart] = relationship.split('=').map(part => part.trim());
        const [typeCode, typeDisplay] = typePart.split('|').map(part => part.trim());
        const [targetCode, targetDisplay] = targetPart.split('|').map(part => part.trim());
  
        return {
          type: { code: typeCode, display: typeDisplay.replace(/\(.*\)/, '').trim() },
          target: { code: targetCode, display: targetDisplay } // .replace(/\(.*\)/, '').trim()
        };
      });
  
      groups.push(group);
    });
  
    return { groups };
  }

  getMemberships(conceptId: string) {
    // https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-DERIVATIVES/2024-07-01/members?referencedComponentId=195967001&active=true
    let requestUrl = `https://browser.ihtsdotools.org/snowstorm/snomed-ct/MAIN/SNOMEDCT-DERIVATIVES/2025-01-01/members?referencedComponentId=${conceptId}&active=true`;
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getMemberships', {}))
      );
    }

  getNativeCodeSystems() {
    // Use the configured FHIR server URL and replace /fhir with /snowstorm/snomed-ct
    const snowstormBase = this.snowstormFhirBase.replace('/fhir', '/snowstorm/snomed-ct');
    let requestUrl = `${snowstormBase}/codesystems`;
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getNativeCodeSystems', {}))
      );
  }

  getFhirCodeSystems() {
    // Use the configured FHIR server URL to get CodeSystems
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem`;
    const headers = new HttpHeaders({
      'Accept': 'application/fhir+json',
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('getFhirCodeSystems', {}))
      );
  }

  /**
   * Creates a FHIR ValueSet Parameters resource from a list of codes
   * @param codes Array of objects containing code and optional display
   * @param system Optional coding system (defaults to SNOMED CT)
   * @returns FHIR Parameters resource containing a ValueSet
   */
  getValueSetFromCodes(codes: CodeDisplay[], system: string = 'http://snomed.info/sct'): any {
    let valueset: { resourceType: string; parameter: any[] } = {
      resourceType: 'Parameters',
      parameter: []
    };

    // Filter out invalid codes
    const validCodes = codes.filter(code => 
      code.code && 
      code.code !== 'undefined' && 
      code.code !== 'null' && 
      code.code !== '' &&
      (!code.display || (
        code.display !== 'undefined' && 
        code.display !== 'null' && 
        code.display !== ''
      ))
    );

    // Initialize the ValueSet structure
    let valueSetResource = {
      resourceType: 'ValueSet',
      status: 'draft',
      experimental: true,
      compose: {
        include: [
          {
            system: system,
            version: this.fhirUrlParam,
            concept: validCodes.map(code => ({
              code: code.code,
              ...(code.display && { display: code.display })
            }))
          }
        ]
      }
    };

    // Add the ValueSet resource to the parameters
    valueset.parameter.push({
      name: 'valueSet',
      resource: valueSetResource
    });

    return valueset;
  }

  postValueSetToFhirServer(valueSet: any, fhirServerUrl: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    });

    // Ensure the URL ends with /ValueSet
    const url = fhirServerUrl.endsWith('/ValueSet') ? 
      fhirServerUrl : 
      `${fhirServerUrl}${fhirServerUrl.endsWith('/') ? '' : '/'}ValueSet`;

    return this.http.post<any>(url, valueSet, { headers }).pipe(
      catchError(this.handleError<any>('postValueSetToFhirServer', {}))
    );
  }

  setEditionsDetails(editionsDetails: any[]) {
    this.editionsDetails$.next(editionsDetails);
  }

  setLanguages(languages: string[]) {
    this.languages$.next(languages);
  }

  setFilteredLanguageMetadata(metadata: any) {
    this.filteredLanguageMetadata$.next(metadata);
    this.contexts$.next(metadata?.contexts || []);
  }

  /**
   * Extract the base edition URI from a fhirUrl (removing /version/YYYYMMDD)
   * e.g. "http://snomed.info/sct/11000221109/version/20251120" -> "http://snomed.info/sct/11000221109"
   */
  private extractEditionUri(fhirUrl: string): string {
    if (!fhirUrl || typeof fhirUrl !== 'string') return '';
    if (fhirUrl.includes('/version/')) {
      const parts = fhirUrl.split('/version/');
      return parts[0];
    }
    return fhirUrl;
  }

  /**
   * Compute the appropriate language context for a specific edition URI.
   * Returns the first available languageDialects from the edition's contexts,
   * or falls back to the global computed language context if not found.
   * Always prepends "en," to ensure English fallback.
   */
  computedLanguageContextForUri(fhirUrl: string): string {
    const editionUri = this.extractEditionUri(fhirUrl);
    let langContext: string;
    if (!editionUri || !this.languageMetadata?.editions?.length) {
      langContext = this.getComputedLanguageContext();
    } else {
      const edition = this.languageMetadata.editions.find(
        (e: any) => e.moduleUri === editionUri
      );
      if (edition?.contexts?.length > 0) {
        langContext = edition.contexts[0].languageDialects || this.getComputedLanguageContext();
      } else {
        langContext = this.getComputedLanguageContext();
      }
    }
    // Prepend "en," if not already starting with "en"
    if (!langContext.startsWith('en')) {
      return 'en,' + langContext;
    }
    return langContext;
  }

  getContextsForEdition(fhirUrl: string): any[] {
    const editionUri = this.extractEditionUri(fhirUrl);
    const edition = this.languageMetadata?.editions?.find(
      (e: any) => e.moduleUri === editionUri
    );

    const contexts = Array.isArray(edition?.contexts) ? [...edition.contexts] : [];
    const hasUsEnglish = contexts.some((context: any) => context?.languageDialects === 'en-X-900000000000509007');
    if (!hasUsEnglish) {
      contexts.push({ name: 'US English', languageDialects: 'en-X-900000000000509007' });
    }

    return contexts;
  }

  /**
   * Get all ancestors of a SNOMED CT concept using ECL
   * @param conceptId The SNOMED CT concept ID
   * @returns Observable with ancestors expansion
   */
  getAncestors(conceptId: string): Observable<any> {
    const ecl = `> ${conceptId}`;  // ECL to get all ancestors
    return this.expandValueSet(ecl, '', 0, 1000);
  }
}
