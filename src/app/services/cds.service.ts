import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// TypeScript interfaces for CDS request/response structures
export interface CDSPatient {
  resourceType: 'Patient';
  id: string;
  gender: string;
  birthDate: string;
  identifier: Array<{
    type: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
      text: string;
    };
    system: string;
    value: string;
  }>;
  name: Array<{
    use: string;
    family: string;
    given: string[];
    prefix?: string[];
  }>;
}

export interface CDSCondition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  verificationStatus: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
}

export interface CDSMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter?: {
    reference: string;
  };
  authoredOn?: string;
  requester?: {
    reference: string;
  };
  reasonReference?: Array<{
    reference: string;
  }>;
  dosageInstruction?: Array<{
    sequence: number;
    timing: {
      repeat: {
        frequency: number;
        period: number;
        periodUnit: string;
      };
    };
    asNeededBoolean: boolean;
    doseAndRate: Array<{
      type: {
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      };
      doseQuantity: {
        value: number;
        unit?: string;
      };
    }>;
  }>;
}

export interface CDSBundle<T> {
  resourceType: 'Bundle';
  id: string;
  meta?: {
    lastUpdated: string;
  };
  type?: string;
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: Array<{
    fullUrl: string;
    resource: T;
    search?: {
      mode: string;
    };
    response?: {
      status: string;
      etag: string;
    };
  }>;
}

export interface CDSRequest {
  hook: string;
  hookInstance?: string;
  fhirServer?: string;
  context?: {
    patientId?: string;
    encounterId?: string;
    userId?: string;
  };
  prefetch: {
    patient: CDSPatient;
    conditions: CDSBundle<CDSCondition>;
    draftMedicationRequests: CDSBundle<CDSMedicationRequest>;
    allergies: CDSBundle<any>;
  };
}

export interface CDSCard {
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
  };
  suggestions?: Array<{
    label: string;
    uuid?: string;
    actions?: Array<{
      type: string;
      description: string;
      resource?: any;
    }>;
  }>;
}

export interface CDSResponse {
  cards: CDSCard[];
}

@Injectable({
  providedIn: 'root'
})
export class CdsService {
  private readonly baseUrl = 'https://implementation-demo.snomedtools.org';
  private readonly fhirBaseUrl = 'https://r4.smarthealthit.org';
  private readonly cdsEndpoint = '/cds-services/medication-order-select';

  constructor(private http: HttpClient) {}

