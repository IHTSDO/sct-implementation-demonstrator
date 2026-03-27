import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class FhirService {
  static readonly DEFAULT_BASE_URL = 'http://hapi.fhir.org/baseR4';
  private static readonly BASE_URL_STORAGE_KEY = 'baseUrl';
  private static readonly RECENT_BASE_URLS_STORAGE_KEY = 'recentBaseUrls';
  private static readonly MAX_RECENT_BASE_URLS = 6;

  private baseUrlSubject = new BehaviorSubject<string>(FhirService.DEFAULT_BASE_URL);
  baseUrl$ = this.baseUrlSubject.asObservable();
  private capabilityStatementCache = new Map<string, Observable<any>>();
  private patientSummarySupportCache = new Map<string, Observable<boolean>>();

  private userTagSubject = new BehaviorSubject<string>('');
  userTag$ = this.userTagSubject.asObservable();
  
  constructor(private http: HttpClient, private storageService: StorageService) {
    this.initialize();
  }
  
  private initialize(): void {
    if (this.storageService.isLocalStorageSupported()) {
      const baseUrl = this.storageService.getItem(FhirService.BASE_URL_STORAGE_KEY);
      if (baseUrl) {
        this.baseUrlSubject.next(this.normalizeBaseUrl(baseUrl));
      }
      const userTag = this.storageService.getItem('userTag');
      if (userTag) {
        this.userTagSubject.next(userTag);
      }

      this.saveRecentBaseUrls(this.buildRecentBaseUrls(this.baseUrlSubject.value, this.readStoredRecentBaseUrls()));
    }
  }

  setBaseUrl(url: string): void {
    const normalizedUrl = this.normalizeBaseUrl(url);
    this.baseUrlSubject.next(normalizedUrl);
    this.storageService.saveItem(FhirService.BASE_URL_STORAGE_KEY, normalizedUrl);
    this.saveRecentBaseUrls(this.buildRecentBaseUrls(normalizedUrl, this.readStoredRecentBaseUrls()));
  }

  getBaseUrl(): string {
    return this.baseUrlSubject.getValue();
  }

  getRecentBaseUrls(): string[] {
    return this.buildRecentBaseUrls(this.getBaseUrl(), this.readStoredRecentBaseUrls());
  }

  setUserTag(tag: string): void {
    this.userTagSubject.next(tag);
    this.storageService.saveItem('userTag', tag);
  }

  getUserTag(): string {
    return this.userTagSubject.getValue();
  }

  private buildUrl(resourceType: string, id?: string): string {
    const normalizedBase = this.baseUrlSubject.value.replace(/\/$/, '');
    return id ? `${normalizedBase}/${resourceType}/${id}` : `${normalizedBase}/${resourceType}`;
  }

  private buildOperationUrl(resourceType: string, id: string, operationName: string): string {
    return `${this.buildUrl(resourceType, id)}/${operationName}`;
  }

  private buildMetadataUrl(): string {
    const normalizedBase = this.baseUrlSubject.value.replace(/\/$/, '');
    return `${normalizedBase}/metadata`;
  }

  private buildParams(params?: Record<string, string | number | boolean | undefined | null>): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      httpParams = httpParams.set(key, String(value));
    });

    return httpParams;
  }

  search(resourceType: string, params?: Record<string, string | number | boolean | undefined | null>): Observable<any> {
    return this.http.get(this.buildUrl(resourceType), {
      params: this.buildParams(params)
    });
  }

  searchByUrl(url: string): Observable<any> {
    return this.http.get(url);
  }

  read(resourceType: string, id: string): Observable<any> {
    return this.http.get(this.buildUrl(resourceType, id));
  }

  operation(
    resourceType: string,
    id: string,
    operationName: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Observable<any> {
    return this.http.get(this.buildOperationUrl(resourceType, id, operationName), {
      params: this.buildParams(params)
    });
  }

  patientEverything(
    patientId: string,
    params?: Record<string, string | number | boolean | undefined | null>
  ): Observable<any> {
    return this.operation('Patient', patientId, '$everything', params);
  }

  getCapabilityStatement(forceRefresh = false): Observable<any> {
    const baseUrl = this.getBaseUrl();
    if (forceRefresh) {
      this.capabilityStatementCache.delete(baseUrl);
      this.patientSummarySupportCache.delete(baseUrl);
    }

    const cached = this.capabilityStatementCache.get(baseUrl);
    if (cached) {
      return cached;
    }

    const request$ = this.http.get(this.buildMetadataUrl()).pipe(
      shareReplay(1)
    );

    this.capabilityStatementCache.set(baseUrl, request$);
    return request$;
  }

  supportsPatientSummary(forceRefresh = false): Observable<boolean> {
    const baseUrl = this.getBaseUrl();
    if (forceRefresh) {
      this.patientSummarySupportCache.delete(baseUrl);
    }

    const cached = this.patientSummarySupportCache.get(baseUrl);
    if (cached) {
      return cached;
    }

    const support$ = this.getCapabilityStatement(forceRefresh).pipe(
      map((statement) => {
        const resources = statement?.rest?.flatMap((restBlock: any) => restBlock?.resource || []) || [];
        const patientResource = resources.find((resource: any) => resource?.type === 'Patient');
        const operations = patientResource?.operation || [];
        return operations.some((operation: any) => {
          const operationName = String(operation?.name || '').toLowerCase();
          const operationDefinition = String(operation?.definition || '').toLowerCase();
          return operationName === 'summary'
            || operationName === '$summary'
            || operationDefinition.includes('summary');
        });
      }),
      catchError(() => of(false)),
      shareReplay(1)
    );

    this.patientSummarySupportCache.set(baseUrl, support$);
    return support$;
  }

  create(resourceType: string, resource: any): Observable<any> {
    return this.http.post(this.buildUrl(resourceType), resource);
  }

  executeTransaction(bundle: any): Observable<any> {
    const normalizedBase = this.baseUrlSubject.value.replace(/\/$/, '');
    return this.http.post(normalizedBase, bundle);
  }

  update(resourceType: string, id: string, resource: any): Observable<any> {
    return this.http.put(this.buildUrl(resourceType, id), resource);
  }

  delete(resourceType: string, id: string): Observable<any> {
    return this.http.delete(this.buildUrl(resourceType, id));
  }

  // POST a questionnaire
  postQuestionnaire(questionnaire: any) {
    return this.http.post(`${this.baseUrlSubject.value}/Questionnaire`, questionnaire);
  }

  // Retrieve questionnaires by tag
  getQuestionnairesByTag(tag: string, count?: number) {
    if (!count) {
      count = 100;
    }
    return this.http.get(`${this.baseUrlSubject.value}/Questionnaire?_tag=${tag}&_count=${count}`);
  }

  tagQuestionnaire(id: string, tag: string) {
    return this.http.post(`${this.baseUrlSubject.value}/Questionnaire/${id}/$meta-add`, {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'meta',
          valueMeta: {
            tag: [
              {
                system: 'http://snomed.org/tags',
                code: tag
              }
            ]
          }
        }
      ]
    });
  }

  deleteQuestionnaire(id: string) {
    return this.http.delete(`${this.baseUrlSubject.value}/Questionnaire/${id}`);
  }

  // Attempt to update, and if not found, create a new Questionnaire
  updateOrCreateQuestionnaire(questionnaire: any, tag: string) {
    if (!questionnaire.id) {
      return this.postQuestionnaire(questionnaire);
    } else {
      const conditionalUrl = `${this.baseUrlSubject.value}/Questionnaire?_id=${questionnaire.id}&_tag=${tag}`;
      return this.http.put(conditionalUrl, questionnaire).pipe(
        catchError(error => {
          // Check if the error indicates that no matching resource was found
          if (error.status === 404) {
            // Create a new Questionnaire resource
            return this.postQuestionnaire(questionnaire);
          } else {
            // If the error is not a 404, rethrow it
            return throwError(error);
          }
        })
      );
    }
    
  }

  // Retrieve all previous versions of a specific questionnaire
  getQuestionnaireHistory(questionnaireId: string) {
    return this.http.get(`${this.getBaseUrl()}/Questionnaire/${questionnaireId}/_history`);
  }

  getSpecificQuestionnaireVersion(questionnaireId: string, versionId: string) {
    return this.http.get(`${this.getBaseUrl()}/Questionnaire/${questionnaireId}/_history/${versionId}`);
  }

  private normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/$/, '');
  }

  private readStoredRecentBaseUrls(): string[] {
    const rawValue = this.storageService.getItem(FhirService.RECENT_BASE_URLS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => this.normalizeBaseUrl(value));
    } catch {
      return [];
    }
  }

  private saveRecentBaseUrls(urls: string[]): void {
    this.storageService.saveItem(FhirService.RECENT_BASE_URLS_STORAGE_KEY, JSON.stringify(urls));
  }

  private buildRecentBaseUrls(currentUrl: string, recentUrls: string[]): string[] {
    const normalizedCurrentUrl = this.normalizeBaseUrl(currentUrl || FhirService.DEFAULT_BASE_URL);
    const normalizedDefaultUrl = this.normalizeBaseUrl(FhirService.DEFAULT_BASE_URL);
    const uniqueUrls = [normalizedCurrentUrl, ...recentUrls]
      .map((url) => this.normalizeBaseUrl(url))
      .filter((url, index, allUrls) => !!url && allUrls.indexOf(url) === index)
      .filter((url) => url !== normalizedDefaultUrl)
      .slice(0, FhirService.MAX_RECENT_BASE_URLS);

    return [...uniqueUrls, normalizedDefaultUrl];
  }

}
