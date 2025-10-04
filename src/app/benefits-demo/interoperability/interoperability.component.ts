import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { IPSReaderService } from './ips-reader.service';
import { ProcessedPatientData } from './ips-interfaces';
import { PatientService, Patient } from '../../services/patient.service';

@Component({
  selector: 'app-interoperability',
  templateUrl: './interoperability.component.html',
  styleUrls: ['./interoperability.component.css'],
  standalone: false
})
export class InteroperabilityComponent implements OnInit, OnDestroy {
  patientData: ProcessedPatientData | null = null;
  isLoading = false;
  error: string | null = null;
  
  // Patient linking properties
  selectedPatientId: string = '';
  linkedPatient: any = null;
  suggestedPatient: any = null;
  availablePatients: Patient[] = [];
  private subscriptions: Subscription[] = [];
  
  // Data verification properties
  showDataVerification = false;
  existingPatientData: any = null;
  importSummary: any = null;
  
  // Selection tracking
  selectedConditions: Set<string> = new Set();
  selectedProcedures: Set<string> = new Set();
  selectedMedications: Set<string> = new Set();
  selectedAllergies: Set<string> = new Set();

  // File upload
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(
    public ipsReaderService: IPSReaderService,
    private patientService: PatientService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAvailablePatients();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load available patients from the PatientService
   */
  private loadAvailablePatients(): void {
    this.subscriptions.push(
      this.patientService.getPatients().subscribe(patients => {
        this.availablePatients = patients;
        // Re-run suggestion logic if we already have IPS data
        if (this.patientData) {
          this.findSuggestedPatient();
        }
      })
    );
  }

  /**
   * Load the example IPS bundle
   */
  loadExampleIPSBundle(): void {
    this.isLoading = true;
    this.error = null;
    
    const ipsFilePath = 'assets/data/ips-example.json';
    
    this.ipsReaderService.loadIPSBundle(ipsFilePath).subscribe({
      next: (data) => {
        this.patientData = data;
        this.isLoading = false;
        this.findSuggestedPatient();
      },
      error: (error) => {
        this.error = 'Failed to load IPS bundle: ' + error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Get patient name
   */
  getPatientName(): string {
    return this.ipsReaderService.getPatientName(this.patientData?.patient || null);
  }

  /**
   * Get patient birth date
   */
  getPatientBirthDate(): string {
    return this.ipsReaderService.getPatientBirthDate(this.patientData?.patient || null);
  }

  /**
   * Get patient gender
   */
  getPatientGender(): string {
    return this.ipsReaderService.getPatientGender(this.patientData?.patient || null);
  }

  /**
   * Check if patient data is available
   */
  hasPatientData(): boolean {
    return this.patientData !== null && this.patientData.patient !== null;
  }

  /**
   * Check if there are any conditions
   */
  hasConditions(): boolean {
    return this.patientData !== null && this.patientData.conditions.length > 0;
  }

  /**
   * Check if there are any procedures
   */
  hasProcedures(): boolean {
    return this.patientData !== null && this.patientData.procedures.length > 0;
  }

  /**
   * Check if there are any medications
   */
  hasMedications(): boolean {
    return this.patientData !== null && this.patientData.medications.length > 0;
  }

  /**
   * Check if there are any allergies
   */
  hasAllergies(): boolean {
    return this.patientData !== null && this.patientData.allergies.length > 0;
  }


  /**
   * Handle patient selection change
   */
  onPatientSelectionChange(event: any): void {
    this.selectedPatientId = event.value;
    // Clear linked patient when selection changes
    this.linkedPatient = null;
  }

  /**
   * Find suggested patient based on name and birth date matches
   */
  findSuggestedPatient(): void {
    if (!this.patientData?.patient || this.availablePatients.length === 0) {
      return;
    }

    const ipsPatient = this.patientData.patient;
    const ipsName = this.getPatientName().toLowerCase();
    const ipsBirthDate = ipsPatient.birthDate;

    // Find exact matches first
    let exactMatch = this.availablePatients.find(patient => {
      const patientName = this.getPatientDisplayName(patient).toLowerCase();
      return patientName === ipsName && patient.birthDate === ipsBirthDate;
    });

    if (exactMatch) {
      this.suggestedPatient = { ...exactMatch, matchType: 'exact' };
      return;
    }

    // Find name similarity matches
    let nameMatch = this.availablePatients.find(patient => {
      const patientName = this.getPatientDisplayName(patient).toLowerCase();
      const similarity = this.calculateNameSimilarity(ipsName, patientName);
      return similarity > 0.8 && patient.birthDate === ipsBirthDate;
    });

    if (nameMatch) {
      this.suggestedPatient = { ...nameMatch, matchType: 'name' };
      return;
    }

    // Find birth date matches with partial name similarity
    let dateMatch = this.availablePatients.find(patient => {
      const patientName = this.getPatientDisplayName(patient).toLowerCase();
      const similarity = this.calculateNameSimilarity(ipsName, patientName);
      return similarity > 0.6 && patient.birthDate === ipsBirthDate;
    });

    if (dateMatch) {
      this.suggestedPatient = { ...dateMatch, matchType: 'date' };
    }
  }

  /**
   * Calculate name similarity using simple string comparison
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    
    let matches = 0;
    let totalWords = Math.max(words1.length, words2.length);
    
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || 
            (word1.length > 2 && word2.length > 2 && 
             (word1.includes(word2) || word2.includes(word1)))) {
          matches++;
          break;
        }
      }
    }
    
    return matches / totalWords;
  }

  /**
   * Accept the suggested patient
   */
  acceptSuggestion(): void {
    if (this.suggestedPatient) {
      this.selectedPatientId = this.suggestedPatient.id;
      this.linkPatient();
    }
  }

  /**
   * Dismiss the suggested patient
   */
  dismissSuggestion(): void {
    this.suggestedPatient = null;
  }

  /**
   * Get match type label for display
   */
  getMatchTypeLabel(matchType: string): string {
    switch (matchType) {
      case 'exact':
        return 'Exact Match';
      case 'name':
        return 'Name Similarity';
      case 'date':
        return 'Birth Date Match';
      default:
        return 'Possible Match';
    }
  }

  /**
   * Get patient display name from Patient object
   */
  getPatientDisplayName(patient: Patient): string {
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

  /**
   * Link the IPS patient to an existing patient
   */
  linkPatient(): void {
    if (!this.selectedPatientId) {
      return;
    }

    const selectedPatient = this.availablePatients.find(p => p.id === this.selectedPatientId);
    if (selectedPatient) {
      this.linkedPatient = selectedPatient;
      this.suggestedPatient = null; // Clear suggestion after linking
      this.verifyExistingData(selectedPatient.id);
    }
  }

  /**
   * Verify existing data for the selected patient
   */
  private verifyExistingData(patientId: string): void {
    if (!this.patientData) {
      return;
    }

    // Get existing patient data
    const existingConditions = this.patientService.getPatientConditions(patientId);
    const existingProcedures = this.patientService.getPatientProcedures(patientId);
    const existingMedications = this.patientService.getPatientMedications(patientId);

    this.existingPatientData = {
      conditions: existingConditions,
      procedures: existingProcedures,
      medications: existingMedications
    };

    // Create import summary
    this.importSummary = {
      ipsData: {
        conditions: this.patientData.conditions.length,
        procedures: this.patientData.procedures.length,
        medications: this.patientData.medications.length,
        allergies: this.patientData.allergies.length
      },
      existingData: {
        conditions: existingConditions.length,
        procedures: existingProcedures.length,
        medications: existingMedications.length
      },
      potentialDuplicates: this.findPotentialDuplicates(patientId)
    };

    // Initialize selections (select all by default)
    this.initializeSelections();
    
    this.showDataVerification = true;
  }

  /**
   * Find potential duplicates between IPS data and existing patient data
   */
  private findPotentialDuplicates(patientId: string): any {
    if (!this.patientData) {
      return { conditions: [], procedures: [], medications: [] };
    }

    const existingConditions = this.patientService.getPatientConditions(patientId);
    const existingProcedures = this.patientService.getPatientProcedures(patientId);
    const existingMedications = this.patientService.getPatientMedications(patientId);

    return {
      conditions: this.findDuplicateConditions(this.patientData.conditions, existingConditions),
      procedures: this.findDuplicateProcedures(this.patientData.procedures, existingProcedures),
      medications: this.findDuplicateMedications(this.patientData.medications, existingMedications)
    };
  }

  /**
   * Find duplicate conditions
   */
  private findDuplicateConditions(ipsConditions: any[], existingConditions: any[]): any[] {
    const duplicates: any[] = [];
    
    ipsConditions.forEach(ipsCondition => {
      const ipsText = ipsCondition.code?.text || '';
      const existingMatch = existingConditions.find(existing => {
        const existingText = existing.code?.text || '';
        return this.calculateNameSimilarity(ipsText.toLowerCase(), existingText.toLowerCase()) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsCondition,
          existing: existingMatch,
          similarity: this.calculateNameSimilarity(ipsText.toLowerCase(), existingMatch.code?.text?.toLowerCase() || '')
        });
      }
    });
    
    return duplicates;
  }

  /**
   * Find duplicate procedures
   */
  private findDuplicateProcedures(ipsProcedures: any[], existingProcedures: any[]): any[] {
    const duplicates: any[] = [];
    
    ipsProcedures.forEach(ipsProcedure => {
      const ipsText = ipsProcedure.code?.text || '';
      const existingMatch = existingProcedures.find(existing => {
        const existingText = existing.code?.text || '';
        return this.calculateNameSimilarity(ipsText.toLowerCase(), existingText.toLowerCase()) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsProcedure,
          existing: existingMatch,
          similarity: this.calculateNameSimilarity(ipsText.toLowerCase(), existingMatch.code?.text?.toLowerCase() || '')
        });
      }
    });
    
    return duplicates;
  }

  /**
   * Find duplicate medications
   */
  private findDuplicateMedications(ipsMedications: any[], existingMedications: any[]): any[] {
    const duplicates: any[] = [];
    
    ipsMedications.forEach(ipsMedication => {
      const ipsText = ipsMedication.medicationCodeableConcept?.text || '';
      const existingMatch = existingMedications.find(existing => {
        const existingText = existing.medicationCodeableConcept?.text || '';
        return this.calculateNameSimilarity(ipsText.toLowerCase(), existingText.toLowerCase()) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsMedication,
          existing: existingMatch,
          similarity: this.calculateNameSimilarity(ipsText.toLowerCase(), existingMatch.medicationCodeableConcept?.text?.toLowerCase() || '')
        });
      }
    });
    
    return duplicates;
  }

  /**
   * Proceed with data import after verification
   */
  proceedWithImport(): void {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    // Import the data
    this.importIPSToPatient(this.linkedPatient.id, this.patientData);
    
    // Close verification dialog
    this.showDataVerification = false;
  }

  /**
   * Cancel the import process
   */
  cancelImport(): void {
    this.showDataVerification = false;
    this.linkedPatient = null;
    this.selectedPatientId = '';
    this.clearSelections();
  }

  /**
   * Initialize selections (select all by default)
   */
  private initializeSelections(): void {
    this.selectedConditions.clear();
    this.selectedProcedures.clear();
    this.selectedMedications.clear();
    this.selectedAllergies.clear();

    if (this.patientData) {
      // Select all conditions by default
      this.patientData.conditions.forEach(condition => {
        this.selectedConditions.add(condition.id);
      });

      // Select all procedures by default
      this.patientData.procedures.forEach(procedure => {
        this.selectedProcedures.add(procedure.id);
      });

      // Select all medications by default
      this.patientData.medications.forEach(medication => {
        this.selectedMedications.add(medication.id);
      });

      // Select all allergies by default
      this.patientData.allergies.forEach(allergy => {
        this.selectedAllergies.add(allergy.id);
      });
    }
  }

  /**
   * Clear all selections
   */
  private clearSelections(): void {
    this.selectedConditions.clear();
    this.selectedProcedures.clear();
    this.selectedMedications.clear();
    this.selectedAllergies.clear();
  }

  /**
   * Toggle condition selection
   */
  toggleConditionSelection(conditionId: string): void {
    if (this.selectedConditions.has(conditionId)) {
      this.selectedConditions.delete(conditionId);
    } else {
      this.selectedConditions.add(conditionId);
    }
  }

  /**
   * Toggle procedure selection
   */
  toggleProcedureSelection(procedureId: string): void {
    if (this.selectedProcedures.has(procedureId)) {
      this.selectedProcedures.delete(procedureId);
    } else {
      this.selectedProcedures.add(procedureId);
    }
  }

  /**
   * Toggle medication selection
   */
  toggleMedicationSelection(medicationId: string): void {
    if (this.selectedMedications.has(medicationId)) {
      this.selectedMedications.delete(medicationId);
    } else {
      this.selectedMedications.add(medicationId);
    }
  }

  /**
   * Toggle allergy selection
   */
  toggleAllergySelection(allergyId: string): void {
    if (this.selectedAllergies.has(allergyId)) {
      this.selectedAllergies.delete(allergyId);
    } else {
      this.selectedAllergies.add(allergyId);
    }
  }

  /**
   * Select all items in a category
   */
  selectAllConditions(): void {
    if (this.patientData) {
      this.patientData.conditions.forEach(condition => {
        this.selectedConditions.add(condition.id);
      });
    }
  }

  selectAllProcedures(): void {
    if (this.patientData) {
      this.patientData.procedures.forEach(procedure => {
        this.selectedProcedures.add(procedure.id);
      });
    }
  }

  selectAllMedications(): void {
    if (this.patientData) {
      this.patientData.medications.forEach(medication => {
        this.selectedMedications.add(medication.id);
      });
    }
  }

  selectAllAllergies(): void {
    if (this.patientData) {
      this.patientData.allergies.forEach(allergy => {
        this.selectedAllergies.add(allergy.id);
      });
    }
  }

  /**
   * Deselect all items in a category
   */
  deselectAllConditions(): void {
    this.selectedConditions.clear();
  }

  deselectAllProcedures(): void {
    this.selectedProcedures.clear();
  }

  deselectAllMedications(): void {
    this.selectedMedications.clear();
  }

  deselectAllAllergies(): void {
    this.selectedAllergies.clear();
  }

  /**
   * Check if any items are selected
   */
  hasSelectedItems(): boolean {
    return this.selectedConditions.size > 0 || 
           this.selectedProcedures.size > 0 || 
           this.selectedMedications.size > 0 || 
           this.selectedAllergies.size > 0;
  }

  /**
   * Navigate back to benefits demo
   */
  goBack(): void {
    this.router.navigate(['/benefits-demo']);
  }

  /**
   * Trigger file input click
   */
  triggerFileUpload(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Handle file selection
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.loadIPSBundleFromFile(file);
    }
  }

  /**
   * Load IPS bundle from uploaded file
   */
  private loadIPSBundleFromFile(file: File): void {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      this.error = 'Please select a JSON file.';
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.error = 'File size too large. Please select a file smaller than 10MB.';
      return;
    }

    this.isLoading = true;
    this.error = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonContent = e.target?.result as string;
        const bundle = JSON.parse(jsonContent);
        
        // Process the bundle using the IPS reader service
        this.ipsReaderService.processIPSBundleFromObject(bundle).subscribe({
          next: (data) => {
            this.patientData = data;
            this.isLoading = false;
            this.findSuggestedPatient();
            // Clear the file input
            this.fileInput.nativeElement.value = '';
          },
          error: (error) => {
            this.error = 'Failed to parse IPS bundle: ' + error.message;
            this.isLoading = false;
            this.fileInput.nativeElement.value = '';
          }
        });
      } catch (parseError) {
        this.error = 'Invalid JSON file. Please check the file format.';
        this.isLoading = false;
        this.fileInput.nativeElement.value = '';
      }
    };

