import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import type { AllergyIntolerance, Condition, MedicationStatement, Patient } from '../model';
import { CdsHooksServerConfig, CdsHooksServerConfigService } from './cds-hooks-server-config.service';

export type StandardCdsHook = 'patient-view' | 'order-select' | 'order-sign' | 'problem-list-item-create' | 'allergyintolerance-create';

export const STANDARD_CDS_HOOK_LABELS: Record<StandardCdsHook, string> = {
  'patient-view': 'Patient View',
  'order-select': 'Order Select',
  'order-sign': 'Order Sign',
  'problem-list-item-create': 'Problem List Item Create',
  'allergyintolerance-create': 'AllergyIntolerance Create'
};

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
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
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

interface DiscoveryResult {
  services: CDSDiscoveryService[];
  failed: boolean;
}

interface DiscoveryCacheEntry {
  observable: Observable<DiscoveryResult>;
  createdAt: number;
}

interface LegacyOrderSelectRequest {
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

interface OrderSelectRequest {
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
    medications: CDSBundle<CDSMedicationRequest>;
    allergies: CDSBundle<any>;
  };
}

interface OrderSignRequest {
  hook: 'order-sign';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId: string;
    userId: string;
    draftOrders: CDSBundle<CDSMedicationRequest>;
  };
  prefetch: {
    patient: CDSPatient;
    conditions: CDSBundle<CDSCondition>;
    medications: CDSBundle<CDSMedicationRequest>;
    allergies: CDSBundle<any>;
  };
}

interface PatientViewRequest {
  hook: 'patient-view';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId?: string;
    userId: string;
  };
  prefetch: {
    patient: CDSPatient;
    conditions: CDSBundle<CDSCondition>;
    medications: CDSBundle<CDSMedicationRequest>;
    allergies: CDSBundle<any>;
  };
}

interface ProblemListItemCreateRequest {
  hook: 'problem-list-item-create';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId?: string;
    userId: string;
    conditions: CDSBundle<CDSCondition>;
  };
  prefetch: {
    patient: CDSPatient;
    medications: CDSBundle<CDSMedicationRequest>;
  };
}

interface AllergyIntoleranceCreateRequest {
  hook: 'allergyintolerance-create';
  hookInstance: string;
  fhirServer: string;
  context: {
    patientId: string;
    encounterId?: string;
    userId: string;
    allergyIntolerance: any;
  };
  prefetch: {
    patient: CDSPatient;
    medications: CDSBundle<CDSMedicationRequest>;
  };
}

type StandardHookRequest =
  | OrderSelectRequest
  | OrderSignRequest
  | PatientViewRequest
  | ProblemListItemCreateRequest
  | AllergyIntoleranceCreateRequest;

export interface CDSServerExecutionResult {
  server: CdsHooksServerConfig;
  hook: StandardCdsHook;
  serviceId: string;
  serviceTitle: string;
  mode: 'standard' | 'legacy';
  response: CDSResponse | null;
  error: string | null;
}

export interface HookExecutionContextSnapshot {
  patient: Patient;
  conditions: Condition[];
  medications: MedicationStatement[];
  allergies: AllergyIntolerance[];
  selectedMedications?: MedicationStatement[];
  draftMedications?: MedicationStatement[];
  newConditions?: Condition[];
  encounterId?: string;
  userId?: string;
  hookInstance?: string;
}

export interface HookExecutionSnapshot {
  hook: StandardCdsHook;
  results: CDSServerExecutionResult[];
  isLoading: boolean;
  errorMessage: string | null;
  noDataMessage: string | null;
  lastUpdated: string | null;
  context: HookExecutionContextSnapshot | null;
}

export type ClinicalCdsEvent =
  | { type: 'patient-view'; context: HookExecutionContextSnapshot }
  | { type: 'condition-added'; context: HookExecutionContextSnapshot; newCondition: Condition }
  | { type: 'condition-deleted'; context: HookExecutionContextSnapshot }
  | { type: 'allergy-added'; context: HookExecutionContextSnapshot; newAllergy: AllergyIntolerance }
  | { type: 'allergy-deleted'; context: HookExecutionContextSnapshot }
  | { type: 'medication-draft-changed'; context: HookExecutionContextSnapshot; draftMedication: MedicationStatement }
  | { type: 'medication-signed'; context: HookExecutionContextSnapshot; draftMedication: MedicationStatement }
  | { type: 'medication-deleted'; context: HookExecutionContextSnapshot }
  | { type: 'immunization-added'; context: HookExecutionContextSnapshot }
  | { type: 'immunization-deleted'; context: HookExecutionContextSnapshot };

