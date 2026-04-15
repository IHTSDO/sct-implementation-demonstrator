import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { TerminologyService } from './terminology.service';
import { PatientFhirStorageService } from './patient-fhir-storage.service';
import { PatientLocalStorageService } from './patient-local-storage.service';
import JSZip from 'jszip';
import {
  AiAssistedEntryTransactionPayload,
  AiAssistedEntryTransactionResult,
  PatientClinicalRecordData,
  PatientClinicalPackagePayload,
  PatientClinicalPackageResult,
  PatientConditionPackageResult,
  PatientPage,
  PatientPaginationState,
  PersistenceMode,
  PatientStorageBackend
} from './patient-storage.types';

import type {
  AllergyIntolerance,
  BodyStructure,
  ClinicalDataLoadSummary,
  Condition,
  DeathRecord,
  DeathRecordDiagnosis,
  Encounter,
  FhirObservation,
  Immunization,
  LaboratoryOrderGroup,
  MedicationStatement,
  OpenEHRComposition,
  Patient,
  PatientSimilarityResult,
  Provenance,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest
} from '../model';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  public static readonly SNOMED_SYSTEM = 'http://snomed.info/sct';
  public static readonly SNOMED_EDITION_SYSTEM = 'http://snomed.info/sct/900000000000207008';
  public static readonly ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';
  private static readonly EHR_LAB_LOCATION_SYSTEM = 'http://ehr-lab.demo/location';
  private static readonly PERSISTENCE_MODE_STORAGE_KEY = 'ehr_persistence_mode';
  private static readonly AI_PROVENANCE_TECHNICAL_AGENT_DISPLAY = 'AI/NLP pipeline';
  private static readonly AI_PROVENANCE_HUMAN_REVIEWER_DISPLAY = 'Human reviewer';
  private readonly FHIR_PATIENT_PAGE_SIZE = 20;
  private readonly ANATOMICAL_ANCHOR_POINTS: Array<{ id: string; ancestors: string[] }> = [
    {
      id: 'head',
      ancestors: ['406122000', '118690002', '384821006 |Mental state, behavior and/or psychosocial function finding (finding)|']
    },
    {
      id: 'neck',
      ancestors: ['298378000', '118693000']
    },
    {
      id: 'thorax',
      ancestors: ['298705000 |Finding of thoracic region (finding)|', '118695007 |Procedure on thorax (procedure)|', '106048009 |Respiratory finding (finding)|', '106063007 |Cardiovascular finding (finding)|', '118669005 |Procedure on respiratory system (procedure)|']
    },
    {
      id: 'abdomen',
      ancestors: ['609624008', '118698009', '386617003 |Digestive system finding (finding)|']
    },
    {
      id: 'pelvis',
      ancestors: ['609625009', '609637006']
    },
    {
      id: 'arms',
      ancestors: ['116307009', '118702008']
    },
    {
      id: 'legs',
      ancestors: ['116312005', '118710009']
    }
  ];
  private patientsSubject = new BehaviorSubject<Patient[]>([]);
  private selectedPatientSubject = new BehaviorSubject<Patient | null>(null);
  private observationsChangedSubject = new Subject<string>();
  private persistenceModeSubject = new BehaviorSubject<PersistenceMode>('local');
  private patientPaginationSubject = new BehaviorSubject<PatientPaginationState>({
    hasNext: false,
    hasPrevious: false,
    nextUrl: null,
    previousUrl: null,
    loading: false,
    pageSize: this.FHIR_PATIENT_PAGE_SIZE,
    total: null
  });

  private fhirCache = {
    conditions: new Map<string, Condition[]>(),
    bodyStructures: new Map<string, BodyStructure[]>(),
    procedures: new Map<string, Procedure[]>(),
    medications: new Map<string, MedicationStatement[]>(),
    immunizations: new Map<string, Immunization[]>(),
    serviceRequests: new Map<string, ServiceRequest[]>(),
    labOrders: new Map<string, LaboratoryOrderGroup[]>(),
    observations: new Map<string, FhirObservation[]>(),
    allergies: new Map<string, AllergyIntolerance[]>(),
    provenance: new Map<string, Provenance[]>(),
    questionnaireResponses: new Map<string, QuestionnaireResponse[]>(),
    encounters: new Map<string, Encounter[]>(),
    deathRecords: new Map<string, DeathRecord | null>(),
  };
  private loadingResourceKeys = new Set<string>();

  public patients$ = this.patientsSubject.asObservable();
  public selectedPatient$ = this.selectedPatientSubject.asObservable();
  public persistenceMode$ = this.persistenceModeSubject.asObservable();
  public patientPagination$ = this.patientPaginationSubject.asObservable();

  constructor(
    private storageService: StorageService,
    private terminologyService: TerminologyService,
    private patientLocalStorageService: PatientLocalStorageService,
    private patientFhirStorageService: PatientFhirStorageService
  ) {
    this.restorePersistenceMode();
    this.loadPatientsForCurrentMode();
    // this.initializeSamplePatients(); // Deactivated - start with empty patient list
  }

  private getActiveStorageBackend(): PatientStorageBackend {
    return this.getCurrentPersistenceMode() === 'fhir'
      ? this.patientFhirStorageService
      : this.patientLocalStorageService;
  }

  getPersistenceMode(): Observable<PersistenceMode> {
    return this.persistenceMode$;
  }

  getCurrentPersistenceMode(): PersistenceMode {
    return this.persistenceModeSubject.value;
  }

  getPatientPagination(): Observable<PatientPaginationState> {
    return this.patientPagination$;
  }

  async refreshPatients(): Promise<void> {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.clearFhirCaches();
    }

    await this.loadPatientsForCurrentMode();
  }

  addOrUpdatePatientInMemory(patient: Patient): void {
    const existingIndex = this.patientsSubject.value.findIndex((item) => item.id === patient.id);
    if (existingIndex >= 0) {
      const updatedPatients = [...this.patientsSubject.value];
      updatedPatients[existingIndex] = patient;
      this.patientsSubject.next(updatedPatients);
      return;
    }

    this.patientsSubject.next([patient, ...this.patientsSubject.value]);
  }

  async refreshPatient(patientId: string): Promise<Patient | null> {
    const patient = await this.getActiveStorageBackend().readPatient(patientId);
    if (!patient) {
      return null;
    }

    this.addOrUpdatePatientInMemory(patient);
    if (this.selectedPatientSubject.value?.id === patientId) {
      this.selectedPatientSubject.next(patient);
    }

    return patient;
  }

  async searchPatients(term: string): Promise<PatientPage> {
    if (this.getCurrentPersistenceMode() !== 'fhir') {
      const normalizedTerm = term.trim().toLowerCase();
      const patients = this.patientsSubject.value.filter((patient) => {
        if (!normalizedTerm) {
          return true;
        }

        const patientName = this.getPatientDisplayName(patient).toLowerCase();
        return patientName.includes(normalizedTerm);
      });

      return {
        patients,
        nextUrl: null,
        previousUrl: null,
        total: patients.length
      };
    }

    return this.patientFhirStorageService.searchPatients(term);
  }

  async setPersistenceMode(mode: PersistenceMode): Promise<void> {
    if (this.persistenceModeSubject.value === mode) {
      return;
    }

    this.persistenceModeSubject.next(mode);
    this.persistPersistenceMode(mode);
    this.selectedPatientSubject.next(null);
    this.clearFhirCaches();
    await this.loadPatientsForCurrentMode();
  }

  private restorePersistenceMode(): void {
    const storedMode = this.storageService.getItem(PatientService.PERSISTENCE_MODE_STORAGE_KEY);
    if (storedMode === 'local' || storedMode === 'fhir') {
      this.persistenceModeSubject.next(storedMode);
    }
  }

  private persistPersistenceMode(mode: PersistenceMode): void {
    this.storageService.saveItem(PatientService.PERSISTENCE_MODE_STORAGE_KEY, mode);
  }

  async loadNextPatientsPage(): Promise<void> {
    const nextUrl = this.patientPaginationSubject.value.nextUrl;
    if (this.getCurrentPersistenceMode() !== 'fhir' || !nextUrl) {
      return;
    }

    await this.loadPatientsPage(nextUrl);
  }

  async loadPreviousPatientsPage(): Promise<void> {
    const previousUrl = this.patientPaginationSubject.value.previousUrl;
    if (this.getCurrentPersistenceMode() !== 'fhir' || !previousUrl) {
      return;
    }

    await this.loadPatientsPage(previousUrl);
  }

  private async loadPatientsForCurrentMode(): Promise<void> {
    await this.loadPatientsPage();
  }

  private async loadPatientsPage(url?: string): Promise<void> {
    this.patientPaginationSubject.next({
      ...this.patientPaginationSubject.value,
      loading: true
    });

    try {
      const page = await this.getActiveStorageBackend().listPatientsPage(url);
      this.patientsSubject.next(page.patients);
      this.patientPaginationSubject.next({
        hasNext: !!page.nextUrl,
        hasPrevious: !!page.previousUrl,
        nextUrl: page.nextUrl,
        previousUrl: page.previousUrl,
        loading: false,
        pageSize: this.FHIR_PATIENT_PAGE_SIZE,
        total: page.total
      });

      const selectedPatient = this.selectedPatientSubject.value;
      if (selectedPatient) {
        const refreshedPatient = page.patients.find(patient => patient.id === selectedPatient.id) || null;
        this.selectedPatientSubject.next(refreshedPatient);
      }
    } catch (error) {
      console.error('Error loading patients from active storage backend:', error);
      this.patientsSubject.next([]);
      this.patientPaginationSubject.next({
        ...this.patientPaginationSubject.value,
        hasNext: false,
        hasPrevious: false,
        nextUrl: null,
        previousUrl: null,
        loading: false,
        total: null
      });
    }
  }

  private clearFhirCaches(): void {
    Object.values(this.fhirCache).forEach((cache) => {
      if (cache instanceof Map) {
        cache.clear();
      }
    });
    this.loadingResourceKeys.clear();
  }

  private getResourceCache<T>(cache: Map<string, T>, patientId: string, fallback: T): T {
    if (!cache.has(patientId)) {
      cache.set(patientId, fallback);
    }

    return cache.get(patientId) as T;
  }

  private setResourceCache<T>(cache: Map<string, T>, patientId: string, value: T, notify = true): void {
    cache.set(patientId, value);
    if (notify) {
      this.notifyPatientDataChanged(patientId);
    }
  }

  async preloadClinicalRecordData(patientId: string): Promise<ClinicalDataLoadSummary> {
    if (this.getCurrentPersistenceMode() !== 'fhir') {
      const summary: ClinicalDataLoadSummary = {
        totalResources: 0,
        counts: {
          conditions: this.getPatientConditions(patientId).length,
          bodyStructures: this.getPatientBodyStructures(patientId).length,
          procedures: this.getPatientProcedures(patientId).length,
          medications: this.getPatientMedications(patientId).length,
          immunizations: this.getPatientImmunizations(patientId).length,
          serviceRequests: this.getPatientServiceRequests(patientId).length,
          labOrders: this.getPatientLabOrders(patientId).length,
          observations: this.getPatientObservations(patientId).length,
          allergies: this.getPatientAllergies(patientId).length,
          questionnaireResponses: this.getPatientQuestionnaireResponses(patientId).length,
          encounters: this.getPatientEncounters(patientId).length,
          deathRecords: this.getPatientDeathRecord(patientId) ? 1 : 0
        }
      };
      summary.totalResources = Object.values(summary.counts).reduce((sum, count) => sum + count, 0);
      return summary;
    }

    let clinicalData: PatientClinicalRecordData;

    try {
      clinicalData = await this.patientFhirStorageService.getClinicalRecordData(patientId);
    } catch (error) {
      console.warn('FHIR $everything preload failed, falling back to per-resource fetch.', error);
      clinicalData = await this.loadClinicalRecordDataByResource(patientId);
    }

    this.applyClinicalRecordDataToFhirCache(patientId, clinicalData);
    return this.buildClinicalDataLoadSummary(clinicalData);
  }

  async ensureConditionsAndDeathRecordLoaded(patientId: string): Promise<void> {
    if (this.getCurrentPersistenceMode() !== 'fhir') {
      return;
    }
    const conditionsCached = this.fhirCache.conditions.has(patientId);
    const deathRecordCached = this.fhirCache.deathRecords.has(patientId);
    if (conditionsCached && deathRecordCached) {
      return;
    }
    const tasks: Promise<void>[] = [];
    if (!conditionsCached) {
      tasks.push(
        this.patientFhirStorageService.getConditions(patientId)
          .then((conditions) => { this.setResourceCache(this.fhirCache.conditions, patientId, conditions, false); })
      );
    }
    if (!deathRecordCached) {
      tasks.push(
        this.patientFhirStorageService.getDeathRecord(patientId)
          .then((deathRecord) => { this.setResourceCache(this.fhirCache.deathRecords, patientId, deathRecord, false); })
      );
    }
    await Promise.all(tasks);
  }

  private async loadClinicalRecordDataByResource(patientId: string): Promise<PatientClinicalRecordData> {
    const [
      conditions,
      bodyStructures,
      procedures,
      medications,
      immunizations,
      serviceRequests,
      labOrders,
      observations,
      allergies,
      provenance,
      questionnaireResponses,
      deathRecord,
      encounters
    ] = await Promise.all([
      this.patientFhirStorageService.getConditions(patientId),
      this.patientFhirStorageService.getBodyStructures(patientId),
      this.patientFhirStorageService.getProcedures(patientId),
      this.patientFhirStorageService.getMedications(patientId),
      this.patientFhirStorageService.getImmunizations(patientId),
      this.patientFhirStorageService.getServiceRequests(patientId),
      this.patientFhirStorageService.getLabOrders(patientId),
      this.patientFhirStorageService.getObservations(patientId),
      this.patientFhirStorageService.getAllergies(patientId),
      this.patientFhirStorageService.getProvenance(patientId),
      this.patientFhirStorageService.getQuestionnaireResponses(patientId),
      this.patientFhirStorageService.getDeathRecord(patientId),
      this.patientFhirStorageService.getEncounters(patientId)
    ]);

    return {
      conditions,
      bodyStructures,
      procedures,
      medications,
      immunizations,
      serviceRequests,
      labOrders,
      observations,
      allergies,
      provenance,
      questionnaireResponses,
      encounters,
      deathRecord
    };
  }

  private applyClinicalRecordDataToFhirCache(patientId: string, clinicalData: PatientClinicalRecordData): void {
    this.setResourceCache(this.fhirCache.conditions, patientId, clinicalData.conditions, false);
    this.setResourceCache(this.fhirCache.bodyStructures, patientId, clinicalData.bodyStructures, false);
    this.setResourceCache(this.fhirCache.procedures, patientId, clinicalData.procedures, false);
    this.setResourceCache(this.fhirCache.medications, patientId, clinicalData.medications, false);
    this.setResourceCache(this.fhirCache.immunizations, patientId, clinicalData.immunizations, false);
    this.setResourceCache(this.fhirCache.serviceRequests, patientId, clinicalData.serviceRequests, false);
    this.setResourceCache(this.fhirCache.labOrders, patientId, clinicalData.labOrders, false);
    this.setResourceCache(this.fhirCache.observations, patientId, clinicalData.observations, false);
    this.setResourceCache(this.fhirCache.allergies, patientId, clinicalData.allergies, false);
    this.setResourceCache(this.fhirCache.provenance, patientId, clinicalData.provenance, false);
    this.setResourceCache(this.fhirCache.questionnaireResponses, patientId, clinicalData.questionnaireResponses, false);
    this.setResourceCache(this.fhirCache.deathRecords, patientId, clinicalData.deathRecord, false);
    this.setResourceCache(this.fhirCache.encounters, patientId, clinicalData.encounters, false);
  }

  private buildClinicalDataLoadSummary(clinicalData: PatientClinicalRecordData): ClinicalDataLoadSummary {
    const counts = {
      conditions: clinicalData.conditions.length,
      bodyStructures: clinicalData.bodyStructures.length,
      procedures: clinicalData.procedures.length,
      medications: clinicalData.medications.length,
      immunizations: clinicalData.immunizations.length,
      serviceRequests: clinicalData.serviceRequests.length,
      labOrders: clinicalData.labOrders.length,
      observations: clinicalData.observations.length,
      allergies: clinicalData.allergies.length,
      questionnaireResponses: clinicalData.questionnaireResponses.length,
      encounters: clinicalData.encounters.length,
      deathRecords: clinicalData.deathRecord ? 1 : 0
    };

    return {
      totalResources: Object.values(counts).reduce((sum, count) => sum + count, 0),
      counts
    };
  }

  private notifyPatientDataChanged(patientId: string): void {
    const currentPatient = this.selectedPatientSubject.value;
    if (currentPatient && currentPatient.id === patientId) {
      this.selectedPatientSubject.next({ ...currentPatient });
    }
  }

  private ensureFhirResourceLoaded<T>(
    cache: Map<string, T>,
    patientId: string,
    loader: () => Promise<T>,
    fallback: T
  ): T {
    if (cache.has(patientId)) {
      return cache.get(patientId) as T;
    }

    cache.set(patientId, fallback);
    const loadingKey = `${patientId}:${String(loader)}`;
    if (!this.loadingResourceKeys.has(loadingKey)) {
      this.loadingResourceKeys.add(loadingKey);
      loader()
        .then((value) => this.setResourceCache(cache, patientId, value))
        .catch((error) => console.error(`Error loading FHIR resources for patient ${patientId}:`, error))
        .finally(() => this.loadingResourceKeys.delete(loadingKey));
    }

    return fallback;
  }

  private clearFhirPatientCaches(patientId: string): void {
    this.fhirCache.conditions.delete(patientId);
    this.fhirCache.bodyStructures.delete(patientId);
    this.fhirCache.procedures.delete(patientId);
    this.fhirCache.medications.delete(patientId);
    this.fhirCache.immunizations.delete(patientId);
    this.fhirCache.serviceRequests.delete(patientId);
    this.fhirCache.labOrders.delete(patientId);
    this.fhirCache.observations.delete(patientId);
    this.fhirCache.allergies.delete(patientId);
    this.fhirCache.provenance.delete(patientId);
    this.fhirCache.questionnaireResponses.delete(patientId);
    this.fhirCache.encounters.delete(patientId);
    this.fhirCache.deathRecords.delete(patientId);
  }

  // Helper methods for duplicate detection
  public extractSnomedCode(resource: any): string | null {
    // Extract SNOMED CT code from various resource types
    if (resource.code?.coding) {
      const snomedCoding = resource.code.coding.find((coding: any) =>
        (
          coding.system === PatientService.SNOMED_SYSTEM ||
          coding.system === PatientService.SNOMED_EDITION_SYSTEM
        ) && !this.isSnomedExpressionCoding(coding)
      );
      return snomedCoding?.code || null;
    }
    
    if (resource.medicationCodeableConcept?.coding) {
      const snomedCoding = resource.medicationCodeableConcept.coding.find((coding: any) =>
        coding.system === PatientService.SNOMED_SYSTEM ||
        coding.system === PatientService.SNOMED_EDITION_SYSTEM
      );
      return snomedCoding?.code || null;
    }

    if (resource.vaccineCode?.coding) {
      const snomedCoding = resource.vaccineCode.coding.find((coding: any) =>
        coding.system === PatientService.SNOMED_SYSTEM ||
        coding.system === PatientService.SNOMED_EDITION_SYSTEM
      );
      return snomedCoding?.code || null;
    }
    
    if (resource.reasonCode && resource.reasonCode.length > 0 && resource.reasonCode[0].coding) {
      const snomedCoding = resource.reasonCode[0].coding.find((coding: any) =>
        coding.system === PatientService.SNOMED_SYSTEM ||
        coding.system === PatientService.SNOMED_EDITION_SYSTEM
      );
      return snomedCoding?.code || null;
    }
    
    return null;
  }

  public getConditionSnomedCoding(condition: Condition): { system?: string; code?: string; display?: string } | undefined {
    return condition.code?.coding?.find((coding: any) =>
      (
        coding.system === PatientService.SNOMED_SYSTEM ||
        coding.system === PatientService.SNOMED_EDITION_SYSTEM
      ) && !this.isSnomedExpressionCoding(coding)
    );
  }

  public setConditionSnomedExpressionCoding(condition: Condition, expression: string, display?: string): void {
    this.upsertConditionCoding(condition, {
      system: PatientService.SNOMED_SYSTEM,
      version: 'http://snomed.info/xsct',
      code: expression,
      display: display || condition.code?.text || expression
    }, false, (existingCoding: any) => this.isSnomedExpressionCoding(existingCoding));
  }

  public getConditionIcd10Coding(condition: Condition): { system?: string; code?: string; display?: string } | undefined {
    return condition.code?.coding?.find((coding: any) => coding.system === PatientService.ICD10_SYSTEM);
  }

  public getConditionIcd10Code(condition: Condition): string | null {
    return this.getConditionIcd10Coding(condition)?.code || null;
  }

  public setConditionSnomedCoding(condition: Condition, coding: { code: string; display?: string }): void {
    const existingCoding = this.getConditionSnomedCoding(condition);
    this.upsertConditionCoding(condition, {
      system: existingCoding?.system || PatientService.SNOMED_SYSTEM,
      code: coding.code,
      display: coding.display || existingCoding?.display || condition.code?.text || coding.code
    }, true, (existingCoding: any) => {
      const sameSystem = existingCoding?.system === PatientService.SNOMED_SYSTEM
        || existingCoding?.system === PatientService.SNOMED_EDITION_SYSTEM;
      return sameSystem && !this.isSnomedExpressionCoding(existingCoding);
    });
  }

  public setConditionIcd10Coding(condition: Condition, coding: { code: string; display?: string }): void {
    const existingCoding = this.getConditionIcd10Coding(condition);
    this.upsertConditionCoding(condition, {
      system: PatientService.ICD10_SYSTEM,
      code: coding.code,
      display: coding.display || existingCoding?.display || coding.code
    }, false);
  }

  private upsertConditionCoding(
    condition: Condition,
    coding: { system?: string; version?: string; code?: string; display?: string },
    placeFirst: boolean,
    predicate?: (existingCoding: any) => boolean
  ): void {
    condition.code = condition.code || { text: coding.display || coding.code || '' };

    const existingCodings = condition.code.coding || [];
    const filteredCodings = existingCodings.filter((item: any) => {
      if (predicate) {
        return !predicate(item);
      }
      return item.system !== coding.system;
    });
    condition.code.coding = placeFirst ? [coding, ...filteredCodings] : [...filteredCodings, coding];
  }

  private isSnomedExpressionCoding(coding: any): boolean {
    if (coding?.version === 'http://snomed.info/xsct') {
      return true;
    }
    const code = String(coding?.code || '').trim();
    return code.startsWith('===');
  }

  private isDuplicateCondition(existingConditions: Condition[], newCondition: Condition): boolean {
    const newCode = this.extractSnomedCode(newCondition);
    if (!newCode) return false;
    
    return existingConditions.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      return existingCode === newCode;
    });
  }

  public isDuplicateProcedure(existingProcedures: Procedure[], newProcedure: Procedure): boolean {
    const newCode = this.extractSnomedCode(newProcedure);
    
    if (!newCode) return false;
    
    return existingProcedures.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      
      // Check if same SNOMED code
      if (existingCode !== newCode) return false;
      
      // Check if same date/time
      const existingDateTime = existing.performedDateTime || existing.performedPeriod?.start;
      const newDateTime = newProcedure.performedDateTime || newProcedure.performedPeriod?.start;
      if (existingDateTime !== newDateTime) return false;
      
      // Check if same encounter reference
      const existingEncounter = existing.encounter?.reference;
      const newEncounter = newProcedure.encounter?.reference;
      if (existingEncounter !== newEncounter) return false;
      
      // All criteria match - this is a duplicate
      return true;
    });
  }

  private isDuplicateMedication(existingMedications: MedicationStatement[], newMedication: MedicationStatement): boolean {
    const newCode = this.extractSnomedCode(newMedication);
    if (!newCode) return false;
    
    return existingMedications.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      return existingCode === newCode;
    });
  }

  public isDuplicateImmunization(existingImmunizations: Immunization[], newImmunization: Immunization): boolean {
    const newCode = this.extractSnomedCode(newImmunization);
    const newOccurrence = newImmunization.occurrenceDateTime || newImmunization.recorded;

    if (!newCode || !newOccurrence) {
      return false;
    }

    return existingImmunizations.some((existing) => {
      const existingCode = this.extractSnomedCode(existing);
      const existingOccurrence = existing.occurrenceDateTime || existing.recorded;
      return existingCode === newCode && existingOccurrence === newOccurrence;
    });
  }

  private isDuplicateAllergy(existingAllergies: AllergyIntolerance[], newAllergy: AllergyIntolerance): boolean {
    const newCode = this.extractSnomedCode(newAllergy);
    if (!newCode) return false;
    
    return existingAllergies.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      return existingCode === newCode;
    });
  }

  private isDuplicateEncounter(existingEncounters: Encounter[], newEncounter: Encounter): boolean {
    const newCode = this.extractSnomedCode(newEncounter);
    if (!newCode) return false;
    
    return existingEncounters.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      return existingCode === newCode;
    });
  }

  private isDuplicateObservation(existingObservations: FhirObservation[], newObservation: FhirObservation): boolean {
    const newFindingCode = newObservation.valueCodeableConcept?.coding?.[0]?.code;
    const newToothCode = newObservation.bodySite?.[0]?.coding?.[0]?.code;
    const newSurfaceCode = newObservation.bodySite?.[1]?.coding?.[0]?.code;

    if (!newFindingCode || !newToothCode || !newSurfaceCode) {
      return false;
    }

    return existingObservations.some((existing) => {
      const existingFindingCode = existing.valueCodeableConcept?.coding?.[0]?.code;
      const existingToothCode = existing.bodySite?.[0]?.coding?.[0]?.code;
      const existingSurfaceCode = existing.bodySite?.[1]?.coding?.[0]?.code;

      return existingFindingCode === newFindingCode
        && existingToothCode === newToothCode
        && existingSurfaceCode === newSurfaceCode;
    });
  }

  private isDuplicateServiceRequest(existingRequests: ServiceRequest[], newRequest: ServiceRequest): boolean {
    const newCode = this.extractSnomedCode(newRequest);
    if (!newCode) return false;

    return existingRequests.some(existing => {
      const existingCode = this.extractSnomedCode(existing);
      if (existingCode !== newCode) return false;

      return (existing.occurrenceDateTime || existing.authoredOn || '') === (newRequest.occurrenceDateTime || newRequest.authoredOn || '');
    });
  }

  private loadPatients(): void {
    this.patientLocalStorageService.listPatientsPage()
      .then((page) => this.patientsSubject.next(page.patients))
      .catch(() => this.patientsSubject.next([]));
  }


  private savePatients(patients: Patient[]): void {
    this.patientsSubject.next(patients);
  }

  private initializeSamplePatients(): void {
    const currentPatients = this.patientsSubject.value;
    if (currentPatients.length === 0) {
      const samplePatients: Patient[] = [
        {
          resourceType: 'Patient',
          id: 'patient-001',
          identifier: [
            {
              system: 'http://hospital.example.org/identifiers/patient',
              value: 'MRN001'
            }
          ],
          active: true,
          name: [
            {
              use: 'official',
              family: 'Smith',
              given: ['John', 'Michael']
            }
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-0123',
              use: 'home'
            },
            {
              system: 'email',
              value: 'john.smith@email.com',
              use: 'home'
            }
          ],
          gender: 'male',
          birthDate: '1985-03-15',
          address: [
            {
              use: 'home',
              type: 'physical',
              line: ['123 Main Street'],
              city: 'Springfield',
              state: 'IL',
              postalCode: '62701',
              country: 'US'
            }
          ]
        },
        {
          resourceType: 'Patient',
          id: 'patient-002',
          identifier: [
            {
              system: 'http://hospital.example.org/identifiers/patient',
              value: 'MRN002'
            }
          ],
          active: true,
          name: [
            {
              use: 'official',
              family: 'Johnson',
              given: ['Sarah', 'Elizabeth']
            }
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-0456',
              use: 'home'
            },
            {
              system: 'email',
              value: 'sarah.johnson@email.com',
              use: 'home'
            }
          ],
          gender: 'female',
          birthDate: '1992-07-22',
          address: [
            {
              use: 'home',
              type: 'physical',
              line: ['456 Oak Avenue'],
              city: 'Springfield',
              state: 'IL',
              postalCode: '62702',
              country: 'US'
            }
          ]
        },
        {
          resourceType: 'Patient',
          id: 'patient-003',
          identifier: [
            {
              system: 'http://hospital.example.org/identifiers/patient',
              value: 'MRN003'
            }
          ],
          active: true,
          name: [
            {
              use: 'official',
              family: 'Williams',
              given: ['Robert', 'David']
            }
          ],
          telecom: [
            {
              system: 'phone',
              value: '+1-555-0789',
              use: 'home'
            },
            {
              system: 'email',
              value: 'robert.williams@email.com',
              use: 'home'
            }
          ],
          gender: 'male',
          birthDate: '1978-11-08',
          address: [
            {
              use: 'home',
              type: 'physical',
              line: ['789 Pine Street'],
              city: 'Springfield',
              state: 'IL',
              postalCode: '62703',
              country: 'US'
            }
          ]
        }
      ];
      this.patientsSubject.next(samplePatients);
      this.savePatients(samplePatients);
    }
  }

  getPatients(): Observable<Patient[]> {
    return this.patients$;
  }

  getSelectedPatient(): Observable<Patient | null> {
    return this.selectedPatient$;
  }

  getObservationsChanged(): Observable<string> {
    return this.observationsChangedSubject.asObservable();
  }

  selectPatient(patient: Patient | null): void {
    this.selectedPatientSubject.next(patient);
  }

  async addPatient(patient: Patient, options?: { refreshPatients?: boolean }): Promise<Patient> {
    const shouldRefreshPatients = options?.refreshPatients !== false;

    try {
      const savedPatient = await this.getActiveStorageBackend().createPatient(patient);
      if (shouldRefreshPatients) {
        await this.loadPatientsForCurrentMode();
      }
      const resolvedPatient = (shouldRefreshPatients ? this.getPatientById(savedPatient.id) : undefined) || savedPatient;
      this.addOrUpdatePatientInMemory(resolvedPatient);
      this.selectedPatientSubject.next(resolvedPatient);
      return resolvedPatient;
    } catch (error) {
      console.error('Error creating patient in storage backend:', error);
      throw error;
    }
  }

  async addPatientWithConditions(
    patient: Patient,
    conditions: Condition[],
    options?: { refreshPatients?: boolean; skipConditionEnrichment?: boolean }
  ): Promise<PatientConditionPackageResult> {
    const shouldRefreshPatients = options?.refreshPatients !== false;
    const shouldSkipConditionEnrichment = options?.skipConditionEnrichment === true;
    const enrichedConditions = shouldSkipConditionEnrichment
      ? conditions.map((condition) => JSON.parse(JSON.stringify(condition)) as Condition)
      : await Promise.all(
          conditions.map(async (condition) => {
            const clonedCondition: Condition = JSON.parse(JSON.stringify(condition));
            await this.enrichCondition(clonedCondition);
            return clonedCondition;
          })
        );

    const normalizedConditions = enrichedConditions.map((condition) => ({
      ...condition,
      subject: {
        ...condition.subject,
        reference: `Patient/${patient.id}`,
        display: condition.subject?.display || this.getPatientDisplayName(patient)
      }
    }));

    const backend = this.getActiveStorageBackend();
    if (!backend.savePatientWithConditions) {
      const savedPatient = await this.addPatient(patient, { refreshPatients: shouldRefreshPatients });
      const savedConditions: Condition[] = [];

      for (const condition of normalizedConditions) {
        condition.subject = {
          ...condition.subject,
          reference: `Patient/${savedPatient.id}`,
          display: condition.subject?.display || this.getPatientDisplayName(savedPatient)
        };
        const wasAdded = await this.addPatientConditionEnriched(savedPatient.id, condition);
        if (wasAdded) {
          const savedCondition = this.getPatientConditions(savedPatient.id).find((existing) => existing.id === condition.id);
          if (savedCondition) {
            savedConditions.push(savedCondition);
          }
        }
      }

      return {
        patient: savedPatient,
        conditions: savedConditions
      };
    }

    const result = await backend.savePatientWithConditions(patient, normalizedConditions);
    if (shouldRefreshPatients) {
      await this.loadPatientsForCurrentMode();
    }

    const resolvedPatient = (shouldRefreshPatients ? this.getPatientById(result.patient.id) : undefined) || result.patient;
    this.addOrUpdatePatientInMemory(resolvedPatient);
    this.selectedPatientSubject.next(resolvedPatient);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.conditions, resolvedPatient.id, result.conditions, false);
      this.notifyPatientDataChanged(resolvedPatient.id);
    }

    return {
      patient: resolvedPatient,
      conditions: result.conditions
    };
  }

  async addPatientClinicalPackage(
    patient: Patient,
    payload: PatientClinicalPackagePayload,
    options?: { refreshPatients?: boolean }
  ): Promise<PatientClinicalPackageResult> {
    const shouldRefreshPatients = options?.refreshPatients !== false;
    const enrichedConditions = await Promise.all(
      payload.conditions.map(async (condition) => {
        const clonedCondition: Condition = JSON.parse(JSON.stringify(condition));
        await this.enrichCondition(clonedCondition);
        return clonedCondition;
      })
    );

    const normalizedPayload: PatientClinicalPackagePayload = {
      conditions: enrichedConditions.map((condition) => ({
        ...condition,
        subject: {
          ...condition.subject,
          reference: `Patient/${patient.id}`,
          display: condition.subject?.display || this.getPatientDisplayName(patient)
        }
      })),
      procedures: payload.procedures.map((procedure) => ({
        ...procedure,
        subject: {
          ...procedure.subject,
          reference: `Patient/${patient.id}`,
          display: procedure.subject?.display || this.getPatientDisplayName(patient)
        }
      })),
      medications: payload.medications.map((medication) => ({
        ...medication,
        subject: {
          ...medication.subject,
          reference: `Patient/${patient.id}`,
          display: medication.subject?.display || this.getPatientDisplayName(patient)
        }
      })),
      immunizations: payload.immunizations.map((immunization) => ({
        ...immunization,
        patient: {
          ...immunization.patient,
          reference: `Patient/${patient.id}`,
          display: immunization.patient?.display || this.getPatientDisplayName(patient)
        }
      })),
      allergies: payload.allergies.map((allergy) => ({
        ...allergy,
        patient: {
          ...allergy.patient,
          reference: `Patient/${patient.id}`,
          display: allergy.patient?.display || this.getPatientDisplayName(patient)
        }
      })),
      provenance: payload.provenance
    };

    const backend = this.getActiveStorageBackend();
    if (!backend.savePatientClinicalPackage) {
      const savedPatient = await this.addPatient(patient, { refreshPatients: shouldRefreshPatients });
      const savedProvenance: Provenance[] = [];
      for (const condition of normalizedPayload.conditions) {
        await this.addPatientConditionEnriched(savedPatient.id, {
          ...condition,
          subject: { ...condition.subject, reference: `Patient/${savedPatient.id}` }
        });
      }
      for (const procedure of normalizedPayload.procedures) {
        await this.addPatientProcedureEnriched(savedPatient.id, {
          ...procedure,
          subject: { ...procedure.subject, reference: `Patient/${savedPatient.id}` }
        });
      }
      for (const medication of normalizedPayload.medications) {
        await this.addPatientMedicationEnriched(savedPatient.id, {
          ...medication,
          subject: { ...medication.subject, reference: `Patient/${savedPatient.id}` }
        });
      }
      for (const immunization of normalizedPayload.immunizations) {
        this.addPatientImmunization(savedPatient.id, {
          ...immunization,
          patient: { ...immunization.patient, reference: `Patient/${savedPatient.id}` }
        });
      }
      for (const allergy of normalizedPayload.allergies) {
        this.addPatientAllergy(savedPatient.id, {
          ...allergy,
          patient: { ...allergy.patient, reference: `Patient/${savedPatient.id}` }
        });
      }

      for (const provenance of normalizedPayload.provenance || []) {
        savedProvenance.push(await this.createPatientProvenance(savedPatient.id, provenance));
      }

      return {
        patient: savedPatient,
        conditions: this.getPatientConditions(savedPatient.id),
        procedures: this.getPatientProcedures(savedPatient.id),
        medications: this.getPatientMedications(savedPatient.id),
        immunizations: this.getPatientImmunizations(savedPatient.id),
        allergies: this.getPatientAllergies(savedPatient.id),
        provenance: savedProvenance
      };
    }

    const result = await backend.savePatientClinicalPackage(patient, normalizedPayload);
    if (shouldRefreshPatients) {
      await this.loadPatientsForCurrentMode();
    }

    const resolvedPatient = (shouldRefreshPatients ? this.getPatientById(result.patient.id) : undefined) || result.patient;
    this.addOrUpdatePatientInMemory(resolvedPatient);
    this.selectedPatientSubject.next(resolvedPatient);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.conditions, resolvedPatient.id, result.conditions, false);
      this.setResourceCache(this.fhirCache.procedures, resolvedPatient.id, result.procedures, false);
      this.setResourceCache(this.fhirCache.medications, resolvedPatient.id, result.medications, false);
      this.setResourceCache(this.fhirCache.immunizations, resolvedPatient.id, result.immunizations, false);
      this.setResourceCache(this.fhirCache.allergies, resolvedPatient.id, result.allergies, false);
      this.setResourceCache(this.fhirCache.provenance, resolvedPatient.id, result.provenance, false);
      this.notifyPatientDataChanged(resolvedPatient.id);
    }

    return {
      patient: resolvedPatient,
      conditions: result.conditions,
      procedures: result.procedures,
      medications: result.medications,
      immunizations: result.immunizations,
      allergies: result.allergies,
      provenance: result.provenance
    };
  }

  updatePatient(updatedPatient: Patient): void {
    this.getActiveStorageBackend().updatePatient(updatedPatient)
      .then((savedPatient) => {
        const updatedPatients = this.patientsSubject.value.map(patient =>
          patient.id === updatedPatient.id ? savedPatient : patient
        );
        this.patientsSubject.next(updatedPatients);
        if (this.selectedPatientSubject.value?.id === updatedPatient.id) {
          this.selectedPatientSubject.next(savedPatient);
        }
      })
      .catch((error) => console.error('Error updating patient in storage backend:', error));
  }

  async deletePatient(patientId: string): Promise<void> {
    try {
      await this.getActiveStorageBackend().deletePatient(patientId);
      const updatedPatients = this.patientsSubject.value.filter(patient => patient.id !== patientId);
      this.patientsSubject.next(updatedPatients);
      this.clearFhirPatientCaches(patientId);
      if (this.selectedPatientSubject.value?.id === patientId) {
        this.selectPatient(null);
      }
    } catch (error) {
      console.error('Error deleting patient from storage backend:', error);
      throw error;
    }
  }

  async deletePatientRecord(patientId: string): Promise<void> {
    await this.clearAllPatientEvents(patientId);
    await this.deletePatient(patientId);
  }

  getPatientById(patientId: string): Patient | undefined {
    return this.patientsSubject.value.find(patient => patient.id === patientId);
  }

  clearAllPatients(): void {
    const patients = [...this.patientsSubject.value];
    this.getActiveStorageBackend().deleteAllPatients(patients)
      .then(async () => {
        this.clearFhirCaches();
        this.patientsSubject.next([]);
        this.selectedPatientSubject.next(null);
        await this.loadPatientsForCurrentMode();
      })
      .catch((error) => console.error('Error clearing patients from storage backend:', error));
  }

  clearAllPatientsAndClinicalData(): void {
    const patients = [...this.patientsSubject.value];

    if (this.getCurrentPersistenceMode() === 'local') {
      this.patientLocalStorageService.clearAllPatientsAndClinicalData?.()
        .then(() => {
          this.clearFhirCaches();
          this.patientsSubject.next([]);
          this.selectedPatientSubject.next(null);
        })
        .catch((error) => console.error('Error clearing local patient data:', error));
      return;
    }

    Promise.all(patients.map((patient) => this.getActiveStorageBackend().clearAllPatientEvents(patient.id)))
      .then(() => this.clearAllPatients())
      .catch((error) => console.error('Error clearing clinical data from storage backend:', error));
  }

  // Clinical Data Management Methods

  // Conditions
  getPatientConditions(patientId: string): Condition[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.conditions,
        patientId,
        () => this.patientFhirStorageService.getConditions(patientId),
        []
      );
    }

    const conditions = this.patientLocalStorageService.readStoredArray<Condition>(`ehr_conditions_${patientId}`);
    return this.patientLocalStorageService.hydrateConditionsFromStorage(conditions);
  }

  addPatientCondition(patientId: string, condition: Condition): boolean {
    const conditions = this.getPatientConditions(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateCondition(conditions, condition)) {
      return false; // Duplicate found, not added
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createCondition(patientId, condition)
        .then((savedCondition) => {
          const updatedConditions = [...this.getPatientConditions(patientId), savedCondition];
          this.setResourceCache(this.fhirCache.conditions, patientId, updatedConditions);
          this.enrichConditionInBackground(patientId, savedCondition);
        })
        .catch((error) => console.error('Error creating condition in FHIR storage service:', error));
      return true;
    }

    conditions.push(condition);
    this.savePatientConditions(patientId, conditions);
    this.enrichConditionInBackground(patientId, condition);
    return true; // Successfully added
  }

  async addPatientConditionEnriched(patientId: string, condition: Condition): Promise<boolean> {
    await this.enrichCondition(condition);
    return this.addPatientCondition(patientId, condition);
  }

  addPatientConditionAllowDuplicates(patientId: string, condition: Condition): void {
    const conditions = this.getPatientConditions(patientId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createCondition(patientId, condition)
        .then((savedCondition) => {
          this.setResourceCache(this.fhirCache.conditions, patientId, [...conditions, savedCondition]);
          this.enrichConditionInBackground(patientId, savedCondition);
        })
        .catch((error) => console.error('Error creating condition in FHIR storage service:', error));
      return;
    }

    conditions.push(condition);
    this.savePatientConditions(patientId, conditions);
    this.enrichConditionInBackground(patientId, condition);
  }

  async addPatientConditionAllowDuplicatesEnriched(patientId: string, condition: Condition): Promise<Condition> {
    await this.enrichCondition(condition);
    if (this.getCurrentPersistenceMode() === 'fhir') {
      const conditions = this.getPatientConditions(patientId);
      const savedCondition = await this.patientFhirStorageService.createCondition(patientId, condition);
      this.setResourceCache(this.fhirCache.conditions, patientId, [...conditions, savedCondition]);
      this.enrichConditionInBackground(patientId, savedCondition);
      return savedCondition;
    }
    this.addPatientConditionAllowDuplicates(patientId, condition);
    return condition;
  }

  async addPatientConditionWithIcd10(patientId: string, condition: Condition): Promise<boolean> {
    return this.addPatientConditionEnriched(patientId, condition);
  }

  async addPatientConditionAllowDuplicatesWithIcd10(patientId: string, condition: Condition): Promise<void> {
    await this.addPatientConditionAllowDuplicatesEnriched(patientId, condition);
  }

  updatePatientCondition(patientId: string, conditionId: string, updatedCondition: Condition): void {
    const conditions = this.getPatientConditions(patientId);
    const index = conditions.findIndex(c => c.id === conditionId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateCondition(patientId, conditionId, updatedCondition)
          .then((savedCondition) => {
            const updatedConditions = [...conditions];
            updatedConditions[index] = savedCondition;
            this.setResourceCache(this.fhirCache.conditions, patientId, updatedConditions);
          })
          .catch((error) => console.error('Error updating condition in FHIR storage service:', error));
        return;
      }

      conditions[index] = updatedCondition;
      this.savePatientConditions(patientId, conditions);
    }
  }

  deletePatientCondition(patientId: string, conditionId: string): void {
    const conditions = this.getPatientConditions(patientId);
    const filteredConditions = conditions.filter(c => c.id !== conditionId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteCondition(patientId, conditionId)
        .then(() => this.setResourceCache(this.fhirCache.conditions, patientId, filteredConditions))
        .catch((error) => console.error('Error deleting condition from FHIR storage service:', error));
      return;
    }

    this.savePatientConditions(patientId, filteredConditions);
  }

  private savePatientConditions(patientId: string, conditions: Condition[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.conditions, patientId, conditions);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(
      `ehr_conditions_${patientId}`,
      this.patientLocalStorageService.normalizeConditionsForStorage(conditions)
    );
  }

  private async enrichConditionInBackground(patientId: string, condition: Condition): Promise<void> {
    if (this.getConditionIcd10Code(condition) && this.getConditionStoredLocation(condition)) {
      return;
    }

    try {
      await this.enrichCondition(condition);
      this.updatePatientCondition(patientId, condition.id, condition);
    } catch (error) {
      console.warn(`Failed to enrich condition ${condition.id}:`, error);
    }
  }

  private async enrichCondition(condition: Condition): Promise<void> {
    const snomedCode = this.extractSnomedCode(condition);

    if (snomedCode) {
      const snomedCoding = this.getConditionSnomedCoding(condition);
      this.setConditionSnomedCoding(condition, {
        code: snomedCode,
        display: snomedCoding?.display || condition.code?.text || snomedCode
      });

      if (!this.getConditionIcd10Code(condition)) {
        const icd10Code = await this.resolveIcd10Code(snomedCode);
        if (icd10Code) {
          this.setConditionIcd10Coding(condition, { code: icd10Code });
        }
      }

      if (!this.getConditionStoredLocation(condition)) {
        this.setConditionStoredLocation(condition, await this.resolveComputedLocation(snomedCode));
      }
    }
  }

  private async resolveIcd10Code(snomedCode: string): Promise<string | undefined> {
    try {
      const response = await firstValueFrom(this.terminologyService.getIcd10MapTargets(snomedCode));
      const matchParam = response?.parameter?.find((param: any) => param.name === 'match');
      const conceptPart = matchParam?.part?.find((part: any) => part.name === 'concept');
      return conceptPart?.valueCoding?.code || undefined;
    } catch (error) {
      console.warn(`Failed to resolve ICD-10 map for SNOMED concept ${snomedCode}:`, error);
      return undefined;
    }
  }

  // BodyStructures
  getPatientBodyStructures(patientId: string): BodyStructure[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.bodyStructures,
        patientId,
        () => this.patientFhirStorageService.getBodyStructures(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<BodyStructure>(`ehr_body_structures_${patientId}`);
  }

  addPatientBodyStructure(patientId: string, bodyStructure: BodyStructure): void {
    const bodyStructures = this.getPatientBodyStructures(patientId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createBodyStructure(patientId, bodyStructure)
        .then((savedBodyStructure) => {
          this.setResourceCache(this.fhirCache.bodyStructures, patientId, [...bodyStructures, savedBodyStructure]);
        })
        .catch((error) => console.error('Error creating body structure in FHIR storage service:', error));
      return;
    }

    bodyStructures.push(bodyStructure);
    this.savePatientBodyStructures(patientId, bodyStructures);
  }

  updatePatientBodyStructure(patientId: string, bodyStructureId: string, updatedBodyStructure: BodyStructure): void {
    const bodyStructures = this.getPatientBodyStructures(patientId);
    const index = bodyStructures.findIndex((item) => item.id === bodyStructureId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateBodyStructure(patientId, bodyStructureId, updatedBodyStructure)
          .then((savedBodyStructure) => {
            const updatedBodyStructures = [...bodyStructures];
            updatedBodyStructures[index] = savedBodyStructure;
            this.setResourceCache(this.fhirCache.bodyStructures, patientId, updatedBodyStructures);
          })
          .catch((error) => console.error('Error updating body structure in FHIR storage service:', error));
        return;
      }

      bodyStructures[index] = updatedBodyStructure;
      this.savePatientBodyStructures(patientId, bodyStructures);
    }
  }

  deletePatientBodyStructure(patientId: string, bodyStructureId: string): void {
    const bodyStructures = this.getPatientBodyStructures(patientId);
    const filtered = bodyStructures.filter((item) => item.id !== bodyStructureId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteBodyStructure(patientId, bodyStructureId)
        .then(() => this.setResourceCache(this.fhirCache.bodyStructures, patientId, filtered))
        .catch((error) => console.error('Error deleting body structure from FHIR storage service:', error));
      return;
    }

    this.savePatientBodyStructures(patientId, filtered);
  }

  private savePatientBodyStructures(patientId: string, bodyStructures: BodyStructure[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.bodyStructures, patientId, bodyStructures);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_body_structures_${patientId}`, bodyStructures);
  }

  // Procedures
  getPatientProcedures(patientId: string): Procedure[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.procedures,
        patientId,
        () => this.patientFhirStorageService.getProcedures(patientId),
        []
      );
    }

    const procedures = this.patientLocalStorageService.readStoredArray<Procedure>(`ehr_procedures_${patientId}`);
    return this.patientLocalStorageService.hydrateProceduresFromStorage(procedures);
  }

  addPatientProcedure(patientId: string, procedure: Procedure): boolean {
    const procedures = this.getPatientProcedures(patientId);
    
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateProcedure(procedures, procedure)) {
      return false; // Duplicate found, not added
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createProcedure(patientId, procedure)
        .then((savedProcedure) => {
          this.setResourceCache(this.fhirCache.procedures, patientId, [...procedures, savedProcedure]);
          this.enrichProcedureInBackground(patientId, savedProcedure);
        })
        .catch((error) => console.error('Error creating procedure in FHIR storage service:', error));
      return true;
    }

    procedures.push(procedure);
    this.savePatientProcedures(patientId, procedures);
    this.enrichProcedureInBackground(patientId, procedure);
    return true; // Successfully added
  }

  async addPatientProcedureEnriched(patientId: string, procedure: Procedure): Promise<boolean> {
    await this.enrichProcedure(procedure);
    return this.addPatientProcedure(patientId, procedure);
  }

  async addPatientProcedureAllowDuplicatesEnriched(patientId: string, procedure: Procedure): Promise<void> {
    await this.enrichProcedure(procedure);
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createProcedure(patientId, procedure)
        .then((savedProcedure) => {
          const procedures = this.getPatientProcedures(patientId);
          this.setResourceCache(this.fhirCache.procedures, patientId, [...procedures, savedProcedure]);
          this.enrichProcedureInBackground(patientId, savedProcedure);
        })
        .catch((error) => console.error('Error creating procedure in FHIR storage service:', error));
      return;
    }

    const procedures = this.getPatientProcedures(patientId);
    procedures.push(procedure);
    this.savePatientProcedures(patientId, procedures);
  }

  async addPatientProcedureWithLocation(patientId: string, procedure: Procedure): Promise<boolean> {
    return this.addPatientProcedureEnriched(patientId, procedure);
  }

  async addPatientProcedureAllowDuplicatesWithLocation(patientId: string, procedure: Procedure): Promise<void> {
    await this.addPatientProcedureAllowDuplicatesEnriched(patientId, procedure);
  }

  updatePatientProcedure(patientId: string, procedureId: string, updatedProcedure: Procedure): void {
    const procedures = this.getPatientProcedures(patientId);
    const index = procedures.findIndex(p => p.id === procedureId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateProcedure(patientId, procedureId, updatedProcedure)
          .then((savedProcedure) => {
            const updatedProcedures = [...procedures];
            updatedProcedures[index] = savedProcedure;
            this.setResourceCache(this.fhirCache.procedures, patientId, updatedProcedures);
          })
          .catch((error) => console.error('Error updating procedure in FHIR storage service:', error));
        return;
      }

      procedures[index] = updatedProcedure;
      this.savePatientProcedures(patientId, procedures);
    }
  }

  deletePatientProcedure(patientId: string, procedureId: string): void {
    const procedures = this.getPatientProcedures(patientId);
    const filteredProcedures = procedures.filter(p => p.id !== procedureId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteProcedure(patientId, procedureId)
        .then(() => this.setResourceCache(this.fhirCache.procedures, patientId, filteredProcedures))
        .catch((error) => console.error('Error deleting procedure from FHIR storage service:', error));
      return;
    }

    this.savePatientProcedures(patientId, filteredProcedures);
  }

  private savePatientProcedures(patientId: string, procedures: Procedure[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.procedures, patientId, procedures);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(
      `ehr_procedures_${patientId}`,
      this.patientLocalStorageService.normalizeProceduresForStorage(procedures)
    );
  }

  private async enrichProcedureInBackground(patientId: string, procedure: Procedure): Promise<void> {
    if (this.getProcedureStoredLocation(procedure)) {
      return;
    }

    try {
      await this.enrichProcedure(procedure);
      this.updatePatientProcedure(patientId, procedure.id, procedure);
    } catch (error) {
      console.warn(`Failed to enrich procedure ${procedure.id}:`, error);
    }
  }

  private async enrichProcedure(procedure: Procedure): Promise<void> {
    const snomedCode = this.extractSnomedCode(procedure);

    if (snomedCode) {
      procedure.snomedConceptId = procedure.snomedConceptId || snomedCode;

      if (!this.getProcedureStoredLocation(procedure)) {
        this.setProcedureStoredLocation(procedure, await this.resolveComputedLocation(snomedCode));
      }
    }
  }

  private async resolveComputedLocation(snomedCode: string): Promise<string> {
    try {
      const response = await firstValueFrom(this.terminologyService.getAncestors(snomedCode));
      const ancestorIds = this.extractConceptIdsFromExpansion(response);
      return this.findBestAnchorLocation(ancestorIds);
    } catch (error) {
      console.warn(`Failed to resolve anatomical location for SNOMED concept ${snomedCode}:`, error);
      return 'systemic';
    }
  }

  private extractConceptIdsFromExpansion(response: any): string[] {
    const contains = response?.expansion?.contains;
    if (!Array.isArray(contains)) {
      return [];
    }

    return contains
      .map((item: any) => String(item?.code || '').trim())
      .filter((code: string) => code.length > 0);
  }

  private findBestAnchorLocation(ancestorIds: string[]): string {
    for (const anchorPoint of this.ANATOMICAL_ANCHOR_POINTS) {
      const anchorPointConceptIds = anchorPoint.ancestors.map(ancestor => this.extractAnchorConceptId(ancestor));
      if (anchorPointConceptIds.some(ancestorId => ancestorIds.includes(ancestorId))) {
        return anchorPoint.id;
      }
    }

    return 'systemic';
  }

  private getConditionStoredLocation(condition: Condition): string | undefined {
    return (condition.bodySite || [])
      .flatMap((site) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding) => coding?.system === PatientService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;
  }

  private setConditionStoredLocation(condition: Condition, locationCode: string): void {
    const bodySite = Array.isArray(condition.bodySite) ? [...condition.bodySite] : [];
    const filteredBodySite = bodySite.filter((site) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding) => coding?.system === PatientService.EHR_LAB_LOCATION_SYSTEM);
    });

    condition.bodySite = [
      ...filteredBodySite,
      {
        coding: [
          {
            system: PatientService.EHR_LAB_LOCATION_SYSTEM,
            code: locationCode,
            display: this.toLocationDisplay(locationCode)
          }
        ],
        text: this.toLocationDisplay(locationCode)
      }
    ];
  }

  private getProcedureStoredLocation(procedure: Procedure): string | undefined {
    return (procedure.bodySite || [])
      .flatMap((site) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding) => coding?.system === PatientService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;
  }

  private setProcedureStoredLocation(procedure: Procedure, locationCode: string): void {
    const bodySite = Array.isArray(procedure.bodySite) ? [...procedure.bodySite] : [];
    const filteredBodySite = bodySite.filter((site) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding) => coding?.system === PatientService.EHR_LAB_LOCATION_SYSTEM);
    });

    procedure.bodySite = [
      ...filteredBodySite,
      {
        coding: [
          {
            system: PatientService.EHR_LAB_LOCATION_SYSTEM,
            code: locationCode,
            display: this.toLocationDisplay(locationCode)
          }
        ],
        text: this.toLocationDisplay(locationCode)
      }
    ];
  }

  private toLocationDisplay(locationCode: string): string {
    return locationCode
      .split(/[-_]/g)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private extractAnchorConceptId(snomedString: string): string {
    if (snomedString.includes('|')) {
      return snomedString.split(' ')[0].trim();
    }

    return snomedString.trim();
  }

  // Medications
  getPatientMedications(patientId: string): MedicationStatement[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.medications,
        patientId,
        () => this.patientFhirStorageService.getMedications(patientId),
        []
      );
    }

    const medications = this.patientLocalStorageService.readStoredArray<MedicationStatement>(`ehr_medications_${patientId}`);
    return this.patientLocalStorageService.hydrateMedicationsFromStorage(medications);
  }

  addPatientMedication(patientId: string, medication: MedicationStatement): boolean {
    const medications = this.getPatientMedications(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateMedication(medications, medication)) {
      return false; // Duplicate found, not added
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createMedication(patientId, medication)
        .then((savedMedication) => {
          this.setResourceCache(this.fhirCache.medications, patientId, [...medications, savedMedication]);
          this.enrichMedicationInBackground(patientId, savedMedication);
        })
        .catch((error) => console.error('Error creating medication in FHIR storage service:', error));
      return true;
    }

    medications.push(medication);
    this.savePatientMedications(patientId, medications);
    this.enrichMedicationInBackground(patientId, medication);
    return true; // Successfully added
  }

  async addPatientMedicationEnriched(patientId: string, medication: MedicationStatement): Promise<boolean> {
    await this.enrichMedication(patientId, medication);
    return this.addPatientMedication(patientId, medication);
  }

  updatePatientMedication(patientId: string, medicationId: string, updatedMedication: MedicationStatement): void {
    const medications = this.getPatientMedications(patientId);
    const index = medications.findIndex(m => m.id === medicationId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateMedication(patientId, medicationId, updatedMedication)
          .then((savedMedication) => {
            const updatedMedications = [...medications];
            updatedMedications[index] = savedMedication;
            this.setResourceCache(this.fhirCache.medications, patientId, updatedMedications);
          })
          .catch((error) => console.error('Error updating medication in FHIR storage service:', error));
        return;
      }

      medications[index] = updatedMedication;
      this.savePatientMedications(patientId, medications);
    }
  }

  deletePatientMedication(patientId: string, medicationId: string): void {
    const medications = this.getPatientMedications(patientId);
    const filteredMedications = medications.filter(m => m.id !== medicationId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteMedication(patientId, medicationId)
        .then(() => this.setResourceCache(this.fhirCache.medications, patientId, filteredMedications))
        .catch((error) => console.error('Error deleting medication from FHIR storage service:', error));
      return;
    }

    this.savePatientMedications(patientId, filteredMedications);
  }

  private savePatientMedications(patientId: string, medications: MedicationStatement[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.medications, patientId, medications);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(
      `ehr_medications_${patientId}`,
      this.patientLocalStorageService.normalizeMedicationsForStorage(medications)
    );
  }

  getPatientImmunizations(patientId: string): Immunization[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.immunizations,
        patientId,
        () => this.patientFhirStorageService.getImmunizations(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<Immunization>(`ehr_immunizations_${patientId}`);
  }

  addPatientImmunization(patientId: string, immunization: Immunization): boolean {
    const immunizations = this.getPatientImmunizations(patientId);

    if (this.isDuplicateImmunization(immunizations, immunization)) {
      return false;
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createImmunization(patientId, immunization)
        .then((savedImmunization) => {
          this.setResourceCache(this.fhirCache.immunizations, patientId, [...immunizations, savedImmunization]);
        })
        .catch((error) => console.error('Error creating immunization in FHIR storage service:', error));
      return true;
    }

    immunizations.push(immunization);
    this.savePatientImmunizations(patientId, immunizations);
    return true;
  }

  updatePatientImmunization(patientId: string, immunizationId: string, updatedImmunization: Immunization): void {
    const immunizations = this.getPatientImmunizations(patientId);
    const index = immunizations.findIndex((item) => item.id === immunizationId);
    if (index === -1) {
      return;
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.updateImmunization(patientId, immunizationId, updatedImmunization)
        .then((savedImmunization) => {
          const updatedImmunizations = [...immunizations];
          updatedImmunizations[index] = savedImmunization;
          this.setResourceCache(this.fhirCache.immunizations, patientId, updatedImmunizations);
        })
        .catch((error) => console.error('Error updating immunization in FHIR storage service:', error));
      return;
    }

    immunizations[index] = updatedImmunization;
    this.savePatientImmunizations(patientId, immunizations);
  }

  deletePatientImmunization(patientId: string, immunizationId: string): void {
    const immunizations = this.getPatientImmunizations(patientId);
    const filteredImmunizations = immunizations.filter((item) => item.id !== immunizationId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteImmunization(patientId, immunizationId)
        .then(() => this.setResourceCache(this.fhirCache.immunizations, patientId, filteredImmunizations))
        .catch((error) => console.error('Error deleting immunization from FHIR storage service:', error));
      return;
    }

    this.savePatientImmunizations(patientId, filteredImmunizations);
  }

  private savePatientImmunizations(patientId: string, immunizations: Immunization[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.immunizations, patientId, immunizations);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_immunizations_${patientId}`, immunizations);
  }

  getPatientServiceRequests(patientId: string): ServiceRequest[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.serviceRequests,
        patientId,
        () => this.patientFhirStorageService.getServiceRequests(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<ServiceRequest>(`ehr_service_requests_${patientId}`);
  }

  addPatientServiceRequest(patientId: string, serviceRequest: ServiceRequest): boolean {
    const requests = this.getPatientServiceRequests(patientId);

    if (this.isDuplicateServiceRequest(requests, serviceRequest)) {
      return false;
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createServiceRequest(patientId, serviceRequest)
        .then((savedRequest) => {
          this.setResourceCache(this.fhirCache.serviceRequests, patientId, [...requests, savedRequest]);
        })
        .catch((error) => console.error('Error creating service request in FHIR storage service:', error));
      return true;
    }

    requests.push(serviceRequest);
    this.savePatientServiceRequests(patientId, requests);
    return true;
  }

  updatePatientServiceRequest(patientId: string, requestId: string, updatedServiceRequest: ServiceRequest): void {
    const requests = this.getPatientServiceRequests(patientId);
    const index = requests.findIndex(request => request.id === requestId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateServiceRequest(patientId, requestId, updatedServiceRequest)
          .then((savedRequest) => {
            const updatedRequests = [...requests];
            updatedRequests[index] = savedRequest;
            this.setResourceCache(this.fhirCache.serviceRequests, patientId, updatedRequests);
          })
          .catch((error) => console.error('Error updating service request in FHIR storage service:', error));
        return;
      }

      requests[index] = updatedServiceRequest;
      this.savePatientServiceRequests(patientId, requests);
    }
  }

  deletePatientServiceRequest(patientId: string, requestId: string): void {
    const requests = this.getPatientServiceRequests(patientId);
    const filteredRequests = requests.filter(request => request.id !== requestId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteServiceRequest(patientId, requestId)
        .then(() => this.setResourceCache(this.fhirCache.serviceRequests, patientId, filteredRequests))
        .catch((error) => console.error('Error deleting service request from FHIR storage service:', error));
      return;
    }

    this.savePatientServiceRequests(patientId, filteredRequests);
  }

  private savePatientServiceRequests(patientId: string, requests: ServiceRequest[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.serviceRequests, patientId, requests);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_service_requests_${patientId}`, requests);
  }

  getPatientLabOrders(patientId: string): LaboratoryOrderGroup[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.fhirCache.labOrders.get(patientId) ?? [];
    }

    return this.patientLocalStorageService.readStoredArray<LaboratoryOrderGroup>(`ehr_lab_orders_${patientId}`);
  }

  addPatientLabOrder(patientId: string, labOrder: LaboratoryOrderGroup): void {
    const orders = this.getPatientLabOrders(patientId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createLabOrder(patientId, labOrder)
        .then((savedBundle) => {
          this.setResourceCache(this.fhirCache.labOrders, patientId, [...orders, savedBundle]);
        })
        .catch((error) => console.error('Error creating laboratory bundle in FHIR storage service:', error));
      return;
    }

    orders.push(labOrder);
    this.savePatientLabOrders(patientId, orders);
  }

  deletePatientLabOrder(patientId: string, labOrderId: string): void {
    const orders = this.getPatientLabOrders(patientId);
    const filteredOrders = orders.filter(order => order.id !== labOrderId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteLabOrder(patientId, labOrderId)
        .then(() => this.setResourceCache(this.fhirCache.labOrders, patientId, filteredOrders))
        .catch((error) => console.error('Error deleting laboratory bundle from FHIR storage service:', error));
      return;
    }

    this.savePatientLabOrders(patientId, filteredOrders);
  }

  private savePatientLabOrders(patientId: string, labOrders: LaboratoryOrderGroup[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.labOrders, patientId, labOrders);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_lab_orders_${patientId}`, labOrders);
  }

  private async enrichMedicationInBackground(patientId: string, medication: MedicationStatement): Promise<void> {
    try {
      await this.enrichMedication(patientId, medication);
      this.updatePatientMedication(patientId, medication.id, medication);
    } catch (error) {
      console.warn(`Failed to enrich medication ${medication.id}:`, error);
    }
  }

  private async enrichMedication(_patientId: string, medication: MedicationStatement): Promise<void> {
    const medicationSnomedCode = this.extractSnomedCode(medication);
    if (medicationSnomedCode) {
      medication.snomedConceptId = medication.snomedConceptId || medicationSnomedCode;
    }
  }

  // Observations
  getPatientObservations(patientId: string): FhirObservation[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.observations,
        patientId,
        () => this.patientFhirStorageService.getObservations(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<FhirObservation>(`ehr_observations_${patientId}`);
  }

  addPatientObservation(patientId: string, observation: FhirObservation): boolean {
    const observations = this.getPatientObservations(patientId);

    if (this.isDuplicateObservation(observations, observation)) {
      return false;
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createObservation(patientId, observation)
        .then((savedObservation) => {
          this.setResourceCache(this.fhirCache.observations, patientId, [...observations, savedObservation]);
          this.observationsChangedSubject.next(patientId);
        })
        .catch((error) => console.error('Error creating observation in FHIR storage service:', error));
      return true;
    }

    observations.push(observation);
    this.savePatientObservations(patientId, observations);
    this.observationsChangedSubject.next(patientId);
    return true;
  }

  updatePatientObservation(patientId: string, observationId: string, updatedObservation: FhirObservation): void {
    const observations = this.getPatientObservations(patientId);
    const index = observations.findIndex((observation) => observation.id === observationId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateObservation(patientId, observationId, updatedObservation)
          .then((savedObservation) => {
            const updatedObservations = [...observations];
            updatedObservations[index] = savedObservation;
            this.setResourceCache(this.fhirCache.observations, patientId, updatedObservations);
            this.observationsChangedSubject.next(patientId);
          })
          .catch((error) => console.error('Error updating observation in FHIR storage service:', error));
        return;
      }

      observations[index] = updatedObservation;
      this.savePatientObservations(patientId, observations);
      this.observationsChangedSubject.next(patientId);
    }
  }

  deletePatientObservation(patientId: string, observationId: string): void {
    const observations = this.getPatientObservations(patientId);
    const filteredObservations = observations.filter((observation) => observation.id !== observationId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteObservation(patientId, observationId)
        .then(() => {
          this.setResourceCache(this.fhirCache.observations, patientId, filteredObservations);
          this.observationsChangedSubject.next(patientId);
        })
        .catch((error) => console.error('Error deleting observation from FHIR storage service:', error));
      return;
    }

    this.savePatientObservations(patientId, filteredObservations);
    this.observationsChangedSubject.next(patientId);
  }

  private savePatientObservations(patientId: string, observations: FhirObservation[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.observations, patientId, observations);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_observations_${patientId}`, observations);
  }

  // Allergies
  getPatientAllergies(patientId: string): AllergyIntolerance[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.allergies,
        patientId,
        () => this.patientFhirStorageService.getAllergies(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<AllergyIntolerance>(`ehr_allergies_${patientId}`);
  }

  addPatientAllergy(patientId: string, allergy: AllergyIntolerance): boolean {
    const normalizedAllergy = this.normalizeAllergyForPersistence(allergy);
    const allergies = this.getPatientAllergies(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateAllergy(allergies, normalizedAllergy)) {
      return false; // Duplicate found, not added
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createAllergy(patientId, normalizedAllergy)
        .then((savedAllergy) => {
          this.setResourceCache(this.fhirCache.allergies, patientId, [...allergies, savedAllergy]);
        })
        .catch((error) => console.error('Error creating allergy in FHIR storage service:', error));
      return true;
    }

    allergies.push(normalizedAllergy);
    this.savePatientAllergies(patientId, allergies);
    return true; // Successfully added
  }

  updatePatientAllergy(patientId: string, allergyId: string, updatedAllergy: AllergyIntolerance): void {
    const normalizedAllergy = this.normalizeAllergyForPersistence(updatedAllergy);
    const allergies = this.getPatientAllergies(patientId);
    const index = allergies.findIndex(a => a.id === allergyId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateAllergy(patientId, allergyId, normalizedAllergy)
          .then((savedAllergy) => {
            const updatedAllergies = [...allergies];
            updatedAllergies[index] = savedAllergy;
            this.setResourceCache(this.fhirCache.allergies, patientId, updatedAllergies);
          })
          .catch((error) => console.error('Error updating allergy in FHIR storage service:', error));
        return;
      }

      allergies[index] = normalizedAllergy;
      this.savePatientAllergies(patientId, allergies);
    }
  }

  deletePatientAllergy(patientId: string, allergyId: string): void {
    const allergies = this.getPatientAllergies(patientId);
    const filteredAllergies = allergies.filter(a => a.id !== allergyId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteAllergy(patientId, allergyId)
        .then(() => this.setResourceCache(this.fhirCache.allergies, patientId, filteredAllergies))
        .catch((error) => console.error('Error deleting allergy from FHIR storage service:', error));
      return;
    }

    this.savePatientAllergies(patientId, filteredAllergies);
  }

  private savePatientAllergies(patientId: string, allergies: AllergyIntolerance[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.allergies, patientId, allergies);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_allergies_${patientId}`, allergies);
  }

  getPatientProvenance(patientId: string): Provenance[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.provenance,
        patientId,
        () => this.patientFhirStorageService.getProvenance(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<Provenance>(`ehr_provenance_${patientId}`);
  }

  async createPatientProvenance(patientId: string, provenance: Provenance): Promise<Provenance> {
    const savedProvenance = await this.getActiveStorageBackend().createProvenance(patientId, provenance);
    const updatedProvenance = this.mergeResourcesById(this.getPatientProvenance(patientId), [savedProvenance]);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.provenance, patientId, updatedProvenance, false);
    } else {
      this.patientLocalStorageService.writeStoredArray(`ehr_provenance_${patientId}`, updatedProvenance);
    }

    this.notifyPatientDataChanged(patientId);
    return savedProvenance;
  }

  buildIpsImportProvenance(
    patientId: string,
    targetResource: { resourceType: string; id: string; code?: { text?: string }; medicationCodeableConcept?: { text?: string }; vaccineCode?: { text?: string }; },
    sourceBundle?: {
      bundleId?: string;
      bundleIdentifier?: { system?: string; value?: string };
      bundleType?: string;
      bundleTimestamp?: string;
    }
  ): Provenance {
    const recorded = new Date().toISOString();
    const targetDisplay = targetResource.code?.text
      || targetResource.medicationCodeableConcept?.text
      || targetResource.vaccineCode?.text
      || `${targetResource.resourceType} ${targetResource.id}`;
    const sourceDisplay = sourceBundle?.bundleIdentifier?.value
      ? `IPS ${sourceBundle.bundleIdentifier.value}`
      : (sourceBundle?.bundleId ? `IPS Bundle ${sourceBundle.bundleId}` : 'Imported IPS document');
    const narrative = `Imported from an IPS document and reviewed under active human supervision.`;

    return {
      resourceType: 'Provenance',
      id: `provenance-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      recorded,
      patient: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      activity: {
        text: 'IPS import under active human review'
      },
      target: [
        {
          reference: `${targetResource.resourceType}/${targetResource.id}`,
          display: targetDisplay
        },
        {
          reference: `Patient/${patientId}`,
          display: `Patient ${patientId}`
        }
      ],
      agent: [
        {
          type: {
            text: 'assembler'
          },
          role: [
            {
              text: 'human reviewer'
            }
          ],
          who: {
            display: 'Human-reviewed IPS import'
          }
        }
      ],
      entity: [
        {
          role: 'source',
          what: {
            ...(sourceBundle?.bundleIdentifier ? { identifier: sourceBundle.bundleIdentifier } : {}),
            display: sourceDisplay
          }
        }
      ],
      text: {
        status: 'generated',
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${narrative}</p></div>`
      }
    };
  }

  createAiDerivedProvenance(
    patientId: string,
    targetResource: { resourceType: string; id: string; code?: { text?: string }; medicationCodeableConcept?: { text?: string } },
    sourceReference: { reference: string; display?: string },
    recorded: string = new Date().toISOString()
  ): Provenance {
    const targetDisplay = targetResource.code?.text
      || targetResource.medicationCodeableConcept?.text
      || `${targetResource.resourceType} ${targetResource.id}`;

    return {
      resourceType: 'Provenance',
      id: `provenance-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      recorded,
      patient: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      activity: {
        text: 'AI-derived clinical entity under active human review'
      },
      target: [
        {
          reference: `${targetResource.resourceType}/${targetResource.id}`,
          display: targetDisplay
        },
        {
          reference: `Patient/${patientId}`,
          display: `Patient ${patientId}`
        }
      ],
      agent: [
        {
          type: {
            text: 'assembler'
          },
          role: [
            {
              text: 'technical agent'
            }
          ],
          who: {
            display: PatientService.AI_PROVENANCE_TECHNICAL_AGENT_DISPLAY
          }
        },
        {
          type: {
            text: 'author'
          },
          role: [
            {
              text: 'human reviewer'
            }
          ],
          who: {
            display: PatientService.AI_PROVENANCE_HUMAN_REVIEWER_DISPLAY
          }
        }
      ],
      entity: [
        {
          role: 'derivation',
          what: {
            reference: sourceReference.reference,
            display: sourceReference.display
          }
        }
      ],
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Derived by AI from persisted source text and approved under active human supervision.</p></div>'
      }
    };
  }

  private normalizeAllergyForPersistence(allergy: AllergyIntolerance): AllergyIntolerance {
    const normalizedCategories = Array.isArray(allergy.category)
      ? allergy.category
          .map((category) => this.normalizeAllergyCategoryCode(category))
          .filter((category): category is 'food' | 'medication' | 'environment' | 'biologic' => !!category)
      : allergy.category;

    return {
      ...allergy,
      category: normalizedCategories
    };
  }

  private normalizeAllergyCategoryCode(category: string | undefined): 'food' | 'medication' | 'environment' | 'biologic' | undefined {
    if (!category) {
      return undefined;
    }

    switch (String(category).trim().toLowerCase()) {
      case 'food':
        return 'food';
      case 'medication':
      case 'drug':
        return 'medication';
      case 'environment':
      case 'environmental':
        return 'environment';
      case 'biologic':
      case 'biological':
        return 'biologic';
      default:
        return undefined;
    }
  }

  // QuestionnaireResponses
  getPatientQuestionnaireResponses(patientId: string): QuestionnaireResponse[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.questionnaireResponses,
        patientId,
        () => this.patientFhirStorageService.getQuestionnaireResponses(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<QuestionnaireResponse>(`ehr_questionnaire_responses_${patientId}`);
  }

  addPatientQuestionnaireResponse(patientId: string, response: QuestionnaireResponse): boolean {
    const responses = this.getPatientQuestionnaireResponses(patientId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createQuestionnaireResponse(patientId, response)
        .then((savedResponse) => {
          this.setResourceCache(this.fhirCache.questionnaireResponses, patientId, [...responses, savedResponse]);
        })
        .catch((error) => console.error('Error creating questionnaire response in FHIR storage service:', error));
      return true;
    }

    responses.push(response);
    this.savePatientQuestionnaireResponses(patientId, responses);
    return true; // Successfully added
  }

  updatePatientQuestionnaireResponse(patientId: string, responseId: string, updatedResponse: QuestionnaireResponse): void {
    const responses = this.getPatientQuestionnaireResponses(patientId);
    const index = responses.findIndex(r => r.id === responseId);
    if (index !== -1) {
      if (this.getCurrentPersistenceMode() === 'fhir') {
        this.patientFhirStorageService.updateQuestionnaireResponse(patientId, responseId, updatedResponse)
          .then((savedResponse) => {
            const updatedResponses = [...responses];
            updatedResponses[index] = savedResponse;
            this.setResourceCache(this.fhirCache.questionnaireResponses, patientId, updatedResponses);
          })
          .catch((error) => console.error('Error updating questionnaire response in FHIR storage service:', error));
        return;
      }

      responses[index] = updatedResponse;
      this.savePatientQuestionnaireResponses(patientId, responses);
    }
  }

  deletePatientQuestionnaireResponse(patientId: string, responseId: string): void {
    const responses = this.getPatientQuestionnaireResponses(patientId);
    const filteredResponses = responses.filter(r => r.id !== responseId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteQuestionnaireResponse(patientId, responseId)
        .then(() => this.setResourceCache(this.fhirCache.questionnaireResponses, patientId, filteredResponses))
        .catch((error) => console.error('Error deleting questionnaire response from FHIR storage service:', error));
      return;
    }

    this.savePatientQuestionnaireResponses(patientId, filteredResponses);
  }

  private savePatientQuestionnaireResponses(patientId: string, responses: QuestionnaireResponse[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.questionnaireResponses, patientId, responses);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_questionnaire_responses_${patientId}`, responses);
  }

  // OpenEHR Compositions
  getPatientOpenEHRCompositions(patientId: string): OpenEHRComposition[] {
    return this.patientLocalStorageService.readStoredArray<OpenEHRComposition>(`ehr_openehr_compositions_${patientId}`);
  }

  addPatientOpenEHRComposition(patientId: string, composition: OpenEHRComposition): boolean {
    const compositions = this.getPatientOpenEHRCompositions(patientId);
    compositions.push(composition);
    this.savePatientOpenEHRCompositions(patientId, compositions);
    return true; // Successfully added
  }

  updatePatientOpenEHRComposition(patientId: string, compositionId: string, updatedComposition: OpenEHRComposition): void {
    const compositions = this.getPatientOpenEHRCompositions(patientId);
    const index = compositions.findIndex(c => c.id === compositionId);
    if (index !== -1) {
      compositions[index] = updatedComposition;
      this.savePatientOpenEHRCompositions(patientId, compositions);
    }
  }

  deletePatientOpenEHRComposition(patientId: string, compositionId: string): void {
    const compositions = this.getPatientOpenEHRCompositions(patientId);
    const filteredCompositions = compositions.filter(c => c.id !== compositionId);
    this.savePatientOpenEHRCompositions(patientId, filteredCompositions);
  }

  private savePatientOpenEHRCompositions(patientId: string, compositions: OpenEHRComposition[]): void {
    this.patientLocalStorageService.writeStoredArray(`ehr_openehr_compositions_${patientId}`, compositions);
  }

  getPatientDeathRecord(patientId: string): DeathRecord | null {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.fhirCache.deathRecords.get(patientId) ?? null;
    }

    return this.patientLocalStorageService.readStoredValue<DeathRecord | null>(`ehr_death_record_${patientId}`, null);
  }

  savePatientDeathRecord(patientId: string, record: DeathRecord): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.saveDeathRecord(patientId, record)
        .then((savedBundle) => this.setResourceCache(this.fhirCache.deathRecords, patientId, savedBundle))
        .catch((error) => console.error('Error saving death record bundle in FHIR storage service:', error));
      return;
    }

    this.patientLocalStorageService.writeStoredValue(`ehr_death_record_${patientId}`, record);
  }

  deletePatientDeathRecord(patientId: string): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      const currentRecord = this.getPatientDeathRecord(patientId);
      if (!currentRecord?.id) {
        this.setResourceCache(this.fhirCache.deathRecords, patientId, null);
        return;
      }

      this.patientFhirStorageService.deleteDeathRecord(patientId)
        .then(() => this.setResourceCache(this.fhirCache.deathRecords, patientId, null))
        .catch((error) => console.error('Error deleting death record bundle from FHIR storage service:', error));
      return;
    }

    this.patientLocalStorageService.removeStoredKey(`ehr_death_record_${patientId}`);
  }

  // Utility methods for creating sample clinical data
  createSampleCondition(patientId: string, conditionText: string): Condition {
    return {
      resourceType: 'Condition',
      id: `condition-${Date.now()}`,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      code: {
        text: conditionText
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString()
    };
  }

  createSampleProcedure(patientId: string, procedureText: string): Procedure {
    return {
      resourceType: 'Procedure',
      id: `procedure-${Date.now()}`,
      status: 'completed',
      code: {
        text: procedureText
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      performedDateTime: new Date().toISOString()
    };
  }

  createSampleMedication(patientId: string, medicationText: string): MedicationStatement {
    return {
      resourceType: 'MedicationStatement',
      id: `medication-${Date.now()}`,
      status: 'active',
      medicationCodeableConcept: {
        text: medicationText
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      effectiveDateTime: new Date().toISOString(),
      dosage: [{
        text: 'Take as prescribed'
      }]
    };
  }

  // Centralized FHIR resource creation methods for AI-detected entities
  createConditionFromClinicalEntryConcept(
    patientId: string,
    concept: { code?: string; display?: string; text?: string },
    options?: { dateTime?: string }
  ): Condition {
    const display = concept.display || concept.text || concept.code || 'Unknown condition';
    const conditionDateTime = options?.dateTime || new Date().toISOString();

    return {
      resourceType: 'Condition',
      id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      code: {
        coding: concept.code ? [{
          system: PatientService.SNOMED_SYSTEM,
          code: concept.code,
          display
        }] : undefined,
        text: display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      onsetDateTime: conditionDateTime,
      recordedDate: conditionDateTime
    };
  }

  createProcedureFromClinicalEntryConcept(
    patientId: string,
    concept: { code?: string; display?: string; text?: string },
    options?: { dateTime?: string }
  ): Procedure {
    const display = concept.display || concept.text || concept.code || 'Unknown procedure';
    const procedureDateTime = options?.dateTime || new Date().toISOString();

    return {
      resourceType: 'Procedure',
      id: `procedure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      code: {
        coding: concept.code ? [{
          system: 'http://snomed.info/sct',
          code: concept.code,
          display
        }] : undefined,
        text: display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      performedDateTime: procedureDateTime
    };
  }

  createMedicationFromClinicalEntryConcept(
    patientId: string,
    concept: { code?: string; display?: string; text?: string },
    options?: {
      effectiveDateTime?: string;
      reasonReference?: Array<{ reference: string; display?: string }>;
      dosage?: MedicationStatement['dosage'];
    }
  ): MedicationStatement {
    const display = concept.display || concept.text || concept.code || 'Unknown medication';

    const medication: MedicationStatement = {
      resourceType: 'MedicationStatement',
      id: `medication-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'active',
      medicationCodeableConcept: {
        coding: concept.code ? [{
          system: 'http://snomed.info/sct',
          code: concept.code,
          display
        }] : undefined,
        text: display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      effectiveDateTime: options?.effectiveDateTime || new Date().toISOString(),
      dosage: options?.dosage?.length ? options.dosage : [{
        text: 'Take as prescribed'
      }]
    };

    if (options?.reasonReference?.length) {
      medication.reasonReference = options.reasonReference;
    }

    return medication;
  }

  createImmunizationFromClinicalEntryConcept(
    patientId: string,
    concept: { code?: string; display?: string; text?: string },
    options?: { occurrenceDateTime?: string; status?: Immunization['status'] }
  ): Immunization {
    const display = concept.display || concept.text || concept.code || 'Unknown vaccine';
    const occurrenceDateTime = options?.occurrenceDateTime || new Date().toISOString();

    return {
      resourceType: 'Immunization',
      id: `immunization-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: options?.status || 'completed',
      vaccineCode: {
        coding: concept.code ? [{
          system: PatientService.SNOMED_SYSTEM,
          code: concept.code,
          display
        }] : undefined,
        text: display
      },
      patient: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      occurrenceDateTime,
      recorded: occurrenceDateTime,
      primarySource: true
    };
  }

  createAllergyFromClinicalEntryConcept(
    patientId: string,
    concept: { code?: string; display?: string; text?: string },
    options?: { recordedDate?: string }
  ): AllergyIntolerance {
    const display = concept.display || concept.text || concept.code || 'Allergy';

    return {
      resourceType: 'AllergyIntolerance',
      id: `allergy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      type: 'allergy',
      category: ['medication'],
      criticality: 'low',
      code: {
        coding: concept.code ? [{
          system: 'http://snomed.info/sct',
          code: concept.code,
          display
        }] : undefined,
        text: display
      },
      patient: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      recordedDate: options?.recordedDate || new Date().toISOString(),
      reaction: []
    };
  }

  createConditionFromDetectedEntity(patientId: string, detectedEntity: { name: string; conceptId?: string; confidence?: number; detectedText?: string }): Condition {
    return {
      resourceType: 'Condition',
      id: `condition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      code: {
        coding: detectedEntity.conceptId ? [{
          system: PatientService.SNOMED_SYSTEM,
          code: detectedEntity.conceptId,
          display: detectedEntity.name
        }] : undefined,
        text: detectedEntity.name
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString()
    };
  }

  createProcedureFromDetectedEntity(patientId: string, detectedEntity: { name: string; conceptId?: string; confidence?: number; detectedText?: string }, encounterId?: string): Procedure {
    const procedure: Procedure = {
      resourceType: 'Procedure',
      id: `procedure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      code: {
        coding: detectedEntity.conceptId ? [{
          system: 'http://snomed.info/sct',
          code: detectedEntity.conceptId,
          display: detectedEntity.name
        }] : undefined,
        text: detectedEntity.name
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      performedDateTime: new Date().toISOString()
    };

    // Link to encounter if provided
    if (encounterId) {
      procedure.encounter = {
        reference: `Encounter/${encounterId}`
      };
    }

    return procedure;
  }

  createMedicationFromDetectedEntity(patientId: string, detectedEntity: { name: string; conceptId?: string; confidence?: number; detectedText?: string }): MedicationStatement {
    return {
      resourceType: 'MedicationStatement',
      id: `medication-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'active',
      medicationCodeableConcept: {
        coding: detectedEntity.conceptId ? [{
          system: 'http://snomed.info/sct',
          code: detectedEntity.conceptId,
          display: detectedEntity.name
        }] : undefined,
        text: detectedEntity.name
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      effectiveDateTime: new Date().toISOString(),
      dateAsserted: new Date().toISOString()
    };
  }

  // Create encounter for AI-assisted entry session
  createEncounterFromAISession(
    patientId: string, 
    clinicalText: string, 
    reasonForEncounter: { name: string; conceptId?: string } | null,
    diagnosis: { name: string; conceptId?: string; conditionId?: string } | null
  ): Encounter {
    const encounterId = `encounter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = new Date().toISOString();
    
    // Create reason code from reason for encounter
    const reasonCode = reasonForEncounter ? [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: reasonForEncounter.conceptId || '308335008', // Patient consultation
        display: reasonForEncounter.name
      }],
      text: reasonForEncounter.name
    }] : undefined;

    // Create diagnosis from diagnosis parameter
    const diagnosisArray = diagnosis?.conditionId ? [{
      condition: {
        reference: `Condition/${diagnosis.conditionId}`,
        display: diagnosis.name
      },
      use: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }]
      },
      rank: 1
    }] : undefined;

    return {
      resourceType: 'Encounter',
      id: encounterId,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'Ambulatory'
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      period: {
        start: currentTime,
        end: currentTime
      },
      reasonCode: reasonCode,
      diagnosis: diagnosisArray,
      note: [{
        text: `AI-assisted clinical data entry session. Clinical text: "${clinicalText}"`,
        time: currentTime,
        authorReference: {
          reference: 'Practitioner/ai-assistant'
        }
      }]
    };
  }

  async saveAiAssistedEntryTransaction(
    patientId: string,
    payload: AiAssistedEntryTransactionPayload
  ): Promise<AiAssistedEntryTransactionResult> {
    await Promise.all([
      ...payload.conditions.map((condition) => this.enrichCondition(condition)),
      ...payload.procedures.map((procedure) => this.enrichProcedure(procedure)),
      ...payload.medications.map((medication) => this.enrichMedication(patientId, medication))
    ]);

    if (this.getCurrentPersistenceMode() !== 'fhir') {
      const savedEncounter = payload.encounter && this.addPatientEncounter(patientId, payload.encounter)
        ? payload.encounter
        : null;
      const savedConditions: Condition[] = [];
      const savedProcedures: Procedure[] = [];
      const savedMedications: MedicationStatement[] = [];
      const savedImmunizations: Immunization[] = [];
      const savedAllergies: AllergyIntolerance[] = [];

      for (const condition of payload.conditions) {
        if (this.addPatientCondition(patientId, condition)) {
          savedConditions.push(condition);
        }
      }

      for (const procedure of payload.procedures) {
        if (this.addPatientProcedure(patientId, procedure)) {
          savedProcedures.push(procedure);
        }
      }

      for (const medication of payload.medications) {
        if (this.addPatientMedication(patientId, medication)) {
          savedMedications.push(medication);
        }
      }

      for (const immunization of payload.immunizations) {
        if (this.addPatientImmunization(patientId, immunization)) {
          savedImmunizations.push(immunization);
        }
      }

      for (const allergy of payload.allergies) {
        if (this.addPatientAllergy(patientId, allergy)) {
          savedAllergies.push(allergy);
        }
      }

      const savedTargetReferences = new Set<string>([
        ...savedConditions.map((resource) => `Condition/${resource.id}`),
        ...savedProcedures.map((resource) => `Procedure/${resource.id}`),
        ...savedMedications.map((resource) => `MedicationStatement/${resource.id}`),
        ...savedImmunizations.map((resource) => `Immunization/${resource.id}`),
        ...savedAllergies.map((resource) => `AllergyIntolerance/${resource.id}`)
      ]);

      const savedProvenance: Provenance[] = [];
      for (const provenance of payload.provenance || []) {
        const hasSavedTarget = (provenance.target || []).some((target) => savedTargetReferences.has(target.reference));
        if (!hasSavedTarget) {
          continue;
        }
        savedProvenance.push(await this.createPatientProvenance(patientId, provenance));
      }

      this.notifyPatientDataChanged(patientId);
      return {
        encounter: savedEncounter,
        conditions: savedConditions,
        procedures: savedProcedures,
        medications: savedMedications,
        immunizations: savedImmunizations,
        allergies: savedAllergies,
        provenance: savedProvenance
      };
    }

    const result = await this.patientFhirStorageService.saveAiAssistedEntryTransaction(patientId, payload);

    this.setResourceCache(
      this.fhirCache.conditions,
      patientId,
      this.mergeResourcesById(this.getPatientConditions(patientId), result.conditions),
      false
    );
    this.setResourceCache(
      this.fhirCache.procedures,
      patientId,
      this.mergeResourcesById(this.getPatientProcedures(patientId), result.procedures),
      false
    );
    this.setResourceCache(
      this.fhirCache.medications,
      patientId,
      this.mergeResourcesById(this.getPatientMedications(patientId), result.medications),
      false
    );
    this.setResourceCache(
      this.fhirCache.immunizations,
      patientId,
      this.mergeResourcesById(this.getPatientImmunizations(patientId), result.immunizations),
      false
    );
    this.setResourceCache(
      this.fhirCache.allergies,
      patientId,
      this.mergeResourcesById(this.getPatientAllergies(patientId), result.allergies),
      false
    );
    this.setResourceCache(
      this.fhirCache.provenance,
      patientId,
      this.mergeResourcesById(this.getPatientProvenance(patientId), result.provenance),
      false
    );

    if (result.encounter) {
      this.setResourceCache(
        this.fhirCache.encounters,
        patientId,
        this.mergeResourcesById(this.getPatientEncounters(patientId), [result.encounter]),
        false
      );
    }

    this.notifyPatientDataChanged(patientId);
    return result;
  }

  async saveEncounterClinicalPackage(
    patientId: string,
    payload: { encounter: Encounter; conditions: Condition[]; procedures: Procedure[] }
  ): Promise<AiAssistedEntryTransactionResult> {
    const existingEncounters = this.getPatientEncounters(patientId);
    if (this.isDuplicateEncounter(existingEncounters, payload.encounter)) {
      const duplicateError = new Error('This encounter already exists for this patient.');
      (duplicateError as any).code = 'duplicate-encounter';
      throw duplicateError;
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.saveAiAssistedEntryTransaction(patientId, {
        encounter: payload.encounter,
        conditions: payload.conditions,
        procedures: payload.procedures,
        medications: [],
        immunizations: [],
        allergies: []
      });
    }

    const savedEncounter = this.addPatientEncounter(patientId, payload.encounter) ? payload.encounter : null;
    const savedConditions: Condition[] = [];
    const savedProcedures: Procedure[] = [];

    for (const condition of payload.conditions) {
      await this.enrichCondition(condition);
      if (this.addPatientCondition(patientId, condition)) {
        savedConditions.push(condition);
      }
    }

    for (const procedure of payload.procedures) {
      await this.enrichProcedure(procedure);
      if (this.addPatientProcedure(patientId, procedure)) {
        savedProcedures.push(procedure);
      }
    }

    this.notifyPatientDataChanged(patientId);

    return {
      encounter: savedEncounter,
      conditions: savedConditions,
      procedures: savedProcedures,
      medications: [],
      immunizations: [],
      allergies: [],
      provenance: []
    };
  }

  private mergeResourcesById<T extends { id?: string }>(existing: T[], incoming: T[]): T[] {
    const merged = new Map<string, T>();

    existing.forEach((resource) => {
      const key = resource.id || this.createEphemeralResourceKey();
      merged.set(key, resource);
    });

    incoming.forEach((resource) => {
      const key = resource.id || this.createEphemeralResourceKey();
      merged.set(key, resource);
    });

    return Array.from(merged.values());
  }

  private createEphemeralResourceKey(): string {
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Encounter management methods
  getPatientEncounters(patientId: string): Encounter[] {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      return this.ensureFhirResourceLoaded(
        this.fhirCache.encounters,
        patientId,
        () => this.patientFhirStorageService.getEncounters(patientId),
        []
      );
    }

    return this.patientLocalStorageService.readStoredArray<Encounter>(`ehr_encounters_${patientId}`);
  }

  addPatientEncounter(patientId: string, encounter: Encounter): boolean {
    const encounters = this.getPatientEncounters(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateEncounter(encounters, encounter)) {
      return false; // Duplicate found, not added
    }

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.createEncounter(patientId, encounter)
        .then((savedEncounter) => {
          this.setResourceCache(this.fhirCache.encounters, patientId, [...encounters, savedEncounter]);
        })
        .catch((error) => console.error('Error creating encounter in FHIR storage service:', error));
      return true;
    }

    encounters.push(encounter);
    this.savePatientEncounters(patientId, encounters);
    
    // Notify subscribers by updating the selected patient
    const currentPatient = this.selectedPatientSubject.value;
    if (currentPatient && currentPatient.id === patientId) {
      this.selectedPatientSubject.next({ ...currentPatient });
    }
    
    return true; // Successfully added
  }

  private savePatientEncounters(patientId: string, encounters: Encounter[]): void {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.setResourceCache(this.fhirCache.encounters, patientId, encounters);
      return;
    }

    this.patientLocalStorageService.writeStoredArray(`ehr_encounters_${patientId}`, encounters);
  }

  // Public method to delete an encounter
  deletePatientEncounter(patientId: string, encounterId: string): void {
    const encounters = this.getPatientEncounters(patientId);
    const updatedEncounters = encounters.filter(enc => enc.id !== encounterId);

    if (this.getCurrentPersistenceMode() === 'fhir') {
      this.patientFhirStorageService.deleteEncounter(patientId, encounterId)
        .then(() => this.setResourceCache(this.fhirCache.encounters, patientId, updatedEncounters))
        .catch((error) => console.error('Error deleting encounter from FHIR storage service:', error));
      return;
    }

    this.savePatientEncounters(patientId, updatedEncounters);
    
    // Notify subscribers by updating the selected patient
    const currentPatient = this.selectedPatientSubject.value;
    if (currentPatient && currentPatient.id === patientId) {
      this.selectedPatientSubject.next({ ...currentPatient });
    }
  }

  async clearAllPatientEvents(patientId: string): Promise<void> {
    if (this.getCurrentPersistenceMode() === 'fhir') {
      await this.patientFhirStorageService.clearAllPatientEvents(patientId);
      this.clearFhirPatientCaches(patientId);
      this.notifyPatientDataChanged(patientId);
      return;
    }

    await this.patientLocalStorageService.clearAllPatientEvents(patientId);
    
    
    // Notify subscribers by updating the selected patient
    const currentPatient = this.selectedPatientSubject.value;
    if (currentPatient && currentPatient.id === patientId) {
      this.selectedPatientSubject.next({ ...currentPatient });
    }
  }

  // Export functionality
  exportAllPatientsData(): any {
    const patients = this.patientsSubject.value;
    const exportData = {
      exportDate: new Date().toISOString(),
      totalPatients: patients.length,
      patients: patients.map(patient => {
        const conditions = this.getPatientConditions(patient.id);
        const procedures = this.getPatientProcedures(patient.id);
        const medications = this.getPatientMedications(patient.id);
        const immunizations = this.getPatientImmunizations(patient.id);
        const serviceRequests = this.getPatientServiceRequests(patient.id);
        const labOrders = this.getPatientLabOrders(patient.id);
        const observations = this.getPatientObservations(patient.id);
        const allergies = this.getPatientAllergies(patient.id);
        const encounters = this.getPatientEncounters(patient.id);
        const questionnaireResponses = this.getPatientQuestionnaireResponses(patient.id);
        const openEhrCompositions = this.getPatientOpenEHRCompositions(patient.id);
        const deathRecord = this.getPatientDeathRecord(patient.id);
        
        return {
          patient: patient,
          clinicalData: {
            conditions: conditions,
            procedures: procedures,
            medications: medications,
            immunizations: immunizations,
            serviceRequests: serviceRequests,
            labOrders: labOrders,
            observations: observations,
            allergies: allergies,
            encounters: encounters,
            questionnaireResponses: questionnaireResponses,
            openEhrCompositions: openEhrCompositions,
            deathRecord: deathRecord,
            totalClinicalItems:
              conditions.length +
              procedures.length +
              medications.length +
              serviceRequests.length +
              labOrders.length +
              observations.length +
              allergies.length +
              encounters.length +
              questionnaireResponses.length +
              openEhrCompositions.length +
              (deathRecord ? 1 : 0)
          }
        };
      })
    };
    
    return exportData;
  }

  generatePatientSummaryCSV(): string {
    const patients = this.patientsSubject.value;
    const csvHeaders = 'Patient ID,Name,Birth Date,Gender,Active,Conditions Count,Procedures Count,Medications Count\n';
    
    const csvRows = patients.map(patient => {
      const name = this.getPatientDisplayName(patient);
      const conditionsCount = this.getPatientConditions(patient.id).length;
      const proceduresCount = this.getPatientProcedures(patient.id).length;
      const medicationsCount = this.getPatientMedications(patient.id).length;
      
      return [
        patient.id,
        `"${name}"`,
        patient.birthDate || '',
        patient.gender || '',
        patient.active ? 'Yes' : 'No',
        conditionsCount,
        proceduresCount,
        medicationsCount
      ].join(',');
    });
    
    return csvHeaders + csvRows.join('\n');
  }

  private getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) return name.text;
      if (name.given && name.family) {
        return `${name.given.join(' ')} ${name.family}`;
      }
      if (name.family) return name.family;
    }
    return `Patient ${patient.id}`;
  }

  async generatePatientsZip(): Promise<Blob> {
    try {
      const zip = new JSZip();
      const exportData = this.exportAllPatientsData();
      
      // Add main export file with all data
      zip.file('patients-export.json', JSON.stringify(exportData, null, 2));
      
      // Add patient summary CSV
      const csvData = this.generatePatientSummaryCSV();
      zip.file('patients-summary.csv', csvData);
      
      // Add individual patient files
      const patientsFolder = zip.folder('patients');
      if (patientsFolder) {
        exportData.patients.forEach((patientData: any) => {
          const fileName = `${patientData.patient.id}-${this.sanitizeFileName(this.getPatientDisplayName(patientData.patient))}.json`;
          patientsFolder.file(fileName, JSON.stringify(patientData, null, 2));
        });
      }
      
      // Generate and return ZIP blob
      return await zip.generateAsync({ type: 'blob' });
      
    } catch (error) {
      throw new Error('Failed to generate export file');
    }
  }

  downloadPatientsZip(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const zipBlob = await this.generatePatientsZip();
        
        // Download the file
        const url = window.URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ehr-patients-export-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
  }

  async importPatientsFromZip(file: File): Promise<{ success: boolean; message: string; patientsImported?: number }> {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      // Look for the main export file
      const exportFile = zipContent.file('patients-export.json');
      if (!exportFile) {
        return { success: false, message: 'Invalid ZIP file: patients-export.json not found' };
      }
      
      // Parse the export data
      const exportDataStr = await exportFile.async('string');
      const exportData = JSON.parse(exportDataStr);
      
      if (!exportData.patients || !Array.isArray(exportData.patients)) {
        return { success: false, message: 'Invalid export format: patients array not found' };
      }
      
      // Clear existing data
      this.clearAllPatientsAndClinicalData();
      
      // Import patients and their clinical data
      let importedCount = 0;
      for (const patientEntry of exportData.patients) {
        if (patientEntry.patient && patientEntry.clinicalData) {
          // Import patient
          const patient = patientEntry.patient;
          this.addPatient(patient);
          
          // Import clinical data
          const clinicalData = patientEntry.clinicalData;
          
          // Import conditions
          if (clinicalData.conditions && Array.isArray(clinicalData.conditions)) {
            for (const condition of clinicalData.conditions) {
              await this.addPatientConditionEnriched(patient.id, condition);
            }
          }
          
          // Import procedures
          if (clinicalData.procedures && Array.isArray(clinicalData.procedures)) {
            for (const procedure of clinicalData.procedures) {
              await this.addPatientProcedureEnriched(patient.id, procedure);
            }
          }
          
          // Import medications
          if (clinicalData.medications && Array.isArray(clinicalData.medications)) {
            for (const medication of clinicalData.medications) {
              await this.addPatientMedicationEnriched(patient.id, medication);
            }
          }

          if (clinicalData.observations && Array.isArray(clinicalData.observations)) {
            for (const observation of clinicalData.observations) {
              this.addPatientObservation(patient.id, observation);
            }
          }

          if (clinicalData.allergies && Array.isArray(clinicalData.allergies)) {
            for (const allergy of clinicalData.allergies) {
              this.addPatientAllergy(patient.id, allergy);
            }
          }

          if (clinicalData.encounters && Array.isArray(clinicalData.encounters)) {
            for (const encounter of clinicalData.encounters) {
              this.addPatientEncounter(patient.id, encounter);
            }
          }

          if (clinicalData.questionnaireResponses && Array.isArray(clinicalData.questionnaireResponses)) {
            for (const response of clinicalData.questionnaireResponses) {
              this.addPatientQuestionnaireResponse(patient.id, response);
            }
          }

          if (clinicalData.openEhrCompositions && Array.isArray(clinicalData.openEhrCompositions)) {
            for (const composition of clinicalData.openEhrCompositions) {
              this.addPatientOpenEHRComposition(patient.id, composition);
            }
          }

          if (clinicalData.deathRecord) {
            this.savePatientDeathRecord(patient.id, clinicalData.deathRecord);
          }
          
          importedCount++;
        }
      }
      
      return { 
        success: true, 
        message: `Successfully imported ${importedCount} patients with their clinical data`,
        patientsImported: importedCount
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // ========================================
  // Patient Similarity Matching Methods
  // ========================================

  /**
   * Find and rank patients by similarity to a given FHIR Patient resource
   * @param referencePatient - The FHIR Patient resource to compare against
   * @param includeBreakdown - Whether to include detailed score breakdown
   * @returns Array of patients sorted by similarity score (highest first)
   */
  findSimilarPatients(referencePatient: Patient, includeBreakdown: boolean = false): PatientSimilarityResult[] {
    const availablePatients = this.patientsSubject.value;
    
    if (!referencePatient || availablePatients.length === 0) {
      return [];
    }

    // Calculate score for each patient
    const results: PatientSimilarityResult[] = availablePatients.map(patient => {
      const scoreData = this.calculatePatientSimilarity(referencePatient, patient, includeBreakdown);
      return scoreData;
    });

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Calculate similarity score between two FHIR Patient resources
   * Weights: Name (50%), Birth Date (35%), Gender (15%)
   */
  private calculatePatientSimilarity(referencePatient: Patient, comparePatient: Patient, includeBreakdown: boolean = false): PatientSimilarityResult {
    const referenceName = this.getPatientDisplayName(referencePatient).toLowerCase();
    const compareName = this.getPatientDisplayName(comparePatient).toLowerCase();
    const referenceBirthDate = referencePatient.birthDate || '';
    const compareBirthDate = comparePatient.birthDate || '';
    const referenceGender = referencePatient.gender?.toLowerCase();
    const compareGender = comparePatient.gender?.toLowerCase();

    const nameScore = this.calculateNameSimilarity(referenceName, compareName);
    const birthDateScore = this.calculateBirthDateSimilarity(referenceBirthDate, compareBirthDate);
    const genderScore = this.calculateGenderSimilarity(referenceGender, compareGender);

    // Weighted average
    const totalScore = (nameScore * 0.5) + (birthDateScore * 0.35) + (genderScore * 0.15);
    
    const result: PatientSimilarityResult = {
      patient: comparePatient,
      score: totalScore
    };

    if (includeBreakdown) {
      result.breakdown = {
        nameScore,
        birthDateScore,
        genderScore
      };
    }

    return result;
  }

  /**
   * Calculate name similarity using Levenshtein distance and word matching
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    // Exact match
    if (n1 === n2) return 1.0;
    
    // Calculate Levenshtein-based similarity
    const levenshteinScore = this.levenshteinSimilarity(n1, n2);
    
    // Calculate word-based similarity
    const wordScore = this.wordMatchSimilarity(n1, n2);
    
    // Use the higher of the two scores (more forgiving)
    return Math.max(levenshteinScore, wordScore);
  }

  /**
   * Calculate Levenshtein distance and convert to similarity score (0-1)
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate word-based matching similarity
   */
  private wordMatchSimilarity(name1: string, name2: string): number {
    const words1 = name1.split(/\s+/).filter(w => w.length > 0);
    const words2 = name2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    let matches = 0;
    const totalWords = Math.max(words1.length, words2.length);
    
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2) {
          matches++;
          break;
        } else if (word1.length > 2 && word2.length > 2) {
          // Partial match for longer words
          if (word1.includes(word2) || word2.includes(word1)) {
            matches += 0.7; // Partial credit
            break;
          }
        }
      }
    }
    
    return matches / totalWords;
  }

  /**
   * Calculate birth date similarity (0-1)
   */
  private calculateBirthDateSimilarity(date1: string, date2: string): number {
    if (!date1 || !date2) return 0;
    if (date1 === date2) return 1.0;
    
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      // Calculate difference in years
      const yearDiff = Math.abs(d1.getFullYear() - d2.getFullYear());
      
      // Exact match
      if (yearDiff === 0 && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()) {
        return 1.0;
      }
      
      // Penalize by 0.2 for each year of difference (max 5 years)
      const score = Math.max(0, 1.0 - (yearDiff * 0.2));
      return score;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Calculate gender similarity (0-1)
   */
  private calculateGenderSimilarity(gender1: string | undefined, gender2: string | undefined): number {
    if (!gender1 || !gender2) return 0;
    
    const g1 = gender1.toLowerCase().trim();
    const g2 = gender2.toLowerCase().trim();
    
    return g1 === g2 ? 1.0 : 0.0;
  }

  /**
   * Format similarity score as percentage string
   */
  formatScoreAsPercentage(score: number): string {
    return `${(score * 100).toFixed(0)}%`;
  }

  /**
   * Get patient display name (public for use in components)
   */
  public getPatientName(patient: Patient): string {
    return this.getPatientDisplayName(patient);
  }
}
