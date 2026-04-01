import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { CdsHooksServerConfig, CdsHooksServerConfigService } from './cds-hooks-server-config.service';

export interface CDSPatient {
  resourceType: 'Patient';
  id: string;
  gender: string;
  birthDate: string;
  identifier: Array<{
    type: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
      text: string;
    };
    system: string;
    value: string;
  }>;
  name: Array<{
    use: string;
    family: string;
    given: string[];
    prefix?: string[];
  }>;
}

export interface CDSCondition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
}

export interface CDSMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  authoredOn?: string;
  requester?: {
    reference: string;
  };
  reasonReference?: Array<{
    reference: string;
  }>;
  dosageInstruction?: Array<{
    sequence: number;
    timing: {
      repeat: {
        frequency: number;
        period: number;
        periodUnit: string;
      };
    };
    asNeededBoolean: boolean;
    route?: {
      text?: string;
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    doseAndRate: Array<{
      type: {
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      };
      doseQuantity: {
        value: number;
        unit?: string;
      };
    }>;
  }>;
}

export interface CDSBundle<T> {
  resourceType: 'Bundle';
  id: string;
  meta?: {
    lastUpdated: string;
  };
  type?: string;
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: Array<{
    fullUrl: string;
    resource: T;
    search?: {
      mode: string;
    };
    response?: {
      status: string;
      etag: string;
    };
  }>;
}

export interface CDSCard {
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
  };
  suggestions?: Array<{
    label: string;
    uuid?: string;
    actions?: Array<{
      type: string;
      description: string;
      resource?: unknown;
    }>;
  }>;
}

export interface CDSResponse {
  cards: CDSCard[];
}

export interface CDSDiscoveryService {
  id: string;
  hook?: string;
  title?: string;
  description?: string;
}

interface CDSDiscoveryResponse {
  services?: CDSDiscoveryService[];
}

interface LegacyCDSRequest {
  hook: 'order-page';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId: string;
    userId: string;
  };
  prefetch: {
    patient: CDSPatient;
    conditions: CDSBundle<CDSCondition>;
    draftMedicationRequests: CDSBundle<CDSMedicationRequest>;
    allergies: CDSBundle<any>;
  };
}

interface ModernCDSRequest {
  hook: 'order-select';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId: string;
    userId: string;
    selections: string[];
    draftOrders: CDSBundle<CDSMedicationRequest>;
  };
  prefetch: {
    patient: CDSPatient;
    conditions: CDSBundle<CDSCondition>;
    allergies: CDSBundle<any>;
  };
}

export interface CDSServerExecutionResult {
  server: CdsHooksServerConfig;
  mode: 'modern' | 'legacy';
  response: CDSResponse | null;
  error: string | null;
}

type ServerCapability = 'modern' | 'legacy' | 'ambiguous';

@Injectable({
  providedIn: 'root'
})
export class CdsService {
  private readonly fhirBaseUrl = 'https://r4.smarthealthit.org';
  private readonly cdsEndpoint = '/cds-services/medication-order-select';
  private readonly capabilityCache = new Map<string, Observable<ServerCapability>>();

  constructor(
    private http: HttpClient,
    private cdsServerConfigService: CdsHooksServerConfigService
  ) {}

  getConfiguredServers(): CdsHooksServerConfig[] {
    return this.cdsServerConfigService.getServers();
  }

  getActiveServers(): CdsHooksServerConfig[] {
    return this.cdsServerConfigService.getActiveServers();
  }

  evaluateMedicationOrderSelect(
    patient: CDSPatient,
    conditions: CDSCondition[],
    medications: CDSMedicationRequest[],
    allergies: any[] = [],
    contextOverrides?: {
      encounterId?: string;
      userId?: string;
      hookInstance?: string;
    }
  ): Observable<CDSServerExecutionResult[]> {
    const encounterId = contextOverrides?.encounterId ||
      this.extractEncounterIdFromResources(medications) ||
      this.extractEncounterIdFromResources(conditions) ||
      this.generateId();
    const userId = contextOverrides?.userId || `Practitioner/${this.generateId()}`;
    const hookInstance = contextOverrides?.hookInstance || this.generateId();
    const activeServers = this.getActiveServers();

    if (activeServers.length === 0) {
      return of([]);
    }

    const patientBundle = patient;
    const conditionsBundle = this.createConditionsBundle(patient.id, conditions);
    const medicationsBundle = this.createMedicationBundle(patient.id, medications);
    const allergiesBundle = this.createAllergyBundle(patient.id, allergies);

    const legacyRequest: LegacyCDSRequest = {
      hook: 'order-page',
      hookInstance,
      fhirServer: this.fhirBaseUrl,
      context: {
        patientId: patient.id,
        encounterId,
        userId
      },
      prefetch: {
        patient: patientBundle,
        conditions: conditionsBundle,
        draftMedicationRequests: medicationsBundle,
        allergies: allergiesBundle
      }
    };

    const modernRequest: ModernCDSRequest = {
      hook: 'order-select',
      hookInstance,
      fhirServer: this.fhirBaseUrl,
      context: {
        patientId: patient.id,
        encounterId,
        userId,
        selections: medicationsBundle.entry.map((entry) => `MedicationRequest/${entry.resource.id}`),
        draftOrders: medicationsBundle
      },
      prefetch: {
        patient: patientBundle,
        conditions: conditionsBundle,
        allergies: allergiesBundle
      }
    };

    return forkJoin(
      activeServers.map((server) => this.callServer(server, modernRequest, legacyRequest))
    );
  }

