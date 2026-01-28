/**
 * Example data for Diagnostic Report form
 * Pre-configured examples for Patient, Performer, and Results Interpreter selection
 */

import { SpecimenData } from '../specimen-form/specimen-form.component';

export interface ReferenceExample {
  reference: string;
  display: string;
  type?: string;
  identifier?: {
    system: string;
    value: string;
  };
}

export interface ServiceRequestExample extends ReferenceExample {
  subjectReference?: string; // Reference to Patient
  specimenReference?: string; // Reference to Specimen (optional)
}

export const PATIENT_EXAMPLES: ReferenceExample[] = [
  {
    reference: 'Patient/example-patient-001',
    display: 'John Doe (M, 45 years)',
    type: 'Patient',
    identifier: {
      system: 'http://hospital.example.org/patients',
      value: 'PAT-001'
    }
  },
  {
    reference: 'Patient/example-patient-002',
    display: 'Jane Smith (F, 32 years)',
    type: 'Patient',
    identifier: {
      system: 'http://hospital.example.org/patients',
      value: 'PAT-002'
    }
  },
  {
    reference: 'Patient/example-patient-003',
    display: 'Robert Johnson (M, 58 years)',
    type: 'Patient',
    identifier: {
      system: 'http://hospital.example.org/patients',
      value: 'PAT-003'
    }
  }
];

export const PERFORMER_EXAMPLES: ReferenceExample[] = [
  {
    reference: 'Practitioner/example-practitioner-001',
    display: 'Dr. Sarah Williams, MD - Clinical Pathologist',
    type: 'Practitioner',
    identifier: {
      system: 'http://hospital.example.org/practitioners',
      value: 'PRAC-001'
    }
  },
  {
    reference: 'Organization/example-org-lab-001',
    display: 'Central Laboratory - Main Campus',
    type: 'Organization',
    identifier: {
      system: 'http://hospital.example.org/organizations',
      value: 'ORG-LAB-001'
    }
  },
  {
    reference: 'Practitioner/example-practitioner-002',
    display: 'Dr. Michael Chen, PhD - Laboratory Director',
    type: 'Practitioner',
    identifier: {
      system: 'http://hospital.example.org/practitioners',
      value: 'PRAC-002'
    }
  }
];

export const RESULTS_INTERPRETER_EXAMPLES: ReferenceExample[] = [
  {
    reference: 'Practitioner/example-interpreter-001',
    display: 'Dr. Emily Rodriguez, MD - Pathologist',
    type: 'Practitioner',
    identifier: {
      system: 'http://hospital.example.org/practitioners',
      value: 'INT-001'
    }
  },
  {
    reference: 'Practitioner/example-interpreter-002',
    display: 'Dr. David Thompson, MD - Clinical Biochemist',
    type: 'Practitioner',
    identifier: {
      system: 'http://hospital.example.org/practitioners',
      value: 'INT-002'
    }
  },
  {
    reference: 'Organization/example-org-interpretation-001',
    display: 'Clinical Interpretation Service',
    type: 'Organization',
    identifier: {
      system: 'http://hospital.example.org/organizations',
      value: 'ORG-INT-001'
    }
  }
];

export const SERVICE_REQUEST_EXAMPLES: ServiceRequestExample[] = [
  {
    reference: 'ServiceRequest/example-sr-001',
    display: 'Complete Blood Count (CBC) - Request #SR-001',
    type: 'ServiceRequest',
    identifier: {
      system: 'http://hospital.example.org/service-requests',
      value: 'SR-001'
    },
    subjectReference: 'Patient/example-patient-001',
    specimenReference: 'Specimen/example-specimen-001'
  },
  {
    reference: 'ServiceRequest/example-sr-002',
    display: 'Basic Metabolic Panel (BMP) - Request #SR-002',
    type: 'ServiceRequest',
    identifier: {
      system: 'http://hospital.example.org/service-requests',
      value: 'SR-002'
    },
    subjectReference: 'Patient/example-patient-002',
    specimenReference: 'Specimen/example-specimen-002'
  },
  {
    reference: 'ServiceRequest/example-sr-003',
    display: 'Lipid Panel - Request #SR-003',
    type: 'ServiceRequest',
    identifier: {
      system: 'http://hospital.example.org/service-requests',
      value: 'SR-003'
    },
    subjectReference: 'Patient/example-patient-001',
    specimenReference: 'Specimen/example-specimen-003'
  },
  {
    reference: 'ServiceRequest/example-sr-004',
    display: 'Liver Function Tests (LFT) - Request #SR-004',
    type: 'ServiceRequest',
    identifier: {
      system: 'http://hospital.example.org/service-requests',
      value: 'SR-004'
    },
    subjectReference: 'Patient/example-patient-003',
    specimenReference: 'Specimen/example-specimen-004'
  }
];