type PatientHookStore = Record<StandardCdsHook, HookExecutionSnapshot>;

const STANDARD_HOOKS: StandardCdsHook[] = ['patient-view', 'order-select', 'order-sign', 'problem-list-item-create', 'allergyintolerance-create'];
const EXCLUDED_SERVICE_IDS = new Set(['hello-test']);

const EMPTY_HOOK_SNAPSHOT = (hook: StandardCdsHook): HookExecutionSnapshot => ({
  hook,
  results: [],
  isLoading: false,
  errorMessage: null,
  noDataMessage: null,
  lastUpdated: null,
  context: null
});

@Injectable({
  providedIn: 'root'
})
export class CdsService {
  private readonly fhirBaseUrl = 'https://r4.smarthealthit.org';
  private readonly discoveryCache = new Map<string, DiscoveryCacheEntry>();
  private readonly hookStore$ = new BehaviorSubject<Record<string, PatientHookStore>>({});

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

  watchPatientHooks(patientId: string): Observable<PatientHookStore> {
    return this.hookStore$.pipe(
      map((store) => store[patientId] || this.createEmptyPatientHookStore())
    );
  }

  getPatientHookSnapshot(patientId: string): PatientHookStore {
    return this.hookStore$.value[patientId] || this.createEmptyPatientHookStore();
  }

  getLatestHookSnapshot(patientId: string): HookExecutionSnapshot | null {
    const snapshots = Object.values(this.getPatientHookSnapshot(patientId))
      .filter((snapshot) => !!snapshot.lastUpdated)
      .sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
    return snapshots[0] || null;
  }

  invokePatientView(context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    return this.invokeHook('patient-view', context);
  }

  invokeOrderSelect(context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    return this.invokeHook('order-select', context);
  }

  invokeOrderSign(context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    return this.invokeHook('order-sign', context);
  }

  invokeProblemListItemCreate(context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    return this.invokeHook('problem-list-item-create', context);
  }

  invokeAllergyIntoleranceCreate(context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    return this.invokeHook('allergyintolerance-create', context);
  }

  handleClinicalEvent(event: ClinicalCdsEvent): Observable<HookExecutionSnapshot> {
    switch (event.type) {
      case 'patient-view':
      case 'condition-deleted':
      case 'allergy-deleted':
      case 'medication-deleted':
      case 'immunization-added':
      case 'immunization-deleted':
        return this.invokePatientView(event.context);
      case 'condition-added':
        return this.invokeProblemListItemCreate({
          ...event.context,
          newConditions: [event.newCondition]
        });
      case 'allergy-added':
        return this.invokeAllergyIntoleranceCreate({
          ...event.context,
          allergies: [...event.context.allergies.filter((allergy) => allergy.id !== event.newAllergy.id), event.newAllergy]
        });
      case 'medication-draft-changed':
        return this.invokeOrderSelect({
          ...event.context,
          selectedMedications: [event.draftMedication]
        });
      case 'medication-signed':
        return this.invokeOrderSign({
          ...event.context,
          draftMedications: [event.draftMedication]
        });
    }
  }

  rerunHook(patientId: string, hook: StandardCdsHook): Observable<HookExecutionSnapshot> {
    const snapshot = this.getPatientHookSnapshot(patientId)[hook];
    if (!snapshot?.context) {
      const emptySnapshot: HookExecutionSnapshot = {
        ...EMPTY_HOOK_SNAPSHOT(hook),
        noDataMessage: `No recent ${STANDARD_CDS_HOOK_LABELS[hook]} context is available to rerun yet.`
      };
      this.updateHookSnapshot(patientId, hook, emptySnapshot);
      return of(emptySnapshot);
    }

    return this.invokeHook(hook, snapshot.context);
  }