  private callServer(
    server: CdsHooksServerConfig,
    modernRequest: ModernCDSRequest,
    legacyRequest: LegacyCDSRequest
  ): Observable<CDSServerExecutionResult> {
    return this.detectServerCapability(server.baseUrl).pipe(
      switchMap((capability) => {
        if (capability === 'modern') {
          return this.postRequest(server.baseUrl, modernRequest).pipe(
            map((response) => this.createSuccessResult(server, 'modern', response))
          );
        }

        if (capability === 'legacy') {
          return this.postRequest(server.baseUrl, legacyRequest).pipe(
            map((response) => this.createSuccessResult(server, 'legacy', response))
          );
        }

        return this.postRequest(server.baseUrl, modernRequest).pipe(
          map((response) => this.createSuccessResult(server, 'modern', response)),
          catchError((error) => {
            if (!this.isContractError(error)) {
              return throwError(() => error);
            }

            return this.postRequest(server.baseUrl, legacyRequest).pipe(
              map((response) => this.createSuccessResult(server, 'legacy', response))
            );
          })
        );
      }),
      catchError((error) => of(this.createErrorResult(server, error)))
    );
  }

  private detectServerCapability(baseUrl: string): Observable<ServerCapability> {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    const cached = this.capabilityCache.get(normalizedBaseUrl);
    if (cached) {
      return cached;
    }

    const capability$ = this.http.get<CDSDiscoveryResponse>(`${normalizedBaseUrl}/cds-services`).pipe(
      map((response) => {
        const service = response?.services?.find((candidate) => candidate.id === 'medication-order-select');
        if (!service) {
          return 'ambiguous' as ServerCapability;
        }

        if (service.hook === 'order-select') {
          return 'modern' as ServerCapability;
        }

        if (typeof service.hook === 'string' && service.hook.trim().length > 0) {
          return 'legacy' as ServerCapability;
        }

        return 'ambiguous' as ServerCapability;
      }),
      catchError(() => of('ambiguous' as ServerCapability)),
      shareReplay(1)
    );

    this.capabilityCache.set(normalizedBaseUrl, capability$);
    return capability$;
  }

  private postRequest(baseUrl: string, request: LegacyCDSRequest | ModernCDSRequest): Observable<CDSResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<CDSResponse>(
      `${this.normalizeBaseUrl(baseUrl)}${this.cdsEndpoint}`,
      request,
      { headers }
    );
  }

  private createSuccessResult(
    server: CdsHooksServerConfig,
    mode: 'modern' | 'legacy',
    response: CDSResponse
  ): CDSServerExecutionResult {
    return {
      server,
      mode,
      response,
      error: null
    };
  }

  private createErrorResult(server: CdsHooksServerConfig, error: unknown): CDSServerExecutionResult {
    return {
      server,
      mode: 'modern',
      response: null,
      error: this.getErrorMessage(error)
    };
  }

  private isContractError(error: unknown): boolean {
    return error instanceof HttpErrorResponse
      && error.status >= 400
      && error.status < 500;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = typeof error.error === 'string'
        ? error.error
        : error.error?.message || error.error?.error;
      return serverMessage || error.message || `HTTP ${error.status}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  private createConditionsBundle(patientId: string, conditions: CDSCondition[]): CDSBundle<CDSCondition> {
    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      type: 'searchset',
      total: conditions.length,
      link: [
        {
          relation: 'self',
          url: `${this.fhirBaseUrl}/Condition?patient=${patientId}`
        }
      ],
      entry: conditions.map((condition) => ({
        fullUrl: `${this.fhirBaseUrl}/Condition/${condition.id}`,
        resource: condition,
        search: {
          mode: 'match'
        },
        response: {
          status: '200 OK',
          etag: 'W/"3"'
        }
      }))
    };
  }

  private createMedicationBundle(patientId: string, medications: CDSMedicationRequest[]): CDSBundle<CDSMedicationRequest> {
    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      type: 'collection',
      total: medications.length,
      link: [
        {
          relation: 'self',
          url: `${this.fhirBaseUrl}/MedicationRequest?patient=${patientId}`
        }
      ],
      entry: medications.map((medication) => ({
        fullUrl: `${this.fhirBaseUrl}/MedicationRequest/${medication.id}`,
        resource: medication,
        search: {
          mode: 'match'
        },
        response: {
          status: '200 OK',
          etag: 'W/"4"'
        }
      }))
    };
  }

  private createAllergyBundle(patientId: string, allergies: any[]): CDSBundle<any> {
    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      type: 'searchset',
      total: allergies.length,
      link: [
        {
          relation: 'self',
          url: `${this.fhirBaseUrl}/AllergyIntolerance?patient=${patientId}`
        }
      ],
      entry: allergies.map((allergy) => ({
        fullUrl: `${this.fhirBaseUrl}/AllergyIntolerance/${allergy.id}`,
        resource: allergy,
        search: {
          mode: 'match'
        },
        response: {
          status: '200 OK',
          etag: 'W/"5"'
        }
      }))
    };
  }

  private extractEncounterIdFromResources(
    resources: Array<{ encounter?: { reference: string } }>
  ): string | null {
    for (const resource of resources) {
      const reference = resource?.encounter?.reference;
      if (!reference) {
        continue;
      }

      const [resourceType, id] = reference.split('/');
      if (resourceType === 'Encounter' && id) {
        return id;
      }
    }

    return null;
  }

  private normalizeBaseUrl(url: string): string {
    return String(url || '').trim().replace(/\/$/, '');
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }
}