// Specimen examples mapped by reference
export const SPECIMEN_EXAMPLES: { [key: string]: SpecimenData } = {
  'Specimen/example-specimen-001': {
    status: 'available',
    referenceNumber: 'Specimen1',
    type: {
      code: '122555007',
      system: 'http://snomed.info/sct',
      display: 'Venous blood specimen'
    },
    receivedTime: new Date(),
    collectionBodySite: {
      code: '368208006',
      display: 'Vein structure'
    },
    collectionMethod: {
      code: '82078001',
      system: 'http://snomed.info/sct',
      display: 'Venipuncture'
    },
    collectionFastingStatus: null,
    processingProcedure: null,
    additive: null,
    containerType: {
      code: '467989009',
      system: 'http://snomed.info/sct',
      display: 'Blood collection tube'
    },
    condition: null
  },
  'Specimen/example-specimen-002': {
    status: 'available',
    referenceNumber: 'Specimen2',
    type: {
      code: '122555007',
      system: 'http://snomed.info/sct',
      display: 'Venous blood specimen'
    },
    receivedTime: new Date(),
    collectionBodySite: {
      code: '368208006',
      display: 'Vein structure'
    },
    collectionMethod: {
      code: '82078001',
      system: 'http://snomed.info/sct',
      display: 'Venipuncture'
    },
    collectionFastingStatus: {
      code: '39801008',
      system: 'http://snomed.info/sct',
      display: 'Fasting'
    },
    processingProcedure: null,
    additive: null,
    containerType: {
      code: '467989009',
      system: 'http://snomed.info/sct',
      display: 'Blood collection tube'
    },
    condition: null
  },
  'Specimen/example-specimen-003': {
    status: 'available',
    referenceNumber: 'Specimen3',
    type: {
      code: '122555007',
      system: 'http://snomed.info/sct',
      display: 'Venous blood specimen'
    },
    receivedTime: new Date(),
    collectionBodySite: {
      code: '368208006',
      display: 'Vein structure'
    },
    collectionMethod: {
      code: '82078001',
      system: 'http://snomed.info/sct',
      display: 'Venipuncture'
    },
    collectionFastingStatus: {
      code: '260415000',
      system: 'http://snomed.info/sct',
      display: 'Non-fasting'
    },
    processingProcedure: null,
    additive: null,
    containerType: {
      code: '467989009',
      system: 'http://snomed.info/sct',
      display: 'Blood collection tube'
    },
    condition: null
  },
  'Specimen/example-specimen-004': {
    status: 'available',
    referenceNumber: 'Specimen4',
    type: {
      code: '122555007',
      system: 'http://snomed.info/sct',
      display: 'Venous blood specimen'
    },
    receivedTime: new Date(),
    collectionBodySite: {
      code: '368208006',
      display: 'Vein structure'
    },
    collectionMethod: {
      code: '82078001',
      system: 'http://snomed.info/sct',
      display: 'Venipuncture'
    },
    collectionFastingStatus: null,
    processingProcedure: null,
    additive: null,
    containerType: {
      code: '467989009',
      system: 'http://snomed.info/sct',
      display: 'Blood collection tube'
    },
    condition: null
  }
};

