import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdsService, CDSServerExecutionResult } from '../../services/cds.service';
import type { AllergyIntolerance, Condition, MedicationStatement, Patient } from '../../model';

export interface CdsState {
  isLoading: boolean;
  hasError: boolean;
  hasNoData: boolean;
  hasRecommendations: boolean;
  hasExecuted: boolean;
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
  cdsError: string | null = null;
  cdsNoDataMessage: string | null = null;
  serverResults: CDSServerExecutionResult[] = [];

  private subscriptions: Subscription[] = [];
  private triggerTimeout: any = null;

  constructor(private cdsService: CdsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.autoTrigger && this.patient) {
      if (changes['patient'] || changes['conditions'] || changes['medications'] || changes['allergies']) {
        this.triggerAutomaticCdsRequest();
      }
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
    }
  }

  submitToCdsService(): void {
    if (!this.patient) {
      console.warn('No patient data available for CDS submission');
      return;
    }

    if (this.cdsService.getActiveServers().length === 0) {
      this.resetTransientState();
      this.cdsNoDataMessage = 'No active CDS Hooks servers configured. Use Data > CDS Hooks Servers to activate at least one server.';
      this.emitStateChange();
      return;
    }

    if (this.conditions.length === 0 && this.medications.length === 0) {
      this.resetTransientState();
      this.cdsNoDataMessage = 'No clinical data available yet. Add conditions or medications to receive decision support recommendations.';
      console.info('No clinical data available for CDS submission');
      this.emitStateChange();
      return;
    }

    this.resetTransientState();
    this.isCdsLoading = true;
    this.emitStateChange();

    try {
      const cdsPatient = this.convertPatientToCdsFormat(this.patient);
      const encounterId = this.resolveEncounterId(this.conditions, this.medications);
      const cdsConditions = this.convertConditionsToCdsFormat(this.conditions, encounterId);
      const cdsMedications = this.convertMedicationsToCdsFormat(this.medications, encounterId);
      const cdsAllergies = this.convertAllergiesToCdsFormat(this.allergies);

      this.subscriptions.push(
        this.cdsService.evaluateMedicationOrderSelect(
          cdsPatient,
          cdsConditions,
          cdsMedications,
          cdsAllergies,
          { encounterId }
        ).subscribe({
          next: (results) => {
            this.isCdsLoading = false;
            this.serverResults = results;

            const successfulResults = this.getSuccessfulServerResults();
            const totalRecommendationCount = this.getTotalRecommendationCount();

            if (results.length > 0 && successfulResults.length === 0) {
              this.cdsError = 'All active CDS servers failed to return recommendations.';
            } else if (successfulResults.length > 0 && totalRecommendationCount === 0) {
              // handled by the dedicated empty-state UI
            }

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

  getTotalRecommendationCount(): number {
    return this.serverResults.reduce((total, result) => total + (result.response?.cards?.length || 0), 0);
  }

  getSuccessfulServerResults(): CDSServerExecutionResult[] {
    return this.serverResults.filter((result) => !result.error && !!result.response);
  }

  getServerResultsWithCards(): CDSServerExecutionResult[] {
    return this.getSuccessfulServerResults().filter((result) => (result.response?.cards?.length || 0) > 0);
  }

  getServerResultsWithoutCards(): CDSServerExecutionResult[] {
    return this.getSuccessfulServerResults().filter((result) => (result.response?.cards?.length || 0) === 0);
  }

  getErroredServerResults(): CDSServerExecutionResult[] {
    return this.serverResults.filter((result) => !!result.error);
  }

  hasAnyServerResponse(): boolean {
    return this.serverResults.length > 0;
  }

  showGroupedResults(): boolean {
    return this.hasAnyServerResponse() && (this.getServerResultsWithCards().length > 0 || this.getErroredServerResults().length > 0);
  }

  showNoRecommendations(): boolean {
    return this.hasAnyServerResponse()
      && this.getSuccessfulServerResults().length > 0
      && this.getErroredServerResults().length === 0
      && this.getTotalRecommendationCount() === 0;
  }

  getServerDisplayName(result: CDSServerExecutionResult): string {
    return result.server.name || result.server.baseUrl;
  }

  getServerStatusLabel(result: CDSServerExecutionResult): string {
    return result.mode === 'modern' ? 'order-select' : 'legacy fallback';
  }

  private resetTransientState(): void {
    this.cdsError = null;
    this.cdsNoDataMessage = null;
    this.serverResults = [];
  }

  private emitStateChange(): void {
    const recommendationCount = this.getTotalRecommendationCount();
    const state: CdsState = {
      isLoading: this.isCdsLoading,
      hasError: !!this.cdsError,
      hasNoData: !!this.cdsNoDataMessage,
      hasRecommendations: recommendationCount > 0,
      hasExecuted: this.hasAnyServerResponse() || !!this.cdsError,
      recommendationCount,
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

  private convertConditionsToCdsFormat(conditions: Condition[], fallbackEncounterId: string): any[] {
    return conditions.map((condition) => ({
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
        reference: `Encounter/${this.extractEncounterId(condition.encounter?.reference) || fallbackEncounterId}`
      },
      onsetDateTime: condition.onsetDateTime || new Date().toISOString(),
      recordedDate: condition.recordedDate || new Date().toISOString()
    }));
  }

  private convertMedicationsToCdsFormat(medications: MedicationStatement[], fallbackEncounterId: string): any[] {
    return medications.map((medication) => {
      const medicationText = medication.medicationCodeableConcept?.text
        || medication.medicationCodeableConcept?.coding?.[0]?.display
        || 'Unknown medication';

      const textLower = medicationText.toLowerCase();
      const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
      const isTablet = textLower.includes('tablet');
      const isOral = textLower.includes('oral');

      let category: 'tablet' | 'liquid' | 'other' = 'other';
      if (isTablet) {
        category = 'tablet';
      } else if (textLower.includes('syrup') || textLower.includes('solution') || textLower.includes('suspension')) {
        category = 'liquid';
      }

      const dosageRoute = medication.dosage?.[0]?.route;
      const routeCoding = (dosageRoute?.coding || [])
        .filter((coding: any) => coding?.code || coding?.display)
        .map((coding: any) => ({
          ...(coding.system ? { system: coding.system } : {}),
          ...(coding.code ? { code: coding.code } : {}),
          ...(coding.display ? { display: coding.display } : {})
        }));
      const route = dosageRoute ? {
        ...(dosageRoute.text ? { text: dosageRoute.text } : {}),
        ...(routeCoding.length > 0 ? { coding: routeCoding } : {})
      } : undefined;

      return {
        resourceType: 'MedicationRequest',
        id: medication.id || this.generateId(),
        status: 'draft',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: medicationCode || 'dummyCode',
              display: medication.medicationCodeableConcept?.coding?.[0]?.display || medicationText
            }
          ],
          text: medicationText
        },
        subject: {
          reference: `Patient/${this.patient?.id}`
        },
        encounter: {
          reference: `Encounter/${this.extractEncounterId(medication.context?.reference) || fallbackEncounterId}`
        },
        authoredOn: medication.effectiveDateTime || new Date().toISOString(),
        requester: {
          reference: 'Practitioner/demo-practitioner'
        },
        dosageInstruction: [
          {
            sequence: 1,
            timing: {
              repeat: {
                frequency: medication.dosage?.[0]?.timing?.repeat?.frequency || 1,
                period: medication.dosage?.[0]?.timing?.repeat?.period || 1,
                periodUnit: medication.dosage?.[0]?.timing?.repeat?.periodUnit || 'd'
              }
            },
            asNeededBoolean: false,
            ...(route && (route.text || route.coding?.length) ? { route } : {}),
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
                  value: medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value || (category === 'tablet' ? 1 : 5),
                  unit: medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || (category === 'tablet' ? 'tablet' : 'mg')
                }
              }
            ]
          }
        ]
      };
    });
  }

  private resolveEncounterId(conditions: Condition[], medications: MedicationStatement[]): string {
    const medicationEncounter = medications
      .map((medication) => this.extractEncounterId(medication.context?.reference))
      .find((encounterId) => !!encounterId);

    if (medicationEncounter) {
      return medicationEncounter;
    }

    const conditionEncounter = conditions
      .map((condition) => this.extractEncounterId(condition.encounter?.reference))
      .find((encounterId) => !!encounterId);

    if (conditionEncounter) {
      return conditionEncounter;
    }

    return this.generateId();
  }

  private extractEncounterId(reference?: string): string | null {
    if (!reference) {
      return null;
    }

    const parts = reference.split('/');
    if (parts.length !== 2 || parts[0] !== 'Encounter' || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  private convertAllergiesToCdsFormat(allergies: AllergyIntolerance[]): any[] {
    return allergies.map((allergy) => {
      const cleanedReactions = (allergy.reaction || []).map((reaction: any) => {
        const cleanedReaction: any = {};

        if (reaction.substance && reaction.substance.length > 0) {
          const validSubstance = reaction.substance.filter((substance: any) =>
            substance.coding && substance.coding.length > 0 && substance.coding.some((coding: any) => coding.code)
          );
          if (validSubstance.length > 0) {
            cleanedReaction.substance = validSubstance;
          }
        }

        if (reaction.manifestation && reaction.manifestation.length > 0) {
          const validManifestation = reaction.manifestation.filter((manifestation: any) =>
            manifestation.coding && manifestation.coding.length > 0 && manifestation.coding.some((coding: any) => coding.code)
          );
          if (validManifestation.length > 0) {
            cleanedReaction.manifestation = validManifestation;
          }
        }

        if (reaction.exposureRoute?.coding && reaction.exposureRoute.coding.length > 0) {
          const validCoding = reaction.exposureRoute.coding.filter((coding: any) => coding.code);
          if (validCoding.length > 0) {
            cleanedReaction.exposureRoute = {
              ...reaction.exposureRoute,
              coding: validCoding
            };
          }
        }

        return Object.keys(cleanedReaction).length > 0 ? cleanedReaction : undefined;
      }).filter((reaction: any) => reaction !== undefined);

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

    return category.map((value: string) => value.toLowerCase());
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  private triggerAutomaticCdsRequest(): void {
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
    }

    if (this.conditions.length > 0 || this.medications.length > 0) {
      this.triggerTimeout = setTimeout(() => {
        this.submitToCdsService();
        this.triggerTimeout = null;
      }, 500);
    } else {
      this.resetTransientState();
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
