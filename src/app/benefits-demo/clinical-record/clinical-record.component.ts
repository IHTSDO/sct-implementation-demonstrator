import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService, Patient, Condition, Procedure, MedicationStatement, AllergyIntolerance } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { CdsService, CDSRequest, CDSResponse } from '../../services/cds.service';
import { ClinicalEntryComponent } from '../clinical-entry/clinical-entry.component';
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

  // CDS service state
  isCdsLoading = false;
  cdsResponse: CDSResponse | null = null;
  cdsError: string | null = null;

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
    private cdsService: CdsService
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
    
    // Load encounters from localStorage
    this.encounters = this.getEncountersFromStorage(patientId);

    // Reset CDS state when loading new patient data
    this.resetCdsState();
    
    // Automatically trigger CDS request for new patient if we have clinical data
    this.triggerAutomaticCdsRequest();
  }

  /**
   * Submit patient information to CDS service for medication order recommendations
   */
  submitToCdsService(): void {
    if (!this.patient) {
      console.warn('No patient data available for CDS submission');
      return;
    }

    // Check if we have clinical data to send
    if (this.conditions.length === 0 && this.medications.length === 0) {
      this.cdsError = 'No conditions or medications available for CDS analysis. Please add some clinical data first.';
      console.warn('No clinical data available for CDS submission');
      return;
    }

    // Reset CDS state
    this.cdsError = null;
    this.cdsResponse = null;
    this.isCdsLoading = true;

    try {
      // Convert patient data to CDS format
      const cdsPatient = this.convertPatientToCdsFormat(this.patient);
      const cdsConditions = this.convertConditionsToCdsFormat(this.conditions);
      const cdsMedications = this.convertMedicationsToCdsFormat(this.medications);

      // Build CDS request
      const cdsRequest = this.cdsService.buildCDSRequest(cdsPatient, cdsConditions, cdsMedications);

      // Submit to CDS service
      this.subscriptions.push(
        this.cdsService.postMedicationOrderSelect(cdsRequest).subscribe({
          next: (response: CDSResponse) => {
            this.isCdsLoading = false;
            this.cdsResponse = response;
            // Process CDS recommendations
            this.processCdsRecommendations(response);
          },
          error: (error) => {
            this.isCdsLoading = false;
            this.cdsError = `CDS Service Error: ${error.message || 'Unknown error'}`;
            console.error('CDS Service error:', error);
          }
        })
      );
    } catch (error: any) {
      this.isCdsLoading = false;
      this.cdsError = `CDS Request Error: ${error.message || 'Unknown error'}`;
      console.error('Error building CDS request:', error);
    }
  }

  /**
   * Convert Patient service format to CDS Patient format
   */
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

  /**
   * Convert Condition service format to CDS Condition format
   */
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

  /**
   * Convert MedicationStatement service format to CDS MedicationRequest format
   */
  private convertMedicationsToCdsFormat(medications: MedicationStatement[]): any[] {
    return medications.map(medication => {
      // Get medication text for unit detection
      const medicationText = medication.medicationCodeableConcept?.text || 
                            medication.medicationCodeableConcept?.coding?.[0]?.display || 
                            'Unknown medication';
      
      // Check if medication is a tablet
      const isTablet = medicationText.toLowerCase().includes('tablet');
      
      // Check if medication is oral
      const isOral = medicationText.toLowerCase().includes('oral');
      
      // Create doseQuantity object with conditional unit
      const doseQuantity: any = { value: 1 };
      if (isTablet) {
        doseQuantity.unit = 'Tablet';
      }
      
      // Create route object if oral
      const route = isOral ? {
        coding: [
          {
            code: "",
            display: "O"
          }
        ],
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

  /**
   * Process CDS recommendations and display them to the user
   */
  private processCdsRecommendations(response: CDSResponse): void {
    if (response.cards && response.cards.length > 0) {
      console.log(`Received ${response.cards.length} CDS recommendation(s)`);
      
      // You can add UI logic here to display the recommendations
      // For now, just log them
      response.cards.forEach((card, index) => {
        console.log(`CDS Card ${index + 1}:`, {
          summary: card.summary,
          detail: card.detail,
          indicator: card.indicator,
          source: card.source
        });
      });
    }
  }

  /**
   * Generate a simple UUID for IDs
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Handle CDS tab selection
   */
  onCdsTabSelected(): void {
    // Tab focus no longer triggers automatic CDS request
    // CDS requests are now triggered automatically when patient data loads
  }

  /**
   * Handle click on CDS notice - focus on CDS tab if there are recommendations
   */
  onCdsNoticeClick(): void {
    if (this.cdsResponse && this.cdsResponse.cards && this.cdsResponse.cards.length > 0) {
      // Use MatTabGroup API to select the CDS tab (index 3: Encounters, Timeline, List View, Decision Support)
      this.tabGroup.selectedIndex = 3;
    }
  }

  /**
   * Open source URL in a new tab
   */
  openSourceUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Reset CDS state
   */
  private resetCdsState(): void {
    this.isCdsLoading = false;
    this.cdsResponse = null;
    this.cdsError = null;
  }

  /**
   * Automatically trigger CDS request when patient data is loaded
   */
  private triggerAutomaticCdsRequest(): void {
    // Only trigger if we have clinical data to analyze
    if (this.conditions.length > 0 || this.medications.length > 0) {
      // Add a small delay to ensure the UI is ready
      setTimeout(() => {
        this.submitToCdsService();
      }, 500);
    }
  }

  /**
   * Get icon for CDS card based on indicator
   */
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

  /**
   * Get icon color for CDS card based on indicator
   */
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

  /**
   * Get CSS class for CDS notice based on current state
   */
  getCdsNoticeClass(): string {
    if (this.isCdsLoading) {
      return 'cds-loading';
    } else if (this.cdsError) {
      return 'cds-error';
    } else if (this.cdsResponse && this.cdsResponse.cards && this.cdsResponse.cards.length > 0) {
      return 'cds-has-recommendations';
    } else if (this.cdsResponse && (!this.cdsResponse.cards || this.cdsResponse.cards.length === 0)) {
      return 'cds-no-recommendations';
    } else {
      return 'cds-initial';
    }
  }

  /**
   * Get icon for CDS notice based on current state
   */
  getCdsNoticeIcon(): string {
    if (this.isCdsLoading) {
      return 'access_time';
    } else if (this.cdsError) {
      return 'error';
    } else if (this.cdsResponse && this.cdsResponse.cards && this.cdsResponse.cards.length > 0) {
      return 'settings';
    } else if (this.cdsResponse && (!this.cdsResponse.cards || this.cdsResponse.cards.length === 0)) {
      return 'check_circle';
    } else {
      return 'settings';
    }
  }

  /**
   * Get text for CDS notice based on current state
   */
  getCdsNoticeText(): string {
    if (this.isCdsLoading) {
      return 'Analyzing...';
    } else if (this.cdsError) {
      return 'Error occurred';
    } else if (this.cdsResponse && this.cdsResponse.cards && this.cdsResponse.cards.length > 0) {
      return `${this.cdsResponse.cards.length} recommendation${this.cdsResponse.cards.length === 1 ? '' : 's'}`;
    } else if (this.cdsResponse && (!this.cdsResponse.cards || this.cdsResponse.cards.length === 0)) {
      return 'No recommendations';
    } else {
      return 'Initializing...';
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  }

  private getEncountersFromStorage(patientId: string): any[] {
    const storageKey = `encounters_${patientId}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
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
    if (allergy.criticality) {
      let criticalityText = '';
      if (typeof allergy.criticality === 'string') {
        criticalityText = allergy.criticality;
      } else if (Array.isArray(allergy.criticality) && (allergy.criticality as any[]).length > 0) {
        criticalityText = (allergy.criticality as any[])[0];
      }
      
      if (criticalityText) {
        return criticalityText.charAt(0).toUpperCase() + criticalityText.slice(1).replace('-', ' ');
      }
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
    console.log(`Condition "${condition.code.text}" has ICD-10 code: ${hasCode}`, condition);
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

    console.log(`Attempting manual ICD-10 mapping for SNOMED concept: ${snomedConceptId}`);
    
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
              // Save to storage after successful mapping
              this.saveUpdatedEventsToStorage();
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
        alert(`Failed to map to ICD-10. Error: ${error.message || 'Unknown error'}`);
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
      // Add the new condition directly to the local array to avoid timing issues
      this.conditions.push(event);
      
      // Get SNOMED concept ID for ICD-10 mapping
      const snomedConceptId = this.getConceptId(event);
      
      // Get ICD-10 mapping if SNOMED concept ID is available
      if (snomedConceptId) {
        try {
          this.terminologyService.getIcd10MapTargets(snomedConceptId).subscribe({
            next: (response) => {
              console.log('ICD-10 mapping response:', response);
              
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
                    console.log(`Mapped SNOMED ${snomedConceptId} to ICD-10 ${icd10Code}`);
                    
                    // Save to storage after ICD-10 mapping is complete
                    this.saveUpdatedEventsToStorage();
                  }
                }
              }
            },
            error: (error) => {
              console.warn(`Failed to get ICD-10 mapping for SNOMED concept ${snomedConceptId}:`, error);
              // Store just the SNOMED concept ID if ICD-10 mapping fails
              event.snomedConceptId = snomedConceptId;
              // Save to storage even if mapping fails
              this.saveUpdatedEventsToStorage();
            }
          });
        } catch (mappingError) {
          console.warn(`Error calling ICD-10 mapping service for concept ${snomedConceptId}:`, mappingError);
          // Store just the SNOMED concept ID if service call fails
          event.snomedConceptId = snomedConceptId;
          // Save to storage even if service call fails
          this.saveUpdatedEventsToStorage();
        }
      } else {
        // If no SNOMED concept ID, save immediately
        this.saveUpdatedEventsToStorage();
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
      // Add the new procedure directly to the local array to avoid timing issues
      this.procedures.push(event);
      
      // Map the procedure to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
      
      // Reload clinical data to ensure consistency with storage
      this.loadClinicalData(this.patient!.id);
    } catch (error) {
      console.error('Error processing new procedure:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  toggleMedicationEntry(): void {
    this.medicationEntry.toggleAddForm();
  }

  async onMedicationAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Add the new medication directly to the local array to avoid timing issues
      this.medications.push(event);
      
      // Map the medication to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
      
      // Reload clinical data to ensure consistency with storage
      this.loadClinicalData(this.patient!.id);
    } catch (error) {
      console.error('Error processing new medication:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
  }

  async onEncounterAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      // Add the new encounter to the local array
      this.encounters.push(event);
      
      // Save encounter to storage using PatientService
      this.patientService.addPatientEncounter(this.patient!.id, event);
      
      console.log('Encounter added from AI-assisted entry:', event);
    } catch (error) {
      console.error('Error processing new encounter:', error);
    } finally {
      this.isProcessingNewEvent = false;
    }
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
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteProcedure(procedureId: string): void {
    if (!this.patient) return;
    
    const procedure = this.procedures.find(p => p.id === procedureId);
    if (procedure && confirm(`Are you sure you want to delete the procedure "${procedure.code.text}"?`)) {
      this.patientService.deletePatientProcedure(this.patient.id, procedureId);
      this.loadClinicalData(this.patient.id);
    }
  }

  deleteMedication(medicationId: string): void {
    if (!this.patient) return;
    
    const medication = this.medications.find(m => m.id === medicationId);
    if (medication && confirm(`Are you sure you want to delete the medication "${medication.medicationCodeableConcept?.text}"?`)) {
      this.patientService.deletePatientMedication(this.patient.id, medicationId);
      this.loadClinicalData(this.patient.id);
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
      endX = anchorRect.left + anchorRect.width / 2;
      endY = anchorRect.top + anchorRect.height / 2;
    } else {
      // Right side (medications): start from left border of clinical item
      startX = clinicalRect.left;
      startY = clinicalRect.top + clinicalRect.height / 2;
      endX = anchorRect.left + anchorRect.width / 2;
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

    // Start from center of anchor point
    const startX = endRect.left + endRect.width / 2;
    const startY = endRect.top + endRect.height / 2;
    
    // Determine which side the clinical item is on and point to appropriate border
    const viewportWidth = window.innerWidth;
    const isLeftSide = startRect.left < viewportWidth / 2;
    
    let endX: number, endY: number;
    if (isLeftSide) {
      // Left side items: point to right border
      endX = startRect.right;
      endY = startRect.top + startRect.height / 2;
    } else {
      // Right side items: point to left border
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
      alert('No clinical events to delete.');
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete all ${eventCount} clinical events (including conditions, procedures, medications, allergies, and encounters) for ${this.getPatientDisplayName(this.patient)}? This action cannot be undone.`);
    if (!confirmed) return;
    
    // Clear all clinical data from localStorage
    localStorage.removeItem(`ehr_conditions_${patientId}`);
    localStorage.removeItem(`ehr_procedures_${patientId}`);
    localStorage.removeItem(`ehr_medications_${patientId}`);
    localStorage.removeItem(`ehr_allergies_${patientId}`);
    localStorage.removeItem(`ehr_encounters_${patientId}`);
    
    // Clear the arrays
    this.conditions = [];
    this.procedures = [];
    this.medications = [];
    this.allergies = [];
    this.encounters = [];
    
    // Notify other components by updating the selected patient
    const currentPatient = this.patientService.getSelectedPatient();
    this.patientService.selectPatient({ ...this.patient });
    
    alert('All clinical events have been deleted successfully.');
  }



  /**
   * Save updated clinical events to browser storage
   */
  private saveUpdatedEventsToStorage(): void {
    // Save to localStorage with patient-specific keys
    const patientId = this.patient?.id || 'default';
    
    if (this.conditions.length > 0) {
      localStorage.setItem(`ehr_conditions_${patientId}`, JSON.stringify(this.conditions));
    }
    
    if (this.procedures.length > 0) {
      localStorage.setItem(`ehr_procedures_${patientId}`, JSON.stringify(this.procedures));
    }
    
    if (this.medications.length > 0) {
      localStorage.setItem(`ehr_medications_${patientId}`, JSON.stringify(this.medications));
    }
    

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
      
      // Save the updated event to storage immediately
      this.saveUpdatedEventsToStorage();
    } catch (error) {
      console.error(`Error mapping single event with concept ${conceptId}:`, error);
      // Default to systemic on error
      (event as any).computedLocation = 'systemic';
    }
  }
}