    reader.onerror = () => {
      this.error = 'Failed to read file. Please try again.';
      this.isLoading = false;
      this.fileInput.nativeElement.value = '';
    };

    reader.readAsText(file);
  }

  /**
   * Import IPS data to patient (only selected items)
   */
  private importIPSToPatient(patientId: string, ipsData: ProcessedPatientData): void {
    // Import selected conditions
    ipsData.conditions
      .filter(condition => this.selectedConditions.has(condition.id))
      .forEach(condition => {
        const convertedCondition = {
          ...condition,
          code: {
            ...condition.code,
            text: condition.code?.text || 'Unknown condition'
          }
        };
        this.patientService.addPatientCondition(patientId, convertedCondition);
      });
    
    // Import selected procedures
    ipsData.procedures
      .filter(procedure => this.selectedProcedures.has(procedure.id))
      .forEach(procedure => {
        const convertedProcedure = {
          ...procedure,
          status: this.convertProcedureStatus(procedure.status),
          code: {
            ...procedure.code,
            text: procedure.code?.text || 'Unknown procedure'
          }
        };
        this.patientService.addPatientProcedure(patientId, convertedProcedure);
      });
    
    // Import selected medications
    ipsData.medications
      .filter(medication => this.selectedMedications.has(medication.id))
      .forEach(medication => {
        const convertedMedication = {
          ...medication,
          status: this.convertMedicationStatus(medication.status),
          medicationCodeableConcept: medication.medicationCodeableConcept ? {
            ...medication.medicationCodeableConcept,
            text: medication.medicationCodeableConcept.text || 'Unknown medication'
          } : undefined
        };
        this.patientService.addPatientMedication(patientId, convertedMedication);
      });
    
    // Note: Allergies would need to be implemented in PatientService
    // ipsData.allergies
    //   .filter(allergy => this.selectedAllergies.has(allergy.id))
    //   .forEach(allergy => {
    //     this.patientService.addPatientAllergy(patientId, allergy);
    //   });
  }

  /**
   * Convert procedure status to valid enum value
   */
  private convertProcedureStatus(status: string): "preparation" | "in-progress" | "not-done" | "on-hold" | "stopped" | "completed" | "entered-in-error" | "unknown" {
    const validStatuses = ["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"];
    return validStatuses.includes(status) ? status as any : "unknown";
  }

  /**
   * Convert medication status to valid enum value
   */
  private convertMedicationStatus(status: string): "on-hold" | "stopped" | "completed" | "entered-in-error" | "unknown" | "active" | "intended" | "not-taken" {
    const validStatuses = ["on-hold", "stopped", "completed", "entered-in-error", "unknown", "active", "intended", "not-taken"];
    return validStatuses.includes(status) ? status as any : "unknown";
  }
}
