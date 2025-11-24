/**
 * Example data for Diagnostic Report form
 * Pre-configured examples for Patient, Performer, and Results Interpreter selection
 */

export interface ReferenceExample {
  reference: string;
  display: string;
  type?: string;
  identifier?: {
    system: string;
    value: string;
  };
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

