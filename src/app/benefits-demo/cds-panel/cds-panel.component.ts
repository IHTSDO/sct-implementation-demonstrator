import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Patient, Condition, MedicationStatement, AllergyIntolerance } from '../../services/patient.service';
import { CdsService, CDSResponse } from '../../services/cds.service';

export interface CdsState {
  isLoading: boolean;
  hasError: boolean;
  hasNoData: boolean;
  hasRecommendations: boolean;
  hasExecuted: boolean; // New flag to track if CDS has been executed at least once
  recommendationCount: number;
  errorMessage: string | null;
  noDataMessage: string | null;
}

@Component({
  selector: 'app-cds-panel',
  templateUrl: './cds-panel.component.html',
  styleUrls: ['./cds-panel.component.css'],
  standalone: false
})
export class CdsPanelComponent implements OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() conditions: Condition[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Input() allergies: AllergyIntolerance[] = [];
  @Input() autoTrigger: boolean = false;
  @Output() stateChange = new EventEmitter<CdsState>();

  isCdsLoading = false;
  cdsResponse: CDSResponse | null = null;
  cdsError: string | null = null;
  cdsNoDataMessage: string | null = null;

  private subscriptions: Subscription[] = [];
  private triggerTimeout: any = null;

  constructor(private cdsService: CdsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Auto-trigger CDS when data changes and autoTrigger is enabled
    if (this.autoTrigger && this.patient) {
      // Trigger when patient changes (including first load) or when clinical data changes
      if (changes['patient'] || changes['conditions'] || changes['medications'] || changes['allergies']) {
        this.triggerAutomaticCdsRequest();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
    }
  }

  submitToCdsService(): void {
    if (!this.patient) {
      console.warn('No patient data available for CDS submission');
      return;
    }

    // Check if we have clinical data to send
    if (this.conditions.length === 0 && this.medications.length === 0) {
      this.cdsNoDataMessage = 'No clinical data available yet. Add conditions or medications to receive decision support recommendations.';
      console.info('No clinical data available for CDS submission');
      this.emitStateChange();
      return;
    }

    // Reset CDS state
    this.cdsError = null;
    this.cdsNoDataMessage = null;
    this.cdsResponse = null;
    this.isCdsLoading = true;
    this.emitStateChange();

    try {
      // Convert patient data to CDS format
      const cdsPatient = this.convertPatientToCdsFormat(this.patient);
      const cdsConditions = this.convertConditionsToCdsFormat(this.conditions);
      const cdsMedications = this.convertMedicationsToCdsFormat(this.medications);
      const cdsAllergies = this.convertAllergiesToCdsFormat(this.allergies);

      // Build CDS request
      const cdsRequest = this.cdsService.buildCDSRequest(cdsPatient, cdsConditions, cdsMedications, cdsAllergies);

      // Submit to CDS service
      this.subscriptions.push(
        this.cdsService.postMedicationOrderSelect(cdsRequest).subscribe({
          next: (response: CDSResponse) => {
            this.isCdsLoading = false;
            this.cdsResponse = response;
            this.processCdsRecommendations(response);
            this.emitStateChange();
          },
          error: (error) => {
            this.isCdsLoading = false;
            this.cdsError = `CDS Service Error: ${error.message || 'Unknown error'}`;
            console.error('CDS Service error:', error);
            this.emitStateChange();
          }
        })
      );
    } catch (error: any) {
      this.isCdsLoading = false;
      this.cdsError = `CDS Request Error: ${error.message || 'Unknown error'}`;
      console.error('Error building CDS request:', error);
      this.emitStateChange();
    }
  }

  private emitStateChange(): void {
    const state: CdsState = {
      isLoading: this.isCdsLoading,
      hasError: !!this.cdsError,
      hasNoData: !!this.cdsNoDataMessage,
      hasRecommendations: !!(this.cdsResponse && this.cdsResponse.cards && this.cdsResponse.cards.length > 0),
      hasExecuted: !!this.cdsResponse || !!this.cdsError, // Executed if we have a response or an error
      recommendationCount: this.cdsResponse?.cards?.length || 0,
      errorMessage: this.cdsError,
      noDataMessage: this.cdsNoDataMessage
    };
    this.stateChange.emit(state);
  }

  private convertPatientToCdsFormat(patient: Patient): any {
    return {
      resourceType: 'Patient',
      id: patient.id,
      gender: patient.gender || 'unknown',
      birthDate: patient.birthDate || '1990-01-01',
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
          value: patient.id
        }
      ],
      name: [
        {
          use: 'official',
          family: patient.name?.[0]?.family || 'Unknown',
          given: patient.name?.[0]?.given || ['Unknown'],
          prefix: []
        }
      ]
    };
  }

  private convertConditionsToCdsFormat(conditions: Condition[]): any[] {
    return conditions.map(condition => ({
      resourceType: 'Condition',
      id: condition.id || this.generateId(),
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: condition.clinicalStatus?.coding?.[0]?.code || 'active'
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
            code: condition.code?.coding?.[0]?.code || '404684003',
            display: condition.code?.coding?.[0]?.display || condition.code?.text || 'Unknown condition'
          }
        ],
        text: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'
      },
      subject: {
        reference: `Patient/${this.patient?.id}`
      },
      encounter: {
        reference: `Encounter/${this.generateId()}`
      },
      onsetDateTime: condition.onsetDateTime || new Date().toISOString(),
      recordedDate: condition.recordedDate || new Date().toISOString()
    }));
  }

  private convertMedicationsToCdsFormat(medications: MedicationStatement[]): any[] {
    return medications.map(medication => {
      const medicationText = medication.medicationCodeableConcept?.text || 
                            medication.medicationCodeableConcept?.coding?.[0]?.display || 
                            'Unknown medication';
      
      const textLower = medicationText.toLowerCase();
      const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
      const isTablet = textLower.includes('tablet');
      const isOral = textLower.includes('oral');
      
      // Known tablet medications by SNOMED CT code
      const knownTabletCodes = [
        '108774000',  // Product containing anastrozole (medicinal product) - typically 1mg tablet
        '318352004',  // Propranolol hydrochloride 10 mg oral tablet
        '327373002'   // Anastrozole 1 mg oral tablet
      ];
      
      // Check if it's likely an oral medication based on various indicators
      const likelyOral = isOral || isTablet || 
                        textLower.includes('capsule') ||
                        textLower.includes('suspension') ||
                        textLower.includes('solution') ||
                        textLower.includes('pill') ||
                        textLower.includes('extract') ||  // herbal extracts are typically oral
                        (medicationCode === '108774000') || // anastrozole is typically oral
                        (medicationCode === '412588001');   // black cohosh extract
      
      const doseQuantity: any = { value: 1 };
      if (isTablet || knownTabletCodes.includes(medicationCode || '')) {
        doseQuantity.unit = 'Tablet';
      }
      
      // Include route if it's oral or likely oral
      // Use simple format that works with dummy CDS service
      const route = likelyOral ? {
        coding: [{ code: "", display: "O" }],
        text: "O"
      } : undefined;

      return {
        resourceType: 'MedicationRequest',
        id: medication.id || this.generateId(),
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: medication.medicationCodeableConcept?.coding?.[0]?.code || '387207008',
              display: medication.medicationCodeableConcept?.coding?.[0]?.display || 
                       medication.medicationCodeableConcept?.text || 'Unknown medication'
            }
          ],
          text: medicationText
        },
        subject: {
          reference: `Patient/${this.patient?.id}`
        },
        encounter: {
          reference: `Encounter/${this.generateId()}`
        },
        authoredOn: medication.effectiveDateTime || new Date().toISOString(),
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
            ...(route && { route }),
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
                doseQuantity: doseQuantity
              }
            ]
          }
        ]
      };
    });
  }

  private convertAllergiesToCdsFormat(allergies: AllergyIntolerance[]): any[] {
    return allergies.map(allergy => {
      // Clean up reaction array - remove empty coding objects
      const cleanedReactions = (allergy.reaction || []).map((reaction: any) => {
        const cleanedReaction: any = {};
        
        // Only include substance if it has valid coding
        if (reaction.substance && reaction.substance.length > 0) {
          const validSubstance = reaction.substance.filter((s: any) => 
            s.coding && s.coding.length > 0 && s.coding.some((c: any) => c.code)
          );
          if (validSubstance.length > 0) {
            cleanedReaction.substance = validSubstance;
          }
        }
        
        // Only include manifestation if it has valid coding
        if (reaction.manifestation && reaction.manifestation.length > 0) {
          const validManifestation = reaction.manifestation.filter((m: any) => 
            m.coding && m.coding.length > 0 && m.coding.some((c: any) => c.code)
          );
          if (validManifestation.length > 0) {
            cleanedReaction.manifestation = validManifestation;
          }
        }
        
        // Only include exposureRoute if it has valid coding
        if (reaction.exposureRoute?.coding && reaction.exposureRoute.coding.length > 0) {
          const validCoding = reaction.exposureRoute.coding.filter((c: any) => c.code);
          if (validCoding.length > 0) {
            cleanedReaction.exposureRoute = {
              ...reaction.exposureRoute,
              coding: validCoding
            };
          }
        }
        
        return Object.keys(cleanedReaction).length > 0 ? cleanedReaction : undefined;
      }).filter((r: any) => r !== undefined);

      return {
        resourceType: 'AllergyIntolerance',
        id: allergy.id || this.generateId(),
        clinicalStatus: allergy.clinicalStatus || {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
            display: 'Active'
          }]
        },
        verificationStatus: allergy.verificationStatus || {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed',
            display: 'Confirmed'
          }]
        },
        type: allergy.type || 'allergy',
        category: this.normalizeAllergyCategory(allergy.category),
        criticality: allergy.criticality || 'low',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: allergy.code?.coding?.[0]?.code || '419199007',
              display: allergy.code?.coding?.[0]?.display || allergy.code?.text || 'Allergy'
            }
          ],
          text: allergy.code?.text || 'Allergy'
        },
        patient: {
          reference: `Patient/${this.patient?.id}`
        },
        recordedDate: allergy.recordedDate || new Date().toISOString(),
        reaction: cleanedReactions
      };
    });
  }

  private normalizeAllergyCategory(category: any): string[] {
    if (!category || !Array.isArray(category)) {
      return ['medication'];
    }
    // Normalize to lowercase to ensure consistency
    return category.map((c: string) => c.toLowerCase());
  }

  private processCdsRecommendations(response: CDSResponse): void {
    if (response.cards && response.cards.length > 0) {
      // Recommendations processed and displayed in template
    }
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private triggerAutomaticCdsRequest(): void {
    // Clear any pending trigger to avoid duplicate requests (debounce)
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
    }

    // Only trigger if we have clinical data to analyze
    if (this.conditions.length > 0 || this.medications.length > 0) {
      // Add a small delay to ensure the UI is ready and avoid duplicate requests
      this.triggerTimeout = setTimeout(() => {
        this.submitToCdsService();
        this.triggerTimeout = null;
      }, 500);
    } else {
      // If no data, set the no-data message and emit state
      this.cdsNoDataMessage = 'No clinical data available yet. Add conditions or medications to receive decision support recommendations.';
      this.emitStateChange();
    }
  }

  getCardIcon(indicator: string): string {
    switch (indicator) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }

  getCardIconColor(indicator: string): string {
    switch (indicator) {
      case 'critical':
        return 'warn';
      case 'warning':
        return 'accent';
      case 'info':
      default:
        return 'primary';
    }
  }

  openSourceUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
