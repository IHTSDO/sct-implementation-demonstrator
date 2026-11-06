/**
 * Curated configuration overlay for the EHDS Patient Summary demonstrator.
 *
 * This is the hand-editable layer of the hybrid generator. It decides:
 *   - which sections of the EPS Composition we surface,
 *   - which fields of each resource to show (we focus on SNOMED-coded fields
 *     plus a few clarifying ones — NOT every optional element), and
 *   - the ECL bindings and coded option lists (these live in the base EU Core
 *     value sets, not in the EPS obligation profiles).
 *
 * The generator (generate-eps-sections.mjs) cross-checks every field listed here
 * against the EPS StructureDefinitions in ./eps-package and fills in the real
 * cardinality / must-support flags. To add a section or field, edit this file
 * and re-run the generator; do not edit eps-sections.generated.ts by hand.
 */

export interface EpsFieldConfig {
  key: string;
  path: string;
  label: string;
  control: 'snomed' | 'text' | 'textarea' | 'date' | 'dropdown';
  binding?: { ecl: string; title: string; note?: string };
  options?: { code: string; system: string; display: string }[];
  system?: string;
  hint?: string;
}

export interface EpsSectionConfig {
  key: string;
  /** 'resource' (default) or 'narrative' (free-text section). */
  kind?: 'resource' | 'narrative';
  title: string;
  loincCode: string;
  resourceType: string;
  /** File name (without extension) of the EPS StructureDefinition under ./eps-package. */
  profileFile: string;
  profile: string;
  icon: string;
  description: string;
  fields: EpsFieldConfig[];
}

const CLINICAL_STATUS = 'http://terminology.hl7.org/CodeSystem/condition-clinical';
const ALLERGY_CLINICAL_STATUS = 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical';
const SCT = 'http://snomed.info/sct';
const EVENT_STATUS = 'http://hl7.org/fhir/event-status';
const FLAG_STATUS = 'http://hl7.org/fhir/flag-status';
const FLAG_CATEGORY = 'http://terminology.hl7.org/CodeSystem/flag-category';
const DEVICE_STMT_STATUS = 'http://hl7.org/fhir/device-statement-status';
const OBSERVATION_STATUS = 'http://hl7.org/fhir/observation-status';
const ISO3166 = 'urn:iso:std:iso:3166';

const COUNTRY_OPTIONS = [
  { code: 'AT', display: 'Austria' }, { code: 'BE', display: 'Belgium' },
  { code: 'BR', display: 'Brazil' }, { code: 'CA', display: 'Canada' },
  { code: 'CH', display: 'Switzerland' }, { code: 'CN', display: 'China' },
  { code: 'DE', display: 'Germany' }, { code: 'DK', display: 'Denmark' },
  { code: 'EG', display: 'Egypt' }, { code: 'ES', display: 'Spain' },
  { code: 'FR', display: 'France' }, { code: 'GB', display: 'United Kingdom' },
  { code: 'GR', display: 'Greece' }, { code: 'IE', display: 'Ireland' },
  { code: 'IN', display: 'India' }, { code: 'IT', display: 'Italy' },
  { code: 'JP', display: 'Japan' }, { code: 'KE', display: 'Kenya' },
  { code: 'MX', display: 'Mexico' }, { code: 'NL', display: 'Netherlands' },
  { code: 'NO', display: 'Norway' }, { code: 'PT', display: 'Portugal' },
  { code: 'SE', display: 'Sweden' }, { code: 'TH', display: 'Thailand' },
  { code: 'TR', display: 'Türkiye' }, { code: 'US', display: 'United States' },
  { code: 'ZA', display: 'South Africa' },
].map((c) => ({ code: c.code, system: ISO3166, display: c.display }));

