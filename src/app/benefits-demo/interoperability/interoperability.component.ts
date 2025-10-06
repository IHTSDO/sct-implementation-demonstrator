import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { IPSReaderService } from './ips-reader.service';
import { ProcessedPatientData } from './ips-interfaces';
import { PatientService, Patient } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';

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
    private router: Router,
    private terminologyService: TerminologyService
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
      this.linkedPatient = this.suggestedPatient;
      this.suggestedPatient = null;
      
      // Initialize selections (select all by default)
      this.initializeSelections();
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
      
      // Initialize selections (select all by default)
      this.initializeSelections();
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
   * Get total count of selected items
   */
  getTotalSelectedCount(): number {
    return this.selectedConditions.size + 
           this.selectedProcedures.size + 
           this.selectedMedications.size + 
           this.selectedAllergies.size;
  }

  /**
   * Import all selected items at once
   */
  async importAllSelectedItems(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    let importedCount = 0;

    // Import selected conditions
    if (this.selectedConditions.size > 0) {
      const selectedConditionsData = this.patientData.conditions.filter(
        condition => this.selectedConditions.has(condition.id)
      );

      console.log(`Attempting to import ${selectedConditionsData.length} conditions for patient ${this.linkedPatient.id}`);
      
      for (const condition of selectedConditionsData) {
        const snomedCode = this.patientService.extractSnomedCode(condition);
        let icd10Code: string | undefined = undefined;
        let computedLocation: string | undefined = undefined;
        
        // Try to get ICD-10 mapping if we have a SNOMED code
        if (snomedCode) {
          try {
            const icd10Response = await this.terminologyService.getIcd10MapTargets(snomedCode).toPromise();
            if (icd10Response?.parameter) {
              const targetParam = icd10Response.parameter.find((p: any) => p.name === 'match');
              if (targetParam?.part) {
                const conceptPart = targetParam.part.find((part: any) => part.name === 'concept');
                if (conceptPart?.valueCoding?.code) {
                  icd10Code = conceptPart.valueCoding.code;
                }
              }
            }
          } catch (error) {
            console.warn('Could not fetch ICD-10 mapping for SNOMED code:', snomedCode, error);
          }

          // Calculate anatomic location using ancestor mapping
          try {
            computedLocation = await this.calculateAnatomicLocation(snomedCode);
          } catch (error) {
            console.warn('Could not calculate anatomic location for SNOMED code:', snomedCode, error);
            computedLocation = 'systemic'; // Default fallback
          }
        }

        const convertedCondition = {
          ...condition,
          code: {
            ...condition.code,
            text: condition.code?.text || this.ipsReaderService.getConditionDisplay(condition)
          },
          // Ensure we have proper dates
          recordedDate: condition.recordedDate || new Date().toISOString(),
          onsetDateTime: condition.onsetDateTime || condition.recordedDate || new Date().toISOString(),
          // Add SNOMED concept ID for easier lookup
          snomedConceptId: snomedCode || undefined,
          // Add ICD-10 mapping if available
          icd10Code: icd10Code,
          // Add computed anatomic location
          computedLocation: computedLocation || 'systemic',
          // Ensure proper subject reference
          subject: {
            reference: `Patient/${this.linkedPatient.id}`,
            display: this.getPatientDisplayName(this.linkedPatient)
          }
        };
        console.log(`Importing condition: ${convertedCondition.code.text} (SNOMED: ${snomedCode}, ICD-10: ${icd10Code || 'N/A'}, Location: ${computedLocation})`);
        
        const success = this.patientService.addPatientCondition(this.linkedPatient.id, convertedCondition);
        console.log(`Condition import result: ${success}`);
        if (success) {
          importedCount++;
        }
      }
    }

    // Import selected procedures
    if (this.selectedProcedures.size > 0) {
      const selectedProceduresData = this.patientData.procedures.filter(
        procedure => this.selectedProcedures.has(procedure.id)
      );

      selectedProceduresData.forEach(procedure => {
        const convertedProcedure = {
          ...procedure,
          status: this.convertProcedureStatus(procedure.status),
          code: {
            ...procedure.code,
            text: procedure.code?.text || 'Unknown procedure'
          }
        };
        this.patientService.addPatientProcedure(this.linkedPatient.id, convertedProcedure);
        importedCount++;
      });
    }

    // Import selected medications
    if (this.selectedMedications.size > 0) {
      const selectedMedicationsData = this.patientData.medications.filter(
        medication => this.selectedMedications.has(medication.id)
      );

      selectedMedicationsData.forEach(medication => {
        const convertedMedication = {
          ...medication,
          status: this.convertMedicationStatus(medication.status),
          medicationCodeableConcept: medication.medicationCodeableConcept ? {
            ...medication.medicationCodeableConcept,
            text: medication.medicationCodeableConcept.text || 'Unknown medication'
          } : undefined
        };
        this.patientService.addPatientMedication(this.linkedPatient.id, convertedMedication);
        importedCount++;
      });
    }

    // Import selected allergies
    if (this.selectedAllergies.size > 0) {
      const selectedAllergiesData = this.patientData.allergies.filter(
        allergy => this.selectedAllergies.has(allergy.id)
      );

      selectedAllergiesData.forEach(allergy => {
        const convertedAllergy = {
          ...allergy,
          type: this.convertAllergyType(allergy.type),
          category: this.convertAllergyCategory(allergy.category),
          criticality: this.convertAllergyCriticality(allergy.criticality)
        };
        this.patientService.addPatientAllergy(this.linkedPatient.id, convertedAllergy as any);
        importedCount++;
      });
    }

    // Clear all selections after import
    this.clearSelections();
    
    // Debug: Check what conditions are now stored for this patient
    const storedConditions = this.patientService.getPatientConditions(this.linkedPatient.id);
    console.log(`Patient ${this.linkedPatient.id} now has ${storedConditions.length} conditions stored:`, storedConditions);
    
    console.log(`Successfully imported ${importedCount} items to patient ${this.linkedPatient.id}`);
    
    // You could add a success snackbar here
    // this.snackBar.open(`Successfully imported ${importedCount} items`, 'Close', { duration: 3000 });
  }

  /**
   * Navigate back to benefits demo
   */
  goBack(): void {
    this.router.navigate(['/ehr-lab']);
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
    
    // Import selected allergies
    ipsData.allergies
      .filter(allergy => this.selectedAllergies.has(allergy.id))
      .forEach(allergy => {
        const convertedAllergy = {
          ...allergy,
          type: this.convertAllergyType(allergy.type),
          category: this.convertAllergyCategory(allergy.category),
          criticality: this.convertAllergyCriticality(allergy.criticality)
        };
        this.patientService.addPatientAllergy(patientId, convertedAllergy as any);
      });
  }

  /**
   * Import selected conditions only
   */
  importSelectedConditions(): void {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    const selectedConditionsData = this.patientData.conditions.filter(
      condition => this.selectedConditions.has(condition.id)
    );

    selectedConditionsData.forEach(condition => {
      const convertedCondition = {
        ...condition,
        code: {
          ...condition.code,
          text: condition.code?.text || 'Unknown condition'
        }
      };
      this.patientService.addPatientCondition(this.linkedPatient.id, convertedCondition);
    });

    // Clear selections after import
    this.selectedConditions.clear();
    
    // Show success message (you could add a snackbar here)
    console.log(`Imported ${selectedConditionsData.length} conditions`);
  }

  /**
   * Import selected procedures only
   */
  importSelectedProcedures(): void {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    const selectedProceduresData = this.patientData.procedures.filter(
      procedure => this.selectedProcedures.has(procedure.id)
    );

    selectedProceduresData.forEach(procedure => {
      const convertedProcedure = {
        ...procedure,
        status: this.convertProcedureStatus(procedure.status),
        code: {
          ...procedure.code,
          text: procedure.code?.text || 'Unknown procedure'
        }
      };
      this.patientService.addPatientProcedure(this.linkedPatient.id, convertedProcedure);
    });

    // Clear selections after import
    this.selectedProcedures.clear();
    
    console.log(`Imported ${selectedProceduresData.length} procedures`);
  }

  /**
   * Import selected medications only
   */
  importSelectedMedications(): void {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    const selectedMedicationsData = this.patientData.medications.filter(
      medication => this.selectedMedications.has(medication.id)
    );

    selectedMedicationsData.forEach(medication => {
      const convertedMedication = {
        ...medication,
        status: this.convertMedicationStatus(medication.status),
        medicationCodeableConcept: medication.medicationCodeableConcept ? {
          ...medication.medicationCodeableConcept,
          text: medication.medicationCodeableConcept.text || 'Unknown medication'
        } : undefined
      };
      this.patientService.addPatientMedication(this.linkedPatient.id, convertedMedication);
    });

    // Clear selections after import
    this.selectedMedications.clear();
    
    console.log(`Imported ${selectedMedicationsData.length} medications`);
  }

  /**
   * Import selected allergies only
   */
  importSelectedAllergies(): void {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    const selectedAllergiesData = this.patientData.allergies.filter(
      allergy => this.selectedAllergies.has(allergy.id)
    );

    selectedAllergiesData.forEach(allergy => {
      const convertedAllergy = {
        ...allergy,
        type: this.convertAllergyType(allergy.type),
        category: this.convertAllergyCategory(allergy.category),
        criticality: this.convertAllergyCriticality(allergy.criticality)
      };
      this.patientService.addPatientAllergy(this.linkedPatient.id, convertedAllergy as any);
    });

    // Clear selections after import
    this.selectedAllergies.clear();
    
    console.log(`Imported ${selectedAllergiesData.length} allergies`);
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

  /**
   * Convert allergy type to valid enum value
   */
  private convertAllergyType(type: string | undefined): "allergy" | "intolerance" | undefined {
    if (!type) return undefined;
    const lowerType = type.toLowerCase();
    if (lowerType === "allergy") return "allergy";
    if (lowerType === "intolerance") return "intolerance";
    return "allergy"; // Default to allergy if unknown
  }

  /**
   * Convert allergy category to valid enum values
   */
  private convertAllergyCategory(categories: string[] | undefined): ("food" | "medication" | "environment" | "biologic")[] | undefined {
    if (!categories || !Array.isArray(categories)) return undefined;
    
    const validCategories: ("food" | "medication" | "environment" | "biologic")[] = [];
    const categoryMap: { [key: string]: "food" | "medication" | "environment" | "biologic" } = {
      'food': 'food',
      'medication': 'medication',
      'environment': 'environment',
      'biologic': 'biologic',
      'drug': 'medication', // Common alternative
      'environmental': 'environment' // Common alternative
    };

    categories.forEach(category => {
      const lowerCategory = category.toLowerCase();
      const mappedCategory = categoryMap[lowerCategory];
      if (mappedCategory && !validCategories.includes(mappedCategory)) {
        validCategories.push(mappedCategory);
      }
    });

    return validCategories.length > 0 ? validCategories : ['environment']; // Default to environment if unknown
  }

  /**
   * Convert allergy criticality to valid enum value
   */
  private convertAllergyCriticality(criticality: string | undefined): "low" | "high" | "unable-to-assess" | undefined {
    if (!criticality) return undefined;
    const lowerCriticality = criticality.toLowerCase();
    if (lowerCriticality === "low") return "low";
    if (lowerCriticality === "high") return "high";
    if (lowerCriticality === "unable-to-assess") return "unable-to-assess";
    return "unable-to-assess"; // Default if unknown
  }

  /**
   * Calculate anatomic location for a SNOMED concept using ancestor mapping
   * Based on clinical-record component's anchor point system
   */
  private async calculateAnatomicLocation(snomedCode: string): Promise<string> {
    // Anchor points with their ancestor concepts (simplified version from clinical-record)
    const anchorPoints = [
      {
        id: 'head',
        ancestors: ['406122000', '118690002', '384821006']
      },
      {
        id: 'neck', 
        ancestors: ['298378000', '118693000']
      },
      {
        id: 'thorax',
        ancestors: ['298705000', '118695007', '106048009', '106063007', '118669005']
      },
      {
        id: 'abdomen',
        ancestors: ['609624008', '118698009', '386617003']
      },
      {
        id: 'pelvis',
        ancestors: ['609625009', '609637006']
      },
      {
        id: 'arms',
        ancestors: ['609617007', '118700008']
      },
      {
        id: 'legs',
        ancestors: ['609618002', '118701007']
      }
    ];

    return new Promise((resolve) => {
      this.terminologyService.getAncestors(snomedCode).subscribe({
        next: (response) => {
          try {
            const ancestorIds = this.extractConceptIdsFromExpansion(response);
            
            // Find the best matching anchor point
            const bestAnchorPoint = this.findBestAnchorPointForAncestors(ancestorIds, anchorPoints);
            
            if (bestAnchorPoint) {
              resolve(bestAnchorPoint.id);
            } else {
              resolve('systemic'); // Default fallback
            }
          } catch (error) {
            console.error(`Error processing ancestors for concept ${snomedCode}:`, error);
            resolve('systemic');
          }
        },
        error: (error) => {
          console.error(`Failed to get ancestors for concept ${snomedCode}:`, error);
          resolve('systemic');
        }
      });
    });
  }

  /**
   * Extract concept IDs from SNOMED CT expansion response
   */
  private extractConceptIdsFromExpansion(response: any): string[] {
    const conceptIds: string[] = [];
    
    if (response?.expansion?.contains) {
      response.expansion.contains.forEach((concept: any) => {
        if (concept.code) {
          conceptIds.push(concept.code);
        }
      });
    }
    
    return conceptIds;
  }

  /**
   * Find the best matching anchor point based on ancestor concepts
   */
  private findBestAnchorPointForAncestors(ancestorIds: string[], anchorPoints: any[]): any | null {
    // Check each anchor point to see if any of its ancestor concepts match
    for (const anchorPoint of anchorPoints) {
      // Extract concept IDs from anchor point ancestors (handle SNOMED format with display names)
      const anchorPointConceptIds = anchorPoint.ancestors.map((ancestor: string) => this.extractConceptId(ancestor));
      
      // Check if any of the event's ancestors match any of the anchor point's ancestors
      const hasMatch = anchorPointConceptIds.some((ancestorId: string) => ancestorIds.includes(ancestorId));
      
      if (hasMatch) {
        return anchorPoint;
      }
    }
    
    return null; // No match found
  }

  /**
   * Extract concept ID from SNOMED CT format (handles both "123456" and "123456 |Display Name|")
   */
  private extractConceptId(snomedString: string): string {
    // If it contains a pipe character, extract just the ID part before the first space
    if (snomedString.includes('|')) {
      return snomedString.split(' ')[0].trim();
    }
    // Otherwise, return as-is (already just an ID)
    return snomedString.trim();
  }
}