  private invokeHook(hook: StandardCdsHook, context: HookExecutionContextSnapshot): Observable<HookExecutionSnapshot> {
    const patientId = context.patient.id;
    const activeServers = this.getActiveServers();

    if (activeServers.length === 0) {
      const noServerSnapshot: HookExecutionSnapshot = {
        hook,
        results: [],
        isLoading: false,
        errorMessage: null,
        noDataMessage: 'No active CDS Hooks servers configured. Use Data > CDS Hooks Servers to activate at least one server.',
        lastUpdated: new Date().toISOString(),
        context
      };
      this.updateHookSnapshot(patientId, hook, noServerSnapshot);
      return of(noServerSnapshot);
    }

    const loadingSnapshot: HookExecutionSnapshot = {
      ...EMPTY_HOOK_SNAPSHOT(hook),
      isLoading: true,
      context
    };
    this.updateHookSnapshot(patientId, hook, loadingSnapshot);

    const requestData = this.buildHookRequestData(hook, context);
    if ('noDataMessage' in requestData) {
      const noDataSnapshot: HookExecutionSnapshot = {
        hook,
        results: [],
        isLoading: false,
        errorMessage: null,
        noDataMessage: requestData.noDataMessage,
        lastUpdated: new Date().toISOString(),
        context
      };
      this.updateHookSnapshot(patientId, hook, noDataSnapshot);
      return of(noDataSnapshot);
    }

    return forkJoin(
      activeServers.map((server) => this.callHookOnServer(server, hook, requestData.standardRequest, requestData.legacyRequest))
    ).pipe(
      map((serverResults) => serverResults.flat()),
      map((results) => {
        const successfulResults = results.filter((result) => !result.error && !!result.response);
        const erroredResults = results.filter((result) => !!result.error);

        let errorMessage: string | null = null;
        let noDataMessage: string | null = null;

        if (results.length === 0) {
          noDataMessage = `No active CDS server advertises support for ${STANDARD_CDS_HOOK_LABELS[hook]}.`;
        } else if (successfulResults.length === 0 && erroredResults.length > 0) {
          errorMessage = `All active CDS servers failed while executing ${STANDARD_CDS_HOOK_LABELS[hook]}.`;
        }

        const snapshot: HookExecutionSnapshot = {
          hook,
          results,
          isLoading: false,
          errorMessage,
          noDataMessage,
          lastUpdated: new Date().toISOString(),
          context
        };

        this.updateHookSnapshot(patientId, hook, snapshot);
        return snapshot;
      }),
      catchError((error) => {
        const failedSnapshot: HookExecutionSnapshot = {
          hook,
          results: [],
          isLoading: false,
          errorMessage: `CDS Service Error: ${error.message || 'Unknown error'}`,
          noDataMessage: null,
          lastUpdated: new Date().toISOString(),
          context
        };
        this.updateHookSnapshot(patientId, hook, failedSnapshot);
        return of(failedSnapshot);
      })
    );
  }

  private callHookOnServer(
    server: CdsHooksServerConfig,
    hook: StandardCdsHook,
    standardRequest: StandardHookRequest,
    legacyRequest?: LegacyOrderSelectRequest,
    forceDiscoveryRefresh: boolean = false
  ): Observable<CDSServerExecutionResult[]> {
    return this.discoverServices(server.baseUrl, forceDiscoveryRefresh).pipe(
      switchMap((discovery) => {
        const matchingServices = discovery.services.filter((service) => service.hook === hook && !EXCLUDED_SERVICE_IDS.has(service.id));
        if (matchingServices.length > 0) {
          return forkJoin(
            matchingServices.map((service) =>
              this.http.post<CDSResponse>(this.buildServiceUrl(server.baseUrl, service.id), standardRequest, {
                headers: this.createHttpHeaders()
              }).pipe(
                map((response) => ({
                  server,
                  hook,
                  serviceId: service.id,
                  serviceTitle: service.title || service.id,
                  mode: 'standard' as const,
                  response,
                  error: null
                })),
                catchError((error) => of({
                  server,
                  hook,
                  serviceId: service.id,
                  serviceTitle: service.title || service.id,
                  mode: 'standard' as const,
                  response: null,
                  error: this.formatHttpError(error)
                }))
              )
            )
          );
        }

        if (!forceDiscoveryRefresh && !discovery.failed) {
          return this.callHookOnServer(server, hook, standardRequest, legacyRequest, true);
        }

        if (legacyRequest) {
          const legacyService = discovery.services.find((service) => service.id === 'medication-order-select' && (!service.hook || service.hook.trim().length === 0));
          if (legacyService || discovery.failed) {
            return this.http.post<CDSResponse>(this.buildServiceUrl(server.baseUrl, 'medication-order-select'), legacyRequest, {
              headers: this.createHttpHeaders()
            }).pipe(
              map((response) => [{
                server,
                hook,
                serviceId: 'medication-order-select',
                serviceTitle: 'Medication Order Select',
                mode: 'legacy' as const,
                response,
                error: null
              }]),
              catchError((error) => of([{
                server,
                hook,
                serviceId: 'medication-order-select',
                serviceTitle: 'Medication Order Select',
                mode: 'legacy' as const,
                response: null,
                error: this.formatHttpError(error)
              }]))
            );
          }
        }

        return of([]);
      })
    );
  }

