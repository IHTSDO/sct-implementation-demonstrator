import { Component, Input, OnInit, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Patient, Condition, Procedure, MedicationStatement, AllergyIntolerance, PatientService, OpenEHRComposition } from '../../services/patient.service';
import { AdverseReactionReport } from './adverse-reaction-form/adverse-reaction-form.component';
import { FormRecordsComponent } from '../form-records/form-records.component';
import { CustomQuestionnaireService, CustomQuestionnaire } from '../../services/custom-questionnaire.service';

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
  
  // Custom questionnaires management
  customQuestionnaires: CustomQuestionnaire[] = [];
  isUploadingQuestionnaire: boolean = false;
  uploadError: string | null = null;
  
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
    },
    {
      id: 'openehr-vital-signs',
      name: 'Vital signs',
      description: 'openEHR template for documenting vital signs: body temperature, blood pressure, BMI, height, weight, pulse, respiration, and pulse oximetry',
      category: 'openEHR Templates',
      available: true
    }
  ];

  // Store loaded questionnaires
  private questionnaires: { [key: string]: any } = {};
  
  // Store loaded openEHR templates
  private openehrTemplates: { [key: string]: any } = {};

  constructor(
    private snackBar: MatSnackBar, 
    private patientService: PatientService,
    private http: HttpClient,
    private customQuestionnaireService: CustomQuestionnaireService
  ) { }

  ngOnInit(): void {
    // Load custom questionnaires from localStorage
    this.loadCustomQuestionnaires();
  }

  private loadCustomQuestionnaires(): void {
    this.customQuestionnaires = this.customQuestionnaireService.getAllCustomQuestionnaires();
  }

  /**
   * Get all available forms (built-in + custom questionnaires)
   */
  get allAvailableForms(): ClinicalForm[] {
    const customForms: ClinicalForm[] = this.customQuestionnaires.map(cq => ({
      id: cq.id,
      name: cq.name,
      description: cq.description,
      category: cq.category,
      available: true
    }));

    return [...this.availableForms, ...customForms];
  }

  /**
   * Handle file upload for FHIR Questionnaire
   */
  onQuestionnaireFileSelected(event: any): void {
    const file: File = event.target.files[0];
    
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.json')) {
      this.uploadError = 'Please select a JSON file';
      this.snackBar.open('Please select a JSON file', 'Close', {
        duration: 4000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isUploadingQuestionnaire = true;
    this.uploadError = null;

    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      try {
        const jsonContent = JSON.parse(e.target.result);
        
        // Attempt to add the questionnaire
        const result = this.customQuestionnaireService.addCustomQuestionnaire(jsonContent);
        
        if (result.success) {
          // Reload custom questionnaires
          this.loadCustomQuestionnaires();
          
          // Show success message
          this.snackBar.open(
            `✅ Questionnaire "${jsonContent.title || jsonContent.name}" uploaded successfully!`,
            'Close',
            {
              duration: 5000,
              panelClass: ['success-snackbar']
            }
          );
          
          // Clear the file input
          event.target.value = '';
        } else {
          this.uploadError = result.error || 'Failed to upload questionnaire';
          this.snackBar.open(
            `❌ ${result.error || 'Failed to upload questionnaire'}`,
            'Close',
            {
              duration: 6000,
              panelClass: ['error-snackbar']
            }
          );
        }
      } catch (error) {
        this.uploadError = 'Invalid JSON file';
        this.snackBar.open(
          '❌ Invalid JSON file. Please ensure the file contains valid JSON.',
          'Close',
          {
            duration: 6000,
            panelClass: ['error-snackbar']
          }
        );
      } finally {
        this.isUploadingQuestionnaire = false;
      }
    };

    reader.onerror = () => {
      this.uploadError = 'Failed to read file';
      this.snackBar.open(
        '❌ Failed to read file',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
      this.isUploadingQuestionnaire = false;
    };

    reader.readAsText(file);
  }

  /**
   * Delete a custom questionnaire
   */
  deleteCustomQuestionnaire(id: string, name: string): void {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    const success = this.customQuestionnaireService.deleteCustomQuestionnaire(id);
    
    if (success) {
      // Reload custom questionnaires
      this.loadCustomQuestionnaires();
      
      // If the deleted questionnaire was selected, clear selection
      if (this.selectedForm === id) {
        this.selectedForm = null;
      }
      
      this.snackBar.open(
        `✅ Questionnaire "${name}" deleted successfully`,
        'Close',
        {
          duration: 4000,
          panelClass: ['success-snackbar']
        }
      );
    } else {
      this.snackBar.open(
        `❌ Failed to delete questionnaire`,
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    }
  }

  /**
   * Delete all custom questionnaires
   */
  deleteAllCustomQuestionnaires(): void {
    if (!confirm('Are you sure you want to delete ALL custom questionnaires? This action cannot be undone.')) {
      return;
    }

    const success = this.customQuestionnaireService.deleteAllCustomQuestionnaires();
    
    if (success) {
      this.loadCustomQuestionnaires();
      
      if (this.selectedForm && this.customQuestionnaireService.isCustomQuestionnaire(this.selectedForm)) {
        this.selectedForm = null;
      }
      
      this.snackBar.open(
        '✅ All custom questionnaires deleted successfully',
        'Close',
        {
          duration: 4000,
          panelClass: ['success-snackbar']
        }
      );
    } else {
      this.snackBar.open(
        '❌ Failed to delete questionnaires',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    }
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
    } else if (formId && this.customQuestionnaireService.isCustomQuestionnaire(formId)) {
      // Load custom questionnaire
      this.loadCustomQuestionnaireData(formId);
    } else if (formId && formId.startsWith('openehr-')) {
      // Load openEHR template
      this.loadOpenehrTemplate(formId);
    }
  }

  private loadCustomQuestionnaireData(formId: string): void {
    const customQ = this.customQuestionnaireService.getCustomQuestionnaire(formId);
    if (customQ) {
      // Store it in the questionnaires cache
      this.questionnaires[formId] = customQ.data;
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
    return !!(formId && (formId.startsWith('questionnaire-') || this.customQuestionnaireService.isCustomQuestionnaire(formId)));
  }

  isOpenehrForm(formId: string | null): boolean {
    return !!(formId && formId.startsWith('openehr-'));
  }

  getFormType(formId: string | null): 'fhir' | 'openehr' | 'custom' | null {
    if (!formId) return null;
    if (formId.startsWith('openehr-')) return 'openehr';
    if (this.customQuestionnaireService.isCustomQuestionnaire(formId)) return 'fhir'; // Custom questionnaires are FHIR
    // All other forms (questionnaires, adverse-reaction, allergies) are FHIR
    return 'fhir';
  }

  private async loadOpenehrTemplate(formId: string): Promise<void> {
    // Check if already loaded
    if (this.openehrTemplates[formId]) {
      return;
    }

    // Map form IDs to JSON filenames (pre-converted using @medblocks/wtg or EHRbase)
    const filenameMap: { [key: string]: string } = {
      'openehr-vital-signs': 'vital_signs.json'
    };

    const templateFile = filenameMap[formId];
    
    if (!templateFile) {
      this.snackBar.open(
        `Template file not found for: ${formId}`,
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar']
        }
      );
      return;
    }

    try {
      // Load JSON file directly (pre-converted using @medblocks/wtg or EHRbase)
      const webTemplateJson = await lastValueFrom(this.http.get<any>(`assets/openehr/${templateFile}`));
      
      // Convert format if needed (EHRbase uses templateId, Medblocks expects template_id)
      let webTemplate: any;
      if (webTemplateJson.templateId && !webTemplateJson.template_id) {
        // Convert from EHRbase format to Medblocks format
        webTemplate = {
          template_id: webTemplateJson.templateId,
          tree: webTemplateJson.tree
        };
      } else {
        // Already in correct format
        webTemplate = webTemplateJson;
      }
      
      // Validate that it's a valid web template
      if (!webTemplate || !webTemplate.template_id || !webTemplate.tree) {
        throw new Error('Invalid web template format');
      }
      
      // Store the web template directly (no conversion needed - already in correct format)
      this.openehrTemplates[formId] = webTemplate;
    } catch (error) {
      console.error('Error loading openEHR template:', error);
      this.snackBar.open(
        `Failed to load openEHR template: ${templateFile}. Error: ${(error as Error).message}`,
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar']
        }
      );
    }
  }


  getOpenehrTemplate(formId: string | null): any {
    if (!formId) return null;
    return this.openehrTemplates[formId] || null;
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

  onOpenehrFormSubmitted(data: any): void {
    // Check if composition has any data (even if just a date)
    const hasCompositionData = data.composition && typeof data.composition === 'object' && Object.keys(data.composition).length > 0;
    
    // Save the composition to patient's record if patient is selected
    if (this.patient && this.patient.id) {
      if (hasCompositionData) {
        const compositionRecord: OpenEHRComposition = {
          resourceType: 'OpenEHRComposition',
          id: `openehr-composition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          templateId: data.webTemplate?.template_id || this.selectedForm || '',
          templateName: data.webTemplate?.tree?.name || '',
          composition: data.composition,
          webTemplate: data.webTemplate,
          authored: data.timestamp || new Date().toISOString(),
          subject: {
            reference: `Patient/${this.patient.id}`,
            display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
          },
          compositionName: data.webTemplate?.tree?.name || 'openEHR Composition'
        };

        this.patientService.addPatientOpenEHRComposition(this.patient.id, compositionRecord);
        
        // Show success message
        this.snackBar.open(
          `openEHR composition saved successfully`,
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          }
        );
      } else {
        // No composition data
        this.snackBar.open(
          `Warning: No data to save. Please fill in at least one field.`,
          'Close',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        return; // Don't continue if there's no data
      }
    } else {
      // No patient selected
      this.snackBar.open(
        `Warning: No patient selected. Composition not saved.`,
        'Close',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['warning-snackbar']
        }
      );
      return; // Don't continue if there's no patient
    }

    // Emit the openEHR composition data
    this.formSubmitted.emit({
      type: 'openehr-composition',
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
    const form = this.allAvailableForms.find(f => f.id === this.selectedForm);
    return form ? form.name : 'Unknown Form';
  }

  /**
   * Get formatted upload date for a custom questionnaire
   */
  getFormattedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
}
