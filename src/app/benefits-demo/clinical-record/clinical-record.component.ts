import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService } from '../../services/patient.service';
import { AiAssistedEntryTransactionResult } from '../../services/patient-storage.types';
import { CdsService, STANDARD_CDS_HOOK_LABELS, StandardCdsHook } from '../../services/cds.service';
import { TerminologyService } from '../../services/terminology.service';
import { ClinicalEntryComponent, ClinicalEntryType } from '../clinical-entry/clinical-entry.component';
import { CdsState } from '../cds-panel/cds-panel.component';
import { Subscription, forkJoin, of, delay, firstValueFrom } from 'rxjs';
import { AllergyFormDialogComponent } from '../allergy-form-dialog/allergy-form-dialog.component';
import { ConfirmationDialogComponent } from '../../questionnaires/confirmation-dialog/confirmation-dialog.component';
import type {
  AllergyIntolerance,
  ClinicalDataLoadSummary,
  Condition,
  FhirObservation,
  Immunization,
  LaboratoryOrderGroup,
  MedicationStatement,
  Patient,
  Procedure
} from '../../model';

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

interface VitalSignObservationConfig {
  loincCode: string;
  label: string;
  unit: string;
  snomedCode?: string;
  bloodPressureParentCode?: string;
  bloodPressureComponentCode?: string;
  bloodPressureComponentSnomed?: string;
}

