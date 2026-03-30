import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import type {
  AllergyIntolerance,
  BodyStructure,
  Condition,
  DeathRecord,
  Encounter,
  FhirObservation,
  Immunization,
  LaboratoryOrderGroup,
  MedicationStatement,
  Patient,
  Provenance,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest,
} from '../model';
import {
  PatientClinicalPackagePayload,
  PatientClinicalPackageResult,
  PatientConditionPackageResult,
  PatientStorageBackend,
  PatientPage
} from './patient-storage.types';

@Injectable({
  providedIn: 'root'
})
export class PatientLocalStorageService implements PatientStorageBackend {
  private readonly STORAGE_KEY = 'ehr_patients';
  private static readonly EHR_LAB_LOCATION_SYSTEM = 'http://ehr-lab.demo/location';
  private static readonly EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL = 'http://ehr-lab.demo/fhir/StructureDefinition/computed-location';

  constructor(private storageService: StorageService) {}

  async listPatientsPage(): Promise<PatientPage> {
    const patients = this.readArray<Patient>(this.STORAGE_KEY);
    return {
      patients,
      nextUrl: null,
      previousUrl: null,
      total: patients.length
    };
  }

  async readPatient(patientId: string): Promise<Patient | null> {
    return this.readArray<Patient>(this.STORAGE_KEY).find((patient) => patient.id === patientId) || null;
  }

  async createPatient(patient: Patient): Promise<Patient> {
    const patients = this.readArray<Patient>(this.STORAGE_KEY);
    patients.push(patient);
    this.writeArray(this.STORAGE_KEY, patients);
    return patient;
  }

  async savePatientWithConditions(patient: Patient, conditions: Condition[]): Promise<PatientConditionPackageResult> {
    const savedPatient = await this.createPatient(patient);
    const savedConditions = conditions
      .map((condition) => {
        const normalizedCondition: Condition = {
          ...condition,
          subject: {
            ...condition.subject,
            reference: `Patient/${savedPatient.id}`,
            display: condition.subject?.display || this.getPatientDisplayName(savedPatient)
          }
        };

        return this.pushItem(`ehr_conditions_${savedPatient.id}`, this.prepareConditionForStorage(normalizedCondition));
      });

    return {
      patient: savedPatient,
      conditions: savedConditions
    };
  }

  async savePatientClinicalPackage(
    patient: Patient,
    payload: PatientClinicalPackagePayload
  ): Promise<PatientClinicalPackageResult> {
    const savedPatient = await this.createPatient(patient);
    const patientReference = `Patient/${savedPatient.id}`;
    const patientDisplay = this.getPatientDisplayName(savedPatient);

    const savedConditions = payload.conditions
      .map((condition) => this.pushItem(
        `ehr_conditions_${savedPatient.id}`,
        this.prepareConditionForStorage({
          ...condition,
          subject: {
            ...condition.subject,
            reference: patientReference,
            display: condition.subject?.display || patientDisplay
          }
        })
      ));

    const savedProcedures = payload.procedures
      .map((procedure) => this.pushItem(
        `ehr_procedures_${savedPatient.id}`,
        this.prepareProcedureForStorage({
          ...procedure,
          subject: {
            ...procedure.subject,
            reference: patientReference,
            display: procedure.subject?.display || patientDisplay
          }
        })
      ));

    const savedMedications = payload.medications
      .map((medication) => this.pushItem(
        `ehr_medications_${savedPatient.id}`,
        this.prepareMedicationForStorage({
          ...medication,
          subject: {
            ...medication.subject,
            reference: patientReference,
            display: medication.subject?.display || patientDisplay
          }
        })
      ))
      .map((medication) => this.hydrateMedicationComputedLocation(medication));

    const savedImmunizations = payload.immunizations
      .map((immunization) => this.pushItem(
        `ehr_immunizations_${savedPatient.id}`,
        {
          ...immunization,
          patient: {
            ...immunization.patient,
            reference: patientReference,
            display: immunization.patient?.display || patientDisplay
          }
        }
      ));

    const savedAllergies = payload.allergies
      .map((allergy) => this.pushItem(
        `ehr_allergies_${savedPatient.id}`,
        {
          ...allergy,
          patient: {
            ...allergy.patient,
            reference: patientReference,
            display: allergy.patient?.display || patientDisplay
          }
        }
      ));

    const savedProvenance = (payload.provenance || [])
      .map((provenance) => this.pushItem(
        `ehr_provenance_${savedPatient.id}`,
        this.prepareProvenanceForStorage({
          ...provenance,
          patient: {
            ...provenance.patient,
            reference: patientReference,
            display: provenance.patient?.display || patientDisplay
          }
        })
      ));

    return {
      patient: savedPatient,
      conditions: savedConditions,
      procedures: savedProcedures,
      medications: savedMedications,
      immunizations: savedImmunizations,
      allergies: savedAllergies,
      provenance: savedProvenance
    };
  }

