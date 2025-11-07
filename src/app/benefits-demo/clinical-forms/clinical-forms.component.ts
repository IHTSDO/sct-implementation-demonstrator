import { Component, Input, OnInit, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Patient, Condition, Procedure, MedicationStatement, AllergyIntolerance, PatientService } from '../../services/patient.service';
import { AdverseReactionReport } from './adverse-reaction-form/adverse-reaction-form.component';
import { FormRecordsComponent } from '../form-records/form-records.component';

export interface ClinicalForm {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
}

@Component({
  selector: 'app-clinical-forms',
  templateUrl: './clinical-forms.component.html',
  styleUrls: ['./clinical-forms.component.css'],
  standalone: false
})
export class ClinicalFormsComponent implements OnInit {
  @Input() patient: Patient | null = null;
  @Input() conditions: Condition[] = [];
  @Input() procedures: Procedure[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCancelled = new EventEmitter<void>();
  @ViewChild(FormRecordsComponent) formRecordsComponent?: FormRecordsComponent;

  selectedForm: string | null = null;
  isSubmitting: boolean = false;
  selectedTabIndex: number = 0;
  
  availableForms: ClinicalForm[] = [
    {
      id: 'adverse-reaction',
      name: 'Adverse Drug Reaction Report (ICSR)',
      description: 'Individual Case Safety Report for adverse drug reactions',
      category: 'Pharmacovigilance',
      available: true
    },
    {
      id: 'allergies',
      name: 'Allergy/Intolerance Documentation',
      description: 'Document patient allergies and intolerances using SNOMED CT terminology',
      category: 'Clinical Documentation',
      available: true
    },
    {
      id: 'questionnaire-phq9',
      name: 'PHQ-9 Depression Screening',
      description: 'Patient Health Questionnaire-9 for depression screening',
      category: 'Questionnaires',
      available: true
    },
    {
      id: 'questionnaire-gad7',
      name: 'GAD-7 Anxiety Screening',
      description: 'Generalized Anxiety Disorder 7-item scale',
      category: 'Questionnaires',
      available: true
    },
    {
      id: 'questionnaire-carcinoma',
      name: 'Carcinoma of the Exocrine Pancreas - Histopathology Reporting Form',
      description: 'Comprehensive histopathology reporting form for pancreatic carcinoma',
      category: 'Questionnaires',
      available: true
    },
    {
      id: 'questionnaire-terminology-bindings',
      name: 'A simple form with terminology bindings',
      description: 'Simple form demonstrating SNOMED CT terminology bindings',
      category: 'Questionnaires',
      available: true
    }
  ];

  // Store loaded questionnaires
  private questionnaires: { [key: string]: any } = {};

  constructor(
    private snackBar: MatSnackBar, 
    private patientService: PatientService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    // Component initialization
  }

  onTabChange(index: number): void {
    // When switching to Form Records tab (index 1), refresh the list
    if (index === 1 && this.formRecordsComponent) {
      setTimeout(() => {
        if (this.formRecordsComponent) {
          this.formRecordsComponent.refresh();
        }
      }, 100);
    }
  }

  onFormSelected(formId: string): void {
    this.selectedForm = formId;
    
    // Load questionnaire if it's a questionnaire form
    if (formId && formId.startsWith('questionnaire-')) {
      this.loadQuestionnaire(formId);
    }
  }

  private async loadQuestionnaire(formId: string): Promise<void> {
    // Check if already loaded
    if (this.questionnaires[formId]) {
      return;
    }

    // Map form IDs to actual filenames (handle special cases with spaces/parentheses)
    const filenameMap: { [key: string]: string } = {
      'questionnaire-phq9': 'phq9.json',
      'questionnaire-gad7': 'gad7.json',
      'questionnaire-carcinoma': 'Carcinoma-of-the-Exocrine-Pancreas-Histopathology-Reporting-Form.R4 (11).json',
      'questionnaire-terminology-bindings': 'A simple form with terminology bindings-v4.json'
    };

    const questionnaireFile = filenameMap[formId] || formId.replace('questionnaire-', '') + '.json';
    
    try {
      const data = await lastValueFrom(this.http.get(`assets/questionnaires/${questionnaireFile}`));
      this.questionnaires[formId] = data;
    } catch (error) {
      this.snackBar.open(
        `Failed to load questionnaire: ${questionnaireFile}`,
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar']
        }
      );
    }
  }

  getQuestionnaire(formId: string | null): any {
    if (!formId) return null;
    return this.questionnaires[formId] || null;
  }

