import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})

export class TerminologyService {
  
  
  snowstormFhirBase = 'https://snowstorm.ihtsdotools.org/fhir';
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

  public editionsDetails$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  public languages$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>(['da', 'de', 'en', 'es', 'et', 'fi', 'fr', 'nl', 'no', 'sv']);
  public filteredLanguageMetadata$: BehaviorSubject<any> = new BehaviorSubject<any>({ contexts: [] });
  public contexts$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);


  // For external components to subscribe to
  snowstormFhirBase$ = this.snowstormFhirBaseSubject.asObservable();
  fhirUrlParam$ = this.fhirUrlParamSubject.asObservable();
  lang$ = this.langSubject.asObservable();
  languageRefsetConcept$ = this.languageRefsetConceptSubject.asObservable();
  context$ = this.contextSubject.asObservable();
  editionName$ = this.editionNameSubject.asObservable();


  constructor(private http: HttpClient, private _snackBar: MatSnackBar) { 
    this.loadCache();
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
      return this.context.languageDialects;
    } else if (this.languageRefsetConcept) {
      return this.lang + '-X-' + this.languageRefsetConcept.code
    } else return this.lang;
  }

  getCodeSystems() {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem`;
    if (this.snowstormFhirBase.includes('ontoserver')) {
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

  getAlternateIdentifiers(conceptId: string) {
    // This uses the native API
    let requestUrl = this.snowstormFhirBase.replace('fhir', 'snowstorm/snomed-ct/browser/MAIN/LOINC/concepts/' + conceptId);
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(map(response => response.alternateIdentifiers), // Extract only alternateIdentifiers
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
    let requestUrl = `${this.snowstormFhirBase}/ValueSet/$expand`;
    const httpOptions = {
      headers: new HttpHeaders({
          'Content-Type': 'application/fhir+json', // FHIR JSON content type
          'Accept-Language': this.getComputedLanguageContext(), 
      })
  };
    return this.http.post<any>(requestUrl, inlineValueSet, httpOptions)
      .pipe(
        catchError(this.handleError<any>('expandInlineValueSet', {}))
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
        console.error('Failed to save cache:', error);
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
        console.error('Failed to load cache:', error);
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

  expandValueSetFromServer(fhirBase: string, fhirUrl: string, ecl: string, terms: string, offset?: number, count?:number): Observable<any> {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (!fhirBase) fhirBase = this.snowstormFhirBase;
    if (!fhirUrl) fhirUrl = this.fhirUrlParam;
    if (typeof terms != 'string') {
      terms = '';
    }
    let langParam = this.getComputedLanguageContext();
    let requestUrl = `${fhirBase}/ValueSet/$expand?url=${fhirUrl}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${langParam}&displayLanguage=${langParam}`;
    const headers = new HttpHeaders({
      'Accept-Language': this.getComputedLanguageContext()
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error("There was an error!");
      console.error(error);
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5 * 1000,
        data: error.message,
        panelClass: ['red-snackbar']
      });
      // TODO: send the error to remote logging infrastructure
      // console.error(error); // log to console instead
  
      // TODO: better job of transforming error for user consumption
      // console.log(`${operation} failed: ${error.message}`);
  
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
    // https://snowstorm-fhir.snomedtools.org/fhir/ConceptMap/$translate?code=254153009&system=http://snomed.info/sct&source=http://snomed.info/sct?fhir_vs&target=http://hl7.org/fhir/sid/icd-10&url=http://snomed.info/sct/900000000000207008/version/20200131?fhir_cm=447562003
    let requestUrl = `${this.snowstormFhirBase}/ConceptMap/$translate?code=${code}&system=http://snomed.info/sct&source=http://snomed.info/sct?fhir_vs&target=http://hl7.org/fhir/sid/icd-10&url=http://snomed.info/sct/900000000000207008/version/20200131?fhir_cm=447562003`
    const headers = new HttpHeaders({
      'Accept-Language': this.lang
    });
    return this.http.get<any>(requestUrl, { headers })
      .pipe(
        catchError(this.handleError<any>('translate', {}))
      );
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
   * Get all ancestors of a SNOMED CT concept using ECL
   * @param conceptId The SNOMED CT concept ID
   * @returns Observable with ancestors expansion
   */
  getAncestors(conceptId: string): Observable<any> {
    const ecl = `> ${conceptId}`;  // ECL to get all ancestors
    return this.expandValueSet(ecl, '', 0, 1000);
  }
}
