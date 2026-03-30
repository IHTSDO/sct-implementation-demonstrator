export type FlatPatientResourceType =
  | 'BodyStructure'
  | 'Condition'
  | 'Procedure'
  | 'MedicationStatement'
  | 'Immunization'
  | 'AllergyIntolerance'
  | 'Provenance'
  | 'Observation'
  | 'Encounter'
  | 'QuestionnaireResponse'
  | 'ServiceRequest';

export interface FlatPatientResourceCatalogEntry {
  resourceType: FlatPatientResourceType;
  title: string;
  icon: string;
  iconFontSet?: string;
  patientServiceGetter: string;
  fhirStorageGetter: string;
  exportFullUrlPrefix: string;
}

export const FLAT_PATIENT_RESOURCE_CATALOG: FlatPatientResourceCatalogEntry[] = [
  {
    resourceType: 'BodyStructure',
    title: 'BodyStructure',
    icon: 'body_system',
    iconFontSet: 'material-symbols-outlined',
    patientServiceGetter: 'getPatientBodyStructures',
    fhirStorageGetter: 'getBodyStructures',
    exportFullUrlPrefix: 'body-structure'
  },
  {
    resourceType: 'Condition',
    title: 'Condition',
    icon: 'stethoscope',
    iconFontSet: 'material-symbols-outlined',
    patientServiceGetter: 'getPatientConditions',
    fhirStorageGetter: 'getConditions',
    exportFullUrlPrefix: 'condition'
  },
  {
    resourceType: 'Procedure',
    title: 'Procedure',
    icon: 'healing',
    patientServiceGetter: 'getPatientProcedures',
    fhirStorageGetter: 'getProcedures',
    exportFullUrlPrefix: 'procedure'
  },
  {
    resourceType: 'MedicationStatement',
    title: 'MedicationStatement',
    icon: 'medication',
    patientServiceGetter: 'getPatientMedications',
    fhirStorageGetter: 'getMedications',
    exportFullUrlPrefix: 'medication'
  },
  {
    resourceType: 'Immunization',
    title: 'Immunization',
    icon: 'vaccines',
    patientServiceGetter: 'getPatientImmunizations',
    fhirStorageGetter: 'getImmunizations',
    exportFullUrlPrefix: 'immunization'
  },
  {
    resourceType: 'AllergyIntolerance',
    title: 'AllergyIntolerance',
    icon: 'warning',
    patientServiceGetter: 'getPatientAllergies',
    fhirStorageGetter: 'getAllergies',
    exportFullUrlPrefix: 'allergy'
  },
  {
    resourceType: 'Provenance',
    title: 'Provenance',
    icon: 'history_edu',
    patientServiceGetter: 'getPatientProvenance',
    fhirStorageGetter: 'getProvenance',
    exportFullUrlPrefix: 'provenance'
  },
  {
    resourceType: 'Observation',
    title: 'Observation',
    icon: 'monitor_heart',
    patientServiceGetter: 'getPatientObservations',
    fhirStorageGetter: 'getObservations',
    exportFullUrlPrefix: 'observation'
  },
  {
    resourceType: 'Encounter',
    title: 'Encounter',
    icon: 'event_note',
    patientServiceGetter: 'getPatientEncounters',
    fhirStorageGetter: 'getEncounters',
    exportFullUrlPrefix: 'encounter'
  },
  {
    resourceType: 'QuestionnaireResponse',
    title: 'QuestionnaireResponse',
    icon: 'assignment',
    patientServiceGetter: 'getPatientQuestionnaireResponses',
    fhirStorageGetter: 'getQuestionnaireResponses',
    exportFullUrlPrefix: 'questionnaire'
  },
  {
    resourceType: 'ServiceRequest',
    title: 'ServiceRequest',
    icon: 'biotech',
    patientServiceGetter: 'getPatientServiceRequests',
    fhirStorageGetter: 'getServiceRequests',
    exportFullUrlPrefix: 'service-request'
  }
];
