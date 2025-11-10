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
  computedLocation?: string;
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
  questionnaire?: string; // Canonical URL of the Questionnaire
  status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped';
  subject?: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  authored?: string; // DateTime when completed
  author?: {
    reference: string;
    display?: string;
  };
  source?: {
    reference: string;
    display?: string;
  };
  item?: Array<any>; // QuestionnaireResponse items (answers)
  // Custom metadata for display
  questionnaireTitle?: string;
  questionnaireId?: string; // Our internal ID (like 'questionnaire-phq9')
  questionnaireName?: string; // Display name
}

export interface PatientSimilarityResult {
  patient: Patient;
  score: number;
  breakdown?: {
    nameScore: number;
    birthDateScore: number;
    genderScore: number;
  };
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

  // Helper methods for duplicate detection
  public extractSnomedCode(resource: any): string | null {
    // Extract SNOMED CT code from various resource types
    if (resource.code?.coding) {
      const snomedCoding = resource.code.coding.find((coding: any) => 
        coding.system === 'http://snomed.info/sct' || 
        coding.system === 'http://snomed.info/sct/900000000000207008'
      );
      return snomedCoding?.code || null;
    }
    
    if (resource.medicationCodeableConcept?.coding) {
      const snomedCoding = resource.medicationCodeableConcept.coding.find((coding: any) => 
        coding.system === 'http://snomed.info/sct' || 
        coding.system === 'http://snomed.info/sct/900000000000207008'
      );
      return snomedCoding?.code || null;
    }
    
    if (resource.reasonCode && resource.reasonCode.length > 0 && resource.reasonCode[0].coding) {
      const snomedCoding = resource.reasonCode[0].coding.find((coding: any) => 
        coding.system === 'http://snomed.info/sct' || 
        coding.system === 'http://snomed.info/sct/900000000000207008'
      );
      return snomedCoding?.code || null;
    }
    
    return null;
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

  private loadPatients(): void {
    if (this.storageService.isLocalStorageSupported()) {
      const storedPatients = this.storageService.getItem(this.STORAGE_KEY);
      if (storedPatients) {
        try {
          const patients = JSON.parse(storedPatients);
          this.patientsSubject.next(patients);
        } catch (error) {
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

  addPatientCondition(patientId: string, condition: Condition): boolean {
    const conditions = this.getPatientConditions(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateCondition(conditions, condition)) {
      return false; // Duplicate found, not added
    }
    
    conditions.push(condition);
    this.savePatientConditions(patientId, conditions);
    return true; // Successfully added
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

  addPatientProcedure(patientId: string, procedure: Procedure): boolean {
    const procedures = this.getPatientProcedures(patientId);
    
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateProcedure(procedures, procedure)) {
      return false; // Duplicate found, not added
    }
    
    procedures.push(procedure);
    this.savePatientProcedures(patientId, procedures);
    return true; // Successfully added
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

  addPatientMedication(patientId: string, medication: MedicationStatement): boolean {
    const medications = this.getPatientMedications(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateMedication(medications, medication)) {
      return false; // Duplicate found, not added
    }
    
    medications.push(medication);
    this.savePatientMedications(patientId, medications);
    return true; // Successfully added
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

  // Allergies
  getPatientAllergies(patientId: string): AllergyIntolerance[] {
    const key = `ehr_allergies_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientAllergy(patientId: string, allergy: AllergyIntolerance): boolean {
    const allergies = this.getPatientAllergies(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateAllergy(allergies, allergy)) {
      return false; // Duplicate found, not added
    }
    
    allergies.push(allergy);
    this.savePatientAllergies(patientId, allergies);
    return true; // Successfully added
  }

  updatePatientAllergy(patientId: string, allergyId: string, updatedAllergy: AllergyIntolerance): void {
    const allergies = this.getPatientAllergies(patientId);
    const index = allergies.findIndex(a => a.id === allergyId);
    if (index !== -1) {
      allergies[index] = updatedAllergy;
      this.savePatientAllergies(patientId, allergies);
    }
  }

  deletePatientAllergy(patientId: string, allergyId: string): void {
    const allergies = this.getPatientAllergies(patientId);
    const filteredAllergies = allergies.filter(a => a.id !== allergyId);
    this.savePatientAllergies(patientId, filteredAllergies);
  }

  private savePatientAllergies(patientId: string, allergies: AllergyIntolerance[]): void {
    const key = `ehr_allergies_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(allergies));
  }

  // QuestionnaireResponses
  getPatientQuestionnaireResponses(patientId: string): QuestionnaireResponse[] {
    const key = `ehr_questionnaire_responses_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientQuestionnaireResponse(patientId: string, response: QuestionnaireResponse): boolean {
    const responses = this.getPatientQuestionnaireResponses(patientId);
    responses.push(response);
    this.savePatientQuestionnaireResponses(patientId, responses);
    return true; // Successfully added
  }

  updatePatientQuestionnaireResponse(patientId: string, responseId: string, updatedResponse: QuestionnaireResponse): void {
    const responses = this.getPatientQuestionnaireResponses(patientId);
    const index = responses.findIndex(r => r.id === responseId);
    if (index !== -1) {
      responses[index] = updatedResponse;
      this.savePatientQuestionnaireResponses(patientId, responses);
    }
  }

  deletePatientQuestionnaireResponse(patientId: string, responseId: string): void {
    const responses = this.getPatientQuestionnaireResponses(patientId);
    const filteredResponses = responses.filter(r => r.id !== responseId);
    this.savePatientQuestionnaireResponses(patientId, filteredResponses);
  }

  private savePatientQuestionnaireResponses(patientId: string, responses: QuestionnaireResponse[]): void {
    const key = `ehr_questionnaire_responses_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(responses));
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
    diagnosis: { name: string; conceptId?: string } | null
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
    const diagnosisArray = diagnosis ? [{
      condition: {
        reference: `Condition/${diagnosis.conceptId || 'unknown'}`,
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

  // Encounter management methods
  getPatientEncounters(patientId: string): Encounter[] {
    const key = `ehr_encounters_${patientId}`;
    const stored = this.storageService.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  addPatientEncounter(patientId: string, encounter: Encounter): boolean {
    const encounters = this.getPatientEncounters(patientId);
    
    // Check for duplicates based on SNOMED CT code
    if (this.isDuplicateEncounter(encounters, encounter)) {
      return false; // Duplicate found, not added
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
    const key = `ehr_encounters_${patientId}`;
    this.storageService.saveItem(key, JSON.stringify(encounters));
  }

  // Public method to delete an encounter
  deletePatientEncounter(patientId: string, encounterId: string): void {
    const encounters = this.getPatientEncounters(patientId);
    const updatedEncounters = encounters.filter(enc => enc.id !== encounterId);
    this.savePatientEncounters(patientId, updatedEncounters);
    
    // Notify subscribers by updating the selected patient
    const currentPatient = this.selectedPatientSubject.value;
    if (currentPatient && currentPatient.id === patientId) {
      this.selectedPatientSubject.next({ ...currentPatient });
    }
  }

  clearAllPatientEvents(patientId: string): void {
    
    // Clear all clinical events for a patient
    this.storageService.removeItem(`ehr_conditions_${patientId}`);
    this.storageService.removeItem(`ehr_procedures_${patientId}`);
    this.storageService.removeItem(`ehr_medications_${patientId}`);
    this.storageService.removeItem(`ehr_allergies_${patientId}`);
    this.storageService.removeItem(`ehr_encounters_${patientId}`);
    this.storageService.removeItem(`ehr_questionnaire_responses_${patientId}`);
    
    // Also clear old storage key format for encounters (for backwards compatibility)
    this.storageService.removeItem(`encounters_${patientId}`);
    
    
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
