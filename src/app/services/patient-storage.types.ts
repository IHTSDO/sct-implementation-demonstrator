import type {
  AllergyIntolerance,
  BodyStructure,
  Condition,
  DeathRecord,
  Encounter,
  FhirObservation,
  LaboratoryOrderGroup,
  MedicationStatement,
  Patient,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest,
} from './patient.service';

export type PersistenceMode = 'local' | 'fhir';

export interface PatientPaginationState {
  hasNext: boolean;
  hasPrevious: boolean;
  nextUrl: string | null;
  previousUrl: string | null;
  loading: boolean;
  pageSize: number;
  total: number | null;
}

export interface PatientPage {
  patients: Patient[];
  nextUrl: string | null;
  previousUrl: string | null;
  total: number | null;
}

export interface AiAssistedEntryTransactionPayload {
  encounter: Encounter | null;
  conditions: Condition[];
  procedures: Procedure[];
  medications: MedicationStatement[];
  allergies: AllergyIntolerance[];
}

export interface AiAssistedEntryTransactionResult {
  encounter: Encounter | null;
  conditions: Condition[];
  procedures: Procedure[];
  medications: MedicationStatement[];
  allergies: AllergyIntolerance[];
}

export interface PatientStorageBackend {
  listPatientsPage(url?: string): Promise<PatientPage>;
  readPatient(patientId: string): Promise<Patient | null>;
  createPatient(patient: Patient): Promise<Patient>;
  updatePatient(patient: Patient): Promise<Patient>;
  deletePatient(patientId: string): Promise<void>;
  deleteAllPatients(patients: Patient[]): Promise<void>;
  clearAllPatientsAndClinicalData?(): Promise<void>;

  getConditions(patientId: string): Promise<Condition[]>;
  createCondition(patientId: string, condition: Condition): Promise<Condition>;
  updateCondition(patientId: string, conditionId: string, condition: Condition): Promise<Condition>;
  deleteCondition(patientId: string, conditionId: string): Promise<void>;

  getBodyStructures(patientId: string): Promise<BodyStructure[]>;
  createBodyStructure(patientId: string, bodyStructure: BodyStructure): Promise<BodyStructure>;
  updateBodyStructure(patientId: string, bodyStructureId: string, bodyStructure: BodyStructure): Promise<BodyStructure>;
  deleteBodyStructure(patientId: string, bodyStructureId: string): Promise<void>;

  getProcedures(patientId: string): Promise<Procedure[]>;
  createProcedure(patientId: string, procedure: Procedure): Promise<Procedure>;
  updateProcedure(patientId: string, procedureId: string, procedure: Procedure): Promise<Procedure>;
  deleteProcedure(patientId: string, procedureId: string): Promise<void>;

  getMedications(patientId: string): Promise<MedicationStatement[]>;
  createMedication(patientId: string, medication: MedicationStatement): Promise<MedicationStatement>;
  updateMedication(patientId: string, medicationId: string, medication: MedicationStatement): Promise<MedicationStatement>;
  deleteMedication(patientId: string, medicationId: string): Promise<void>;

  getServiceRequests(patientId: string): Promise<ServiceRequest[]>;
  createServiceRequest(patientId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(patientId: string, requestId: string, serviceRequest: ServiceRequest): Promise<ServiceRequest>;
  deleteServiceRequest(patientId: string, requestId: string): Promise<void>;

  getLabOrders(patientId: string): Promise<LaboratoryOrderGroup[]>;
  createLabOrder(patientId: string, labOrder: LaboratoryOrderGroup): Promise<LaboratoryOrderGroup>;
  deleteLabOrder(patientId: string, labOrderId: string): Promise<void>;

  getObservations(patientId: string): Promise<FhirObservation[]>;
  createObservation(patientId: string, observation: FhirObservation): Promise<FhirObservation>;
  updateObservation(patientId: string, observationId: string, observation: FhirObservation): Promise<FhirObservation>;
  deleteObservation(patientId: string, observationId: string): Promise<void>;

  getAllergies(patientId: string): Promise<AllergyIntolerance[]>;
  createAllergy(patientId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance>;
  updateAllergy(patientId: string, allergyId: string, allergy: AllergyIntolerance): Promise<AllergyIntolerance>;
  deleteAllergy(patientId: string, allergyId: string): Promise<void>;

  getQuestionnaireResponses(patientId: string): Promise<QuestionnaireResponse[]>;
  createQuestionnaireResponse(patientId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse>;
  updateQuestionnaireResponse(patientId: string, responseId: string, response: QuestionnaireResponse): Promise<QuestionnaireResponse>;
  deleteQuestionnaireResponse(patientId: string, responseId: string): Promise<void>;

  getDeathRecord(patientId: string): Promise<DeathRecord | null>;
  saveDeathRecord(patientId: string, record: DeathRecord): Promise<DeathRecord>;
  deleteDeathRecord(patientId: string): Promise<void>;

  getEncounters(patientId: string): Promise<Encounter[]>;
  createEncounter(patientId: string, encounter: Encounter): Promise<Encounter>;
  deleteEncounter(patientId: string, encounterId: string): Promise<void>;
  saveAiAssistedEntryTransaction?(
    patientId: string,
    payload: AiAssistedEntryTransactionPayload
  ): Promise<AiAssistedEntryTransactionResult>;

  clearAllPatientEvents(patientId: string): Promise<void>;
}
