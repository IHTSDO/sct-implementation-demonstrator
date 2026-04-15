export interface Patient {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  active?: boolean;
  name?: Array<{
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  gender?: string;
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Array<{
    use?: string;
    type?: string;
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  maritalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Array<{
    contentType?: string;
    language?: string;
    data?: string;
    url?: string;
    size?: number;
    hash?: string;
    title?: string;
  }>;
  contact?: Array<{
    relationship?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    name?: {
      use?: string;
      text?: string;
      family?: string;
      given?: string[];
    };
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
    address?: {
      use?: string;
      type?: string;
      text?: string;
      line?: string[];
      city?: string;
      district?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    gender?: string;
    organization?: {
      reference?: string;
      display?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  communication?: Array<{
    language: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    preferred?: boolean;
  }>;
  generalPractitioner?: Array<{
    reference?: string;
    display?: string;
  }>;
  managingOrganization?: {
    reference?: string;
    display?: string;
  };
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
  link?: Array<{
    other?: {
      reference?: string;
      display?: string;
    };
    type?: string;
  }>;
}

export interface Condition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  verificationStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  severity?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  code: {
    coding?: Array<{
      system?: string;
      version?: string;
      code?: string;
      display?: string;
    }>;
    text: string;
  };
  bodySite?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  onsetDateTime?: string;
  onsetAge?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetRange?: {
    low?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    high?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
  };
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  abatementPeriod?: {
    start?: string;
    end?: string;
  };
  abatementRange?: {
    low?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    high?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
  };
  abatementString?: string;
  recordedDate?: string;
  recorder?: {
    reference: string;
    display?: string;
  };
  asserter?: {
    reference: string;
    display?: string;
  };
  stage?: Array<{
    summary?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    assessment?: Array<{
      reference: string;
      display?: string;
    }>;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  evidence?: Array<{
    code?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    detail?: Array<{
      reference: string;
      display?: string;
    }>;
  }>;
  note?: Array<{
    authorReference?: {
      reference: string;
      display?: string;
    };
    authorString?: string;
    time?: string;
    text: string;
  }>;
  bodyStructure?: {
    reference?: string;
    display?: string;
  };
}

export interface BodyStructure {
  resourceType: 'BodyStructure';
  id: string;
  patient: {
    reference: string;
    display?: string;
  };
  includedStructure?: Array<{
    structure: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  note?: Array<{
    text: string;
    time?: string;
  }>;
}

export interface Procedure {
  resourceType: 'Procedure';
  id: string;
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    system?: string;
    value?: string;
    period?: {
      start?: string;
      end?: string;
    };
    assigner?: {
      reference: string;
      display?: string;
    };
  }>;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Array<{
    reference: string;
    display?: string;
  }>;
  partOf?: Array<{
    reference: string;
    display?: string;
  }>;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  category?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  code: {
    coding?: Array<{
      system?: string;
      version?: string;
      code?: string;
      display?: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start?: string;
    end?: string;
  };
  performedString?: string;
  performedAge?: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  };
  performedRange?: {
    low?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    high?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
  };
  recorder?: {
    reference: string;
    display?: string;
  };
  asserter?: {
    reference: string;
    display?: string;
  };
  performer?: Array<{
    function?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    actor: {
      reference: string;
      display?: string;
    };
    onBehalfOf?: {
      reference: string;
      display?: string;
    };
  }>;
  location?: {
    reference: string;
    display?: string;
  };
  reasonCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  reasonReference?: Array<{
    reference: string;
    display?: string;
  }>;
  bodySite?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  outcome?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  report?: Array<{
    reference: string;
    display?: string;
  }>;
  complication?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  complicationDetail?: Array<{
    reference: string;
    display?: string;
  }>;
  followUp?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  note?: Array<{
    authorReference?: {
      reference: string;
      display?: string;
    };
    authorString?: string;
    time?: string;
    text: string;
  }>;
  focalDevice?: Array<{
    action?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    manipulated: {
      reference: string;
      display?: string;
    };
  }>;
  usedReference?: Array<{
    reference: string;
    display?: string;
  }>;
  usedCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  bodyStructure?: {
    reference?: string;
    display?: string;
  };
  snomedConceptId?: string;
}

export interface MedicationStatement {
  resourceType: 'MedicationStatement';
  id: string;
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    system?: string;
    value?: string;
    period?: {
      start?: string;
      end?: string;
    };
    assigner?: {
      reference: string;
      display?: string;
    };
  }>;
  basedOn?: Array<{
    reference: string;
    display?: string;
  }>;
  partOf?: Array<{
    reference: string;
    display?: string;
  }>;
  status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken';
  statusReason?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  category?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text: string;
  };
  medicationReference?: {
    reference: string;
    display?: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  context?: {
    reference: string;
    display?: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  dateAsserted?: string;
  informationSource?: {
    reference: string;
    display?: string;
  };
  derivedFrom?: Array<{
    reference: string;
    display?: string;
  }>;
  reasonCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  reasonReference?: Array<{
    reference: string;
    display?: string;
  }>;
  note?: Array<{
    authorReference?: {
      reference: string;
      display?: string;
    };
    authorString?: string;
    time?: string;
    text: string;
  }>;
  dosage?: Array<{
    sequence?: number;
    text?: string;
    additionalInstruction?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    patientInstruction?: string;
    timing?: {
      event?: string[];
      repeat?: {
        boundsDuration?: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
        boundsRange?: {
          low?: {
            value: number;
            unit: string;
            system?: string;
            code?: string;
          };
          high?: {
            value: number;
            unit: string;
            system?: string;
            code?: string;
          };
        };
        boundsPeriod?: {
          start?: string;
          end?: string;
        };
        count?: number;
        countMax?: number;
        duration?: number;
        durationMax?: number;
        durationUnit?: string;
        frequency?: number;
        frequencyMax?: number;
        period?: number;
        periodMax?: number;
        periodUnit?: string;
        dayOfWeek?: string[];
        timeOfDay?: string[];
        when?: string[];
        offset?: number;
      };
      code?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
    };
    asNeededBoolean?: boolean;
    asNeededCodeableConcept?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    site?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    route?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    method?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    doseAndRate?: Array<{
      type?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      doseRange?: {
        low?: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
        high?: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
      };
      doseQuantity?: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
      };
      rateRatio?: {
        numerator: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
        denominator: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
      };
      rateRange?: {
        low?: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
        high?: {
          value: number;
          unit: string;
          system?: string;
          code?: string;
        };
      };
      rateQuantity?: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
      };
    }>;
    maxDosePerPeriod?: {
      numerator: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
      };
      denominator: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
      };
    };
    maxDosePerAdministration?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    maxDosePerLifetime?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
  }>;
  snomedConceptId?: string;
}

export interface Immunization {
  resourceType: 'Immunization';
  id: string;
  identifier?: Array<{
    system?: string;
    value?: string;
  }>;
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  vaccineCode: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  patient: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference?: string;
    display?: string;
  };
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference?: string;
      display?: string;
    };
  }>;
}

