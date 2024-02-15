import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, of, tap } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorComponent } from '../alerts/http-error';
import { SnackAlertComponent } from '../alerts/snack-alert';


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

@Injectable({
  providedIn: 'root'
})

export class TerminologyService {
  

  snowstormFhirBase = 'https://snowstorm.ihtsdotools.org/fhir';
  defaultFhirUrlParam = 'http://snomed.info/sct'; // 'http://snomed.info/sct/11000221109/version/20211130'
  fhirUrlParam = this.defaultFhirUrlParam;
  lang = 'en';

  constructor(private http: HttpClient, private _snackBar: MatSnackBar) { }

  setSnowstormFhirBase(url: string) {
    this.snowstormFhirBase = url;
  }
  
  setFhirUrlParam(url: string) {
    this.fhirUrlParam = url;
  }

  getFhirUrlParam() {
    return this.fhirUrlParam;
  }

  setLang(lang: string) {
    this.lang = lang;
  }

  getCodeSystems() {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem`;
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('getCodeSystems', {}))
      );
  }

  getValueSetExpansionUrl(ecl: string, terms: string, offset?: number, count?:number) {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (typeof terms != 'string') {
      terms = '';
    }
    return `${this.snowstormFhirBase}/ValueSet/$expand?url=${this.fhirUrlParam}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${this.lang}&displayLanguage=${this.lang}`;
  }

  expandValueSet(ecl: string, terms: string, offset?: number, count?:number): Observable<any> {
    let requestUrl = this.getValueSetExpansionUrl(ecl, terms, offset, count);
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  translate(conceptMapId: string, code: string, system?: string) {
    if (!system) system = this.defaultFhirUrlParam;
    let requestUrl = `${this.snowstormFhirBase}/ConceptMap/$translate?url=http://snomed.info/sct?fhir_cm=${conceptMapId}&code=${code}&system=${system}`;
    return this.http.get<any>(requestUrl)
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
    let requestUrl = `${fhirBase}/ValueSet/$expand?url=${fhirUrl}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${this.lang}&displayLanguage=${this.lang}`;
    return this.http.get<any>(requestUrl)
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

  lookupConcept(conceptId: string, system?: string) {
    if (!system) system = this.fhirUrlParam;
    const cacheKey = `${system}:${conceptId}`;
    const cachedConcept = this.conceptCache.get(cacheKey);
    if (cachedConcept) {
      return of(cachedConcept);
    }
    const requestUrl = `${this.snowstormFhirBase}/CodeSystem/$lookup?system=${system}&code=${conceptId}&property=normalForm`;
  
    // Define HttpHeaders, including Accept-Language
    const httpOptions = {
      headers: new HttpHeaders({
        'Accept-Language': 'en' // Set the desired language here
      })
    };
  
    return this.http.get<any>(requestUrl, httpOptions).pipe( // Add httpOptions to the request
      tap(concept => {
        this.conceptCache.set(cacheKey, concept);
      }),
      catchError(this.handleError<any>('lookupConcept', {}))
    );
  }
  

  getMRCMAttributes(conceptId: string) {
    // https://snowstorm.ihtsdotools.org/snowstorm/snomed-ct/mrcm/MAIN/domain-attributes?parentIds=195967001&proximalPrimitiveModeling=false&contentType=POSTCOORDINATED
    let requestUrl = `${this.snowstormFhirBase.replace('fhir','snowstorm/snomed-ct')}mrcm/MAIN/domain-attributes?parentIds=${conceptId}&proximalPrimitiveModeling=false&contentType=POSTCOORDINATED`;
    return this.http.get<any>(requestUrl)
    .pipe(
      catchError(this.handleError<any>('getMRCMAttributes', {}))
    );
  }

  addPostcoordinatedExpression(expression: string) {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/sct_11000003104_EXP`;
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type':  'application/fhir+json'
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
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  getIcd10MapTargets(code: string) {
    // https://snowstorm-fhir.snomedtools.org/fhir/ConceptMap/$translate?code=254153009&system=http://snomed.info/sct&source=http://snomed.info/sct?fhir_vs&target=http://hl7.org/fhir/sid/icd-10&url=http://snomed.info/sct/900000000000207008/version/20200131?fhir_cm=447562003
    let requestUrl = `${this.snowstormFhirBase}/ConceptMap/$translate?code=${code}&system=http://snomed.info/sct&source=http://snomed.info/sct?fhir_vs&target=http://hl7.org/fhir/sid/icd-10&url=http://snomed.info/sct/900000000000207008/version/20200131?fhir_cm=447562003`
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('translate', {}))
      );
  }

  lookupOtherCodeSystems(system: string, code: string) {
    // {{url}}/CodeSystem/$lookup?system=http://hl7.org/fhir/sid/icd-10&code=A01.0
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/$lookup?system=${system}&code=${code}`
    return this.http.get<any>(requestUrl)
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
}
