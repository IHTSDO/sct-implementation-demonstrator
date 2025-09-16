// FHIR IPS Bundle Interfaces

export interface IPSBundle {
  resourceType: string;
  id: string;
  language?: string;
  identifier?: {
    system: string;
    value: string;
  };
  type: string;
  timestamp: string;
  entry: IPSBundleEntry[];
}

export interface IPSBundleEntry {
  fullUrl: string;
  resource: IPSResource;
}

export type IPSResource = 
  | Patient
  | Condition
  | Procedure
  | MedicationStatement
  | AllergyIntolerance
  | Medication
  | Composition;

export interface Patient {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  active?: boolean;
  name?: Array<{
    family?: string;
    given?: string[];
    use?: string;
  }>;
  telecom?: Array<{
    system: string;
    value: string;
    use?: string;
  }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{
    use?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  contact?: Array<{
    relationship?: Array<{
      coding?: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    name?: {
      family?: string;
      given?: string[];
    };
    telecom?: Array<{
      system: string;
      value: string;
    }>;
    address?: {
      text?: string;
    };
  }>;
}

export interface Condition {
  resourceType: 'Condition';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  verificationStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  severity?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  onsetDateTime?: string;
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetString?: string;
  recordedDate?: string;
}

export interface Procedure {
  resourceType: 'Procedure';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: string;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start?: string;
    end?: string;
  };
  performedString?: string;
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
}

export interface MedicationStatement {
  resourceType: 'MedicationStatement';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  status: string;
  medicationCodeableConcept?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  medicationReference?: {
    reference: string;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  effectiveString?: string;
  dosage?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    doseQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  verificationStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  type?: string;
  category?: string[];
  criticality?: string;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  patient: {
    reference: string;
  };
  onsetDateTime?: string;
  onsetString?: string;
  recordedDate?: string;
  reaction?: Array<{
    substance?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    manifestation: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    severity?: string;
  }>;
}

export interface Medication {
  resourceType: 'Medication';
  id: string;
  code?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  form?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  ingredient?: Array<{
    itemCodeableConcept?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    itemReference?: {
      reference: string;
    };
    isActive?: boolean;
    strength?: {
      numerator?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      denominator?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    };
  }>;
}

export interface Composition {
  resourceType: 'Composition';
  id: string;
  identifier?: {
    system: string;
    value: string;
  };
  status: string;
  type: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  date: string;
  author?: Array<{
    reference: string;
  }>;
  title?: string;
  confidentiality?: string;
  section?: Array<{
    title?: string;
    code?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    entry?: Array<{
      reference: string;
    }>;
  }>;
}

// Processed data interfaces for display
export interface ProcessedPatientData {
  patient: Patient | null;
  conditions: Condition[];
  procedures: Procedure[];
  medications: MedicationStatement[];
  allergies: AllergyIntolerance[];
}