export interface ServiceRequest {
  resourceType: 'ServiceRequest';
  id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  code: {
    coding?: Array<{
      system?: string;
      version?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  authoredOn?: string;
  occurrenceDateTime?: string;
  specimen?: Array<{
    reference?: string;
    display?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
  }>;
  note?: Array<{
    text: string;
    time?: string;
  }>;
}

export interface LaboratoryOrderGroup {
  id: string;
  patientId: string;
  patientDisplay?: string;
  createdAt: string;
  serviceRequests: ServiceRequest[];
  fhirBundle: any;
  fhirBundleStr: string;
}

export interface Encounter {
  resourceType: 'Encounter';
  id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  period: {
    start: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  diagnosis?: Array<{
    condition: {
      reference: string;
      display?: string;
    };
    use?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    rank?: number;
  }>;
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference: string;
    };
  }>;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  bodySite?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  method?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  component?: Array<{
    code: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference: string;
      display?: string;
    };
  }>;
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    system?: string;
    value?: string;
    period?: {
      start?: string;
      end?: string;
    };
    assigner?: {
      reference: string;
      display?: string;
    };
  }>;
  clinicalStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  verificationStatus?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  patient?: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  onsetDateTime?: string;
  onsetAge?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetRange?: {
    low?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    high?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  };
  onsetString?: string;
  recordedDate?: string;
  recorder?: {
    reference: string;
    display?: string;
  };
  asserter?: {
    reference: string;
    display?: string;
  };
  lastOccurrence?: string;
  note?: Array<{
    authorReference?: {
      reference: string;
      display?: string;
    };
    authorString?: string;
    time?: string;
    text: string;
  }>;
  reaction?: Array<{
    substance?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    manifestation?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    description?: string;
    onset?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    exposureRoute?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    note?: Array<{
      authorReference?: {
        reference: string;
        display?: string;
      };
      authorString?: string;
      time?: string;
      text: string;
    }>;
  }>;
}