type ClinicalModule = 'clinical' | 'dentistry' | 'nursing' | 'data';
type ClinicalView = 'summary' | 'encounters' | 'ai-entry' | 'problems' | 'orders' | 'forms' | 'alerts';
type DentalView = 'odontogram';
type NursingView = 'vitals' | 'nutrition';
type DataView = 'fhir';

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
  @ViewChild('immunizationEntry') immunizationEntry!: ClinicalEntryComponent;
  @ViewChild('encounterRecord') encounterRecord!: any;
  @ViewChild('clinicalTimeline') clinicalTimeline!: any;
  @ViewChild('clinicalForms') clinicalForms!: any;

  patient: Patient | null = null;
  conditions: Condition[] = [];
  procedures: Procedure[] = [];
  medications: MedicationStatement[] = [];
  immunizations: Immunization[] = [];
  labOrders: LaboratoryOrderGroup[] = [];
  allergies: AllergyIntolerance[] = [];
  encounters: any[] = [];
  currentDate = new Date();
  selectedModule: ClinicalModule = 'clinical';
  selectedClinicalView: ClinicalView = 'summary';
  selectedDentalView: DentalView = 'odontogram';
  selectedNursingView: NursingView = 'vitals';
  selectedDataView: DataView = 'fhir';
  isClinicalNavExpanded = true;
  isDentalNavExpanded = false;
  isNursingNavExpanded = false;
  isDataNavExpanded = false;
  isSidebarCollapsed = false;
  dataVersion = 0;
  private subscriptions: Subscription[] = [];
  private readonly DENTAL_CATEGORY_SYSTEM = 'http://example.org/fhir/CodeSystem/condition-category';
  private readonly DENTAL_CONDITION_CATEGORY_CODE = 'dental';
  private readonly DENTAL_PROCEDURE_CATEGORY_CODE = 'dental-procedure';
  private readonly EHR_LAB_LOCATION_SYSTEM = 'http://ehr-lab.demo/location';
  private readonly EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL = 'http://ehr-lab.demo/fhir/StructureDefinition/computed-location';
  private medicationOrderSelectPreviewTimeout: ReturnType<typeof setTimeout> | null = null;
  

  
  // Loading state for ECL mapping
  isLoadingMapping = false;
  isDeletingAllEvents = false;
  isLoadingClinicalData = false;
  
  // Loading state for processing new events
  isProcessingNewEvent = false;
  savingEntryType: ClinicalEntryType | null = null;

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
    private cdsService: CdsService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
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
    if (this.medicationOrderSelectPreviewTimeout) {
      clearTimeout(this.medicationOrderSelectPreviewTimeout);
      this.medicationOrderSelectPreviewTimeout = null;
    }
  }

  ngAfterViewInit(): void {
    // Connection lines are now handled dynamically via hover events
  }

  goBack(): void {
    this.router.navigate(['/ehr-lab']);
  }

  setSelectedModule(module: ClinicalModule): void {
    this.selectedModule = module;
    if (module === 'clinical') {
      this.selectedClinicalView = 'summary';
      this.expandOnly(module);
      return;
    }
    if (module === 'nursing') {
      this.selectedNursingView = this.selectedNursingView || 'vitals';
      this.expandOnly(module);
      return;
    }
    if (module === 'dentistry') {
      this.selectedDentalView = this.selectedDentalView || 'odontogram';
      this.expandOnly(module);
      return;
    }
    if (module === 'data') {
      this.selectedDataView = this.selectedDataView || 'fhir';
      this.expandOnly(module);
    }
  }

  onClinicalRootClick(): void {
    if (this.selectedModule === 'clinical') {
      this.expandOnly('clinical');
      return;
    }
    this.setSelectedModule('clinical');
  }

  onNursingRootClick(): void {
    if (this.selectedModule === 'nursing') {
      this.expandOnly('nursing');
      return;
    }
    this.setSelectedModule('nursing');
  }

  onDentalRootClick(): void {
    if (this.selectedModule === 'dentistry') {
      this.expandOnly('dentistry');
      return;
    }
    this.setSelectedModule('dentistry');
  }

  onDataRootClick(): void {
    if (this.selectedModule === 'data') {
      this.expandOnly('data');
      return;
    }
    this.setSelectedModule('data');
  }

  toggleSidebarCollapsed(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  private expandOnly(module: ClinicalModule): void {
    this.isClinicalNavExpanded = module === 'clinical';
    this.isDentalNavExpanded = module === 'dentistry';
    this.isNursingNavExpanded = module === 'nursing';
    this.isDataNavExpanded = module === 'data';
  }

  selectClinicalView(view: ClinicalView): void {
    this.selectedModule = 'clinical';
    this.selectedClinicalView = view;
    this.expandOnly('clinical');
    if (view === 'summary') {
      this.refreshSummaryVisualizations();
    }
  }

  selectNursingView(view: NursingView): void {
    this.selectedModule = 'nursing';
    this.selectedNursingView = view;
    this.expandOnly('nursing');
  }

  selectDentalView(view: DentalView): void {
    this.selectedModule = 'dentistry';
    this.selectedDentalView = view;
    this.expandOnly('dentistry');
  }

  selectDataView(view: DataView): void {
    this.selectedModule = 'data';
    this.selectedDataView = view;
    this.expandOnly('data');
  }

  getActiveContentThemeClass(): string {
    if (this.selectedModule === 'dentistry') {
      return 'content-theme-dental';
    }

    if (this.selectedModule === 'nursing') {
      return this.selectedNursingView === 'nutrition'
        ? 'content-theme-nursing-nutrition'
        : 'content-theme-nursing-vitals';
    }

    if (this.selectedModule === 'data') {
      return 'content-theme-data';
    }

    switch (this.selectedClinicalView) {
      case 'summary':
        return 'content-theme-summary';
      case 'problems':
        return 'content-theme-problems';
      case 'encounters':
        return 'content-theme-encounters';
      case 'ai-entry':
        return 'content-theme-ai-entry';
      case 'forms':
        return 'content-theme-forms';
      case 'alerts':
        return 'content-theme-alerts';
      default:
        return 'content-theme-summary';
    }
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

  isPatientDeceased(patient: Patient | null): boolean {
    return !!(patient?.deceasedBoolean || patient?.deceasedDateTime);
  }

  getPatientDeceasedSummary(patient: Patient | null): string {
    if (!patient?.deceasedDateTime) {
      return 'Recorded as deceased';
    }

    return `Recorded as deceased on ${new Date(patient.deceasedDateTime).toLocaleString()}`;
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

  async loadClinicalData(patientId: string): Promise<void> {
    if (this.patientService.getCurrentPersistenceMode() === 'fhir') {
      this.isLoadingClinicalData = true;

      try {
        const summary = await this.patientService.preloadClinicalRecordData(patientId);
        this.populateClinicalDataFromService(patientId);
        this.touchDataVersion();
        this.refreshSummaryVisualizations();
        this.triggerPatientViewHook();
        this.showClinicalDataLoadedSnackBar(summary);
      } catch (error) {
        console.error('Error loading clinical data from FHIR server:', error);
        this.snackBar.open('Failed to load clinical data from the FHIR server.', 'Close', {
          duration: 3500,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } finally {
        this.isLoadingClinicalData = false;
      }
      return;
    }

    this.populateClinicalDataFromService(patientId);
    this.touchDataVersion();
    this.refreshSummaryVisualizations();
    this.triggerPatientViewHook();
  }

  private populateClinicalDataFromService(patientId: string): void {
    this.conditions = this.loadCachedOrFreshData('conditions', patientId, () => this.patientService.getPatientConditions(patientId));
    this.procedures = this.loadCachedOrFreshData('procedures', patientId, () => this.patientService.getPatientProcedures(patientId));
    this.medications = this.loadCachedOrFreshData('medications', patientId, () => this.patientService.getPatientMedications(patientId));
    this.immunizations = this.loadCachedOrFreshData('immunizations', patientId, () => this.patientService.getPatientImmunizations(patientId));
    this.labOrders = this.loadCachedOrFreshData('labOrders', patientId, () => this.patientService.getPatientLabOrders(patientId));
    this.allergies = this.loadCachedOrFreshData('allergies', patientId, () => this.patientService.getPatientAllergies(patientId));
    this.encounters = this.patientService.getPatientEncounters(patientId);
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
    this.selectClinicalView('alerts');
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
   * Summary-only conditions (exclude dental records from body diagram summary)
   */
  getSortedSummaryConditions(): Condition[] {
    return this.getSortedConditions().filter((condition) => !this.isDentalCondition(condition));
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
   * Summary-only procedures (exclude dental records from body diagram summary)
   */
  getSortedSummaryProcedures(): Procedure[] {
    return this.getSortedProcedures().filter((procedure) => !this.isDentalProcedure(procedure));
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

  getSortedImmunizations(): Immunization[] {
    return [...this.immunizations].sort((a, b) => {
      const aDate = a.occurrenceDateTime || a.recorded || '';
      const bDate = b.occurrenceDateTime || b.recorded || '';
      return bDate.localeCompare(aDate);
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

  getSortedLabOrders(): LaboratoryOrderGroup[] {
    return [...this.labOrders].sort((a, b) => {
      const aDate = a.createdAt || '';
      const bDate = b.createdAt || '';
      return bDate.localeCompare(aDate);
    });
  }

  getLabOrderDisplayName(labOrder: LaboratoryOrderGroup): string {
    if (labOrder.serviceRequests.length === 1) {
      const single = labOrder.serviceRequests[0];
      return single.code?.text || single.code?.coding?.[0]?.display || 'Single determination';
    }
    return `${labOrder.serviceRequests.length} determinations`;
  }

  getLabOrderLoincCodes(labOrder: LaboratoryOrderGroup): string[] {
    return labOrder.serviceRequests
      .map((serviceRequest) => serviceRequest.code?.coding?.find(coding => coding.system === 'http://loinc.org')?.code)
      .filter((code): code is string => !!code);
  }

  getLabOrderSpecimenLabels(labOrder: LaboratoryOrderGroup): string[] {
    const specimens = new Set<string>();
    labOrder.serviceRequests.forEach((serviceRequest) => {
      serviceRequest.specimen?.forEach((specimen) => specimens.add(specimen.display || specimen.identifier?.value || 'Specimen'));
    });
    return Array.from(specimens);
  }

  getLabOrderDeterminationCount(labOrder: LaboratoryOrderGroup): number {
    return labOrder.serviceRequests.length;
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
    return !!this.patientService.getConditionIcd10Code(condition);
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
              this.patientService.setConditionSnomedCoding(condition, {
                code: snomedConceptId,
                display: condition.code?.text || undefined
              });
              this.patientService.setConditionIcd10Coding(condition, { code: icd10Code });
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

  getMedicationDosageText(medication: MedicationStatement): string | null {
    return medication.dosage?.[0]?.text || null;
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

  onClinicalEntryFormOpened(entryType: 'condition' | 'procedure' | 'medication' | 'immunization'): void {
    // Close all other forms when one is opened
    if (entryType !== 'condition' && this.conditionEntry) {
      this.conditionEntry.closeForm();
    }
    if (entryType !== 'procedure' && this.procedureEntry) {
      this.procedureEntry.closeForm();
    }
    if (entryType !== 'medication' && this.medicationEntry) {
      this.medicationEntry.closeForm();
    }
    if (entryType !== 'immunization' && this.immunizationEntry) {
      this.immunizationEntry.closeForm();
    }
  }

  async onConditionAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    this.savingEntryType = 'condition';
    
    try {
      // Centralized condition persistence also resolves ICD-10 when needed.
      const wasAdded = await this.patientService.addPatientConditionEnriched(this.patient!.id, event);
      
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
      // and use the updated snapshot as the source of truth for hook execution.
      const createdCondition = event as Condition;
      this.conditions = [...this.conditions, createdCondition];
      this.triggerProblemListItemCreateHook(createdCondition, this.conditions);
      this.conditionEntry?.resetAndCloseForm();
      this.touchDataVersion();
      
      // Refresh timeline to show new condition
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }

      // Map the condition to an anchor point directly
      await this.mapSingleEventToAnchorPoint(event);
    } catch (error) {
      console.error('Error processing new condition:', error);
    } finally {
      this.isProcessingNewEvent = false;
      this.savingEntryType = null;
    }
  }

  toggleProcedureEntry(): void {
    this.procedureEntry.toggleAddForm();
  }

  async onProcedureAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    this.savingEntryType = 'procedure';
    
    try {
      // Centralized procedure persistence also resolves anatomical location when needed.
      const wasAdded = await this.patientService.addPatientProcedureEnriched(this.patient!.id, event);
      
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
      this.procedureEntry?.resetAndCloseForm();
      this.touchDataVersion();
      
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
      this.savingEntryType = null;
    }
  }

  toggleMedicationEntry(): void {
    this.medicationEntry.toggleAddForm();
  }

  toggleImmunizationEntry(): void {
    this.immunizationEntry.toggleAddForm();
  }

  openAllergyForm(): void {
    const dialogRef = this.dialog.open(AllergyFormDialogComponent, {
      width: '1100px',
      maxWidth: '95vw',
      height: '86vh',
      autoFocus: false,
      data: {
        patient: this.patient,
        conditions: this.conditions,
        procedures: this.procedures,
        medications: this.medications
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.onClinicalFormSubmitted(result);
    });
  }

  async onMedicationAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    this.savingEntryType = 'medication';
    
    try {
      // Save the medication to PatientService first (now returns boolean)
      const wasAdded = await this.patientService.addPatientMedicationEnriched(this.patient!.id, event);
      
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
      this.triggerOrderSignHook(event);
      this.medications = [...this.medications, event];
      this.medicationEntry?.resetAndCloseForm();
      this.touchDataVersion();
      
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
      this.savingEntryType = null;
    }
  }

  onMedicationDraftChanged(draftMedication: MedicationStatement | null): void {
    if (!this.patient) {
      return;
    }

    if (this.medicationOrderSelectPreviewTimeout) {
      clearTimeout(this.medicationOrderSelectPreviewTimeout);
      this.medicationOrderSelectPreviewTimeout = null;
    }

    if (!draftMedication) {
      return;
    }

    this.medicationOrderSelectPreviewTimeout = setTimeout(() => {
      this.triggerOrderSelectHook(draftMedication);
      this.medicationOrderSelectPreviewTimeout = null;
    }, 350);
  }

  async onImmunizationAdded(event: Immunization): Promise<void> {
    this.isProcessingNewEvent = true;
    this.savingEntryType = 'immunization';

    try {
      const wasAdded = this.patientService.addPatientImmunization(this.patient!.id, event);

      if (!wasAdded) {
        this.snackBar.open(
          'This immunization already exists for this patient (same vaccine and date).',
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

      this.immunizations = [...this.immunizations, event];
      this.immunizationEntry?.resetAndCloseForm();
      this.triggerPatientViewHook();
      this.touchDataVersion();

      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
    } catch (error) {
      console.error('Error processing new immunization:', error);
    } finally {
      this.isProcessingNewEvent = false;
      this.savingEntryType = null;
    }
  }

  onLabOrderSaved(labOrder: LaboratoryOrderGroup): void {
    if (!this.patient) return;

    this.patientService.addPatientLabOrder(this.patient.id, labOrder);
    this.labOrders = [...this.labOrders, labOrder];
    this.touchDataVersion();
    this.snackBar.open('Order saved successfully.', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  async onEncounterAdded(event: any): Promise<void> {
    this.isProcessingNewEvent = true;
    
    try {
      const encounterPackage = event?.encounter
        ? event
        : {
            encounter: event,
            conditions: [],
            procedures: []
          };

      await this.patientService.saveEncounterClinicalPackage(this.patient!.id, encounterPackage);

      this.conditions = this.patientService.getPatientConditions(this.patient!.id);
      this.procedures = this.patientService.getPatientProcedures(this.patient!.id);
      this.encounters = this.patientService.getPatientEncounters(this.patient!.id);
      this.touchDataVersion();
      
      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
      
      if (this.encounterRecord && this.encounterRecord.refreshEncounterDisplay) {
        this.encounterRecord.refreshEncounterDisplay();
      }
    } catch (error) {
      if ((error as any)?.code === 'duplicate-encounter') {
        this.snackBar.open(
          'This encounter already exists for this patient.',
          'Close',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['warning-snackbar']
          }
        );
        this.encounterRecord?.finishSaving(false);
        return;
      }
      console.error('Error processing new encounter:', error);
      this.encounterRecord?.finishSaving(false);
    } finally {
      if (!(this.encounterRecord?.isSaving === false)) {
        this.encounterRecord?.finishSaving(true);
      }
      this.isProcessingNewEvent = false;
    }
  }

  onAiAssistedEntryTransactionSaved(_result: AiAssistedEntryTransactionResult): void {
    if (!this.patient) {
      return;
    }

    this.conditions = this.patientService.getPatientConditions(this.patient.id);
    this.procedures = this.patientService.getPatientProcedures(this.patient.id);
    this.medications = this.patientService.getPatientMedications(this.patient.id);
    this.encounters = this.patientService.getPatientEncounters(this.patient.id);
    this.touchDataVersion();

    if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
      this.clinicalTimeline.refreshTimeline();
    }

    if (this.encounterRecord && this.encounterRecord.refreshEncounterDisplay) {
      this.encounterRecord.refreshEncounterDisplay();
    }
  }

  async onClinicalFormSubmitted(event: any): Promise<void> {
    // Handle clinical form submissions (allergies, adverse reactions, questionnaires, etc.)
    if (event.type === 'allergy' && this.patient) {
      this.isLoadingMapping = true;
      
      try {
        // Reload allergies from the service to update the summary
        this.allergies = this.patientService.getPatientAllergies(this.patient.id);
        const newestAllergy = event.data?.id
          ? this.allergies.find((allergy) => allergy.id === event.data.id) || event.data
          : this.allergies[this.allergies.length - 1];
        
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
        if (newestAllergy) {
          this.triggerAllergyIntoleranceCreateHook(newestAllergy);
        }
        
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
        this.touchDataVersion();
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
          successMessage += `. ${extractedConditions} item(s) extracted.`;
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
        this.touchDataVersion();
        
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

    let extractedCount = 0;
    // SDC extraction relationship (None/component/member/derived/independent) is intentionally ignored for now.
    // We currently extract recognized observable items as individual Conditions/Observations and then apply
    // the vital-signs consolidation (for BP) at the questionnaire level.
    let systolicBloodPressure: number | null = null;
    let diastolicBloodPressure: number | null = null;
    let bloodPressureDetected = false;

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
          const vitalSign = this.getVitalSignConfig(questionnaireItem);

          if (responseItem && responseItem.value !== undefined && responseItem.value !== null) {
            if (this.isVitalSignObservable(questionnaireItem)) {
              if (!vitalSign) {
                continue;
              }

              const numericValue = this.extractNumericValue(responseItem.value);
              if (numericValue === null) {
                continue;
              }

              if (this.isBloodPressureVitalSign(vitalSign)) {
                bloodPressureDetected = true;
                if (vitalSign.bloodPressureComponentCode === '8480-6') {
                  systolicBloodPressure = numericValue;
                } else if (vitalSign.bloodPressureComponentCode === '8462-4') {
                  diastolicBloodPressure = numericValue;
                } else {
                  extractedCount += await this.createVitalSignsFromQuestionnaireResponseWithValue(
                    vitalSign,
                    numericValue,
                    questionnaire.title || 'Questionnaire'
                  );
                }

                continue;
              } else {
                extractedCount += await this.createVitalSignsFromQuestionnaireResponseWithValue(
                  vitalSign,
                  numericValue,
                  questionnaire.title || 'Questionnaire'
                );
                continue;
              }
            }

            // Extract either a Condition or an Observation depending on the observable type
            const extracted = await this.createConditionsFromRiskFactorResponse(
              questionnaireItem,
              responseItem,
              questionnaire.title || 'Questionnaire'
            );
            extractedCount += extracted;
          }
        }
      }

      if (bloodPressureDetected && (systolicBloodPressure !== null || diastolicBloodPressure !== null)) {
        const observationCreated = await this.createBloodPressureObservationFromValues(
          systolicBloodPressure,
          diastolicBloodPressure,
          questionnaire.title || 'Questionnaire'
        );
        extractedCount += observationCreated;
      }
    } catch (error) {
      console.error('Error extracting conditions from questionnaire:', error);
    }

    return extractedCount;
  }

  private findExtractableItems(items: any[]): any[] {
    const extractable: any[] = [];

    for (const item of items) {
      // Check if item has observationExtract extension set to true
      if (item.extension) {
        // SDC compatibility rule: consider extractable when sdc-questionnaire-observationExtract is present
        // as valueBoolean=true or as any non-empty valueCode (independent/component/member/derived/none/etc.).
        // We intentionally do not enforce relation semantics here.
        const extractExtension = item.extension.find((ext: any) =>
          ext.url === 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract' &&
          (
            ext.valueBoolean === true ||
            (typeof ext.valueCode === 'string' && ext.valueCode.trim().length > 0)
          )
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

  // Vital sign observable entity codes (SNOMED CT) that should be converted to Observations
  private readonly RECOGNIZED_VITAL_SIGNS: Record<string, VitalSignObservationConfig> = {
    '364075005': {
      loincCode: '8867-4',
      label: 'Heart rate',
      unit: 'bpm',
      snomedCode: '364075005'
    },
    '386725007': {
      loincCode: '8310-5',
      label: 'Body temperature',
      unit: '°C',
      snomedCode: '386725007'
    },
    '86290005': {
      loincCode: '9279-1',
      label: 'Respiratory rate',
      unit: 'breaths/min',
      snomedCode: '86290005'
    },
    '103228002': {
      loincCode: '2708-6',
      label: 'Oxygen saturation in arterial blood',
      unit: '%',
      snomedCode: '103228002'
    },
    '27113001': {
      loincCode: '29463-7',
      label: 'Body weight',
      unit: 'kg',
      snomedCode: '27113001'
    },
    '271649006': {
      bloodPressureParentCode: '85354-9',
      bloodPressureComponentCode: '8480-6',
      bloodPressureComponentSnomed: '271649006',
      loincCode: '8480-6',
      label: 'Systolic blood pressure',
      unit: 'mmHg',
      snomedCode: '271649006'
    },
    '271650006': {
      bloodPressureParentCode: '85354-9',
      bloodPressureComponentCode: '8462-4',
      bloodPressureComponentSnomed: '271650006',
      loincCode: '8462-4',
      label: 'Diastolic blood pressure',
      unit: 'mmHg',
      snomedCode: '271650006'
    }
  };

  private isObservableRecognized(item: any): boolean {
    const recognizedCodes = [
      ...Object.values(this.RECOGNIZED_OBSERVABLES),
      ...Object.keys(this.RECOGNIZED_VITAL_SIGNS)
    ];
    const itemCodes = this.extractQuestionnaireItemCodes(item);
    return itemCodes.some((code) => recognizedCodes.includes(code));
  }

  private isVitalSignObservable(item: any): boolean {
    const itemCodes = this.extractQuestionnaireItemCodes(item);
    return itemCodes.some((code) => code in this.RECOGNIZED_VITAL_SIGNS);
  }

  private isBloodPressureVitalSign(vitalSign: VitalSignObservationConfig): boolean {
    return !!(
      vitalSign.bloodPressureParentCode &&
      vitalSign.bloodPressureComponentCode &&
      vitalSign.bloodPressureComponentSnomed
    );
  }

  private getVitalSignConfig(item: any): VitalSignObservationConfig | null {
    const itemCodes = this.extractQuestionnaireItemCodes(item);
    for (const code of itemCodes) {
      const vitalSign = this.RECOGNIZED_VITAL_SIGNS[code];
      if (vitalSign) {
        return vitalSign;
      }
    }

    return null;
  }

  private extractQuestionnaireItemCodes(item: any): string[] {
    const codes = new Set<string>();

    // LForms format - check codeList
    if (item.codeList && Array.isArray(item.codeList)) {
      for (const coding of item.codeList) {
        if (coding?.code) {
          codes.add(String(coding.code));
        }
        if (coding?.system) {
          codes.add(String(coding.system));
        }
      }
    }

    // LForms format - check questionCodeSystem
    if (item.questionCodeSystem && typeof item.questionCodeSystem === 'string') {
      codes.add(String(item.questionCodeSystem));
    }

    // FHIR Questionnaire format - check code array
    if (item.code && Array.isArray(item.code)) {
      for (const coding of item.code) {
        if (coding?.code) {
          codes.add(String(coding.code));
        }
        if (coding?.system) {
          codes.add(String(coding.system));
        }
      }
    }

    return Array.from(codes);
  }

  private async createVitalSignsFromQuestionnaireResponseWithValue(
    vitalSign: VitalSignObservationConfig,
    numericValue: number,
    questionnaireName: string
  ): Promise<number> {
    if (!this.patient) return 0;

    if (!vitalSign) {
      return 0;
    }

    const observation = this.createVitalSignObservation(vitalSign, numericValue, questionnaireName);
    const added = this.patientService.addPatientObservation(this.patient.id, observation);

    return added ? 1 : 0;
  }

  private async createBloodPressureObservationFromValues(
    systolic: number | null,
    diastolic: number | null,
    questionnaireName: string
  ): Promise<number> {
    if (!this.patient) {
      return 0;
    }

    const now = new Date().toISOString();
    const subjectDisplay = this.patient?.name?.[0]?.text || `${this.patient?.name?.[0]?.given?.[0]} ${this.patient?.name?.[0]?.family}`;

    const bloodPressureComponents: Array<{
      code: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      valueQuantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }> = [];

    const observation: FhirObservation = {
      resourceType: 'Observation',
      id: `observation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'final',
      subject: {
        reference: `Patient/${this.patient.id}`,
        display: subjectDisplay
      },
      effectiveDateTime: now,
      issued: now,
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure'
          }
        ],
        text: 'Blood pressure'
      },
      note: [{
        text: `Extracted from questionnaire: ${questionnaireName}`,
        time: now
      }]
    };

    if (systolic !== null && Number.isFinite(systolic)) {
      bloodPressureComponents.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure'
            },
            {
              system: 'http://snomed.info/sct',
              code: '271649006',
              display: 'Systolic blood pressure (observable entity)'
            }
          ],
          text: 'Systolic blood pressure'
        },
        valueQuantity: {
          value: systolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      });
    }

    if (diastolic !== null && Number.isFinite(diastolic)) {
      bloodPressureComponents.push({
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure'
            },
            {
              system: 'http://snomed.info/sct',
              code: '271650006',
              display: 'Diastolic blood pressure (observable entity)'
            }
          ],
          text: 'Diastolic blood pressure'
        },
        valueQuantity: {
          value: diastolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]'
        }
      });
    }

    if (bloodPressureComponents.length === 0) {
      return 0;
    }

    observation.component = bloodPressureComponents;

    const added = this.patientService.addPatientObservation(this.patient.id, observation);
    return added ? 1 : 0;
  }

  private extractNumericValue(value: any): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (Array.isArray(value)) {
      return this.extractNumericValue(value[0]);
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    if (typeof value.value === 'number' || typeof value.value === 'string') {
      return this.extractNumericValue(value.value);
    }

    if (value.valueQuantity && typeof value.valueQuantity === 'object' && value.valueQuantity.value !== undefined) {
      return this.extractNumericValue(value.valueQuantity.value);
    }

    if (value.valueInteger !== undefined) {
      return this.extractNumericValue(value.valueInteger);
    }

    if (value.valueDecimal !== undefined) {
      return this.extractNumericValue(value.valueDecimal);
    }

    return null;
  }

  private createVitalSignObservation(
    vitalSign: VitalSignObservationConfig,
    numericValue: number,
    source: string
  ): FhirObservation {
    const now = new Date().toISOString();
    const subjectDisplay = this.patient?.name?.[0]?.text || `${this.patient?.name?.[0]?.given?.[0]} ${this.patient?.name?.[0]?.family}`;

    const primaryCodings: Array<{ system: string; code: string; display: string }> = [
      {
        system: 'http://loinc.org',
        code: vitalSign.bloodPressureParentCode || vitalSign.loincCode,
        display: vitalSign.label
      }
    ];

    if (!vitalSign.bloodPressureParentCode && vitalSign.snomedCode) {
      primaryCodings.push({
        system: 'http://snomed.info/sct',
        code: vitalSign.snomedCode,
        display: `${vitalSign.label} (observable entity)`
      });
    }

    const observation: FhirObservation = {
      resourceType: 'Observation',
      id: `observation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'final',
      subject: {
        reference: `Patient/${this.patient?.id || ''}`,
        display: subjectDisplay
      },
      effectiveDateTime: now,
      issued: now,
      code: {
        coding: primaryCodings,
        text: vitalSign.label
      },
      valueQuantity: {
        value: numericValue,
        unit: vitalSign.unit,
        system: 'http://unitsofmeasure.org',
        code: vitalSign.unit
      },
      note: [{
        text: `Extracted from questionnaire: ${source}`,
        time: now
      }]
    };

    return observation;
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
          const added = await this.patientService.addPatientConditionEnriched(this.patient.id, condition);
          if (added) {
            created++;
            await this.mapSingleEventToAnchorPoint(condition);
          }
        }
      }
    } else if (Array.isArray(value)) {
      // Multiple coded values
      for (const coding of value) {
        if (coding.code && (coding.display || coding.text)) {
          const condition = this.createConditionFromCoding(coding, questionnaireName);
          if (condition) {
            const added = await this.patientService.addPatientConditionEnriched(this.patient.id, condition);
            if (added) {
              created++;
              await this.mapSingleEventToAnchorPoint(condition);
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
    const snomedCode = this.patientService.extractSnomedCode(resource);
    if (snomedCode) {
      return snomedCode;
    }
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return '';
  }

  getIcd10Code(condition: any): string | null {
    return this.patientService.getConditionIcd10Code(condition);
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
      this.triggerPatientViewHook();
      this.touchDataVersion();
    }
  }

  deleteProcedure(procedureId: string): void {
    if (!this.patient) return;
    
    const procedure = this.procedures.find(p => p.id === procedureId);
    if (procedure && confirm(`Are you sure you want to delete the procedure "${procedure.code.text}"?`)) {
      this.patientService.deletePatientProcedure(this.patient.id, procedureId);
      // Reload procedures directly from service to ensure fresh data
      this.procedures = this.patientService.getPatientProcedures(this.patient.id);
      this.touchDataVersion();
    }
  }

  deleteMedication(medicationId: string): void {
    if (!this.patient) return;
    
    const medication = this.medications.find(m => m.id === medicationId);
    if (medication && confirm(`Are you sure you want to delete the medication "${medication.medicationCodeableConcept?.text}"?`)) {
      this.patientService.deletePatientMedication(this.patient.id, medicationId);
      // Reload medications directly from service to ensure fresh data
      this.medications = this.patientService.getPatientMedications(this.patient.id);
      this.triggerPatientViewHook();
      this.touchDataVersion();
    }
  }

  deleteImmunization(immunizationId: string): void {
    if (!this.patient) return;

    const immunization = this.immunizations.find(i => i.id === immunizationId);
    if (immunization && confirm(`Are you sure you want to delete the immunization "${immunization.vaccineCode?.text || immunization.vaccineCode?.coding?.[0]?.display}"?`)) {
      this.patientService.deletePatientImmunization(this.patient.id, immunizationId);
      this.immunizations = this.patientService.getPatientImmunizations(this.patient.id);
      this.triggerPatientViewHook();
      this.touchDataVersion();
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
        this.triggerPatientViewHook();
        this.touchDataVersion();
      }
    }
  }

  deleteLabOrder(labOrderId: string): void {
    if (!this.patient) return;

    const labOrder = this.labOrders.find(order => order.id === labOrderId);
    if (labOrder && confirm(`Are you sure you want to delete the order "${this.getLabOrderDisplayName(labOrder)}"?`)) {
      this.patientService.deletePatientLabOrder(this.patient.id, labOrderId);
      this.labOrders = this.patientService.getPatientLabOrders(this.patient.id);
      this.touchDataVersion();
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
    this.getSortedSummaryConditions().forEach(condition => {
      const conceptId = this.getConceptId(condition);
      const anchorPoint = this.findBestAnchorPointForConcept(conceptId);
      eventsWithAnchors.push({
        event: condition,
        anchorPoint: anchorPoint,
        type: 'condition'
      });
    });

    // Map procedures  
    this.getSortedSummaryProcedures().forEach(procedure => {
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
  async deleteAllEvents(): Promise<void> {
    if (!this.patient) return;
    
    const patientId = this.patient.id;
    
    // Get encounter count
    const encounters = this.patientService.getPatientEncounters(patientId);
    
    // Confirm deletion
    const eventCount = this.conditions.length + this.procedures.length + this.medications.length + this.immunizations.length + this.allergies.length + encounters.length;
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
    
    const confirmation = await firstValueFrom(this.dialog.open(ConfirmationDialogComponent, {
      width: '460px',
      data: {
        title: 'Delete All Clinical Events',
        message: `This will permanently delete ${eventCount} clinical events for ${this.getPatientDisplayName(this.patient)}.\n\nThis includes conditions, procedures, medications, immunizations, allergies, encounters, observations, questionnaires, and related bundles.\n\nThis action cannot be undone.`,
        confirmText: 'Delete All Events',
        cancelText: 'Cancel',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (!confirmation) return;
    
    this.isDeletingAllEvents = true;

    try {
      await this.patientService.clearAllPatientEvents(patientId);

      this.conditions = [];
      this.procedures = [];
      this.medications = [];
      this.immunizations = [];
      this.labOrders = [];
      this.allergies = [];
      this.encounters = [];
      this.touchDataVersion();

      this.patientService.selectPatient({ ...this.patient });

      this.snackBar.open(
        'All clinical events have been deleted successfully.',
        undefined,
        {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        }
      );
    } catch (error) {
      console.error('Error deleting all clinical events:', error);
      this.snackBar.open(
        'Unable to delete all clinical events.',
        'Close',
        {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        }
      );
    } finally {
      this.isDeletingAllEvents = false;
    }
  }

  /**
   * Load cached data from localStorage or fallback to fresh data from service
   */
  private loadCachedOrFreshData<T>(dataType: string, patientId: string, getFreshData: () => T[]): T[] {
    return getFreshData();
  }

  private showClinicalDataLoadedSnackBar(summary: ClinicalDataLoadSummary): void {
    const nonZeroGroups = Object.values(summary.counts).filter((count) => count > 0).length;
    const resourceLabel = summary.totalResources === 1 ? 'resource' : 'resources';
    const groupLabel = nonZeroGroups === 1 ? 'group' : 'groups';

    this.snackBar.open(
      `FHIR data loaded: ${summary.totalResources} ${resourceLabel} across ${nonZeroGroups} ${groupLabel}.`,
      'Close',
      {
        duration: 3200,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      }
    );
  }

  private touchDataVersion(): void {
    this.dataVersion += 1;
  }

  private triggerPatientViewHook(): void {
    if (!this.patient) {
      return;
    }

    void firstValueFrom(this.cdsService.invokePatientView({
      patient: this.patient,
      conditions: this.conditions,
      medications: this.medications,
      allergies: this.allergies
    }));
  }

  private triggerProblemListItemCreateHook(newCondition: Condition, conditionsSnapshot?: Condition[]): void {
    if (!this.patient) {
      return;
    }

    void firstValueFrom(this.cdsService.invokeProblemListItemCreate({
      patient: this.patient,
      conditions: conditionsSnapshot || this.conditions,
      medications: this.medications,
      allergies: this.allergies,
      newConditions: [newCondition]
    }));
  }

  private triggerAllergyIntoleranceCreateHook(newAllergy: AllergyIntolerance): void {
    if (!this.patient) {
      return;
    }

    void firstValueFrom(this.cdsService.invokeAllergyIntoleranceCreate({
      patient: this.patient,
      conditions: this.conditions,
      medications: this.medications,
      allergies: [...this.allergies.filter((allergy) => allergy.id !== newAllergy.id), newAllergy]
    }));
  }

  private triggerOrderSelectHook(draftMedication: MedicationStatement): void {
    if (!this.patient) {
      return;
    }

    void firstValueFrom(this.cdsService.invokeOrderSelect({
      patient: this.patient,
      conditions: this.conditions,
      medications: this.medications,
      allergies: this.allergies,
      selectedMedications: [draftMedication]
    }));
  }

  private triggerOrderSignHook(draftMedication: MedicationStatement): void {
    if (!this.patient) {
      return;
    }

    void firstValueFrom(this.cdsService.invokeOrderSign({
      patient: this.patient,
      conditions: this.conditions,
      medications: this.medications,
      allergies: this.allergies,
      draftMedications: [draftMedication]
    }));
  }

  private refreshSummaryVisualizations(): void {
    setTimeout(() => {
      if (this.selectedClinicalView !== 'summary') {
        return;
      }

      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }

      if (this.encounterRecord && this.encounterRecord.refreshEncounterDisplay) {
        this.encounterRecord.refreshEncounterDisplay();
      }
    }, 0);

    setTimeout(() => {
      if (this.selectedClinicalView !== 'summary') {
        return;
      }

      if (this.clinicalTimeline && this.clinicalTimeline.refreshTimeline) {
        this.clinicalTimeline.refreshTimeline();
      }
    }, 180);
  }

  /**
   * Get cached location for a concept from existing clinical events
   */
  private getCachedLocationForConcept(conceptId: string): string | null {
    // Check conditions
    for (const condition of this.conditions) {
      if (this.getConceptId(condition) === conceptId) {
        const conditionLocation = this.getStoredLocationForEvent(condition);
        if (conditionLocation) {
          return conditionLocation;
        }
      }
    }
    
    // Check procedures
    for (const procedure of this.procedures) {
      if (this.getConceptId(procedure) === conceptId) {
        const procedureLocation = this.getStoredLocationForEvent(procedure);
        if (procedureLocation) {
          return procedureLocation;
        }
      }
    }
    
    // Check medications (using indication concept ID)
    for (const medication of this.medications) {
      const indicationConceptId = this.getIndicationConceptId(medication);
      const medicationConceptId = indicationConceptId || this.getConceptId(medication);
      if (medicationConceptId === conceptId) {
        const medicationLocation = this.getStoredLocationForEvent(medication);
        if (medicationLocation) {
          return medicationLocation;
        }
      }
    }
    
    return null;
  }



  /**
   * Check if an anchor point has any associated clinical events
   */
  hasAssociatedEvents(anchorPoint: AnchorPoint): boolean {
    // Check conditions
    const hasConditions = this.getSortedSummaryConditions().some(condition => {
      const bestAnchorPoint = this.findBestAnchorPointForConcept(this.getConceptId(condition));
      return bestAnchorPoint?.id === anchorPoint.id;
    });
    
    // Check procedures
    const hasProcedures = this.getSortedSummaryProcedures().some(procedure => {
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
              this.setStoredLocationForEvent(event, bestAnchorPoint.id);
            } else {
              this.setStoredLocationForEvent(event, 'systemic');
            }
            
            resolve();
          } catch (error) {
            console.error(`Error processing ancestors for concept ${conceptId}:`, error);
            this.setStoredLocationForEvent(event, 'systemic');
            resolve();
          }
        },
        error: (error) => {
          console.error(`Failed to get ancestors for concept ${conceptId}:`, error);
          this.setStoredLocationForEvent(event, 'systemic');
          resolve();
        }
      });
    });
  }

  private isDentalCondition(condition: Condition): boolean {
    return condition.category?.some((category) =>
      category.coding?.some(
        (coding) => coding.system === this.DENTAL_CATEGORY_SYSTEM && coding.code === this.DENTAL_CONDITION_CATEGORY_CODE
      ) || category.text === 'Dental finding'
    ) || false;
  }

  private isDentalProcedure(procedure: Procedure): boolean {
    return procedure.category?.coding?.some(
      (coding) => coding.system === this.DENTAL_CATEGORY_SYSTEM && coding.code === this.DENTAL_PROCEDURE_CATEGORY_CODE
    ) || procedure.category?.text === 'Dental procedure' || false;
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
      this.setStoredLocationForEvent(event, 'systemic');
      return;
    }

    // Skip if already mapped
    if (this.getStoredLocationForEvent(event)) {
      return;
    }

    try {
      await this.mapEventToAnchorPointUsingAncestors(event, conceptId);
      
      // The event is already saved to PatientService when it was first created
      // No need to save again here
    } catch (error) {
      console.error(`Error mapping single event with concept ${conceptId}:`, error);
      this.setStoredLocationForEvent(event, 'systemic');
    }
  }

  private getStoredLocationForEvent(event: any): string | null {
    if (Array.isArray(event?.bodySite)) {
      const locationCode = event.bodySite
        .flatMap((site: any) => Array.isArray(site?.coding) ? site.coding : [])
        .find((coding: any) => coding?.system === this.EHR_LAB_LOCATION_SYSTEM)
        ?.code;

      if (locationCode) {
        return locationCode;
      }
    }

    if (event?.resourceType === 'MedicationStatement') {
      const extensions = Array.isArray(event?.extension) ? event.extension : [];
      const extensionLocation = extensions.find(
        (extension: any) => extension?.url === this.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL
      )?.valueCode;

      if (extensionLocation) {
        return extensionLocation;
      }

      const dosageSiteLocation = event?.dosage?.[0]?.site?.coding?.find(
        (coding: any) => coding?.system === this.EHR_LAB_LOCATION_SYSTEM
      )?.code;

      if (dosageSiteLocation) {
        return dosageSiteLocation;
      }
    }

    return null;
  }

  private setStoredLocationForEvent(event: any, locationCode: string): void {
    if (event?.resourceType === 'Condition' || Array.isArray(event?.bodySite)) {
      const bodySite = Array.isArray(event?.bodySite) ? [...event.bodySite] : [];
      const filteredBodySite = bodySite.filter((site: any) => {
        const codings = Array.isArray(site?.coding) ? site.coding : [];
        return !codings.some((coding: any) => coding?.system === this.EHR_LAB_LOCATION_SYSTEM);
      });

      event.bodySite = [
        ...filteredBodySite,
        {
          coding: [
            {
              system: this.EHR_LAB_LOCATION_SYSTEM,
              code: locationCode,
              display: this.toLocationDisplay(locationCode)
            }
          ],
          text: this.toLocationDisplay(locationCode)
        }
      ];
      return;
    }

    if (event?.resourceType === 'Procedure') {
      const bodySite = Array.isArray(event?.bodySite) ? [...event.bodySite] : [];
      const filteredBodySite = bodySite.filter((site: any) => {
        const codings = Array.isArray(site?.coding) ? site.coding : [];
        return !codings.some((coding: any) => coding?.system === this.EHR_LAB_LOCATION_SYSTEM);
      });

      event.bodySite = [
        ...filteredBodySite,
        {
          coding: [
            {
              system: this.EHR_LAB_LOCATION_SYSTEM,
              code: locationCode,
              display: this.toLocationDisplay(locationCode)
            }
          ],
          text: this.toLocationDisplay(locationCode)
        }
      ];
      return;
    }

    if (event?.resourceType === 'MedicationStatement') {
      const extensions = Array.isArray(event?.extension) ? [...event.extension] : [];
      const filteredExtensions = extensions.filter(
        (extension: any) => extension?.url !== this.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL
      );

      event.extension = [
        ...filteredExtensions,
        {
          url: this.EHR_LAB_COMPUTED_LOCATION_EXTENSION_URL,
          valueCode: locationCode
        }
      ];
    }
  }

  private toLocationDisplay(locationCode: string): string {
    return locationCode
      .split(/[-_]/g)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