export const EPS_SECTIONS_CONFIG: EpsSectionConfig[] = [
  {
    key: 'problems',
    title: 'Problems',
    loincCode: '11450-4',
    resourceType: 'Condition',
    profileFile: 'StructureDefinition-condition-obl-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/condition-obl-eu-eps',
    icon: 'coronavirus',
    description: 'Active problems and diagnoses on the patient’s problem list.',
    fields: [
      {
        key: 'code',
        path: 'Condition.code',
        label: 'Problem',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 404684003 |Clinical finding (finding)| OR << 243796009 |Situation with explicit context (situation)|',
          title: 'Problem / Diagnosis',
          note: 'Search a clinical finding or disorder',
        },
      },
      {
        key: 'clinicalStatus',
        path: 'Condition.clinicalStatus',
        label: 'Clinical status',
        control: 'dropdown',
        system: CLINICAL_STATUS,
        options: [
          { code: 'active', system: CLINICAL_STATUS, display: 'Active' },
          { code: 'recurrence', system: CLINICAL_STATUS, display: 'Recurrence' },
          { code: 'relapse', system: CLINICAL_STATUS, display: 'Relapse' },
          { code: 'inactive', system: CLINICAL_STATUS, display: 'Inactive' },
          { code: 'remission', system: CLINICAL_STATUS, display: 'Remission' },
          { code: 'resolved', system: CLINICAL_STATUS, display: 'Resolved' },
        ],
      },
      {
        key: 'severity',
        path: 'Condition.severity',
        label: 'Severity',
        control: 'dropdown',
        system: SCT,
        options: [
          { code: '255604002', system: SCT, display: 'Mild' },
          { code: '6736007', system: SCT, display: 'Moderate' },
          { code: '24484000', system: SCT, display: 'Severe' },
        ],
      },
      {
        key: 'onset',
        path: 'Condition.onset[x]',
        label: 'Onset date',
        control: 'date',
      },
    ],
  },
  {
    key: 'allergies',
    title: 'Allergies & Intolerances',
    loincCode: '48765-2',
    resourceType: 'AllergyIntolerance',
    profileFile: 'StructureDefinition-allergyintolerance-obl-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/allergyintolerance-obl-eu-eps',
    icon: 'warning_amber',
    description: 'Allergies and intolerances, including the causative agent and reaction.',
    fields: [
      {
        key: 'code',
        path: 'AllergyIntolerance.code',
        label: 'Causative agent',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '< 105590001 |Substance (substance)| OR < 763158003 |Medicinal product (product)|',
          title: 'Allergy / Intolerance agent',
          note: 'Search a substance or medicinal product',
        },
      },
      {
        key: 'type',
        path: 'AllergyIntolerance.type',
        label: 'Type',
        control: 'dropdown',
        system: 'http://hl7.org/fhir/allergy-intolerance-type',
        options: [
          { code: 'allergy', system: 'http://hl7.org/fhir/allergy-intolerance-type', display: 'Allergy' },
          { code: 'intolerance', system: 'http://hl7.org/fhir/allergy-intolerance-type', display: 'Intolerance' },
        ],
      },
      {
        key: 'clinicalStatus',
        path: 'AllergyIntolerance.clinicalStatus',
        label: 'Clinical status',
        control: 'dropdown',
        system: ALLERGY_CLINICAL_STATUS,
        options: [
          { code: 'active', system: ALLERGY_CLINICAL_STATUS, display: 'Active' },
          { code: 'inactive', system: ALLERGY_CLINICAL_STATUS, display: 'Inactive' },
          { code: 'resolved', system: ALLERGY_CLINICAL_STATUS, display: 'Resolved' },
        ],
      },
      {
        key: 'manifestation',
        path: 'AllergyIntolerance.reaction.manifestation',
        label: 'Reaction manifestation',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 404684003 |Clinical finding (finding)|',
          title: 'Reaction manifestation',
          note: 'Search the clinical manifestation of the reaction',
        },
      },
      {
        key: 'reactionSeverity',
        path: 'AllergyIntolerance.reaction.severity',
        label: 'Reaction severity',
        control: 'dropdown',
        system: 'http://hl7.org/fhir/reaction-event-severity',
        options: [
          { code: 'mild', system: 'http://hl7.org/fhir/reaction-event-severity', display: 'Mild' },
          { code: 'moderate', system: 'http://hl7.org/fhir/reaction-event-severity', display: 'Moderate' },
          { code: 'severe', system: 'http://hl7.org/fhir/reaction-event-severity', display: 'Severe' },
        ],
      },
      {
        key: 'onset',
        path: 'AllergyIntolerance.onset[x]',
        label: 'Onset date',
        control: 'date',
      },
    ],
  },
  {
    key: 'medications',
    title: 'Medication Summary',
    loincCode: '10160-0',
    resourceType: 'MedicationStatement',
    profileFile: 'StructureDefinition-MedicationStatement-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/MedicationStatement-eu-eps',
    icon: 'medication',
    description: 'Current and relevant past medication, as a coded product with dosage.',
    fields: [
      {
        key: 'medication',
        path: 'MedicationStatement.medication[x]',
        label: 'Medicinal product',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 763158003 |Medicinal product (product)|',
          title: 'Medicinal product',
          note: 'Search a medicinal product',
        },
      },
      {
        key: 'status',
        path: 'MedicationStatement.status',
        label: 'Status',
        control: 'dropdown',
        system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status',
        options: [
          { code: 'active', system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status', display: 'Active' },
          { code: 'completed', system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status', display: 'Completed' },
          { code: 'stopped', system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status', display: 'Stopped' },
          { code: 'on-hold', system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status', display: 'On hold' },
          { code: 'intended', system: 'http://hl7.org/fhir/CodeSystem/medication-statement-status', display: 'Intended' },
        ],
      },
      {
        key: 'effective',
        path: 'MedicationStatement.effective[x]',
        label: 'Effective date',
        control: 'date',
      },
      {
        key: 'dosageText',
        path: 'MedicationStatement.dosage.text',
        label: 'Dosage instructions',
        control: 'text',
        hint: 'Free-text dosage, e.g. “1 tablet every 8 hours”',
      },
    ],
  },
  {
    key: 'immunizations',
    title: 'Immunizations',
    loincCode: '11369-6',
    resourceType: 'Immunization',
    profileFile: 'StructureDefinition-immunization-obl-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/immunization-obl-eu-eps',
    icon: 'vaccines',
    description: 'Immunization history: vaccines administered to the patient.',
    fields: [
      {
        key: 'vaccineCode',
        path: 'Immunization.vaccineCode',
        label: 'Vaccine',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 787859002 |Vaccine product (product)|',
          title: 'Vaccine',
          note: 'Search a vaccine product',
        },
      },
      {
        key: 'status',
        path: 'Immunization.status',
        label: 'Status',
        control: 'dropdown',
        system: EVENT_STATUS,
        options: [
          { code: 'completed', system: EVENT_STATUS, display: 'Completed' },
          { code: 'entered-in-error', system: EVENT_STATUS, display: 'Entered in error' },
          { code: 'not-done', system: EVENT_STATUS, display: 'Not done' },
        ],
      },
      {
        key: 'occurrence',
        path: 'Immunization.occurrence[x]',
        label: 'Date administered',
        control: 'date',
      },
      {
        key: 'site',
        path: 'Immunization.site',
        label: 'Body site',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 123037004 |Body structure (body structure)|',
          title: 'Administration site',
          note: 'Search a body structure',
        },
      },
    ],
  },
  {
    key: 'procedures',
    title: 'Procedures',
    loincCode: '47519-4',
    resourceType: 'Procedure',
    profileFile: 'StructureDefinition-procedure-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/procedure-eu-eps',
    icon: 'medical_information',
    description: 'History of procedures performed on the patient.',
    fields: [
      {
        key: 'code',
        path: 'Procedure.code',
        label: 'Procedure',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 71388002 |Procedure (procedure)|',
          title: 'Procedure',
          note: 'Search a procedure',
        },
      },
      {
        key: 'status',
        path: 'Procedure.status',
        label: 'Status',
        control: 'dropdown',
        system: EVENT_STATUS,
        options: [
          { code: 'preparation', system: EVENT_STATUS, display: 'Preparation' },
          { code: 'in-progress', system: EVENT_STATUS, display: 'In progress' },
          { code: 'not-done', system: EVENT_STATUS, display: 'Not done' },
          { code: 'on-hold', system: EVENT_STATUS, display: 'On hold' },
          { code: 'stopped', system: EVENT_STATUS, display: 'Stopped' },
          { code: 'completed', system: EVENT_STATUS, display: 'Completed' },
          { code: 'entered-in-error', system: EVENT_STATUS, display: 'Entered in error' },
          { code: 'unknown', system: EVENT_STATUS, display: 'Unknown' },
        ],
      },
      {
        key: 'performed',
        path: 'Procedure.performed[x]',
        label: 'Performed date',
        control: 'date',
      },
      {
        key: 'bodySite',
        path: 'Procedure.bodySite',
        label: 'Body site',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 123037004 |Body structure (body structure)|',
          title: 'Body site',
          note: 'Search a body structure',
        },
      },
    ],
  },
  {
    key: 'alerts',
    title: 'Alerts',
    loincCode: '104605-1',
    resourceType: 'Flag',
    profileFile: 'StructureDefinition-flag-alert-obl-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/flag-alert-obl-eu-eps',
    icon: 'flag',
    description: 'Clinical alerts and flags to be aware of for this patient.',
    fields: [
      {
        key: 'code',
        path: 'Flag.code',
        label: 'Alert',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 404684003 |Clinical finding (finding)| OR << 243796009 |Situation with explicit context (situation)|',
          title: 'Alert',
          note: 'Search a clinical finding or situation',
        },
      },
      {
        key: 'category',
        path: 'Flag.category',
        label: 'Category',
        control: 'dropdown',
        system: FLAG_CATEGORY,
        options: [
          { code: 'clinical', system: FLAG_CATEGORY, display: 'Clinical' },
          { code: 'drug', system: FLAG_CATEGORY, display: 'Drug' },
          { code: 'lab', system: FLAG_CATEGORY, display: 'Laboratory' },
          { code: 'diet', system: FLAG_CATEGORY, display: 'Diet' },
          { code: 'safety', system: FLAG_CATEGORY, display: 'Safety' },
          { code: 'behavioral', system: FLAG_CATEGORY, display: 'Behavioral' },
        ],
      },
      {
        key: 'status',
        path: 'Flag.status',
        label: 'Status',
        control: 'dropdown',
        system: FLAG_STATUS,
        options: [
          { code: 'active', system: FLAG_STATUS, display: 'Active' },
          { code: 'inactive', system: FLAG_STATUS, display: 'Inactive' },
          { code: 'entered-in-error', system: FLAG_STATUS, display: 'Entered in error' },
        ],
      },
    ],
  },
  {
    key: 'medicalDevices',
    title: 'Medical Devices',
    loincCode: '46264-8',
    resourceType: 'DeviceUseStatement',
    profileFile: 'StructureDefinition-deviceUseStatement-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/deviceUseStatement-eu-eps',
    icon: 'monitor_heart',
    description: 'Medical devices and implants used by the patient.',
    fields: [
      {
        key: 'deviceType',
        path: 'Device.type',
        label: 'Device',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 49062001 |Device (physical object)|',
          title: 'Device type',
          note: 'Search a medical device',
        },
      },
      {
        key: 'status',
        path: 'DeviceUseStatement.status',
        label: 'Status',
        control: 'dropdown',
        system: DEVICE_STMT_STATUS,
        options: [
          { code: 'active', system: DEVICE_STMT_STATUS, display: 'Active' },
          { code: 'completed', system: DEVICE_STMT_STATUS, display: 'Completed' },
          { code: 'intended', system: DEVICE_STMT_STATUS, display: 'Intended' },
          { code: 'on-hold', system: DEVICE_STMT_STATUS, display: 'On hold' },
          { code: 'stopped', system: DEVICE_STMT_STATUS, display: 'Stopped' },
          { code: 'entered-in-error', system: DEVICE_STMT_STATUS, display: 'Entered in error' },
        ],
      },
      {
        key: 'timing',
        path: 'DeviceUseStatement.timing[x]',
        label: 'In use since',
        control: 'date',
      },
      {
        key: 'bodySite',
        path: 'DeviceUseStatement.bodySite',
        label: 'Body site',
        control: 'snomed',
        system: SCT,
        binding: {
          ecl: '<< 123037004 |Body structure (body structure)|',
          title: 'Body site',
          note: 'Search a body structure',
        },
      },
    ],
  },
  {
    key: 'travelHistory',
    title: 'Travel History',
    loincCode: '10182-4',
    resourceType: 'Observation',
    profileFile: 'StructureDefinition-observation-travel-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/observation-travel-eu-eps',
    icon: 'flight',
    description: 'Countries visited, relevant for exposure and infectious risk.',
    fields: [
      {
        key: 'country',
        path: 'Observation.value[x]',
        label: 'Country visited',
        control: 'dropdown',
        system: ISO3166,
        options: COUNTRY_OPTIONS,
      },
      {
        key: 'effective',
        path: 'Observation.effective[x]',
        label: 'Date / period',
        control: 'date',
      },
      {
        key: 'status',
        path: 'Observation.status',
        label: 'Status',
        control: 'dropdown',
        system: OBSERVATION_STATUS,
        options: [
          { code: 'final', system: OBSERVATION_STATUS, display: 'Final' },
          { code: 'preliminary', system: OBSERVATION_STATUS, display: 'Preliminary' },
          { code: 'amended', system: OBSERVATION_STATUS, display: 'Amended' },
          { code: 'entered-in-error', system: OBSERVATION_STATUS, display: 'Entered in error' },
        ],
      },
    ],
  },
  {
    key: 'patientStory',
    kind: 'narrative',
    title: 'Patient Story',
    loincCode: '81338-6',
    resourceType: 'Composition',
    profileFile: 'StructureDefinition-composition-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/composition-eu-eps',
    icon: 'menu_book',
    description: 'The patient’s own narrative — goals, preferences and concerns.',
    fields: [],
  },
  {
    key: 'patientHistory',
    kind: 'narrative',
    title: 'History of Past Illness',
    loincCode: '11329-0',
    resourceType: 'Composition',
    profileFile: 'StructureDefinition-composition-eu-eps',
    profile: 'http://hl7.eu/fhir/eps/StructureDefinition/composition-eu-eps',
    icon: 'history_edu',
    description: 'Narrative summary of the patient’s past medical history.',
    fields: [],
  },
];