export interface QuestionnaireResponse {
  resourceType: 'QuestionnaireResponse';
  id: string;
  identifier?: {
    system?: string;
    value?: string;
  };
  questionnaire?: string;
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped';
  subject?: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  authored?: string;
  author?: {
    reference: string;
    display?: string;
  };
  source?: {
    reference: string;
    display?: string;
  };
  item?: Array<any>;
  questionnaireTitle?: string;
  questionnaireId?: string;
  questionnaireName?: string;
}

export interface Provenance {
  resourceType: 'Provenance';
  id: string;
  recorded?: string;
  target: Array<{
    reference: string;
    display?: string;
  }>;
  patient?: {
    reference: string;
    display?: string;
  };
  activity?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  agent?: Array<{
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    role?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    who?: {
      reference?: string;
      display?: string;
    };
    onBehalfOf?: {
      reference?: string;
      display?: string;
    };
  }>;
  entity?: Array<{
    role?: 'source' | 'derivation' | 'revision' | 'quotation' | 'remove';
    what: {
      reference?: string;
      display?: string;
      identifier?: {
        system?: string;
        value?: string;
      };
    };
  }>;
  text?: {
    status?: 'generated' | 'extensions' | 'additional' | 'empty';
    div?: string;
  };
}

export interface OpenEHRComposition {
  resourceType: 'OpenEHRComposition';
  id: string;
  templateId: string;
  templateName?: string;
  composition: any;
  webTemplate?: any;
  authored?: string;
  subject?: {
    reference: string;
    display?: string;
  };
  compositionName?: string;
}

export interface DeathRecordDiagnosis {
  sourceType: 'existing-condition' | 'snomed-search';
  sourceConditionId?: string;
  text: string;
  intervalText?: string;
  snomedConceptId?: string;
  snomedDisplay?: string;
  icd10Code?: string;
  derivedConditionId?: string;
}

export interface DeathRecord {
  resourceType: 'Bundle';
  id: string;
  type: 'document';
  authored?: string;
  identifier: {
    system: string;
    value: string;
  };
  timestamp: string;
  meta?: {
    profile?: string[];
  };
  entry: Array<{
    fullUrl: string;
    resource: any;
  }>;
}

export interface ClinicalDataLoadSummary {
  totalResources: number;
  counts: {
    conditions: number;
    bodyStructures: number;
    procedures: number;
    medications: number;
    immunizations: number;
    serviceRequests: number;
    labOrders: number;
    observations: number;
    allergies: number;
    questionnaireResponses: number;
    encounters: number;
    deathRecords: number;
  };
}

export interface PatientSimilarityResult {
  patient: Patient;
  score: number;
  matches?: string[];
  breakdown?: {
    nameScore: number;
    birthDateScore: number;
    genderScore: number;
  };
}