  isQuestionnaireForm(formId: string | null): boolean {
    return !!(formId && formId.startsWith('questionnaire-'));
  }

  async onFormSubmitted(formData: any): Promise<void> {
    this.isSubmitting = true;
    
    try {
      // Simulate submission to regulatory organization
      await this.simulateSubmission(formData);
      
      // Show success message
      this.showSuccessMessage(formData);
      
      // Emit the form data for parent component
      this.formSubmitted.emit(formData);
      
      // Reset the form selection
      this.selectedForm = null;
      
    } catch (error) {
      // Show error message
      this.showErrorMessage();
    } finally {
      this.isSubmitting = false;
    }
  }

  private async simulateSubmission(formData: any): Promise<void> {
    // Simulate network delay (2-4 seconds)
    const delay = Math.random() * 2000 + 2000;
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate occasional failure (5% chance)
        if (Math.random() < 0.05) {
          reject(new Error('Submission failed'));
        } else {
          resolve();
        }
      }, delay);
    });
  }

  private showSuccessMessage(formData: any): void {
    const reportId = formData.reportId || 'ADR-XXXXXX';
    const organization = this.getTargetOrganization(formData);
    const referenceId = this.generateReferenceId();
    
    const message = `✅ ICSR Report ${reportId} successfully submitted to ${organization}. Reference ID: ${referenceId}`;
    const action = 'Close';
    
    this.snackBar.open(
      message,
      action,
      {
        duration: 8000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );
    
    // Add demo notice after a short delay
    setTimeout(() => {
      this.snackBar.open(
        'This is a demonstration. No actual data was submitted to any regulatory authority.',
        'OK',
        {
          duration: 6000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['demo-notice-snackbar']
        }
      );
    }, 1000);
  }

  private showErrorMessage(): void {
    this.snackBar.open(
      '❌ Submission failed. Please check your connection and try again.',
      'Close',
      {
        duration: 6000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      }
    );
  }

  private getTargetOrganization(formData: any): string {
    // Determine target organization based on country
    const country = formData.countryOfReaction || formData.senderInformation?.country || 'Unknown';
    
    if (country === 'United Kingdom') {
      return 'MHRA (Medicines and Healthcare products Regulatory Agency)';
    } else if (['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 
               'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
               'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
               'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'].includes(country)) {
      return 'EMA (European Medicines Agency)';
    } else if (country === 'United States') {
      return 'FDA (Food and Drug Administration)';
    } else {
      return 'National Regulatory Authority';
    }
  }

  private generateReferenceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `REF-${timestamp}-${random}`.toUpperCase();
  }

  onFormCancelled(): void {
    this.selectedForm = null;
    this.formCancelled.emit();
  }

  onQuestionnaireSubmitted(data: any): void {
    // Show success message
    this.snackBar.open(
      `Questionnaire response saved successfully`,
      'Close',
      {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );

    // Emit the questionnaire response data
    this.formSubmitted.emit({
      type: 'questionnaire-response',
      data: data,
      timestamp: new Date().toISOString()
    });

    // Reset form selection
    this.selectedForm = null;

    // Switch to Form Records tab and refresh the list after a short delay
    setTimeout(() => {
      // Switch to Form Records tab (index 1)
      this.selectedTabIndex = 1;
      
      // Give the tab time to render, then refresh
      setTimeout(() => {
        if (this.formRecordsComponent) {
          this.formRecordsComponent.refresh();
        }
      }, 100);
    }, 500);
  }

  onAllergyAdded(allergyData: any): void {
    // Show success message for allergy documentation
    this.snackBar.open(
      `✅ Allergy/Intolerance documented: ${allergyData.display || 'Unknown'}`,
      'Close',
      {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );
    
    // Emit the allergy data for parent component
    this.formSubmitted.emit({
      type: 'allergy',
      data: allergyData,
      timestamp: new Date().toISOString()
    });
  }

  onAllergySaved(allergyData: any): void {
    // Store the allergy in the PatientService if we have a selected patient
    if (this.patient && this.patient.id) {
      // Normalize criticality field (form sends it as array, FHIR expects string)
      let criticality: 'low' | 'high' | 'unable-to-assess' | undefined = undefined;
      if (allergyData.criticality) {
        if (Array.isArray(allergyData.criticality) && allergyData.criticality.length > 0) {
          criticality = allergyData.criticality[0];
        } else if (typeof allergyData.criticality === 'string') {
          criticality = allergyData.criticality as any;
        }
      }
      
      // Ensure the allergy has a proper unique ID and patient reference
      // Always generate a unique ID to avoid hardcoded "medication" ID from the form
      const allergyToStore: AllergyIntolerance = {
        ...allergyData,
        id: `allergy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        criticality: criticality,
        patient: {
          reference: `Patient/${this.patient.id}`,
          display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
        },
        recordedDate: new Date().toISOString()
      };
      
      // Add the allergy to the patient's record
      const wasAdded = this.patientService.addPatientAllergy(this.patient.id, allergyToStore);
      
      if (wasAdded) {
        // Create conditions from allergy reactions (manifestations)
        const newConditionsAdded = this.createConditionsFromAllergyReactions(allergyToStore);
        
        // Show success message
        const message = newConditionsAdded > 0 
          ? `Allergy/Intolerance saved successfully. ${newConditionsAdded} reaction(s) added to problem list.`
          : 'Allergy/Intolerance saved successfully';
        
        this.snackBar.open(
          message,
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          }
        );
        
        // Emit the allergy data to parent component to update the summary
        // Include the newly created conditions so they can be mapped to anatomical locations
        const newConditions = this.getNewConditionsFromReactions(allergyToStore);
        this.formSubmitted.emit({
          type: 'allergy',
          data: allergyToStore,
          timestamp: new Date().toISOString(),
          newConditionsCount: newConditionsAdded,
          newConditions: newConditions
        });
      } else {
        // Duplicate detected
        this.snackBar.open(
          'This allergy already exists for this patient',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
      }
      
    } else {
      console.warn('No patient selected - allergy not stored');
    }
  }

  private newlyCreatedConditions: Condition[] = [];

  private createConditionsFromAllergyReactions(allergy: AllergyIntolerance): number {
    if (!this.patient || !allergy.reaction || allergy.reaction.length === 0) {
      return 0;
    }

    // Reset the tracking array
    this.newlyCreatedConditions = [];
    let newConditionsCount = 0;
    const existingConditions = this.patientService.getPatientConditions(this.patient.id);

    // Iterate through all reactions in the allergy
    for (const reaction of allergy.reaction) {
      if (!reaction.manifestation || reaction.manifestation.length === 0) {
        continue;
      }

      // Iterate through all manifestations (symptoms) in the reaction
      for (const manifestation of reaction.manifestation) {
        // Check if this manifestation already exists as a condition
        const manifestationCode = manifestation.coding?.[0]?.code;
        const manifestationDisplay = manifestation.coding?.[0]?.display || manifestation.text;

        if (!manifestationDisplay) {
          continue; // Skip if no display name
        }

        // Check if condition already exists
        const conditionExists = existingConditions.some(condition => {
          // Check by SNOMED code if available
          if (manifestationCode && condition.code?.coding?.[0]?.code === manifestationCode) {
            return true;
          }
          // Otherwise check by display text
          return condition.code?.text === manifestationDisplay;
        });

        if (!conditionExists) {
          // Create a new condition for this manifestation
          const newCondition: Condition = {
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
            category: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                code: 'problem-list-item',
                display: 'Problem List Item'
              }],
              text: 'Problem List Item'
            }],
            code: {
              coding: manifestation.coding ? [...manifestation.coding] : undefined,
              text: manifestationDisplay
            },
            subject: {
              reference: `Patient/${this.patient.id}`,
              display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
            },
            onsetDateTime: allergy.onsetDateTime || new Date().toISOString(),
            recordedDate: new Date().toISOString(),
            note: [{
              text: `Manifestation of allergic reaction to ${allergy.code?.text || 'unknown substance'}`,
              time: new Date().toISOString()
            }]
          };

          // Add the condition to the patient's record
          const added = this.patientService.addPatientCondition(this.patient.id, newCondition);
          if (added) {
            newConditionsCount++;
            // Also add to local conditions array so UI updates
            this.conditions.push(newCondition);
            // Track this newly created condition
            this.newlyCreatedConditions.push(newCondition);
          }
        }
      }
    }

    return newConditionsCount;
  }

  private getNewConditionsFromReactions(allergy: AllergyIntolerance): Condition[] {
    // Return the tracked newly created conditions
    return [...this.newlyCreatedConditions];
  }

  getSelectedFormName(): string {
    const form = this.availableForms.find(f => f.id === this.selectedForm);
    return form ? form.name : 'Unknown Form';
  }
}