  async updatePatient(patient: Patient): Promise<Patient> {
    const patients = this.readArray<Patient>(this.STORAGE_KEY).map((item) => item.id === patient.id ? patient : item);
    this.writeArray(this.STORAGE_KEY, patients);
    return patient;
  }

  async deletePatient(patientId: string): Promise<void> {
    const patients = this.readArray<Patient>(this.STORAGE_KEY).filter((item) => item.id !== patientId);
    this.writeArray(this.STORAGE_KEY, patients);
  }

  async deleteAllPatients(_patients: Patient[] = []): Promise<void> {
    this.writeArray(this.STORAGE_KEY, []);
  }

  async clearAllPatientsAndClinicalData(): Promise<void> {
    const storagePrefixesToClear = [
      'ehr_conditions_',
      'ehr_procedures_',
      'ehr_medications_',
      'ehr_immunizations_',
      'ehr_service_requests_',
      'ehr_lab_orders_',
      'ehr_observations_',
      'ehr_body_structures_',
      'ehr_allergies_',
      'ehr_provenance_',
      'ehr_encounters_',
      'ehr_questionnaire_responses_',
      'ehr_openehr_compositions_',
      'ehr_death_record_',
      'encounters_',
    ];

    const matchingKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && storagePrefixesToClear.some(prefix => key.startsWith(prefix))) {
        matchingKeys.push(key);
      }
    }

    matchingKeys.forEach(key => this.storageService.removeItem(key));
    await this.deleteAllPatients();
  }

  async getConditions(patientId: string): Promise<Condition[]> {
    return this.readArray<Condition>(`ehr_conditions_${patientId}`);
  }
  async createCondition(patientId: string, condition: Condition): Promise<Condition> {
    return this.pushItem(`ehr_conditions_${patientId}`, this.prepareConditionForStorage(condition));
  }
  async updateCondition(patientId: string, conditionId: string, condition: Condition): Promise<Condition> {
    return this.replaceItem(`ehr_conditions_${patientId}`, conditionId, this.prepareConditionForStorage(condition));
  }
  async deleteCondition(patientId: string, conditionId: string): Promise<void> { this.removeItem(`ehr_conditions_${patientId}`, conditionId); }

  async getBodyStructures(patientId: string): Promise<BodyStructure[]> { return this.readArray(`ehr_body_structures_${patientId}`); }
  async createBodyStructure(patientId: string, bodyStructure: BodyStructure): Promise<BodyStructure> { return this.pushItem(`ehr_body_structures_${patientId}`, bodyStructure); }
  async updateBodyStructure(patientId: string, bodyStructureId: string, bodyStructure: BodyStructure): Promise<BodyStructure> { return this.replaceItem(`ehr_body_structures_${patientId}`, bodyStructureId, bodyStructure); }
  async deleteBodyStructure(patientId: string, bodyStructureId: string): Promise<void> { this.removeItem(`ehr_body_structures_${patientId}`, bodyStructureId); }

  async getProcedures(patientId: string): Promise<Procedure[]> {
    return this.readArray<Procedure>(`ehr_procedures_${patientId}`);
  }
  async createProcedure(patientId: string, procedure: Procedure): Promise<Procedure> {
    return this.pushItem(`ehr_procedures_${patientId}`, this.prepareProcedureForStorage(procedure));
  }
  async updateProcedure(patientId: string, procedureId: string, procedure: Procedure): Promise<Procedure> {
    return this.replaceItem(`ehr_procedures_${patientId}`, procedureId, this.prepareProcedureForStorage(procedure));
  }
  async deleteProcedure(patientId: string, procedureId: string): Promise<void> { this.removeItem(`ehr_procedures_${patientId}`, procedureId); }

  async getMedications(patientId: string): Promise<MedicationStatement[]> {
    return this.readArray<MedicationStatement>(`ehr_medications_${patientId}`).map((medication) => this.hydrateMedicationComputedLocation(medication));
  }
  async createMedication(patientId: string, medication: MedicationStatement): Promise<MedicationStatement> {
    const savedMedication = this.pushItem(`ehr_medications_${patientId}`, this.prepareMedicationForStorage(medication));
    return this.hydrateMedicationComputedLocation(savedMedication);
  }
  async updateMedication(patientId: string, medicationId: string, medication: MedicationStatement): Promise<MedicationStatement> {
    const savedMedication = this.replaceItem(`ehr_medications_${patientId}`, medicationId, this.prepareMedicationForStorage(medication));
    return this.hydrateMedicationComputedLocation(savedMedication);
  }
  async deleteMedication(patientId: string, medicationId: string): Promise<void> { this.removeItem(`ehr_medications_${patientId}`, medicationId); }

  async getImmunizations(patientId: string): Promise<Immunization[]> { return this.readArray(`ehr_immunizations_${patientId}`); }
  async createImmunization(patientId: string, immunization: Immunization): Promise<Immunization> { return this.pushItem(`ehr_immunizations_${patientId}`, immunization); }
  async updateImmunization(patientId: string, immunizationId: string, immunization: Immunization): Promise<Immunization> { return this.replaceItem(`ehr_immunizations_${patientId}`, immunizationId, immunization); }
  async deleteImmunization(patientId: string, immunizationId: string): Promise<void> { this.removeItem(`ehr_immunizations_${patientId}`, immunizationId); }

  async getServiceRequests(patientId: string): Promise<ServiceRequest[]> { return this.readArray(`ehr_service_requests_${patientId}`); }
  async createServiceRequest(patientId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest> { return this.pushItem(`ehr_service_requests_${patientId}`, serviceRequest); }
  async updateServiceRequest(patientId: string, requestId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest> { return this.replaceItem(`ehr_service_requests_${patientId}`, requestId, serviceRequest); }
  async deleteServiceRequest(patientId: string, requestId: string): Promise<void> { this.removeItem(`ehr_service_requests_${patientId}`, requestId); }

  async getLabOrders(patientId: string): Promise<LaboratoryOrderGroup[]> { return this.readArray(`ehr_lab_orders_${patientId}`); }
  async createLabOrder(patientId: string, labOrder: LaboratoryOrderGroup): Promise<LaboratoryOrderGroup> { return this.pushItem(`ehr_lab_orders_${patientId}`, labOrder); }
  async deleteLabOrder(patientId: string, labOrderId: string): Promise<void> { this.removeItem(`ehr_lab_orders_${patientId}`, labOrderId); }

  async getObservations(patientId: string): Promise<FhirObservation[]> { return this.readArray(`ehr_observations_${patientId}`); }
  async createObservation(patientId: string, observation: FhirObservation): Promise<FhirObservation> { return this.pushItem(`ehr_observations_${patientId}`, observation); }
  async updateObservation(patientId: string, observationId: string, observation: FhirObservation): Promise<FhirObservation> { return this.replaceItem(`ehr_observations_${patientId}`, observationId, observation); }
  async deleteObservation(patientId: string, observationId: string): Promise<void> { this.removeItem(`ehr_observations_${patientId}`, observationId); }

  async getAllergies(patientId: string): Promise<AllergyIntolerance[]> { return this.readArray(`ehr_allergies_${patientId}`); }
  async createAllergy(patientId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance> { return this.pushItem(`ehr_allergies_${patientId}`, allergy); }
  async updateAllergy(patientId: string, allergyId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance> { return this.replaceItem(`ehr_allergies_${patientId}`, allergyId, allergy); }
  async deleteAllergy(patientId: string, allergyId: string): Promise<void> { this.removeItem(`ehr_allergies_${patientId}`, allergyId); }

  async getProvenance(patientId: string): Promise<Provenance[]> { return this.readArray(`ehr_provenance_${patientId}`); }
  async createProvenance(patientId: string, provenance: Provenance): Promise<Provenance> {
    return this.pushItem(`ehr_provenance_${patientId}`, this.prepareProvenanceForStorage(provenance));
  }
  async deleteProvenance(patientId: string, provenanceId: string): Promise<void> { this.removeItem(`ehr_provenance_${patientId}`, provenanceId); }

  async getQuestionnaireResponses(patientId: string): Promise<QuestionnaireResponse[]> { return this.readArray(`ehr_questionnaire_responses_${patientId}`); }
  async createQuestionnaireResponse(patientId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse> { return this.pushItem(`ehr_questionnaire_responses_${patientId}`, response); }
  async updateQuestionnaireResponse(patientId: string, responseId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse> { return this.replaceItem(`ehr_questionnaire_responses_${patientId}`, responseId, response); }
  async deleteQuestionnaireResponse(patientId: string, responseId: string): Promise<void> { this.removeItem(`ehr_questionnaire_responses_${patientId}`, responseId); }

  async getDeathRecord(patientId: string): Promise<DeathRecord | null> {
    return this.readValue<DeathRecord | null>(`ehr_death_record_${patientId}`, null);
  }

  async saveDeathRecord(patientId: string, record: DeathRecord): Promise<DeathRecord> {
    this.writeValue(`ehr_death_record_${patientId}`, record);
    return record;
  }

  async deleteDeathRecord(patientId: string): Promise<void> {
    this.storageService.removeItem(`ehr_death_record_${patientId}`);
  }

  async getEncounters(patientId: string): Promise<Encounter[]> { return this.readArray(`ehr_encounters_${patientId}`); }
  async createEncounter(patientId: string, encounter: Encounter): Promise<Encounter> { return this.pushItem(`ehr_encounters_${patientId}`, encounter); }
  async deleteEncounter(patientId: string, encounterId: string): Promise<void> { this.removeItem(`ehr_encounters_${patientId}`, encounterId); }

  async clearAllPatientEvents(patientId: string): Promise<void> {
    [
      `ehr_conditions_${patientId}`,
      `ehr_procedures_${patientId}`,
      `ehr_medications_${patientId}`,
      `ehr_immunizations_${patientId}`,
      `ehr_service_requests_${patientId}`,
      `ehr_lab_orders_${patientId}`,
      `ehr_observations_${patientId}`,
      `ehr_body_structures_${patientId}`,
      `ehr_allergies_${patientId}`,
      `ehr_provenance_${patientId}`,
      `ehr_encounters_${patientId}`,
      `ehr_questionnaire_responses_${patientId}`,
      `ehr_openehr_compositions_${patientId}`,
      `ehr_death_record_${patientId}`,
      `encounters_${patientId}`,
    ].forEach((key) => this.storageService.removeItem(key));
  }

  hydrateConditionsFromStorage(conditions: Condition[]): Condition[] {
    return conditions;
  }

  normalizeConditionsForStorage(conditions: Condition[]): Condition[] {
    return conditions.map((condition) => this.prepareConditionForStorage(condition));
  }

  hydrateProceduresFromStorage(procedures: Procedure[]): Procedure[] {
    return procedures;
  }

  normalizeProceduresForStorage(procedures: Procedure[]): Procedure[] {
    return procedures.map((procedure) => this.prepareProcedureForStorage(procedure));
  }

  hydrateMedicationsFromStorage(medications: MedicationStatement[]): MedicationStatement[] {
    return medications.map((medication) => this.hydrateMedicationComputedLocation(medication));
  }

  normalizeMedicationsForStorage(medications: MedicationStatement[]): MedicationStatement[] {
    return medications.map((medication) => this.prepareMedicationForStorage(medication));
  }

  readStoredArray<T>(key: string): T[] {
    return this.readValue<T[]>(key, []);
  }

  readStoredValue<T>(key: string, fallback: T): T {
    return this.readValue<T>(key, fallback);
  }

  writeStoredArray<T>(key: string, value: T[]): void {
    this.writeArray(key, value);
  }

  writeStoredValue<T>(key: string, value: T): void {
    this.writeValue(key, value);
  }

  removeStoredKey(key: string): void {
    this.storageService.removeItem(key);
  }

  private readArray<T>(key: string): T[] {
    return this.readValue<T[]>(key, []);
  }

  private readValue<T>(key: string, fallback: T): T {
    const stored = this.storageService.getItem(key);
    if (!stored) {
      return fallback;
    }

    try {
      return JSON.parse(stored) as T;
    } catch {
      return fallback;
    }
  }

  private writeArray<T>(key: string, value: T[]): void {
    this.storageService.saveItem(key, JSON.stringify(value));
  }

  private writeValue<T>(key: string, value: T): void {
    this.storageService.saveItem(key, JSON.stringify(value));
  }

  private pushItem<T extends { id: string }>(key: string, item: T): T {
    const items = this.readArray<T>(key);
    items.push(item);
    this.writeArray(key, items);
    return item;
  }

  private replaceItem<T extends { id: string }>(key: string, itemId: string, item: T): T {
    const items = this.readArray<T>(key).map((existing) => existing.id === itemId ? item : existing);
    this.writeArray(key, items);
    return item;
  }

  private removeItem<T extends { id: string }>(key: string, itemId: string): void {
    const items = this.readArray<T>(key).filter((existing) => existing.id !== itemId);
    this.writeArray(key, items);
  }

  private prepareConditionForStorage(condition: Condition): Condition {
    const { computedLocation, ...conditionWithoutComputedLocation } = condition;
    const bodySite = Array.isArray(condition.bodySite) ? [...condition.bodySite] : [];
    const filteredBodySite = bodySite.filter((site: any) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding: any) => coding?.system === PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM);
    });

    if (!condition.computedLocation) {
      return {
        ...conditionWithoutComputedLocation,
        bodySite: filteredBodySite.length > 0 ? filteredBodySite : undefined
      };
    }

    return {
      ...conditionWithoutComputedLocation,
      bodySite: [
        ...filteredBodySite,
        {
          coding: [
            {
              system: PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM,
              code: condition.computedLocation,
              display: this.toLocationDisplay(condition.computedLocation)
            }
          ],
          text: this.toLocationDisplay(condition.computedLocation)
        }
      ]
    };
  }

  private hydrateConditionComputedLocation(condition: Condition): Condition {
    if (condition.computedLocation) {
      return condition;
    }

    const computedLocation = (condition.bodySite || [])
      .flatMap((site: any) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding: any) => coding?.system === PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;

    return computedLocation ? { ...condition, computedLocation } : condition;
  }

  private prepareProcedureForStorage(procedure: Procedure): Procedure {
    const { computedLocation, ...procedureWithoutComputedLocation } = procedure;
    const bodySite = Array.isArray(procedure.bodySite) ? [...procedure.bodySite] : [];
    const filteredBodySite = bodySite.filter((site: any) => {
      const codings = Array.isArray(site?.coding) ? site.coding : [];
      return !codings.some((coding: any) => coding?.system === PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM);
    });

    if (!procedure.computedLocation) {
      return {
        ...procedureWithoutComputedLocation,
        bodySite: filteredBodySite.length > 0 ? filteredBodySite : undefined
      };
    }

    return {
      ...procedureWithoutComputedLocation,
      bodySite: [
        ...filteredBodySite,
        {
          coding: [
            {
              system: PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM,
              code: procedure.computedLocation,
              display: this.toLocationDisplay(procedure.computedLocation)
            }
          ],
          text: this.toLocationDisplay(procedure.computedLocation)
        }
      ]
    };
  }

  private hydrateProcedureComputedLocation(procedure: Procedure): Procedure {
    if (procedure.computedLocation) {
      return procedure;
    }

    const computedLocation = (procedure.bodySite || [])
      .flatMap((site: any) => Array.isArray(site?.coding) ? site.coding : [])
      .find((coding: any) => coding?.system === PatientLocalStorageService.EHR_LAB_LOCATION_SYSTEM)
      ?.code;

    return computedLocation ? { ...procedure, computedLocation } : procedure;
  }

  private prepareMedicationForStorage(medication: MedicationStatement): MedicationStatement {
    const { computedLocation, ...medicationWithoutComputedLocation } = medication as MedicationStatement & { computedLocation?: string };
    const extensions = Array.isArray((medication as any).extension) ? [...(medication as any).extension] : [];
    const filteredExtensions = extensions.filter((extension: any) => extension?.url !== PatientLocalStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL);

    if (!medication.computedLocation) {
      return {
        ...medicationWithoutComputedLocation,
        extension: filteredExtensions.length > 0 ? filteredExtensions : undefined
      } as MedicationStatement;
    }

    return {
      ...medicationWithoutComputedLocation,
      extension: [
        ...filteredExtensions,
        {
          url: PatientLocalStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL,
          valueCode: medication.computedLocation
        }
      ]
    } as MedicationStatement;
  }

  private hydrateMedicationComputedLocation(medication: MedicationStatement): MedicationStatement {
    if (medication.computedLocation) {
      return medication;
    }

    const extensions = Array.isArray((medication as any).extension) ? (medication as any).extension : [];
    const computedLocation = extensions.find(
      (extension: any) => extension?.url === PatientLocalStorageService.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL
    )?.valueCode;

    return computedLocation ? { ...medication, computedLocation } : medication;
  }

  private prepareProvenanceForStorage(provenance: Provenance): Provenance {
    return provenance;
  }

  private toLocationDisplay(locationCode: string): string {
    return locationCode
      .split(/[-_]/g)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) {
        return name.text;
      }
      return [...(name.given || []), name.family].filter(Boolean).join(' ') || `Patient ${patient.id}`;
    }

    return `Patient ${patient.id}`;
  }
}