  /**
   * Makes a POST request to the CDS medication order select endpoint
   * @param request The CDS request payload
   * @returns Observable of the CDS response
   */
  postMedicationOrderSelect(request: CDSRequest): Observable<CDSResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<CDSResponse>(
      `${this.baseUrl}${this.cdsEndpoint}`,
      request,
      { headers }
    );
  }

  /**
   * Builds a CDS request from patient data, conditions, and medications
   * @param patient Patient information
   * @param conditions Array of conditions
   * @param medications Array of medication requests
   * @returns Formatted CDS request
   */
  buildCDSRequest(
    patient: CDSPatient,
    conditions: CDSCondition[],
    medications: CDSMedicationRequest[],
    allergies: any[] = [],
    contextOverrides?: {
      encounterId?: string;
      userId?: string;
      hookInstance?: string;
    }
  ): CDSRequest {
    const encounterId = contextOverrides?.encounterId ||
      this.extractEncounterIdFromResources(medications) ||
      this.extractEncounterIdFromResources(conditions) ||
      this.generateId();

    return {
      hook: 'order-page',
      hookInstance: contextOverrides?.hookInstance || this.generateId(),
      fhirServer: this.fhirBaseUrl,
      context: {
        patientId: patient.id,
        encounterId: encounterId,
        userId: contextOverrides?.userId || ('practitioner-' + this.generateId())
      },
      prefetch: {
        patient: patient,
        conditions: {
          resourceType: 'Bundle',
          id: this.generateId(),
          meta: {
            lastUpdated: new Date().toISOString()
          },
          type: 'searchset',
          total: conditions.length,
          link: [
            {
              relation: 'self',
              url: `${this.fhirBaseUrl}/Condition?patient=${patient.id}`
            }
          ],
          entry: conditions.map(condition => ({
            fullUrl: `${this.fhirBaseUrl}/Condition/${condition.id}`,
            resource: condition,
            search: {
              mode: 'match'
            },
            response: {
              status: '200 OK',
              etag: 'W/"3"'
            }
          }))
        },
        draftMedicationRequests: {
          resourceType: 'Bundle',
          id: this.generateId(),
          meta: {
            lastUpdated: new Date().toISOString()
          },
          type: 'searchset',
          total: medications.length,
          link: [
            {
              relation: 'self',
              url: `${this.fhirBaseUrl}/MedicationRequest?patient=${patient.id}`
            }
          ],
          entry: medications.map(medication => ({
            fullUrl: `${this.fhirBaseUrl}/MedicationRequest/${medication.id}`,
            resource: medication,
            search: {
              mode: 'match'
            },
            response: {
              status: '200 OK',
              etag: 'W/"4"'
            }
          }))
        },
        allergies: {
          resourceType: 'Bundle',
          id: this.generateId(),
          meta: {
            lastUpdated: new Date().toISOString()
          },
          type: 'searchset',
          total: allergies.length,
          link: [
            {
              relation: 'self',
              url: `${this.fhirBaseUrl}/AllergyIntolerance?patient=${patient.id}`
            }
          ],
          entry: allergies.map(allergy => ({
            fullUrl: `${this.fhirBaseUrl}/AllergyIntolerance/${allergy.id}`,
            resource: allergy,
            search: {
              mode: 'match'
            },
            response: {
              status: '200 OK',
              etag: 'W/"5"'
            }
          }))
        }
      }
    };
  }

  private extractEncounterIdFromResources(
    resources: Array<{ encounter?: { reference: string } }>
  ): string | null {
    for (const resource of resources) {
      const reference = resource?.encounter?.reference;
      if (!reference) {
        continue;
      }

      const [resourceType, id] = reference.split('/');
      if (resourceType === 'Encounter' && id) {
        return id;
      }
    }

    return null;
  }

  /**
   * Creates a sample patient for testing
   * @param patientId Optional patient ID
   * @returns Sample patient object
   */
  createSamplePatient(patientId: string = this.generateId()): CDSPatient {
    return {
      resourceType: 'Patient',
      id: patientId,
      gender: 'male',
      birthDate: '1974-12-25',
      identifier: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number'
              }
            ],
            text: 'Medical Record Number'
          },
          system: 'http://hospital.smarthealthit.org',
          value: this.generateId()
        }
      ],
      name: [
        {
          use: 'official',
          family: 'Montañez',
          given: ['Clara'],
          prefix: ['Ms.']
        }
      ]
    };
  }

  /**
   * Creates a sample condition
   * @param patientId Patient reference ID
   * @param snomedCode SNOMED CT code
   * @param display Display name for the condition
   * @returns Sample condition object
   */
  createSampleCondition(
    patientId: string,
    snomedCode: string,
    display: string,
    clinicalStatus: string = 'active'
  ): CDSCondition {
    return {
      resourceType: 'Condition',
      id: this.generateId(),
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: clinicalStatus
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed'
          }
        ]
      },
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: snomedCode,
            display: display
          }
        ],
        text: display
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      encounter: {
        reference: `Encounter/${this.generateId()}`
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString()
    };
  }

  /**
   * Creates a sample medication request
   * @param patientId Patient reference ID
   * @param snomedCode SNOMED CT code for medication
   * @param display Display name for the medication
   * @returns Sample medication request object
   */
  createSampleMedicationRequest(
    patientId: string,
    snomedCode: string,
    display: string
  ): CDSMedicationRequest {
    return {
      resourceType: 'MedicationRequest',
      id: this.generateId(),
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: snomedCode,
            display: display
          }
        ],
        text: display
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      encounter: {
        reference: `Encounter/${this.generateId()}`
      },
      authoredOn: new Date().toISOString(),
      requester: {
        reference: `Practitioner/${this.generateId()}`
      },
      dosageInstruction: [
        {
          sequence: 1,
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd'
            }
          },
          asNeededBoolean: false,
          doseAndRate: [
            {
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
                    code: 'ordered',
                    display: 'Ordered'
                  }
                ]
              },
              doseQuantity: {
                value: 1
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Generates a UUID-like identifier
   * @returns Generated UUID string
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
