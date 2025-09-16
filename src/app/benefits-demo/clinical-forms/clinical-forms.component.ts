import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Patient, Condition, Procedure, MedicationStatement, AllergyIntolerance, PatientService } from '../../services/patient.service';
import { AdverseReactionReport } from './adverse-reaction-form/adverse-reaction-form.component';

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

  selectedForm: string | null = null;
  isSubmitting: boolean = false;
  
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
    }
  ];

  constructor(private snackBar: MatSnackBar, private patientService: PatientService) { }

  ngOnInit(): void {
    // Component initialization
  }

  onFormSelected(formId: string): void {
    this.selectedForm = formId;
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
    console.log('Form cancelled');
    this.selectedForm = null;
    this.formCancelled.emit();
  }

  onAllergyAdded(allergyData: any): void {
    console.log('Allergy added:', allergyData);
    
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
    console.log('Allergy saved:', allergyData);
    
    // Store the allergy in the PatientService if we have a selected patient
    if (this.patient && this.patient.id) {
      // Ensure the allergy has a proper ID and patient reference
      const allergyToStore: AllergyIntolerance = {
        ...allergyData,
        id: allergyData.id || `allergy-${Date.now()}`,
        patient: {
          reference: `Patient/${this.patient.id}`,
          display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
        },
        recordedDate: new Date().toISOString()
      };
      
      // Add the allergy to the patient's record
      this.patientService.addPatientAllergy(this.patient.id, allergyToStore);
      
      console.log('Allergy stored for patient:', this.patient.id);
    } else {
      console.warn('No patient selected - allergy not stored');
    }
  }

  getSelectedFormName(): string {
    const form = this.availableForms.find(f => f.id === this.selectedForm);
    return form ? form.name : 'Unknown Form';
  }
}
