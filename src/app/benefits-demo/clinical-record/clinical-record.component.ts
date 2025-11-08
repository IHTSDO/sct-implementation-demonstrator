import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService, Patient, Condition, Procedure, MedicationStatement, AllergyIntolerance } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { ClinicalEntryComponent } from '../clinical-entry/clinical-entry.component';
import { CdsState } from '../cds-panel/cds-panel.component';
import { Subscription, forkJoin, of, delay } from 'rxjs';

export interface AnchorPoint {
  id: string;
  name: string;
  x: number; // Percentage (0-100) from left
  y: number; // Percentage (0-100) from top
  ancestors: string[]; // Array of ancestor concept IDs for SNOMED CT mapping
  description: string;
  anatomicalSystem?: string;
  defaultColor?: string;
  type?: 'circle' | 'systemic'; // Type of anchor point visual style
}

@Component({
  selector: 'app-clinical-record',
  templateUrl: './clinical-record.component.html',
  styleUrls: ['./clinical-record.component.css'],
  standalone: false
})
export class ClinicalRecordComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('conditionEntry') conditionEntry!: ClinicalEntryComponent;
  @ViewChild('procedureEntry') procedureEntry!: ClinicalEntryComponent;
  @ViewChild('medicationEntry') medicationEntry!: ClinicalEntryComponent;
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;
  @ViewChild('encounterRecord') encounterRecord!: any;
  @ViewChild('clinicalTimeline') clinicalTimeline!: any;
  @ViewChild('clinicalForms') clinicalForms!: any;

  patient: Patient | null = null;
  conditions: Condition[] = [];
  procedures: Procedure[] = [];
  medications: MedicationStatement[] = [];
  allergies: AllergyIntolerance[] = [];
  encounters: any[] = [];
  currentDate = new Date();
  private subscriptions: Subscription[] = [];
  

  
  // Loading state for ECL mapping
  isLoadingMapping = false;
  
  // Loading state for processing new events
  isProcessingNewEvent = false;

  // CDS state from CDS panel component
  cdsState: CdsState = {
    isLoading: false,
    hasError: false,
    hasNoData: false,
    hasRecommendations: false,
    hasExecuted: false,
    recommendationCount: 0,
    errorMessage: null,
    noDataMessage: null
  };

  // No separate cache needed - we'll add location directly to the clinical events

  // Anchor points for clinical event mapping - using ancestor concepts
  anchorPoints: AnchorPoint[] = [
    {
      id: 'head',
      name: 'Head',
      x: 48,
      y: 11,
      ancestors: ['406122000', '118690002', '384821006 |Mental state, behavior and/or psychosocial function finding (finding)|'], 
      description: 'Findings, disorders and procedures on the head',
      anatomicalSystem: 'head',
      defaultColor: '#FF6B6B'
    },
    {
      id: 'neck',
      name: 'Neck',
      x: 48,
      y: 18,
      ancestors: ['298378000', '118693000'], 
      description: 'Findings, disorders and procedures on the neck',
      anatomicalSystem: 'neck',
      defaultColor: '#82E0AA'
    },
    {
      id: 'thorax',
      name: 'Thorax',
      x: 48,
      y: 25,
      ancestors: ['298705000 |Finding of thoracic region (finding)|', '118695007 |Procedure on thorax (procedure)|', 
        '106048009 |Respiratory finding (finding)|', '106063007 |Cardiovascular finding (finding)|', '118669005 |Procedure on respiratory system (procedure)|'],
      description: 'Findings, disorders and procedures on the thorax',
      anatomicalSystem: 'thorax',
      defaultColor: '#45B7D1'
    },
    {
      id: 'abdomen',
      name: 'Abdomen',
      x: 48,
      y: 39,
      ancestors: ['609624008', '118698009', '386617003 |Digestive system finding (finding)|'], 
      description: 'Findings, disorders and procedures on the abdomen',
      anatomicalSystem: 'abdomen',
      defaultColor: '#BB8FCE'
    },
    {
      id: 'pelvis',
      name: 'Pelvis',
      x: 48,
      y: 48,
      ancestors: ['609625009', '609637006'], 
      description: 'Findings, disorders and procedures on the pelvis',
      anatomicalSystem: 'pelvis',
      defaultColor: '#F8C471'
    },
    {
      id: 'arms',
      name: 'Upper limbs',
      x: 73,
      y: 40,
      ancestors: ['116307009', '118702008'], 
      description: 'Findings, disorders and procedures on the arms',
      anatomicalSystem: 'arms',
      defaultColor: '#85C1E9'
    },
    {
      id: 'legs',
      name: 'Lower limbs',
      x: 60,
      y: 78,
      ancestors: ['116312005', '118710009'],
      description: 'Findings, disorders and procedures on the legs',
      anatomicalSystem: 'legs',
      defaultColor: '#85C1E9'
    },
    {
      id: 'systemic',
      name: 'Systemic',
      x: 90,
      y: 12,
      ancestors: [], // Empty array - will be used as fallback for unmapped concepts
      description: 'General systemic conditions, multiple system disorders, skin conditions',
      anatomicalSystem: 'systemic',
      defaultColor: '#AED6F1',
      type: 'systemic'
    }
  ];

  constructor(
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Check for patientId in URL route parameters first
    const patientIdFromRoute = this.route.snapshot.paramMap.get('patientId');
    
    if (patientIdFromRoute) {
      // Load patient by ID from route parameter
      const patient = this.patientService.getPatientById(patientIdFromRoute);
      if (patient) {
        this.patient = patient;
        this.patientService.selectPatient(patient); // Update the service
        this.loadClinicalData(patient.id);
      } else {
        // Patient not found, redirect to patient list
        console.warn('Patient not found with ID:', patientIdFromRoute);
        this.router.navigate(['/ehr-lab']);
      }
    } else {
      // Subscribe to selected patient (existing behavior)
      this.subscriptions.push(
        this.patientService.getSelectedPatient().subscribe(patient => {
          this.patient = patient;
          if (patient) {
            this.loadClinicalData(patient.id);
            // Update URL to include patientId for future reloads
            this.router.navigate(['/clinical-record', patient.id], { replaceUrl: true });
          } else {
            this.router.navigate(['/ehr-lab']);
          }
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewInit(): void {
    // Connection lines are now handled dynamically via hover events
  }

  goBack(): void {
    this.router.navigate(['/ehr-lab']);
  }

  getPatientDisplayName(patient: Patient): string {
    if (patient.name && patient.name.length > 0) {
      const name = patient.name[0];
      if (name.text) {
        return name.text;
      }
      if (name.given && name.family) {
        return `${name.given.join(' ')} ${name.family}`;
      }
      if (name.family) {
        return name.family;
      }
    }
    return `Patient ${patient.id}`;
  }

  getPatientAge(birthDate: string | undefined): string {
    if (!birthDate) return 'Unknown';
    
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return `${age - 1} years`;
    }
    return `${age} years`;
  }

  getPatientIdentifier(patient: Patient): string {
    if (patient.identifier && patient.identifier.length > 0) {
      return patient.identifier[0].value;
    }
    return patient.id;
  }

  getBodyModelImage(gender: string | undefined): string {
    if (gender === 'female') {
      return 'assets/img/body-model-female.png';
    } else if (gender === 'male') {
      return 'assets/img/body-model-male.png';
    } else {
      // Default to male model if gender is unknown
      return 'assets/img/body-model-male.png';
    }
  }

  loadClinicalData(patientId: string): void {
    // Try to load cached data first, fallback to service if not found
    this.conditions = this.loadCachedOrFreshData('conditions', patientId, () => this.patientService.getPatientConditions(patientId));
    this.procedures = this.loadCachedOrFreshData('procedures', patientId, () => this.patientService.getPatientProcedures(patientId));
    this.medications = this.loadCachedOrFreshData('medications', patientId, () => this.patientService.getPatientMedications(patientId));
    this.allergies = this.loadCachedOrFreshData('allergies', patientId, () => this.patientService.getPatientAllergies(patientId));
    
    // Load encounters using PatientService
    this.encounters = this.patientService.getPatientEncounters(patientId);

    // CDS panel component now handles CDS logic
  }

  onCdsStateChange(state: CdsState): void {
    this.cdsState = state;
  }

  getCdsNoticeClass(): string {
    if (this.cdsState.isLoading) {
      return 'cds-loading';
    } else if (this.cdsState.hasError) {
      return 'cds-error';
    } else if (this.cdsState.hasRecommendations) {
      return 'cds-has-recommendations';
    } else if (this.cdsState.hasNoData) {
      return 'cds-no-data';
    } else if (this.cdsState.hasExecuted) {
      return 'cds-no-recommendations';
    } else {
      return 'cds-initial';
    }
  }

  getCdsNoticeIcon(): string {
    if (this.cdsState.isLoading) {
      return 'access_time';
    } else if (this.cdsState.hasError) {
      return 'error';
    } else if (this.cdsState.hasRecommendations) {
      return 'settings';
    } else if (this.cdsState.hasExecuted) {
      // No recommendations
      return 'check_circle';
    } else {
      return 'settings';
    }
  }

  getCdsNoticeText(): string {
    if (this.cdsState.isLoading) {
      return 'Analyzing...';
    } else if (this.cdsState.hasError) {
      return 'Error occurred';
    } else if (this.cdsState.hasRecommendations) {
      return `${this.cdsState.recommendationCount} recommendation${this.cdsState.recommendationCount === 1 ? '' : 's'}`;
    } else if (this.cdsState.hasNoData) {
      return 'No data to analyze';
    } else if (this.cdsState.hasExecuted) {
      // CDS executed but no recommendations found
      return 'No recommendations';
    } else {
      // Shouldn't reach here with autoTrigger enabled, but just in case
      return 'Ready to analyze';
    }
  }

  onCdsNoticeClick(): void {
    // Switch to Decision Support tab (index 4) when clicking on CDS notice
    // Tab order: 0=AI Entry, 1=Encounters, 2=Timeline, 3=Problems List, 4=Decision Support, 5=Clinical Forms
    this.tabGroup.selectedIndex = 4;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  }


  getConditionStatus(condition: Condition): string {
    if (condition.clinicalStatus?.text) {
      return condition.clinicalStatus.text;
    }
    if (condition.clinicalStatus?.coding && condition.clinicalStatus.coding.length > 0) {
      return condition.clinicalStatus.coding[0].display || condition.clinicalStatus.coding[0].code || 'Unknown';
    }
    return 'Unknown';
  }

  /**
   * Get conditions sorted by most recently added first
   */
  getSortedConditions(): Condition[] {
    return [...this.conditions].sort((a, b) => {
      // First try to sort by recordedDate (most recent first)
      if (a.recordedDate && b.recordedDate) {
        return new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime();
      }
      
      // If one has recordedDate and the other doesn't, prioritize the one with recordedDate
      if (a.recordedDate && !b.recordedDate) return -1;
      if (!a.recordedDate && b.recordedDate) return 1;
      
      // If neither has recordedDate, sort by array index (newer conditions are added to the end)
      const indexA = this.conditions.indexOf(a);
      const indexB = this.conditions.indexOf(b);
      return indexB - indexA; // Most recent (higher index) first
    });
  }

  /**
   * Get procedures sorted by most recently added first
   */
  getSortedProcedures(): Procedure[] {
    return [...this.procedures].sort((a, b) => {
      // First try to sort by performedDateTime (most recent first)
      if (a.performedDateTime && b.performedDateTime) {
        return new Date(b.performedDateTime).getTime() - new Date(a.performedDateTime).getTime();
      }
      
      // If one has performedDateTime and the other doesn't, prioritize the one with performedDateTime
      if (a.performedDateTime && !b.performedDateTime) return -1;
      if (!a.performedDateTime && b.performedDateTime) return 1;
      
      // If neither has performedDateTime, sort by array index (newer procedures are added to the end)
      const indexA = this.procedures.indexOf(a);
      const indexB = this.procedures.indexOf(b);
      return indexB - indexA; // Most recent (higher index) first
    });
  }

  /**
   * Get medications sorted by most recently added first
   */
  getSortedMedications(): MedicationStatement[] {
    return [...this.medications].sort((a, b) => {
      // First try to sort by effectiveDateTime (most recent first)
      if (a.effectiveDateTime && b.effectiveDateTime) {
        return new Date(b.effectiveDateTime).getTime() - new Date(a.effectiveDateTime).getTime();
      }
      
      // If one has effectiveDateTime and the other doesn't, prioritize the one with effectiveDateTime
      if (a.effectiveDateTime && !b.effectiveDateTime) return -1;
      if (!a.effectiveDateTime && b.effectiveDateTime) return 1;
      
      // If neither has effectiveDateTime, sort by array index (newer medications are added to the end)
      const indexA = this.medications.indexOf(a);
      const indexB = this.medications.indexOf(b);
      return indexB - indexA; // Most recent (higher index) first
    });
  }

  getSortedAllergies(): AllergyIntolerance[] {
    return [...this.allergies].sort((a, b) => {
      // First try to sort by recordedDate (most recent first)
      if (a.recordedDate && b.recordedDate) {
        return new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime();
      }
      
      // If one has recordedDate and the other doesn't, prioritize the one with recordedDate
      if (a.recordedDate && !b.recordedDate) return -1;
      if (!a.recordedDate && b.recordedDate) return 1;
      
      // If neither has recordedDate, sort by array index (newer allergies are added to the end)
      const indexA = this.allergies.indexOf(a);
      const indexB = this.allergies.indexOf(b);
      return indexB - indexA; // Most recent (higher index) first
    });
  }

  getAllergyDisplayName(allergy: AllergyIntolerance): string {
    // Try to get display name from code first
    if (allergy.code?.coding?.[0]?.display) {
      return allergy.code.coding[0].display;
    }
    
    // Try to get display name from substance in reactions
    if (allergy.reaction?.[0]?.substance?.[0]?.coding?.[0]?.display) {
      return allergy.reaction[0].substance[0].coding[0].display;
    }
    
    // Fallback to code text
    if (allergy.code?.text) {
      return allergy.code.text;
    }
    
    // Final fallback
    return 'Unknown Allergy';
  }

  getAllergyCriticality(allergy: AllergyIntolerance): string {
    if (!allergy.criticality) {
      return '';
    }
    
    let criticalityText = '';
    
    // Handle different formats
    if (typeof allergy.criticality === 'string') {
      criticalityText = allergy.criticality;
    } else if (Array.isArray(allergy.criticality) && (allergy.criticality as any[]).length > 0) {
      criticalityText = (allergy.criticality as any[])[0];
    } else if (typeof allergy.criticality === 'object' && !Array.isArray(allergy.criticality)) {
      // Check if it's an empty object or has properties
      const keys = Object.keys(allergy.criticality);
      if (keys.length === 0) {
        return ''; // Empty object
      }
    }
    
    if (criticalityText) {
      // Capitalize and format (e.g., "high" -> "High", "unable-to-assess" -> "Unable to assess")
      return criticalityText.charAt(0).toUpperCase() + criticalityText.slice(1).replace(/-/g, ' ');
    }
    
    return '';
  }

  getAllergyVerificationStatus(allergy: AllergyIntolerance): string {
    if (allergy.verificationStatus?.coding?.[0]?.display) {
      return allergy.verificationStatus.coding[0].display;
    }
    return '';
  }

  getAllergyReactions(allergy: AllergyIntolerance): string[] {
    const reactions: string[] = [];
    
    if (allergy.reaction && allergy.reaction.length > 0) {
      allergy.reaction.forEach(reaction => {
        if (reaction.manifestation && reaction.manifestation.length > 0) {
          reaction.manifestation.forEach(manifestation => {
            if (manifestation.coding?.[0]?.display) {
              reactions.push(manifestation.coding[0].display);
            } else if (manifestation.text) {
              reactions.push(manifestation.text);
            }
          });
        }
      });
    }
    
    return reactions;
  }

  /**
   * Debug method to check if condition has ICD-10 code
   */
  hasIcd10Code(condition: Condition): boolean {
    const hasCode = !!(condition as any).icd10Code;
    return hasCode;
  }

  /**
   * Manually attempt ICD-10 mapping for a condition
   */
  attemptIcd10Mapping(condition: Condition, event: Event): void {
    event.preventDefault();
    
    const snomedConceptId = this.getConceptId(condition);
    if (!snomedConceptId) {
      console.warn('No SNOMED concept ID found for condition:', condition);
      return;
    }
    this.terminologyService.getIcd10MapTargets(snomedConceptId).subscribe({
      next: (response) => {
        // Extract the ICD-10 code from the response
        if (response?.parameter && response.parameter.length > 0) {
          // Look for the match parameter which contains the ICD-10 code
          const matchParam = response.parameter.find((param: any) => param.name === 'match');
          if (matchParam?.part && matchParam.part.length > 0) {
            const conceptPart = matchParam.part.find((part: any) => part.name === 'concept');
            if (conceptPart?.valueCoding?.code) {
              const icd10Code = conceptPart.valueCoding.code;
              // Store the ICD-10 code in the condition
              (condition as any).icd10Code = icd10Code;
              (condition as any).snomedConceptId = snomedConceptId;
              // Update the condition in PatientService with the SNOMED concept ID
              this.patientService.updatePatientCondition(this.patient!.id, condition.id, condition);
            } else {
              console.warn('No ICD-10 code found in mapping response');
            }
          } else {
            console.warn('No match parameter found in mapping response');
          }
        } else {
          console.warn('No parameters found in mapping response');
        }
      },
      error: (error) => {
        console.error(`Failed to get ICD-10 mapping for SNOMED concept ${snomedConceptId}:`, error);
        this.snackBar.open(
          `Failed to map to ICD-10. Error: ${error.message || 'Unknown error'}`,
          'Close',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          }
        );
      }
    });
  }

  getProcedureStatus(procedure: Procedure): string {
    return procedure.status || 'Unknown';
  }

  getMedicationStatus(medication: MedicationStatement): string {
    return medication.status || 'Unknown';
  }

  getMedicationAssociation(medication: MedicationStatement): string | null {
    if (medication.reasonReference && medication.reasonReference.length > 0) {
      return medication.reasonReference[0].display || null;
    }
    return null;
  }

  /**
   * Get the concept ID to use for anchor point mapping for any clinical resource
   * For medications, uses indication concept ID; for others, uses the resource's own concept ID
   */
  getMappingConceptId(resource: any): string {
    if (resource.resourceType === 'MedicationStatement') {
      const indicationConceptId = this.getIndicationConceptId(resource);
      return indicationConceptId || this.getConceptId(resource); // Fallback to medication code if no indication
    }
    return this.getConceptId(resource);
  }

  toggleConditionEntry(): void {
    this.conditionEntry.toggleAddForm();
  }

  async onConditionAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Save the condition to PatientService first (now returns boolean)
      const wasAdded = this.patientService.addPatientCondition(this.patient!.id, event);
      
      if (!wasAdded) {
        // Duplicate detected - show warning and don't add to local array
        this.snackBar.open(
          'This condition already exists for this patient (duplicate SNOMED CT code detected).',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        return;
      }
      
      // Add the new condition to the local array only if it was successfully added
      // Create new array reference to trigger Angular change detection
      this.conditions = [...this.conditions, event];
      
      // Refresh timeline to show new condition
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
      
      // Get SNOMED concept ID for ICD-10 mapping
      const snomedConceptId = this.getConceptId(event);
      
      // Get ICD-10 mapping if SNOMED concept ID is available
      if (snomedConceptId) {
        try {
          this.terminologyService.getIcd10MapTargets(snomedConceptId).subscribe({
            next: (response) => {
              // Extract the ICD-10 code from the response
              if (response?.parameter && response.parameter.length > 0) {
                // Look for the match parameter which contains the ICD-10 code
                const matchParam = response.parameter.find((param: any) => param.name === 'match');
                if (matchParam?.part && matchParam.part.length > 0) {
                  const conceptPart = matchParam.part.find((part: any) => part.name === 'concept');
                  if (conceptPart?.valueCoding?.code) {
                    const icd10Code = conceptPart.valueCoding.code;
                    // Store the ICD-10 code in the condition
                    event.icd10Code = icd10Code;
                    event.snomedConceptId = snomedConceptId;
                    // Update the condition in PatientService with the ICD-10 code
                    this.patientService.updatePatientCondition(this.patient!.id, event.id, event);
                  }
                }
              }
            },
            error: (error) => {
              console.warn(`Failed to get ICD-10 mapping for SNOMED concept ${snomedConceptId}:`, error);
              // Store just the SNOMED concept ID if ICD-10 mapping fails
              event.snomedConceptId = snomedConceptId;
              // Update the condition in PatientService with the SNOMED concept ID
              this.patientService.updatePatientCondition(this.patient!.id, event.id, event);
            }
          });
        } catch (mappingError) {
          console.warn(`Error calling ICD-10 mapping service for concept ${snomedConceptId}:`, mappingError);
          // Store just the SNOMED concept ID if service call fails
          event.snomedConceptId = snomedConceptId;
          // Update the condition in PatientService with the SNOMED concept ID
          this.patientService.updatePatientCondition(this.patient!.id, event.id, event);
        }
      }
      
      // Map the condition to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
    } catch (error) {
      console.error('Error processing new condition:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  toggleProcedureEntry(): void {
    this.procedureEntry.toggleAddForm();
  }

  async onProcedureAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Save the procedure to PatientService first (now returns boolean)
      const wasAdded = this.patientService.addPatientProcedure(this.patient!.id, event);
      
      if (!wasAdded) {
        // Duplicate detected - show warning and don't add to local array
        this.snackBar.open(
          'This procedure already exists for this patient (duplicate SNOMED CT code detected).',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        return;
      }
      
      // Add the new procedure to the local array only if it was successfully added
      // Create new array reference to trigger Angular change detection
      this.procedures = [...this.procedures, event];
      
      // Refresh timeline to show new procedure
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
      
      // Map the procedure to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
      
      // Refresh encounter display to show newly linked procedures
      if (this.encounterRecord && this.encounterRecord.refreshEncounterDisplay) {
        this.encounterRecord.refreshEncounterDisplay();
      }
    } catch (error) {
      console.error('Error processing new procedure:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  toggleMedicationEntry(): void {
    this.medicationEntry.toggleAddForm();
  }

  openAllergyForm(): void {
    // Switch to Clinical Forms tab (index 5)
    if (this.tabGroup) {
      this.tabGroup.selectedIndex = 5;
      
      // Set the selected form to 'allergies' after a brief delay to ensure tab is rendered
      setTimeout(() => {
        if (this.clinicalForms) {
          this.clinicalForms.selectedForm = 'allergies';
        }
      }, 100);
    }
  }

  async onMedicationAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Save the medication to PatientService first (now returns boolean)
      const wasAdded = this.patientService.addPatientMedication(this.patient!.id, event);
      
      if (!wasAdded) {
        // Duplicate detected - show warning and don't add to local array
        this.snackBar.open(
          'This medication already exists for this patient (duplicate SNOMED CT code detected).',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        return;
      }
      
      // Add the new medication to the local array only if it was successfully added
      // Create new array reference to trigger Angular change detection
      this.medications = [...this.medications, event];
      
      // Refresh timeline to show new medication
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
      
      // Map the medication to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
    } catch (error) {
      console.error('Error processing new medication:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  async onEncounterAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Save encounter to storage using PatientService first (now returns boolean)
      const wasAdded = this.patientService.addPatientEncounter(this.patient!.id, event);
      
      if (!wasAdded) {
        // Duplicate detected - show warning and don't add to local array
        this.snackBar.open(
          'This encounter already exists for this patient (duplicate SNOMED CT code detected).',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        return;
      }
      
      // Add the new encounter to the local array only if it was successfully added
      this.encounters.push(event);
      
      // Refresh timeline to show new encounter
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
      
      // Refresh encounter display to show newly linked procedures
      if (this.encounterRecord && this.encounterRecord.refreshEncounterDisplay) {
        this.encounterRecord.refreshEncounterDisplay();
      }
    } catch (error) {
      console.error('Error processing new encounter:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  async onClinicalFormSubmitted(event: any): Promise<void> {
    // Handle clinical form submissions (allergies, adverse reactions, questionnaires, etc.)
    if (event.type === 'allergy' && this.patient) {
      this.isLoadingMapping = true;
      
      try {
        // Reload allergies from the service to update the summary
        this.allergies = this.patientService.getPatientAllergies(this.patient.id);
        
        // Map newly created conditions to anatomical locations
        if (event.newConditions && event.newConditions.length > 0) {
          // Map each new condition to its anatomical location
          for (const condition of event.newConditions) {
            await this.mapSingleEventToAnchorPoint(condition);
            // Update the condition in storage with the computed location
            this.patientService.updatePatientCondition(this.patient.id, condition.id, condition);
          }
        }
        
        // Reload conditions after mapping to get the updated computedLocation
        this.conditions = this.patientService.getPatientConditions(this.patient.id);
        
        // Show success notification (already shown in clinical-forms component, but update here if needed)
        const message = event.newConditionsCount > 0
          ? `Allergy updated. Summary and ${event.newConditionsCount} reaction(s) mapped to body diagram.`
          : 'Allergy record updated successfully';
        
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
        
        // Refresh timeline if available to show both allergies and new conditions
        if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
          this.clinicalTimeline.refreshTimeline();
        }
      } finally {
        this.isLoadingMapping = false;
      }
    } else if (event.type === 'questionnaire-response' && this.patient) {
      // Handle questionnaire response submission
      try {
        const questionnaireData = event.data;
        
        // Create FHIR QuestionnaireResponse resource
        const questionnaireResponse: any = {
          resourceType: 'QuestionnaireResponse',
          id: `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'completed',
          authored: questionnaireData.timestamp || new Date().toISOString(),
          subject: {
            reference: `Patient/${this.patient.id}`,
            display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
          },
          // Store the original response data
          item: questionnaireData.response?.items || [],
          // Custom metadata for display
          questionnaireId: questionnaireData.questionnaire?.lformsVersion || questionnaireData.questionnaire?.code?.[0]?.code,
          questionnaireName: questionnaireData.questionnaire?.name || questionnaireData.questionnaire?.title,
          questionnaireTitle: questionnaireData.questionnaire?.title || questionnaireData.questionnaire?.name,
          // Store the complete questionnaire and response for later viewing
          _completeData: questionnaireData
        };
        
        // Save to patient service
        this.patientService.addPatientQuestionnaireResponse(this.patient.id, questionnaireResponse);
        
        // Process SDC observationExtract - extract observations as Conditions
        const extractedConditions = await this.extractConditionsFromQuestionnaire(
          questionnaireData.questionnaire, 
          questionnaireData.response
        );
        
        let successMessage = `✅ Questionnaire "${questionnaireResponse.questionnaireName || 'Response'}" saved successfully`;
        
        if (extractedConditions > 0) {
          successMessage += `. ${extractedConditions} condition(s) extracted.`;
          // Reload conditions to update the UI
          this.conditions = this.patientService.getPatientConditions(this.patient.id);
        }
        
        // Show success notification
        this.snackBar.open(
          successMessage,
          'Close',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          }
        );
        
      } catch (error) {
        console.error('Error saving questionnaire response:', error);
        this.snackBar.open(
          '❌ Error saving questionnaire response',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          }
        );
      }
    }
  }

  // SDC Observation Extract - Create Conditions from Questionnaire Responses
  private async extractConditionsFromQuestionnaire(questionnaire: any, response: any): Promise<number> {
    if (!questionnaire || !response || !this.patient) {
      return 0;
    }

    let conditionsCreated = 0;

    try {
      // Find items in the questionnaire that have observationExtract extension
      const extractableItems = this.findExtractableItems(questionnaire.items || questionnaire.item || []);

      // Process each extractable item
      for (const questionnaireItem of extractableItems) {
        // Check if this is a recognized observable entity (Risk Factor, Diagnosis, etc.)
        const isRecognizedObservable = this.isObservableRecognized(questionnaireItem);

        if (isRecognizedObservable) {
          // Find the corresponding response
          const responseItem = this.findResponseItem(response.items || [], questionnaireItem.linkId);

          if (responseItem && responseItem.value) {
            // Extract conditions from the response
            const extracted = await this.createConditionsFromRiskFactorResponse(
              questionnaireItem,
              responseItem,
              questionnaire.title || 'Questionnaire'
            );
            conditionsCreated += extracted;
          }
        }
      }
    } catch (error) {
      console.error('Error extracting conditions from questionnaire:', error);
    }

    return conditionsCreated;
  }

  private findExtractableItems(items: any[]): any[] {
    const extractable: any[] = [];

    for (const item of items) {
      // Check if item has observationExtract extension set to true
      if (item.extension) {
        const extractExtension = item.extension.find((ext: any) =>
          ext.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract' &&
          ext.valueBoolean === true
        );

        if (extractExtension) {
          extractable.push(item);
        }
      }

      // Recursively check nested items
      if (item.item && Array.isArray(item.item)) {
        extractable.push(...this.findExtractableItems(item.item));
      }
      if (item.items && Array.isArray(item.items)) {
        extractable.push(...this.findExtractableItems(item.items));
      }
    }

    return extractable;
  }

  // Recognized observable entity codes (SNOMED CT)
  // These codes are language-independent and work in multilingual environments
  private readonly RECOGNIZED_OBSERVABLES = {
    DIAGNOSIS: '439401001',
    RISK_FACTOR: '80943009'
  };

  private isObservableRecognized(item: any): boolean {
    // Check if the item's code indicates it's a recognized observable entity (Diagnosis, Risk Factor, etc.)
    // Support both FHIR Questionnaire format and LForms format
    // Match ONLY by SNOMED CT codes (language-independent)
    
    const recognizedCodes = Object.values(this.RECOGNIZED_OBSERVABLES);
    
    // LForms format - check codeList
    // Note: Some LForms implementations may have the SNOMED code in either 'code' or 'system' field
    if (item.codeList && Array.isArray(item.codeList)) {
      const hasRecognizedObservable = item.codeList.some((coding: any) =>
        recognizedCodes.includes(coding.code) || recognizedCodes.includes(coding.system)
      );
      if (hasRecognizedObservable) {
        return true;
      }
    }
    
    // LForms format - check questionCodeSystem (the SNOMED code is stored here)
    if (item.questionCodeSystem && typeof item.questionCodeSystem === 'string') {
      if (recognizedCodes.includes(item.questionCodeSystem)) {
        return true;
      }
    }
    
    // FHIR Questionnaire format - check code array
    // Note: Check both 'code' and 'system' fields for flexibility
    if (item.code && Array.isArray(item.code)) {
      const hasRecognizedObservable = item.code.some((coding: any) =>
        recognizedCodes.includes(coding.code) || recognizedCodes.includes(coding.system)
      );
      if (hasRecognizedObservable) {
        return true;
      }
    }
    
    return false;
  }

  private findResponseItem(responseItems: any[], linkId: string): any {
    for (const item of responseItems) {
      if (item.linkId === linkId) {
        return item;
      }

      // Recursively search in nested items
      if (item.items && Array.isArray(item.items)) {
        const found = this.findResponseItem(item.items, linkId);
        if (found) return found;
      }
    }
    return null;
  }

  private async createConditionsFromRiskFactorResponse(
    questionnaireItem: any,
    responseItem: any,
    questionnaireName: string
  ): Promise<number> {
    if (!this.patient) return 0;

    let created = 0;
    const value = responseItem.value;

    // Handle different response types
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Single coded value (Coding)
      // Support both 'display' and 'text' fields (LForms uses 'text')
      if (value.code && (value.display || value.text)) {
        const condition = this.createConditionFromCoding(value, questionnaireName);
        if (condition) {
          const added = this.patientService.addPatientCondition(this.patient.id, condition);
          if (added) {
            created++;
            // Map to body location if applicable
            await this.mapSingleEventToAnchorPoint(condition);
            this.patientService.updatePatientCondition(this.patient.id, condition.id, condition);
          }
        }
      }
    } else if (Array.isArray(value)) {
      // Multiple coded values
      for (const coding of value) {
        if (coding.code && (coding.display || coding.text)) {
          const condition = this.createConditionFromCoding(coding, questionnaireName);
          if (condition) {
            const added = this.patientService.addPatientCondition(this.patient.id, condition);
            if (added) {
              created++;
              // Map to body location if applicable
              await this.mapSingleEventToAnchorPoint(condition);
              this.patientService.updatePatientCondition(this.patient.id, condition.id, condition);
            }
          }
        }
      }
    }

    return created;
  }

  private createConditionFromCoding(coding: any, source: string): any {
    if (!this.patient) return null;

    // Support both 'display' and 'text' fields (LForms uses 'text')
    const displayText = coding.display || coding.text;

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
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: 'problem-list-item',
          display: 'Problem List Item'
        }],
        text: 'Problem List Item'
      }],
      code: {
        coding: [{
          system: coding.system || 'http://snomed.info/sct',
          code: coding.code,
          display: displayText
        }],
        text: displayText || coding.code
      },
      subject: {
        reference: `Patient/${this.patient.id}`,
        display: this.patient.name?.[0]?.text || `${this.patient.name?.[0]?.given?.[0]} ${this.patient.name?.[0]?.family}`
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString(),
      note: [{
        text: `Extracted from questionnaire: ${source}`,
        time: new Date().toISOString()
      }]
    };
  }

  // Legacy connection line methods removed - now using dynamic hover-based connections

  getConceptId(resource: any): string {
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return '';
  }

  getIcd10Code(condition: any): string | null {
    // First check if there's a direct ICD-10 code property
    if (condition.icd10Code) {
      return condition.icd10Code;
    }
    
    // Then check if there's an ICD-10 coding in the code array
    if (condition.code?.coding) {
      const icd10Coding = condition.code.coding.find((c: any) => c.system === 'http://hl7.org/fhir/sid/icd-10-cm');
      return icd10Coding?.code || null;
    }
    return null;
  }

  /**
   * Get the indication concept ID from a medication's reasonReference
   * This is used to map medications to body regions based on what they treat
   */
  getIndicationConceptId(medication: any): string {
    if (medication.reasonReference && medication.reasonReference.length > 0) {
      const reasonRef = medication.reasonReference[0].reference;
      
      // Extract the resource ID from the reference (e.g., "Condition/condition-123" -> "condition-123")
      const resourceId = reasonRef.split('/')[1];
      
      // Find the referenced condition or procedure in our local data
      const referencedCondition = this.conditions.find(c => c.id === resourceId);
      if (referencedCondition) {
        return this.getConceptId(referencedCondition);
      }
      
      const referencedProcedure = this.procedures.find(p => p.id === resourceId);
      if (referencedProcedure) {
        return this.getConceptId(referencedProcedure);
      }
    }
    
    return ''; // No indication found
  }

  /**
   * Get concept ID for allergy (from substance in reactions)
   */
  getAllergyConceptId(allergy: any): string {
    // Try to get concept ID from substance in reactions first
    if (allergy.reaction?.[0]?.substance?.[0]?.coding?.[0]?.code) {
      return allergy.reaction[0].substance[0].coding[0].code;
    }
    
    // Fallback to main code
    if (allergy.code?.coding?.[0]?.code) {
      return allergy.code.coding[0].code;
    }
    
    return ''; // No concept ID found
  }

  deleteCondition(conditionId: string): void {
    if (!this.patient) return;
    
    const condition = this.conditions.find(c => c.id === conditionId);
    if (condition && confirm(`Are you sure you want to delete the condition "${condition.code.text}"?`)) {
      this.patientService.deletePatientCondition(this.patient.id, conditionId);
      // Reload conditions directly from service to ensure fresh data
      this.conditions = this.patientService.getPatientConditions(this.patient.id);
    }
  }

  deleteProcedure(procedureId: string): void {
    if (!this.patient) return;
    
    const procedure = this.procedures.find(p => p.id === procedureId);
    if (procedure && confirm(`Are you sure you want to delete the procedure "${procedure.code.text}"?`)) {
      this.patientService.deletePatientProcedure(this.patient.id, procedureId);
      // Reload procedures directly from service to ensure fresh data
      this.procedures = this.patientService.getPatientProcedures(this.patient.id);
    }
  }

  deleteMedication(medicationId: string): void {
    if (!this.patient) return;
    
    const medication = this.medications.find(m => m.id === medicationId);
    if (medication && confirm(`Are you sure you want to delete the medication "${medication.medicationCodeableConcept?.text}"?`)) {
      this.patientService.deletePatientMedication(this.patient.id, medicationId);
      // Reload medications directly from service to ensure fresh data
      this.medications = this.patientService.getPatientMedications(this.patient.id);
    }
  }

  deleteAllergy(allergyId: string): void {
    if (!this.patient) return;
    
    const allergy = this.allergies.find(a => a.id === allergyId);
    if (allergy) {
      const allergyName = this.getAllergyDisplayName(allergy);
      if (confirm(`Are you sure you want to delete the allergy "${allergyName}"?`)) {
        this.patientService.deletePatientAllergy(this.patient.id, allergyId);
        // Reload allergies directly from service to ensure fresh data
        this.allergies = this.patientService.getPatientAllergies(this.patient.id);
      }
    }
  }

  /**
   * Get anchor points filtered by anatomical system
   */
  getAnchorPointsBySystem(system?: string): AnchorPoint[] {
    if (!system) {
      return this.anchorPoints;
    }
    return this.anchorPoints.filter(point => point.anatomicalSystem === system);
  }

  /**
   * Find the best matching anchor point for a clinical event based on SNOMED CT concept
   * Uses cached location if available, otherwise defaults to systemic
   */
  findBestAnchorPointForConcept(conceptId: string): AnchorPoint | null {
    // First check if any clinical event has a cached location for this concept
    const cachedLocation = this.getCachedLocationForConcept(conceptId);
    if (cachedLocation) {
      return this.anchorPoints.find(p => p.id === cachedLocation) || null;
    }
    
    // Default assignment: all conditions go to systemic category
    // This is used before ancestor mapping is performed
    return this.anchorPoints.find(p => p.id === 'systemic') || null;
  }

  /**
   * Get all clinical events with their mapped anchor points
   */
  getClinicalEventsWithAnchorPoints(): Array<{event: any, anchorPoint: AnchorPoint | null, type: string}> {
    const eventsWithAnchors: Array<{event: any, anchorPoint: AnchorPoint | null, type: string}> = [];
    
    // Map conditions
    this.conditions.forEach(condition => {
      const conceptId = this.getConceptId(condition);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: condition,
        anchorPoint: anchorPoint,
        type: 'condition'
      });
    });

    // Map procedures  
    this.procedures.forEach(procedure => {
      const conceptId = this.getConceptId(procedure);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: procedure,
        anchorPoint: anchorPoint,
        type: 'procedure'
      });
    });

    // Map medications
    this.medications.forEach(medication => {
      // For medications, use the indication (condition/procedure) concept ID for mapping
      const indicationConceptId = this.getIndicationConceptId(medication);
      const conceptId = indicationConceptId || this.getConceptId(medication); // Fallback to medication code if no indication
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: medication,
        anchorPoint: anchorPoint,
        type: 'medication'
      });
    });

    return eventsWithAnchors;
  }

  /**
   * Get anchor points that have clinical events mapped to them
   */
  getActiveAnchorPoints(): AnchorPoint[] {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const activeAnchorIds = new Set(
      clinicalEvents
        .filter(item => item.anchorPoint !== null)
        .map(item => item.anchorPoint!.id)
    );
    
    return this.anchorPoints.filter(point => activeAnchorIds.has(point.id));
  }

  /**
   * Get the count of clinical events for a specific anchor point
   */
  getEventCountForAnchorPoint(anchorPointId: string): number {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    return clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPointId
    ).length;
  }

  /**
   * Get all anatomical systems that have anchor points
   */
  getAnatomicalSystems(): string[] {
    const systems = new Set(this.anchorPoints.map(point => point.anatomicalSystem).filter(Boolean));
    return Array.from(systems) as string[];
  }

  /**
   * Handle condition hover - show connection line to anchor point
   */
  onConditionHover(condition: any, event: MouseEvent): void {
    const conceptId = this.getConceptId(condition);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      // Use currentTarget to get the element that has the event listener
      const conditionElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(conditionElement, anchorPoint);
    }
  }

  /**
   * Handle condition hover end - hide connection line
   */
  onConditionHoverEnd(): void {
    this.hideConnectionLine();
  }

  /**
   * Handle procedure hover - show connection line to anchor point
   */
  onProcedureHover(procedure: any, event: MouseEvent): void {
    const conceptId = this.getConceptId(procedure);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      const procedureElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(procedureElement, anchorPoint);
    }
  }

  /**
   * Handle medication hover - show connection line to anchor point
   */
  onMedicationHover(medication: any, event: MouseEvent): void {
    // For medications, use the indication (condition/procedure) concept ID for mapping
    const indicationConceptId = this.getIndicationConceptId(medication);
    const conceptId = indicationConceptId || this.getConceptId(medication); // Fallback to medication code if no indication
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      const medicationElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(medicationElement, anchorPoint);
    }
  }

  /**
   * Handle allergy hover - show connection line to anchor point
   */
  onAllergyHover(allergy: any, event: MouseEvent): void {
    // For allergies, use the substance concept ID for mapping
    const conceptId = this.getAllergyConceptId(allergy);
    const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
    if (anchorPoint) {
      const allergyElement = event.currentTarget as HTMLElement;
      this.showConnectionLine(allergyElement, anchorPoint);
    }
  }

  /**
   * Handle anchor point hover - show all connections and highlight related events
   */
  onAnchorPointHover(anchorPoint: AnchorPoint, event: MouseEvent): void {
    this.showAllConnectionsForAnchorPoint(anchorPoint);
    this.highlightRelatedClinicalEvents(anchorPoint);
  }

  /**
   * Handle anchor point hover end - hide all connections and remove highlights
   */
  onAnchorPointHoverEnd(): void {
    this.hideAllConnections();
    this.removeAllEventHighlights();
  }

  /**
   * Show connection line from clinical item to anchor point
   */
  private showConnectionLine(clinicalElement: HTMLElement, anchorPoint: AnchorPoint): void {
    // Find the anchor point element on the body model
    const anchorElement = document.querySelector(`[data-anchor-id="${anchorPoint.id}"]`) as HTMLElement;
    if (!anchorElement) return;

    // Get or create the connection line element
    let connectionLine = document.getElementById('hover-connection-line');
    if (!connectionLine) {
      connectionLine = document.createElement('div');
      connectionLine.id = 'hover-connection-line';
      connectionLine.className = 'hover-connection-line';
      document.body.appendChild(connectionLine);
    }

    // Calculate positions
    const clinicalRect = clinicalElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();

    // Determine if the clinical item is on the left or right side
    const viewportWidth = window.innerWidth;
    const isLeftSide = clinicalRect.left < viewportWidth / 2;

    let startX: number, startY: number, endX: number, endY: number;

    if (isLeftSide) {
      // Left side (conditions/procedures): start from right border of clinical item
      startX = clinicalRect.right;
      startY = clinicalRect.top + clinicalRect.height / 2;
      // End at left border of anchor point
      endX = anchorRect.left;
      endY = anchorRect.top + anchorRect.height / 2;
    } else {
      // Right side (medications): start from left border of clinical item
      startX = clinicalRect.left;
      startY = clinicalRect.top + clinicalRect.height / 2;
      // End at right border of anchor point
      endX = anchorRect.right;
      endY = anchorRect.top + anchorRect.height / 2;
    }

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Apply styles to the connection line
    connectionLine.style.display = 'block';
    connectionLine.style.position = 'fixed';
    connectionLine.style.left = `${startX}px`;
    connectionLine.style.top = `${startY}px`;
    connectionLine.style.width = `${distance}px`;
    connectionLine.style.height = '1px';
    connectionLine.style.backgroundColor = '#ff0000';
    connectionLine.style.transformOrigin = '0 50%';
    connectionLine.style.transform = `rotate(${angle}deg)`;
    connectionLine.style.zIndex = '10000';
    connectionLine.style.pointerEvents = 'none';
    connectionLine.style.opacity = '1';
    connectionLine.style.boxShadow = '0 0 8px rgba(255,0,0,0.6)';
    connectionLine.style.borderRadius = '2px';

    // Add discrete scaling to anchor point
    anchorElement.classList.add('scaled');
  }

  /**
   * Hide connection line
   */
  private hideConnectionLine(): void {
    const connectionLine = document.getElementById('hover-connection-line');
    if (connectionLine) {
      connectionLine.style.display = 'none';
    }

    // Remove scaling from all anchor points
    const anchorElements = document.querySelectorAll('[data-anchor-id]');
    anchorElements.forEach(element => {
      element.classList.remove('scaled');
    });
  }

  /**
   * Show all connection lines for a specific anchor point
   */
  private showAllConnectionsForAnchorPoint(anchorPoint: AnchorPoint): void {
    const anchorElement = document.querySelector(`[data-anchor-id="${anchorPoint.id}"]`) as HTMLElement;
    if (!anchorElement) return;

    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const relatedEvents = clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPoint.id
    );

    relatedEvents.forEach((eventItem, index) => {
      // Find the corresponding element in the summary using data attributes
      let eventElement: HTMLElement | null = null;

      // Use data attributes to find the correct element
      if (eventItem.type === 'condition') {
        eventElement = document.querySelector(`[data-condition-id="${eventItem.event.id}"]`) as HTMLElement;
      } else if (eventItem.type === 'procedure') {
        eventElement = document.querySelector(`[data-procedure-id="${eventItem.event.id}"]`) as HTMLElement;
      } else if (eventItem.type === 'medication') {
        eventElement = document.querySelector(`[data-medication-id="${eventItem.event.id}"]`) as HTMLElement;
      }

      if (eventElement) {
        this.createConnectionLine(eventElement, anchorElement, `anchor-connection-${index}`);
      }
    });

    // Add scaling effect to the anchor point
    anchorElement.classList.add('scaled');
  }

  /**
   * Create a named connection line
   */
  private createConnectionLine(startElement: HTMLElement, endElement: HTMLElement, lineId: string): void {
    // Remove existing line with this ID
    const existingLine = document.getElementById(lineId);
    if (existingLine) {
      existingLine.remove();
    }

    // Calculate positions
    const startRect = startElement.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();

    // Determine which side the clinical item is on and point to appropriate border
    const viewportWidth = window.innerWidth;
    const isLeftSide = startRect.left < viewportWidth / 2;
    
    let startX: number, startY: number;
    let endX: number, endY: number;
    
    // Start from appropriate border of anchor point based on destination
    if (isLeftSide) {
      // Clinical item is on left side: start from left border of anchor point
      startX = endRect.left;
      startY = endRect.top + endRect.height / 2;
      // Point to right border of clinical item
      endX = startRect.right;
      endY = startRect.top + startRect.height / 2;
    } else {
      // Clinical item is on right side: start from right border of anchor point
      startX = endRect.right;
      startY = endRect.top + endRect.height / 2;
      // Point to left border of clinical item
      endX = startRect.left;
      endY = startRect.top + startRect.height / 2;
    }

    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Create connection line
    const connectionLine = document.createElement('div');
    connectionLine.id = lineId;
    connectionLine.className = 'anchor-connection-line';
    document.body.appendChild(connectionLine);

    // Apply styles
    connectionLine.style.display = 'block';
    connectionLine.style.position = 'fixed';
    connectionLine.style.left = `${startX}px`;
    connectionLine.style.top = `${startY}px`;
    connectionLine.style.width = `${distance}px`;
    connectionLine.style.height = '1px';
    connectionLine.style.backgroundColor = '#ff0000';
    connectionLine.style.transformOrigin = '0 50%';
    connectionLine.style.transform = `rotate(${angle}deg)`;
    connectionLine.style.zIndex = '10000';
    connectionLine.style.pointerEvents = 'none';
    connectionLine.style.opacity = '1';
    connectionLine.style.boxShadow = '0 0 4px rgba(255, 0, 0, 0.4)';
    connectionLine.style.borderRadius = '0.5px';
  }

  /**
   * Hide all connection lines
   */
  private hideAllConnections(): void {
    // Remove all anchor connection lines
    const anchorLines = document.querySelectorAll('.anchor-connection-line');
    anchorLines.forEach(line => line.remove());

    // Hide single hover connection line
    this.hideConnectionLine();
  }

  /**
   * Highlight all clinical events related to an anchor point
   */
  private highlightRelatedClinicalEvents(anchorPoint: AnchorPoint): void {
    const clinicalEvents = this.getClinicalEventsWithAnchorPoints();
    const relatedEvents = clinicalEvents.filter(item => 
      item.anchorPoint && item.anchorPoint.id === anchorPoint.id
    );

    relatedEvents.forEach((eventItem) => {
      // Find the corresponding DOM element using data attributes
      let eventElement: HTMLElement | null = null;

      // Use data attributes to find the correct element
      if (eventItem.type === 'condition') {
        eventElement = document.querySelector(`[data-condition-id="${eventItem.event.id}"]`) as HTMLElement;
      } else if (eventItem.type === 'procedure') {
        eventElement = document.querySelector(`[data-procedure-id="${eventItem.event.id}"]`) as HTMLElement;
      } else if (eventItem.type === 'medication') {
        eventElement = document.querySelector(`[data-medication-id="${eventItem.event.id}"]`) as HTMLElement;
      }

      if (eventElement) {
        eventElement.classList.add('anchor-highlighted');
      }
    });
  }

  /**
   * Remove highlights from all clinical events
   */
  private removeAllEventHighlights(): void {
    const highlightedElements = document.querySelectorAll('.anchor-highlighted');
    highlightedElements.forEach(element => {
      element.classList.remove('anchor-highlighted');
    });

    // Remove scaling from anchor points
    const anchorElements = document.querySelectorAll('[data-anchor-id]');
    anchorElements.forEach(element => {
      element.classList.remove('scaled');
    });
  }







  /**
   * Extract concept IDs from ECL expansion response
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
   * Utility method to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



  /**
   * Delete all clinical events for current patient
   */
  deleteAllEvents(): void {
    if (!this.patient) return;
    
    const patientId = this.patient.id;
    
    // Get encounter count
    const encounters = this.patientService.getPatientEncounters(patientId);
    
    // Confirm deletion
    const eventCount = this.conditions.length + this.procedures.length + this.medications.length + this.allergies.length + encounters.length;
    if (eventCount === 0) {
      this.snackBar.open(
        'No clinical events to delete.',
        'Close',
        {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['info-snackbar']
        }
      );
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete all ${eventCount} clinical events (including conditions, procedures, medications, allergies, and encounters) for ${this.getPatientDisplayName(this.patient)}? This action cannot be undone.`);
    if (!confirmed) return;
    
    // Clear all clinical data using PatientService
    this.patientService.clearAllPatientEvents(patientId);
    
    // Clear the arrays
    this.conditions = [];
    this.procedures = [];
    this.medications = [];
    this.allergies = [];
    this.encounters = [];
    
    // CDS panel component will reset its own state when data changes
    
    // Reload clinical data to ensure all components are updated
    this.loadClinicalData(patientId);
    
    // Notify other components by updating the selected patient
    const currentPatient = this.patientService.getSelectedPatient();
    this.patientService.selectPatient({ ...this.patient });
    
    this.snackBar.open(
      'All clinical events have been deleted successfully.',
      'Close',
      {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      }
    );
  }

  /**
   * Load cached data from localStorage or fallback to fresh data from service
   */
  private loadCachedOrFreshData<T>(dataType: string, patientId: string, getFreshData: () => T[]): T[] {
    const cacheKey = `ehr_${dataType}_${patientId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return parsed;
      } catch (error) {
        // Parsing failed, fall through to fresh data
      }
    }
    
    // No cached data or parsing failed, get fresh data
    return getFreshData();
  }

  /**
   * Get cached location for a concept from existing clinical events
   */
  private getCachedLocationForConcept(conceptId: string): string | null {
    // Check conditions
    for (const condition of this.conditions) {
      if (this.getConceptId(condition) === conceptId && (condition as any).computedLocation) {
        return (condition as any).computedLocation;
      }
    }
    
    // Check procedures
    for (const procedure of this.procedures) {
      if (this.getConceptId(procedure) === conceptId && (procedure as any).computedLocation) {
        return (procedure as any).computedLocation;
      }
    }
    
    // Check medications (using indication concept ID)
    for (const medication of this.medications) {
      const indicationConceptId = this.getIndicationConceptId(medication);
      const medicationConceptId = indicationConceptId || this.getConceptId(medication);
      if (medicationConceptId === conceptId && (medication as any).computedLocation) {
        return (medication as any).computedLocation;
      }
    }
    
    return null;
  }



  /**
   * Check if an anchor point has any associated clinical events
   */
  hasAssociatedEvents(anchorPoint: AnchorPoint): boolean {
    // Check conditions
    const hasConditions = this.conditions.some(condition => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(condition));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    // Check procedures
    const hasProcedures = this.procedures.some(procedure => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(procedure));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    // Check medications
    const hasMedications = this.medications.some(medication => {
      // For medications, use the indication (condition/procedure) concept ID for mapping
      const indicationConceptId = this.getIndicationConceptId(medication);
      const conceptId = indicationConceptId || this.getConceptId(medication); // Fallback to medication code if no indication
      const bestAnchorPoint = this.findBestAnchorPointForConcept(conceptId);
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    return hasConditions || hasProcedures || hasMedications;
  }

  /**
   * Map a clinical event to an anchor point using ancestor matching
   */
  private async mapEventToAnchorPointUsingAncestors(event: any, conceptId: string): Promise<void> {
    return new Promise((resolve) => {
      this.terminologyService.getAncestors(conceptId).subscribe({
        next: (response) => {
          try {
            const ancestorIds = this.extractConceptIdsFromExpansion(response);
            
            // Find the best matching anchor point
            const bestAnchorPoint = this.findBestAnchorPointForAncestors(ancestorIds);
            
            if (bestAnchorPoint) {
              // Store the mapping
              (event as any).computedLocation = bestAnchorPoint.id;
            } else {
              // Default to systemic if no match found
              (event as any).computedLocation = 'systemic';
            }
            
            resolve();
          } catch (error) {
            console.error(`Error processing ancestors for concept ${conceptId}:`, error);
            // Default to systemic on error
            (event as any).computedLocation = 'systemic';
            resolve();
          }
        },
        error: (error) => {
          console.error(`Failed to get ancestors for concept ${conceptId}:`, error);
          // Default to systemic on error
          (event as any).computedLocation = 'systemic';
          resolve();
        }
      });
    });
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

  /**
   * Find the best matching anchor point based on ancestor concepts
   */
  private findBestAnchorPointForAncestors(ancestorIds: string[]): AnchorPoint | null {
    // Check each anchor point (except systemic) to see if any of its ancestor concepts match
    for (const anchorPoint of this.anchorPoints) {
      if (anchorPoint.id === 'systemic') continue; // Skip systemic, it's the fallback
      
      // Extract concept IDs from anchor point ancestors (handle SNOMED format with display names)
      const anchorPointConceptIds = anchorPoint.ancestors.map(ancestor => this.extractConceptId(ancestor));
      
      // Check if any of the event's ancestors match any of the anchor point's ancestors
      const hasMatch = anchorPointConceptIds.some(ancestorId => ancestorIds.includes(ancestorId));
      
      if (hasMatch) {
        return anchorPoint;
      }
    }
    
    return null; // No match found
  }

  /**
   * Map a single clinical event to an anchor point using ancestor matching
   * This is used when adding new events to avoid full remapping
   */
  async mapSingleEventToAnchorPoint(event: any): Promise<void> {
    let conceptId: string;
    
    // For medications, use indication concept ID if available
    if (event.resourceType === 'MedicationStatement') {
      const indicationConceptId = this.getIndicationConceptId(event);
      conceptId = indicationConceptId || this.getConceptId(event); // Fallback to medication code if no indication
    } else {
      conceptId = this.getConceptId(event);
    }
    
    if (!conceptId) {
      // Default to systemic if no concept ID
      (event as any).computedLocation = 'systemic';
      return;
    }

    // Skip if already mapped
    if ((event as any).computedLocation) {
      return;
    }

    try {
      await this.mapEventToAnchorPointUsingAncestors(event, conceptId);
      
      // The event is already saved to PatientService when it was first created
      // No need to save again here
    } catch (error) {
      console.error(`Error mapping single event with concept ${conceptId}:`, error);
      // Default to systemic on error
      (event as any).computedLocation = 'systemic';
    }
  }
}
