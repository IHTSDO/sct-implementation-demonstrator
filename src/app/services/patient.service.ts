import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import JSZip from 'jszip';

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
  // Custom properties for ICD-10 mapping
  icd10Code?: string;
  snomedConceptId?: string;
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
}

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private readonly STORAGE_KEY = 'ehr_patients';
  private patientsSubject = new BehaviorSubject<Patient[]>([]);
  private selectedPatientSubject = new BehaviorSubject<Patient | null>(null);

  public patients$ = this.patientsSubject.asObservable();
  public selectedPatient$ = this.selectedPatientSubject.asObservable();

  constructor(private storageService: StorageService) {
    this.loadPatients();
    // this.initializeSamplePatients(); // Deactivated - start with empty patient list
  }

  private loadPatients(): void {
    if (this.storageService.isLocalStorageSupported()) {
      const storedPatients = this.storageService.getItem(this.STORAGE_KEY);
      if (storedPatients) {
        try {
          const patients = JSON.parse(storedPatients);
          this.patientsSubject.next(patients);
        } catch (error) {
          console.error('Error loading patients from storage:', error);
          this.patientsSubject.next([]);
        }
      }
    }
  }

  private savePatients(patients: Patient[]): void {
    if (this.storageService.isLocalStorageSupported()) {
      this.storageService.saveItem(this.STORAGE_KEY, JSON.stringify(patients));
    }
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

  selectPatient(patient: Patient | null): void {
    this.selectedPatientSubject.next(patient);
  }

  addPatient(patient: Patient): void {
    const currentPatients = this.patientsSubject.value;
    const updatedPatients = [...currentPatients, patient];
    this.patientsSubject.next(updatedPatients);
    this.savePatients(updatedPatients);
  }

  updatePatient(updatedPatient: Patient): void {
    const currentPatients = this.patientsSubject.value;
    const updatedPatients = currentPatients.map(patient => 
      patient.id === updatedPatient.id ? updatedPatient : patient
    );
    this.patientsSubject.next(updatedPatients);
    this.savePatients(updatedPatients);
  }

  deletePatient(patientId: string): void {
    const currentPatients = this.patientsSubject.value;
    const updatedPatients = currentPatients.filter(patient => patient.id !== patientId);
    this.patientsSubject.next(updatedPatients);
    this.savePatients(updatedPatients);
    
    // If the deleted patient was selected, clear the selection
    const selectedPatient = this.selectedPatientSubject.value;
    if (selectedPatient && selectedPatient.id === patientId) {
      this.selectPatient(null);
    }
  }

  getPatientById(patientId: string): Patient | undefined {
    return this.patientsSubject.value.find(patient => patient.id === patientId);
  }

  clearAllPatients(): void {
    this.patientsSubject.next([]);
    this.selectedPatientSubject.next(null);
    this.savePatients([]);
  }

  clearAllPatientsAndClinicalData(): void {
    const patients = this.patientsSubject.value;
    
    // Clear all clinical data for each patient
    patients.forEach(patient => {
      const conditionsKey = `ehr_conditions_${patient.id}`;
      const proceduresKey = `ehr_procedures_${patient.id}`;
      const medicationsKey = `ehr_medications_${patient.id}`;
      
      this.storageService.removeItem(conditionsKey);
      this.storageService.removeItem(proceduresKey);
      this.storageService.removeItem(medicationsKey);
    });
    
    // Clear all patients
    this.clearAllPatients();
  }

  // Clinical Data Management Methods

  // Conditions
  getPatientConditions(patientId: string): Condition[] {
    const key = `ehr_conditions_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientCondition(patientId: string, condition: Condition): void {
    const conditions = this.getPatientConditions(patientId);
    conditions.push(condition);
    this.savePatientConditions(patientId, conditions);
  }

  updatePatientCondition(patientId: string, conditionId: string, updatedCondition: Condition): void {
    const conditions = this.getPatientConditions(patientId);
    const index = conditions.findIndex(c => c.id === conditionId);
    if (index !== -1) {
      conditions[index] = updatedCondition;
      this.savePatientConditions(patientId, conditions);
    }
  }

  deletePatientCondition(patientId: string, conditionId: string): void {
    const conditions = this.getPatientConditions(patientId);
    const filteredConditions = conditions.filter(c => c.id !== conditionId);
    this.savePatientConditions(patientId, filteredConditions);
  }

  private savePatientConditions(patientId: string, conditions: Condition[]): void {
    const key = `ehr_conditions_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(conditions));
  }

  // Procedures
  getPatientProcedures(patientId: string): Procedure[] {
    const key = `ehr_procedures_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientProcedure(patientId: string, procedure: Procedure): void {
    const procedures = this.getPatientProcedures(patientId);
    procedures.push(procedure);
    this.savePatientProcedures(patientId, procedures);
  }

  updatePatientProcedure(patientId: string, procedureId: string, updatedProcedure: Procedure): void {
    const procedures = this.getPatientProcedures(patientId);
    const index = procedures.findIndex(p => p.id === procedureId);
    if (index !== -1) {
      procedures[index] = updatedProcedure;
      this.savePatientProcedures(patientId, procedures);
    }
  }

  deletePatientProcedure(patientId: string, procedureId: string): void {
    const procedures = this.getPatientProcedures(patientId);
    const filteredProcedures = procedures.filter(p => p.id !== procedureId);
    this.savePatientProcedures(patientId, filteredProcedures);
  }

  private savePatientProcedures(patientId: string, procedures: Procedure[]): void {
    const key = `ehr_procedures_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(procedures));
  }

  // Medications
  getPatientMedications(patientId: string): MedicationStatement[] {
    const key = `ehr_medications_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientMedication(patientId: string, medication: MedicationStatement): void {
    const medications = this.getPatientMedications(patientId);
    medications.push(medication);
    this.savePatientMedications(patientId, medications);
  }

  updatePatientMedication(patientId: string, medicationId: string, updatedMedication: MedicationStatement): void {
    const medications = this.getPatientMedications(patientId);
    const index = medications.findIndex(m => m.id === medicationId);
    if (index !== -1) {
      medications[index] = updatedMedication;
      this.savePatientMedications(patientId, medications);
    }
  }

  deletePatientMedication(patientId: string, medicationId: string): void {
    const medications = this.getPatientMedications(patientId);
    const filteredMedications = medications.filter(m => m.id !== medicationId);
    this.savePatientMedications(patientId, filteredMedications);
  }

  private savePatientMedications(patientId: string, medications: MedicationStatement[]): void {
    const key = `ehr_medications_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(medications));
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
        
        return {
          patient: patient,
          clinicalData: {
            conditions: conditions,
            procedures: procedures,
            medications: medications,
            totalClinicalItems: conditions.length + procedures.length + medications.length
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
      console.error('Error generating ZIP file:', error);
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
      this.clearAllPatients();
      
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
              this.addPatientCondition(patient.id, condition);
            }
          }
          
          // Import procedures
          if (clinicalData.procedures && Array.isArray(clinicalData.procedures)) {
            for (const procedure of clinicalData.procedures) {
              this.addPatientProcedure(patient.id, procedure);
            }
          }
          
          // Import medications
          if (clinicalData.medications && Array.isArray(clinicalData.medications)) {
            for (const medication of clinicalData.medications) {
              this.addPatientMedication(patient.id, medication);
            }
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
      console.error('Error importing patients from ZIP:', error);
      return { 
        success: false, 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}