  private discoverServices(baseUrl: string, forceRefresh: boolean = false): Observable<DiscoveryResult> {
    const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
    if (!forceRefresh) {
      const cached = this.discoveryCache.get(normalizedBaseUrl);
      if (cached) {
        return cached.observable;
      }
    }

    const discovery$ = this.http.get<CDSDiscoveryResponse>(`${normalizedBaseUrl}/cds-services`).pipe(
      map((response) => ({
        services: response?.services || [],
        failed: false
      })),
      catchError(() => of({
        services: [],
        failed: true
      })),
      shareReplay(1)
    );

    this.discoveryCache.set(normalizedBaseUrl, {
      observable: discovery$,
      createdAt: Date.now()
    });
    return discovery$;
  }

  private buildHookRequestData(
    hook: StandardCdsHook,
    context: HookExecutionContextSnapshot
  ): { standardRequest: StandardHookRequest; legacyRequest?: LegacyOrderSelectRequest } | { noDataMessage: string } {
    const encounterId = context.encounterId
      || this.resolveEncounterId(context.conditions, context.medications)
      || this.generateId();
    const userId = context.userId || `Practitioner/${this.generateId()}`;
    const hookInstance = context.hookInstance || this.generateId();
    const patient = this.convertPatientToCdsFormat(context.patient);
    const conditions = this.convertConditionsToCdsFormat(context.conditions, encounterId);
    const medications = this.convertMedicationsToCdsFormat(context.medications, encounterId);
    const allergies = this.convertAllergiesToCdsFormat(context.allergies);
    const conditionsBundle = this.createConditionsBundle(context.patient.id, conditions);
    const medicationsBundle = this.createMedicationBundle(context.patient.id, medications);
    const allergiesBundle = this.createAllergyBundle(context.patient.id, allergies);
    const createLegacyCompatibilityRequest = (draftMedicationRequests: CDSBundle<CDSMedicationRequest>): LegacyOrderSelectRequest => ({
      hook: 'order-page',
      hookInstance,
      fhirServer: this.fhirBaseUrl,
      context: {
        patientId: context.patient.id,
        encounterId,
        userId
      },
      prefetch: {
        patient,
        conditions: conditionsBundle,
        draftMedicationRequests,
        allergies: allergiesBundle
      }
    });

    if (hook === 'patient-view') {
      return {
        standardRequest: {
          hook,
          hookInstance,
          fhirServer: this.fhirBaseUrl,
          context: {
            patientId: context.patient.id,
            encounterId,
            userId
          },
          prefetch: {
            patient,
            conditions: conditionsBundle,
            medications: medicationsBundle,
            allergies: allergiesBundle
          }
        },
        legacyRequest: createLegacyCompatibilityRequest(medicationsBundle)
      };
    }

    if (hook === 'problem-list-item-create') {
      const newConditions = context.newConditions || [];
      if (newConditions.length === 0) {
        return {
          noDataMessage: 'No newly created condition is available for Problem List Item Create yet.'
        };
      }
      const newConditionBundle = this.createConditionsBundle(
        context.patient.id,
        this.convertConditionsToCdsFormat(newConditions, encounterId)
      );

      return {
        standardRequest: {
          hook,
          hookInstance,
          fhirServer: this.fhirBaseUrl,
          context: {
            patientId: context.patient.id,
            encounterId,
            userId,
            conditions: newConditionBundle
          },
          prefetch: {
            patient,
            medications: medicationsBundle
          }
        },
        legacyRequest: createLegacyCompatibilityRequest(medicationsBundle)
      };
    }

    if (hook === 'allergyintolerance-create') {
      const newestAllergy = context.allergies[context.allergies.length - 1];
      if (!newestAllergy) {
        return {
          noDataMessage: 'No newly created allergy is available for AllergyIntolerance Create yet.'
        };
      }

      return {
        standardRequest: {
          hook,
          hookInstance,
          fhirServer: this.fhirBaseUrl,
          context: {
            patientId: context.patient.id,
            encounterId,
            userId,
            allergyIntolerance: this.convertAllergiesToCdsFormat([newestAllergy])[0]
          },
          prefetch: {
            patient,
            medications: medicationsBundle
          }
        },
        legacyRequest: createLegacyCompatibilityRequest(medicationsBundle)
      };
    }

    if (hook === 'order-select') {
      const selectedMedications = context.selectedMedications || [];
      if (selectedMedications.length === 0) {
        return {
          noDataMessage: 'No draft medication is currently selected for Order Select.'
        };
      }

      const selectedMedicationRequests = this.convertMedicationsToCdsFormat(selectedMedications, encounterId);
      const draftOrders = this.createMedicationBundle(context.patient.id, selectedMedicationRequests);
      const selections = draftOrders.entry.map((entry) => `MedicationRequest/${entry.resource.id}`);

      return {
        standardRequest: {
          hook,
          hookInstance,
          fhirServer: this.fhirBaseUrl,
          context: {
            patientId: context.patient.id,
            encounterId,
            userId,
            selections,
            draftOrders
          },
          prefetch: {
            patient,
            conditions: conditionsBundle,
            medications: medicationsBundle,
            allergies: allergiesBundle
          }
        },
        legacyRequest: createLegacyCompatibilityRequest(draftOrders)
      };
    }

    const draftMedications = context.draftMedications || [];
    if (draftMedications.length === 0) {
      return {
        noDataMessage: 'No signed draft medication is available for Order Sign yet.'
      };
    }

    return {
      standardRequest: {
        hook,
        hookInstance,
        fhirServer: this.fhirBaseUrl,
        context: {
          patientId: context.patient.id,
          encounterId,
          userId,
          draftOrders: this.createMedicationBundle(
            context.patient.id,
            this.convertMedicationsToCdsFormat(draftMedications, encounterId)
          )
        },
        prefetch: {
          patient,
          conditions: conditionsBundle,
          medications: medicationsBundle,
          allergies: allergiesBundle
        }
      },
      legacyRequest: createLegacyCompatibilityRequest(
        this.createMedicationBundle(
          context.patient.id,
          this.convertMedicationsToCdsFormat(draftMedications, encounterId)
        )
      )
    };
  }

  private updateHookSnapshot(patientId: string, hook: StandardCdsHook, snapshot: HookExecutionSnapshot): void {
    const currentStore = this.hookStore$.value;
    const patientStore = currentStore[patientId] || this.createEmptyPatientHookStore();
    this.hookStore$.next({
      ...currentStore,
      [patientId]: {
        ...patientStore,
        [hook]: snapshot
      }
    });
  }

  private createEmptyPatientHookStore(): PatientHookStore {
    return {
      'patient-view': EMPTY_HOOK_SNAPSHOT('patient-view'),
      'order-select': EMPTY_HOOK_SNAPSHOT('order-select'),
      'order-sign': EMPTY_HOOK_SNAPSHOT('order-sign'),
      'problem-list-item-create': EMPTY_HOOK_SNAPSHOT('problem-list-item-create'),
      'allergyintolerance-create': EMPTY_HOOK_SNAPSHOT('allergyintolerance-create')
    };
  }

  private createHttpHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json'
    });
  }

  private buildServiceUrl(baseUrl: string, serviceId: string): string {
    return `${this.normalizeBaseUrl(baseUrl)}/cds-services/${serviceId}`;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }

  private formatHttpError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Unknown CDS request error';
    }

    if (typeof error.error === 'string' && error.error.trim().length > 0) {
      return error.error;
    }

    if (error.error?.message) {
      return error.error.message;
    }

    return error.message || 'Unknown CDS request error';
  }

  private convertPatientToCdsFormat(patient: Patient): CDSPatient {
    return {
      resourceType: 'Patient',
      id: patient.id,
      gender: patient.gender || 'unknown',
      birthDate: patient.birthDate || '1990-01-01',
      identifier: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ],
            text: 'Medical Record Number'
          },
          system: 'http://hospital.smarthealthit.org',
          value: patient.id
        }
      ],
      name: [
        {
          use: 'official',
          family: patient.name?.[0]?.family || 'Unknown',
          given: patient.name?.[0]?.given || ['Unknown'],
          prefix: []
        }
      ]
    };
  }

  private convertConditionsToCdsFormat(conditions: Condition[], fallbackEncounterId: string): CDSCondition[] {
    return conditions.map((condition) => ({
      resourceType: 'Condition',
      id: condition.id || this.generateId(),
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: condition.clinicalStatus?.coding?.[0]?.code || 'active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: condition.verificationStatus?.coding?.[0]?.code || 'confirmed'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'problem-list-item',
              display: 'Problem List Item'
            }
          ],
          text: 'problem-list-item'
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: condition.code?.coding?.[0]?.code || '404684003',
            display: condition.code?.coding?.[0]?.display || condition.code?.text || 'Unknown condition'
          }
        ],
        text: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'
      },
      subject: {
        reference: `Patient/${condition.subject?.reference?.split('/').pop() || ''}`
      },
      encounter: {
        reference: `Encounter/${this.extractEncounterId(condition.encounter?.reference) || fallbackEncounterId}`
      },
      onsetDateTime: condition.onsetDateTime || new Date().toISOString(),
      recordedDate: condition.recordedDate || new Date().toISOString()
    }));
  }

  private convertMedicationsToCdsFormat(medications: MedicationStatement[], fallbackEncounterId: string): CDSMedicationRequest[] {
    return medications.map((medication) => {
      const medicationText = medication.medicationCodeableConcept?.text
        || medication.medicationCodeableConcept?.coding?.[0]?.display
        || 'Unknown medication';

      const textLower = medicationText.toLowerCase();
      const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
      const isTablet = textLower.includes('tablet');

      let category: 'tablet' | 'liquid' | 'other' = 'other';
      if (isTablet) {
        category = 'tablet';
      } else if (textLower.includes('syrup') || textLower.includes('solution') || textLower.includes('suspension')) {
        category = 'liquid';
      }

      const dosageRoute = medication.dosage?.[0]?.route;
      const routeCoding = (dosageRoute?.coding || [])
        .filter((coding) => coding?.code || coding?.display)
        .map((coding) => ({
          ...(coding.system ? { system: coding.system } : {}),
          ...(coding.code ? { code: coding.code } : {}),
          ...(coding.display ? { display: coding.display } : {})
        }));
      const route = dosageRoute ? {
        ...(dosageRoute.text ? { text: dosageRoute.text } : {}),
        ...(routeCoding.length > 0 ? { coding: routeCoding } : {})
      } : undefined;

      return {
        resourceType: 'MedicationRequest',
        id: medication.id || this.generateId(),
        status: 'draft',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: medicationCode || 'dummyCode',
              display: medication.medicationCodeableConcept?.coding?.[0]?.display || medicationText
            }
          ],
          text: medicationText
        },
        subject: {
          reference: medication.subject?.reference || ''
        },
        encounter: {
          reference: `Encounter/${this.extractEncounterId(medication.context?.reference) || fallbackEncounterId}`
        },
        authoredOn: medication.effectiveDateTime || medication.effectivePeriod?.start || new Date().toISOString(),
        requester: {
          reference: 'Practitioner/demo-practitioner'
        },
        reasonReference: medication.reasonReference?.map((reason) => ({ reference: reason.reference })) || undefined,
        dosageInstruction: [
          {
            sequence: 1,
            timing: {
              repeat: {
                frequency: medication.dosage?.[0]?.timing?.repeat?.frequency || 1,
                period: medication.dosage?.[0]?.timing?.repeat?.period || 1,
                periodUnit: medication.dosage?.[0]?.timing?.repeat?.periodUnit || 'd'
              }
            },
            asNeededBoolean: false,
            ...(route && (route.text || route.coding?.length) ? { route } : {}),
            doseAndRate: [
              {
                type: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
                      code: 'ordered',
                      display: 'Ordered'
                    }
                  ]
                },
                doseQuantity: {
                  value: medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value || (category === 'tablet' ? 1 : 5),
                  unit: medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || (category === 'tablet' ? 'tablet' : 'mg')
                }
              }
            ]
          }
        ]
      };
    });
  }

  private convertAllergiesToCdsFormat(allergies: AllergyIntolerance[]): any[] {
    return allergies.map((allergy) => {
      const cleanedReactions = (allergy.reaction || []).map((reaction: any) => {
        const cleanedReaction: any = {};

        if (reaction.substance && reaction.substance.length > 0) {
          const validSubstance = reaction.substance.filter((substance: any) =>
            substance.coding && substance.coding.length > 0 && substance.coding.some((coding: any) => coding.code)
          );
          if (validSubstance.length > 0) {
            cleanedReaction.substance = validSubstance;
          }
        }

        if (reaction.manifestation && reaction.manifestation.length > 0) {
          const validManifestation = reaction.manifestation.filter((manifestation: any) =>
            manifestation.coding && manifestation.coding.length > 0 && manifestation.coding.some((coding: any) => coding.code)
          );
          if (validManifestation.length > 0) {
            cleanedReaction.manifestation = validManifestation;
          }
        }

        if (reaction.exposureRoute?.coding && reaction.exposureRoute.coding.length > 0) {
          const validCoding = reaction.exposureRoute.coding.filter((coding: any) => coding.code);
          if (validCoding.length > 0) {
            cleanedReaction.exposureRoute = {
              ...reaction.exposureRoute,
              coding: validCoding
            };
          }
        }

        return Object.keys(cleanedReaction).length > 0 ? cleanedReaction : undefined;
      }).filter((reaction: any) => reaction !== undefined);

      return {
        resourceType: 'AllergyIntolerance',
        id: allergy.id || this.generateId(),
        clinicalStatus: allergy.clinicalStatus || {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
            display: 'Active'
          }]
        },
        verificationStatus: allergy.verificationStatus || {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed',
            display: 'Confirmed'
          }]
        },
        type: allergy.type || 'allergy',
        category: this.normalizeAllergyCategory(allergy.category),
        criticality: allergy.criticality || 'low',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: allergy.code?.coding?.[0]?.code || '419199007',
              display: allergy.code?.coding?.[0]?.display || allergy.code?.text || 'Allergy'
            }
          ],
          text: allergy.code?.text || 'Allergy'
        },
        patient: {
          reference: allergy.patient?.reference || ''
        },
        recordedDate: allergy.recordedDate || new Date().toISOString(),
        reaction: cleanedReactions
      };
    });
  }

  private normalizeAllergyCategory(category: any): string[] {
    if (!category || !Array.isArray(category)) {
      return ['medication'];
    }

    return category.map((value: string) => value.toLowerCase());
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
          etag: 'W/"3"'
        }
      }))
    };
  }

  private resolveEncounterId(conditions: Condition[], medications: MedicationStatement[]): string | null {
    const medicationEncounter = medications
      .map((medication) => this.extractEncounterId(medication.context?.reference))
      .find((encounterId) => !!encounterId);

    if (medicationEncounter) {
      return medicationEncounter;
    }

    const conditionEncounter = conditions
      .map((condition) => this.extractEncounterId(condition.encounter?.reference))
      .find((encounterId) => !!encounterId);

    return conditionEncounter || null;
  }

  private extractEncounterId(reference?: string): string | null {
    if (!reference) {
      return null;
    }

    const parts = reference.split('/');
    if (parts.length !== 2 || parts[0] !== 'Encounter' || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }
}
