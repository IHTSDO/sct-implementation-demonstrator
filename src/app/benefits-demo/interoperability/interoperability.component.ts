import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IPSReaderService } from './ips-reader.service';
import { ProcessedPatientData } from './ips-interfaces';
import { PatientService } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import type { Immunization, Patient, PatientSimilarityResult, Provenance } from '../../model';
import {
  ConceptHierarchyValidationService,
  HierarchyMatch,
  HierarchyValidationResult,
  RecordConcept
} from '../../services/concept-hierarchy-validation.service';
import {
  ConceptValidationDialogComponent,
  ConceptValidationDialogState
} from './concept-validation-dialog/concept-validation-dialog.component';

type MergeSectionId = 'conditions' | 'procedures' | 'medications' | 'immunizations' | 'allergies';
type WizardStepId = 'patient' | MergeSectionId | 'summary';

interface WizardStep {
  id: WizardStepId;
  title: string;
  description: string;
}

@Component({
  selector: 'app-interoperability',
  templateUrl: './interoperability.component.html',
  styleUrls: ['./interoperability.component.css'],
  standalone: false
})
export class InteroperabilityComponent implements OnInit, OnDestroy {
  private static readonly AUTO_SELECT_MATCH_THRESHOLD = 0.95;
  patientData: ProcessedPatientData | null = null;
  isLoading = false;
  isImporting = false;
  error: string | null = null;
  
  // Patient linking properties
  selectedPatientId: string = '';
  linkedPatient: Patient | null = null;
  linkedPatientIsDraft = false;
  suggestedPatient: any = null;
  availablePatients: Patient[] = [];
  sortedPatientsWithScores: PatientSimilarityResult[] = [];
  private subscriptions: Subscription[] = [];
  
  // Data verification properties
  showDataVerification = false;
  existingPatientData: any = null;
  importSummary: any = null;
  
  // Selection tracking
  selectedConditions: Set<string> = new Set();
  selectedProcedures: Set<string> = new Set();
  selectedMedications: Set<string> = new Set();
  selectedImmunizations: Set<string> = new Set();
  selectedAllergies: Set<string> = new Set();
  
  // Current patient data
  existingConditions: any[] = [];
  existingProcedures: any[] = [];
  existingMedications: any[] = [];
  existingImmunizations: any[] = [];
  existingAllergies: any[] = [];

  wizardSteps: WizardStep[] = [];
  currentStepIndex = 0;

  // File upload
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('shlScannerVideo') shlScannerVideo?: ElementRef<HTMLVideoElement>;
  isShlScanning = false;
  isShlResolving = false;
  shlScanError: string | null = null;
  private shlScanStream: MediaStream | null = null;
  private shlScanIntervalId: number | null = null;
  private shlScanInProgress = false;

  constructor(
    public ipsReaderService: IPSReaderService,
    private patientService: PatientService,
    private router: Router,
    private terminologyService: TerminologyService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private conceptHierarchyValidationService: ConceptHierarchyValidationService
  ) { }

  ngOnInit(): void {
    this.loadAvailablePatients();
  }

  ngOnDestroy(): void {
    this.stopShlQrScan();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load available patients from the PatientService
   */
  private loadAvailablePatients(): void {
    this.subscriptions.push(
      this.patientService.getPatients().subscribe(patients => {
        this.availablePatients = patients;
        // Calculate scores and sort if we have IPS data
        if (this.patientData?.patient) {
          this.calculateAndSortPatientsByScore();
        }
        // Re-run suggestion logic if we already have IPS data
        if (this.patientData) {
          this.findSuggestedPatient();
        }
      })
    );
  }

  /**
   * Calculate similarity scores for all patients and sort them using PatientService
   */
  private calculateAndSortPatientsByScore(): void {
    if (!this.patientData?.patient || this.availablePatients.length === 0) {
      this.sortedPatientsWithScores = [];
      return;
    }

    // Use PatientService to find similar patients
    this.sortedPatientsWithScores = this.patientService.findSimilarPatients(this.patientData.patient, false);
  }

  /**
   * Get similarity score for a specific patient
   */
  getPatientScore(patientId: string): number {
    const item = this.sortedPatientsWithScores.find(p => p.patient.id === patientId);
    return item ? item.score : 0;
  }

  /**
   * Format score as percentage
   */
  formatScoreAsPercentage(score: number): string {
    return this.patientService.formatScoreAsPercentage(score);
  }

  /**
   * Load the example IPS bundle
   */
  loadExampleIPSBundle(): void {
    this.isLoading = true;
    this.error = null;
    
    const ipsFilePath = 'assets/data/ips-example-active-penicillin.json';
    
    this.ipsReaderService.loadIPSBundle(ipsFilePath).subscribe({
      next: (data) => {
        this.patientData = data;
        this.isLoading = false;
        this.resetWizard();
        this.calculateAndSortPatientsByScore();
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

  hasImmunizations(): boolean {
    return this.patientData !== null && this.patientData.immunizations.length > 0;
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
    if (!this.selectedPatientId) {
      this.linkedPatient = null;
      this.linkedPatientIsDraft = false;
      this.loadExistingPatientData();
      this.clearSelections();
      return;
    }

    this.linkPatient();
  }

  /**
   * Find suggested patient based on similarity score from PatientService
   */
  findSuggestedPatient(): void {
    this.suggestedPatient = null;

    if (!this.patientData?.patient || this.sortedPatientsWithScores.length === 0) {
      return;
    }

    // Get the top match from our sorted list
    const topMatch = this.sortedPatientsWithScores[0];
    
    if (!topMatch || topMatch.score < InteroperabilityComponent.AUTO_SELECT_MATCH_THRESHOLD) {
      // No good matches found
      return;
    }

    // Determine match type based on score
    let matchType = 'possible';
    if (topMatch.score >= 0.95) {
      matchType = 'exact';
    } else if (topMatch.score >= 0.8) {
      matchType = 'name';
    } else if (topMatch.score >= 0.6) {
      matchType = 'date';
    }

    this.suggestedPatient = { ...topMatch.patient, matchType: matchType, score: topMatch.score };
    this.selectedPatientId = topMatch.patient.id;
    this.linkedPatient = topMatch.patient;
    this.linkedPatientIsDraft = false;
    this.loadExistingPatientData();
    this.initializeSelections();
  }

  needsManualPatientEntry(): boolean {
    return !!this.patientData && !this.suggestedPatient;
  }

  private resetWizard(): void {
    this.currentStepIndex = 0;
    this.linkedPatient = null;
    this.linkedPatientIsDraft = false;
    this.selectedPatientId = '';
    this.suggestedPatient = null;
    this.loadExistingPatientData();
    this.clearSelections();
    this.rebuildWizardSteps();
  }

  backToInteroperabilityHome(): void {
    this.stopShlQrScan();
    this.patientData = null;
    this.error = null;
    this.shlScanError = null;
    this.isLoading = false;
    this.isShlResolving = false;
    this.resetWizard();
  }

  private rebuildWizardSteps(): void {
    const steps: WizardStep[] = [
      {
        id: 'patient',
        title: 'Identify Patient',
        description: 'Match the IPS patient to an existing record or create a new one.'
      }
    ];

    if (this.hasConditions()) {
      steps.push({
        id: 'conditions',
        title: 'Merge Conditions',
        description: 'Review IPS conditions against the current clinical record.'
      });
    }

    if (this.hasProcedures()) {
      steps.push({
        id: 'procedures',
        title: 'Merge Procedures',
        description: 'Review IPS procedures against the current clinical record.'
      });
    }

    if (this.hasMedications()) {
      steps.push({
        id: 'medications',
        title: 'Merge Medications',
        description: 'Review IPS medications against the current clinical record.'
      });
    }

    if (this.hasImmunizations()) {
      steps.push({
        id: 'immunizations',
        title: 'Merge Immunizations',
        description: 'Review IPS immunizations against the current clinical record.'
      });
    }

    if (this.hasAllergies()) {
      steps.push({
        id: 'allergies',
        title: 'Merge Allergies',
        description: 'Review IPS allergies against the current clinical record.'
      });
    }

    steps.push({
      id: 'summary',
      title: 'Summary',
      description: 'Confirm the selected IPS items before importing them.'
    });

    this.wizardSteps = steps;
    if (this.currentStepIndex > this.wizardSteps.length - 1) {
      this.currentStepIndex = this.wizardSteps.length - 1;
    }
  }

  getCurrentStep(): WizardStep | null {
    return this.wizardSteps[this.currentStepIndex] || null;
  }

  isCurrentStep(stepId: WizardStepId): boolean {
    return this.getCurrentStep()?.id === stepId;
  }

  getStepNumber(stepId: WizardStepId): number {
    return this.wizardSteps.findIndex(step => step.id === stepId) + 1;
  }

  canGoToPreviousStep(): boolean {
    return this.currentStepIndex > 0;
  }

  canGoToNextStep(): boolean {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      return false;
    }

    if (currentStep.id === 'patient') {
      return !!this.linkedPatient;
    }

    return currentStep.id !== 'summary' && this.currentStepIndex < this.wizardSteps.length - 1;
  }

  goToPreviousStep(): void {
    if (this.canGoToPreviousStep()) {
      this.currentStepIndex -= 1;
    }
  }

  canNavigateToStep(index: number): boolean {
    return index <= this.currentStepIndex;
  }

  goToStep(index: number): void {
    if (this.canNavigateToStep(index)) {
      this.currentStepIndex = index;
    }
  }

  goToNextStep(): void {
    if (this.canGoToNextStep()) {
      this.currentStepIndex += 1;
    }
  }

  /**
   * Accept the suggested patient
   */
  acceptSuggestion(): void {
    if (this.suggestedPatient) {
      this.selectedPatientId = this.suggestedPatient.id;
      this.linkedPatient = this.suggestedPatient;
      this.linkedPatientIsDraft = false;
      this.suggestedPatient = null;

      this.loadExistingPatientData();
      
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
   * Normalize partial date strings to full ISO timestamps
   * Converts formats like "2015-03" or "2015" to "2015-03-01T00:00:00.000Z" or "2015-01-01T00:00:00.000Z"
   */
  private normalizePartialDateToISO(partialDate: string | undefined): string {
    if (!partialDate) {
      return new Date().toISOString();
    }

    // If it's already a full ISO timestamp, return as is
    if (partialDate.includes('T') || partialDate.length > 10) {
      return partialDate;
    }

    // Handle "YYYY-MM" format
    if (partialDate.match(/^\d{4}-\d{2}$/)) {
      return `${partialDate}-01T00:00:00.000Z`;
    }

    // Handle "YYYY" format
    if (partialDate.match(/^\d{4}$/)) {
      return `${partialDate}-01-01T00:00:00.000Z`;
    }

    // Fallback to current date
    return new Date().toISOString();
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
      this.linkedPatientIsDraft = false;
      this.suggestedPatient = null; // Clear suggestion after linking
      
      // Load existing data for this patient
      this.loadExistingPatientData();
      
      // Initialize selections (select all by default)
      this.initializeSelections();
    }
  }

  /**
   * Load existing data for the linked patient
   */
  private loadExistingPatientData(): void {
    if (!this.linkedPatient || this.linkedPatientIsDraft) {
      this.existingConditions = [];
      this.existingProcedures = [];
      this.existingMedications = [];
      this.existingImmunizations = [];
      this.existingAllergies = [];
      return;
    }
    
    this.existingConditions = this.patientService.getPatientConditions(this.linkedPatient.id);
    this.existingProcedures = this.patientService.getPatientProcedures(this.linkedPatient.id);
    this.existingMedications = this.patientService.getPatientMedications(this.linkedPatient.id);
    this.existingImmunizations = this.patientService.getPatientImmunizations(this.linkedPatient.id);
    this.existingAllergies = this.patientService.getPatientAllergies(this.linkedPatient.id);
  }

  /**
   * Create a new patient based on IPS patient data
   */
  createNewPatient(): void {
    if (!this.patientData?.patient) {
      return;
    }

    const ipsPatient = this.patientData.patient;
    
    // Generate unique ID for the new patient
    const newPatientId = `patient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use the IPS patient data directly with a new ID and ensure required fields
    const newPatient: Patient = {
      ...ipsPatient,
      id: newPatientId,
      resourceType: 'Patient',
      active: ipsPatient.active !== undefined ? ipsPatient.active : true
    };

    this.linkedPatient = newPatient;
    this.linkedPatientIsDraft = true;
    this.selectedPatientId = '';
    this.suggestedPatient = null;
    this.loadExistingPatientData();
    this.initializeSelections();
  }

  /**
   * Check if a condition already exists in the patient's records
   */
  isConditionAlreadyRecorded(condition: any): boolean {
    if (!this.linkedPatient || this.existingConditions.length === 0) {
      return false;
    }

    const snomedCode = this.patientService.extractSnomedCode(condition);
    if (!snomedCode) {
      // If no SNOMED code, check by text similarity
      const conditionText = condition.code?.text || '';
      return this.existingConditions.some(existing => {
        const existingText = existing.code?.text || '';
        return this.simpleTextSimilarity(conditionText, existingText) > 0.9;
      });
    }

    // Check if SNOMED code already exists
    return this.existingConditions.some(existing => {
      const existingCode = this.patientService.extractSnomedCode(existing);
      return existingCode === snomedCode;
    });
  }

  /**
   * Add a condition from IPS to the selection by clicking on it
   */
  async addConditionFromIPS(conditionId: string): Promise<void> {
    if (!this.linkedPatient) {
      return;
    }

    // Find the condition to check if it's already recorded
    const condition = this.patientData?.conditions.find(c => c.id === conditionId);
    if (!condition) {
      return;
    }
    if (condition && this.isConditionAlreadyRecorded(condition)) {
      return; // Don't allow adding if already recorded
    }

    // Toggle selection
    if (this.selectedConditions.has(conditionId)) {
      this.selectedConditions.delete(conditionId);
    } else {
      const canAdd = await this.confirmConceptSelection('conditions', condition);
      if (canAdd) {
        this.selectedConditions.add(conditionId);
      }
    }
  }

  /**
   * Check if a condition from IPS is already added (selected)
   */
  isConditionAdded(conditionId: string): boolean {
    return this.selectedConditions.has(conditionId);
  }

  /**
   * Get selected conditions from IPS (to show first in the merge list)
   */
  getSelectedIPSConditions(): any[] {
    if (!this.patientData?.conditions) {
      return [];
    }
    
    return this.patientData.conditions.filter(condition => 
      this.selectedConditions.has(condition.id)
    );
  }

  /**
   * Check if there are available conditions to add (not already recorded)
   */
  hasAvailableConditions(): boolean {
    if (!this.patientData?.conditions || !this.linkedPatient) {
      return false;
    }
    
    return this.patientData.conditions.some(condition => 
      !this.isConditionAlreadyRecorded(condition)
    );
  }

  // ========================================
  // Procedures Methods
  // ========================================

  isProcedureAlreadyRecorded(procedure: any): boolean {
    if (!this.linkedPatient || this.existingProcedures.length === 0) {
      return false;
    }

    const snomedCode = this.patientService.extractSnomedCode(procedure);
    if (!snomedCode) {
      const procedureText = procedure.code?.text || '';
      return this.existingProcedures.some(existing => {
        const existingText = existing.code?.text || '';
        return this.simpleTextSimilarity(procedureText, existingText) > 0.9;
      });
    }

    return this.existingProcedures.some(existing => {
      const existingCode = this.patientService.extractSnomedCode(existing);
      return existingCode === snomedCode;
    });
  }

  async addProcedureFromIPS(procedureId: string): Promise<void> {
    if (!this.linkedPatient) {
      return;
    }

    const procedure = this.patientData?.procedures.find(p => p.id === procedureId);
    if (!procedure) {
      return;
    }
    if (procedure && this.isProcedureAlreadyRecorded(procedure)) {
      return;
    }

    if (this.selectedProcedures.has(procedureId)) {
      this.selectedProcedures.delete(procedureId);
    } else {
      const canAdd = await this.confirmConceptSelection('procedures', procedure);
      if (canAdd) {
        this.selectedProcedures.add(procedureId);
      }
    }
  }

  isProcedureAdded(procedureId: string): boolean {
    return this.selectedProcedures.has(procedureId);
  }

  getSelectedIPSProcedures(): any[] {
    if (!this.patientData?.procedures) {
      return [];
    }

    return this.patientData.procedures.filter(procedure =>
      this.selectedProcedures.has(procedure.id)
    );
  }

  hasAvailableProcedures(): boolean {
    if (!this.patientData?.procedures || !this.linkedPatient) {
      return false;
    }

    return this.patientData.procedures.some(procedure =>
      !this.isProcedureAlreadyRecorded(procedure)
    );
  }

  // ========================================
  // Medications Methods
  // ========================================

  /**
   * Check if a medication already exists in the patient's records
   */
  isMedicationAlreadyRecorded(medication: any): boolean {
    if (!this.linkedPatient || this.existingMedications.length === 0) {
      return false;
    }

    const snomedCode = this.patientService.extractSnomedCode(medication);
    if (!snomedCode) {
      // If no SNOMED code, check by text similarity
      const medicationText = medication.medicationCodeableConcept?.text || '';
      return this.existingMedications.some(existing => {
        const existingText = existing.medicationCodeableConcept?.text || '';
        return this.simpleTextSimilarity(medicationText, existingText) > 0.9;
      });
    }

    // Check if SNOMED code already exists
    return this.existingMedications.some(existing => {
      const existingCode = this.patientService.extractSnomedCode(existing);
      return existingCode === snomedCode;
    });
  }

  /**
   * Add a medication from IPS to the selection by clicking on it
   */
  async addMedicationFromIPS(medicationId: string): Promise<void> {
    if (!this.linkedPatient) {
      return;
    }

    // Find the medication to check if it's already recorded
    const medication = this.patientData?.medications.find(m => m.id === medicationId);
    if (!medication) {
      return;
    }
    if (medication && this.isMedicationAlreadyRecorded(medication)) {
      return; // Don't allow adding if already recorded
    }

    // Toggle selection
    if (this.selectedMedications.has(medicationId)) {
      this.selectedMedications.delete(medicationId);
    } else {
      const canAdd = await this.confirmConceptSelection('medications', medication);
      if (canAdd) {
        this.selectedMedications.add(medicationId);
      }
    }
  }

  /**
   * Check if a medication from IPS is already added (selected)
   */
  isMedicationAdded(medicationId: string): boolean {
    return this.selectedMedications.has(medicationId);
  }

  /**
   * Get selected medications from IPS (to show first in the merge list)
   */
  getSelectedIPSMedications(): any[] {
    if (!this.patientData?.medications) {
      return [];
    }
    
    return this.patientData.medications.filter(medication => 
      this.selectedMedications.has(medication.id)
    );
  }

  /**
   * Check if there are available medications to add (not already recorded)
   */
  hasAvailableMedications(): boolean {
    if (!this.patientData?.medications || !this.linkedPatient) {
      return false;
    }
    
    return this.patientData.medications.some(medication => 
      !this.isMedicationAlreadyRecorded(medication)
    );
  }

  isImmunizationAlreadyRecorded(immunization: any): boolean {
    if (!this.linkedPatient || this.existingImmunizations.length === 0) {
      return false;
    }

    return this.patientService.isDuplicateImmunization(this.existingImmunizations, this.toClinicalEntryImmunization(immunization, this.linkedPatient.id));
  }

  async addImmunizationFromIPS(immunizationId: string): Promise<void> {
    if (!this.linkedPatient) {
      return;
    }

    const immunization = this.patientData?.immunizations.find((item) => item.id === immunizationId);
    if (!immunization || this.isImmunizationAlreadyRecorded(immunization)) {
      return;
    }

    if (this.selectedImmunizations.has(immunizationId)) {
      this.selectedImmunizations.delete(immunizationId);
    } else {
      const canAdd = await this.confirmConceptSelection('immunizations', immunization);
      if (canAdd) {
        this.selectedImmunizations.add(immunizationId);
      }
    }
  }

  isImmunizationAdded(immunizationId: string): boolean {
    return this.selectedImmunizations.has(immunizationId);
  }

  hasAvailableImmunizations(): boolean {
    if (!this.patientData?.immunizations || !this.linkedPatient) {
      return false;
    }

    return this.patientData.immunizations.some((immunization) => !this.isImmunizationAlreadyRecorded(immunization));
  }

  // ========================================
  // Allergies Methods
  // ========================================

  /**
   * Check if an allergy already exists in the patient's records
   */
  isAllergyAlreadyRecorded(allergy: any): boolean {
    if (!this.linkedPatient || this.existingAllergies.length === 0) {
      return false;
    }

    const snomedCode = this.patientService.extractSnomedCode(allergy);
    if (!snomedCode) {
      // If no SNOMED code, check by text similarity
      const allergyText = allergy.code?.text || '';
      return this.existingAllergies.some(existing => {
        const existingText = existing.code?.text || '';
        return this.simpleTextSimilarity(allergyText, existingText) > 0.9;
      });
    }

    // Check if SNOMED code already exists
    return this.existingAllergies.some(existing => {
      const existingCode = this.patientService.extractSnomedCode(existing);
      return existingCode === snomedCode;
    });
  }

  /**
   * Add an allergy from IPS to the selection by clicking on it
   */
  async addAllergyFromIPS(allergyId: string): Promise<void> {
    if (!this.linkedPatient) {
      return;
    }

    // Find the allergy to check if it's already recorded
    const allergy = this.patientData?.allergies.find(a => a.id === allergyId);
    if (!allergy) {
      return;
    }
    if (allergy && this.isAllergyAlreadyRecorded(allergy)) {
      return; // Don't allow adding if already recorded
    }

    // Toggle selection
    if (this.selectedAllergies.has(allergyId)) {
      this.selectedAllergies.delete(allergyId);
    } else {
      const canAdd = await this.confirmConceptSelection('allergies', allergy);
      if (canAdd) {
        this.selectedAllergies.add(allergyId);
      }
    }
  }

  /**
   * Check if an allergy from IPS is already added (selected)
   */
  isAllergyAdded(allergyId: string): boolean {
    return this.selectedAllergies.has(allergyId);
  }

  /**
   * Get selected allergies from IPS (to show first in the merge list)
   */
  getSelectedIPSAllergies(): any[] {
    if (!this.patientData?.allergies) {
      return [];
    }
    
    return this.patientData.allergies.filter(allergy => 
      this.selectedAllergies.has(allergy.id)
    );
  }

  /**
   * Check if there are available allergies to add (not already recorded)
   */
  hasAvailableAllergies(): boolean {
    if (!this.patientData?.allergies || !this.linkedPatient) {
      return false;
    }
    
    return this.patientData.allergies.some(allergy => 
      !this.isAllergyAlreadyRecorded(allergy)
    );
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
    const existingImmunizations = this.patientService.getPatientImmunizations(patientId);

    this.existingPatientData = {
      conditions: existingConditions,
      procedures: existingProcedures,
      medications: existingMedications,
      immunizations: existingImmunizations
    };

    // Create import summary
    this.importSummary = {
      ipsData: {
        conditions: this.patientData.conditions.length,
        procedures: this.patientData.procedures.length,
        medications: this.patientData.medications.length,
        immunizations: this.patientData.immunizations.length,
        allergies: this.patientData.allergies.length
      },
      existingData: {
        conditions: existingConditions.length,
        procedures: existingProcedures.length,
        medications: existingMedications.length,
        immunizations: existingImmunizations.length
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
      return { conditions: [], procedures: [], medications: [], immunizations: [] };
    }

    const existingConditions = this.patientService.getPatientConditions(patientId);
    const existingProcedures = this.patientService.getPatientProcedures(patientId);
    const existingMedications = this.patientService.getPatientMedications(patientId);
    const existingImmunizations = this.patientService.getPatientImmunizations(patientId);

    return {
      conditions: this.findDuplicateConditions(this.patientData.conditions, existingConditions),
      procedures: this.findDuplicateProcedures(this.patientData.procedures, existingProcedures),
      medications: this.findDuplicateMedications(this.patientData.medications, existingMedications),
      immunizations: this.findDuplicateImmunizations(this.patientData.immunizations, existingImmunizations)
    };
  }

  /**
   * Simple text similarity check for duplicate detection
   * Uses basic word matching for performance
   */
  private simpleTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const t1 = text1.toLowerCase().trim();
    const t2 = text2.toLowerCase().trim();
    
    // Exact match
    if (t1 === t2) return 1.0;
    
    // Check if one contains the other
    if (t1.includes(t2) || t2.includes(t1)) {
      return 0.9;
    }
    
    // Word-based matching
    const words1 = t1.split(/\s+/);
    const words2 = t2.split(/\s+/);
    let matches = 0;
    
    for (const word1 of words1) {
      if (words2.includes(word1)) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
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
        return this.simpleTextSimilarity(ipsText, existingText) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsCondition,
          existing: existingMatch,
          similarity: this.simpleTextSimilarity(ipsText, existingMatch.code?.text || '')
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
        return this.simpleTextSimilarity(ipsText, existingText) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsProcedure,
          existing: existingMatch,
          similarity: this.simpleTextSimilarity(ipsText, existingMatch.code?.text || '')
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
        return this.simpleTextSimilarity(ipsText, existingText) > 0.8;
      });
      
      if (existingMatch) {
        duplicates.push({
          ips: ipsMedication,
          existing: existingMatch,
          similarity: this.simpleTextSimilarity(ipsText, existingMatch.medicationCodeableConcept?.text || '')
        });
      }
    });
    
    return duplicates;
  }

  private findDuplicateImmunizations(ipsImmunizations: any[], existingImmunizations: any[]): any[] {
    const duplicates: any[] = [];

    ipsImmunizations.forEach((ipsImmunization) => {
      const candidate = this.toClinicalEntryImmunization(ipsImmunization, this.linkedPatient?.id || 'patient');
      const existingMatch = existingImmunizations.find((existing) => this.patientService.isDuplicateImmunization([existing], candidate));

      if (existingMatch) {
        duplicates.push({
          ips: ipsImmunization,
          existing: existingMatch,
          similarity: 1
        });
      }
    });

    return duplicates;
  }

  /**
   * Proceed with data import after verification
   */
  async proceedWithImport(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }

    // Import the data
    await this.importIPSToPatient(this.linkedPatient.id, this.patientData);
    
    // Close verification dialog
    this.showDataVerification = false;
  }

  /**
   * Cancel the import process
   */
  cancelImport(): void {
    this.showDataVerification = false;
    this.linkedPatient = null;
    this.linkedPatientIsDraft = false;
    this.selectedPatientId = '';
    this.clearSelections();
  }

  /**
   * Initialize selections with everything deselected so the user opts in item by item.
   */
  private initializeSelections(): void {
    this.selectedConditions.clear();
    this.selectedProcedures.clear();
    this.selectedMedications.clear();
    this.selectedImmunizations.clear();
    this.selectedAllergies.clear();
  }

  /**
   * Clear all selections
   */
  private clearSelections(): void {
    this.selectedConditions.clear();
    this.selectedProcedures.clear();
    this.selectedMedications.clear();
    this.selectedImmunizations.clear();
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

  toggleImmunizationSelection(immunizationId: string): void {
    if (this.selectedImmunizations.has(immunizationId)) {
      this.selectedImmunizations.delete(immunizationId);
    } else {
      this.selectedImmunizations.add(immunizationId);
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
        if (!this.isProcedureAlreadyRecorded(procedure)) {
          this.selectedProcedures.add(procedure.id);
        }
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

  selectAllImmunizations(): void {
    if (this.patientData) {
      this.patientData.immunizations.forEach(immunization => {
        if (!this.isImmunizationAlreadyRecorded(immunization)) {
          this.selectedImmunizations.add(immunization.id);
        }
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

  deselectAllImmunizations(): void {
    this.selectedImmunizations.clear();
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
           this.selectedImmunizations.size > 0 || 
           this.selectedAllergies.size > 0;
  }

  /**
   * Get total count of selected items
   */
  getTotalSelectedCount(): number {
    return this.selectedConditions.size + 
           this.selectedProcedures.size + 
           this.selectedMedications.size + 
           this.selectedImmunizations.size + 
           this.selectedAllergies.size;
  }

  isMergeSectionStep(stepId: WizardStepId | undefined): stepId is MergeSectionId {
    return stepId === 'conditions' || stepId === 'procedures' || stepId === 'medications' || stepId === 'immunizations' || stepId === 'allergies';
  }

  getCurrentMergeSection(): MergeSectionId | null {
    const stepId = this.getCurrentStep()?.id;
    return this.isMergeSectionStep(stepId) ? stepId : null;
  }

  getMergeSections(): MergeSectionId[] {
    return this.wizardSteps
      .map(step => step.id)
      .filter((stepId): stepId is MergeSectionId => this.isMergeSectionStep(stepId));
  }

  getSectionTitle(section: MergeSectionId): string {
    switch (section) {
      case 'conditions':
        return 'Conditions';
      case 'procedures':
        return 'Procedures';
      case 'medications':
        return 'Medications';
      case 'immunizations':
        return 'Immunizations';
      case 'allergies':
        return 'Allergies';
    }
  }

  getWizardStepMeta(step: WizardStep, index: number): string | null {
    if (index > this.currentStepIndex || !this.linkedPatient) {
      return null;
    }

    if (step.id === 'patient') {
      return this.getPatientDisplayName(this.linkedPatient);
    }

    if (this.isMergeSectionStep(step.id)) {
      const selectedCount = this.getSelectedCount(step.id);
      const label = selectedCount === 1 ? 'code selected' : 'codes selected';
      return `${selectedCount} ${label}`;
    }

    if (step.id === 'summary') {
      const totalSelected = this.getTotalSelectedCount();
      const label = totalSelected === 1 ? 'code selected' : 'codes selected';
      return `${totalSelected} ${label}`;
    }

    return null;
  }

  getSectionItems(section: MergeSectionId): any[] {
    if (!this.patientData) {
      return [];
    }

    switch (section) {
      case 'conditions':
        return this.patientData.conditions;
      case 'procedures':
        return this.patientData.procedures;
      case 'medications':
        return this.patientData.medications;
      case 'immunizations':
        return this.patientData.immunizations;
      case 'allergies':
        return this.patientData.allergies;
    }
  }

  getExistingItems(section: MergeSectionId): any[] {
    switch (section) {
      case 'conditions':
        return this.existingConditions;
      case 'procedures':
        return this.existingProcedures;
      case 'medications':
        return this.existingMedications;
      case 'immunizations':
        return this.existingImmunizations;
      case 'allergies':
        return this.existingAllergies;
    }
  }

  getSelectedItems(section: MergeSectionId): any[] {
    return this.getSectionItems(section).filter(item => this.isItemSelected(section, item.id));
  }

  getSelectedCount(section: MergeSectionId): number {
    switch (section) {
      case 'conditions':
        return this.selectedConditions.size;
      case 'procedures':
        return this.selectedProcedures.size;
      case 'medications':
        return this.selectedMedications.size;
      case 'immunizations':
        return this.selectedImmunizations.size;
      case 'allergies':
        return this.selectedAllergies.size;
    }
  }

  getSkippedCount(section: MergeSectionId): number {
    return Math.max(this.getSectionItems(section).length - this.getSelectedCount(section), 0);
  }

  isItemSelected(section: MergeSectionId, itemId: string): boolean {
    switch (section) {
      case 'conditions':
        return this.isConditionAdded(itemId);
      case 'procedures':
        return this.isProcedureAdded(itemId);
      case 'medications':
        return this.isMedicationAdded(itemId);
      case 'immunizations':
        return this.isImmunizationAdded(itemId);
      case 'allergies':
        return this.isAllergyAdded(itemId);
    }
  }

  isItemAlreadyRecorded(section: MergeSectionId, item: any): boolean {
    switch (section) {
      case 'conditions':
        return this.isConditionAlreadyRecorded(item);
      case 'procedures':
        return this.isProcedureAlreadyRecorded(item);
      case 'medications':
        return this.isMedicationAlreadyRecorded(item);
      case 'immunizations':
        return this.isImmunizationAlreadyRecorded(item);
      case 'allergies':
        return this.isAllergyAlreadyRecorded(item);
    }
  }

  async toggleSectionSelection(section: MergeSectionId, itemId: string): Promise<void> {
    switch (section) {
      case 'conditions':
        await this.addConditionFromIPS(itemId);
        break;
      case 'procedures':
        await this.addProcedureFromIPS(itemId);
        break;
      case 'medications':
        await this.addMedicationFromIPS(itemId);
        break;
      case 'immunizations':
        await this.addImmunizationFromIPS(itemId);
        break;
      case 'allergies':
        await this.addAllergyFromIPS(itemId);
        break;
    }
  }

  hasAvailableItems(section: MergeSectionId): boolean {
    switch (section) {
      case 'conditions':
        return this.hasAvailableConditions();
      case 'procedures':
        return this.hasAvailableProcedures();
      case 'medications':
        return this.hasAvailableMedications();
      case 'immunizations':
        return this.hasAvailableImmunizations();
      case 'allergies':
        return this.hasAvailableAllergies();
    }
  }

  private async confirmConceptSelection(section: MergeSectionId, item: any): Promise<boolean> {
    const candidate = this.toRecordConcept(section, item);
    if (!candidate) {
      return true;
    }

    const dialogRef = this.dialog.open(ConceptValidationDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      disableClose: true,
      data: this.buildConceptValidationLoadingState(candidate)
    });

    try {
      const result = await this.conceptHierarchyValidationService.validateCandidateAgainstRecord(
        candidate,
        this.getExistingRecordConcepts(section),
        progress => {
          dialogRef.componentInstance.state = {
            ...dialogRef.componentInstance.state,
            loading: true,
            progressCurrent: progress.current,
            progressTotal: progress.total,
            message: progress.message
          };
        }
      );

      dialogRef.componentInstance.state = this.buildConceptValidationResultState(result);

      if (!result.hasConflict) {
        dialogRef.close(true);
        return true;
      }

      dialogRef.disableClose = false;

      return (await firstValueFrom(dialogRef.afterClosed())) === true;
    } catch (error) {
      dialogRef.componentInstance.state = {
        ...dialogRef.componentInstance.state,
        loading: false,
        message: 'We could not complete the hierarchy check. You can still add the concept if you want to continue.',
        primaryActionLabel: 'Add anyway',
        hasConflict: true,
        relations: []
      };
      dialogRef.disableClose = false;

      return (await firstValueFrom(dialogRef.afterClosed())) === true;
    }
  }

  private buildConceptValidationLoadingState(candidate: RecordConcept): ConceptValidationDialogState {
    return {
      title: 'Checking SNOMED hierarchy',
      message: 'Preparing concept hierarchy validation...',
      loading: true,
      progressCurrent: 0,
      progressTotal: 1,
      candidateLabel: `${candidate.label || candidate.code} (${candidate.code})`,
      primaryActionLabel: 'Add',
      hasConflict: false,
      relations: []
    };
  }

  private buildConceptValidationResultState(result: HierarchyValidationResult): ConceptValidationDialogState {
    const relations = result.matches.map(match => ({
      label: match.existing.label || match.existing.code,
      code: match.existing.code,
      relationLabel: this.getHierarchyRelationLabel(match)
    }));

    return {
      title: result.hasConflict ? 'Hierarchy review required' : 'Hierarchy check complete',
      message: result.hasConflict
        ? 'The selected concept overlaps hierarchically with one or more concepts already in the record. Review the relationships before deciding whether to add it.'
        : 'No hierarchical overlap was found with the existing concepts in this section.',
      loading: false,
      progressCurrent: relations.length + 1,
      progressTotal: relations.length + 1,
      candidateLabel: `${result.candidate.label || result.candidate.code} (${result.candidate.code})`,
      primaryActionLabel: result.hasConflict ? 'Add anyway' : 'Add',
      hasConflict: result.hasConflict,
      relations
    };
  }

  private getHierarchyRelationLabel(match: HierarchyMatch): string {
    switch (match.relation) {
      case 'exact-match':
        return 'Exact match';
      case 'candidate-is-ancestor':
        return 'Selected concept is broader';
      case 'candidate-is-descendant':
        return 'Selected concept is narrower';
    }
  }

  private getExistingRecordConcepts(section: MergeSectionId): RecordConcept[] {
    return this.getExistingItems(section)
      .map(item => this.toRecordConcept(section, item))
      .filter((concept): concept is RecordConcept => !!concept);
  }

  private toRecordConcept(section: MergeSectionId, item: any): RecordConcept | null {
    const code = this.patientService.extractSnomedCode(item);
    if (!code) {
      return null;
    }

    return {
      code,
      label: this.getItemDisplay(section, item),
      sourceId: item.id,
      section
    };
  }

  getItemDisplay(section: MergeSectionId, item: any): string {
    switch (section) {
      case 'conditions':
        return this.ipsReaderService.getConditionDisplay(item);
      case 'procedures':
        return this.ipsReaderService.getProcedureDisplay(item);
      case 'medications':
        return this.ipsReaderService.getMedicationDisplay(item);
      case 'immunizations':
        return item.vaccineCode?.text || item.vaccineCode?.coding?.[0]?.display || 'Immunization';
      case 'allergies':
        return this.ipsReaderService.getAllergyDisplay(item);
    }
  }

  getItemStatus(section: MergeSectionId, item: any): string {
    switch (section) {
      case 'conditions':
        return this.ipsReaderService.getConditionStatus(item);
      case 'procedures':
        return item.status || 'Unknown status';
      case 'medications':
        return this.ipsReaderService.getMedicationStatus(item);
      case 'immunizations':
        return item.status || 'Unknown status';
      case 'allergies':
        return this.ipsReaderService.getAllergySeverity(item);
    }
  }

  getItemCode(section: MergeSectionId, item: any): string {
    const snomedCode = this.patientService.extractSnomedCode(item);
    if (snomedCode) {
      return snomedCode;
    }

    switch (section) {
      case 'medications':
        return item.medicationCodeableConcept?.coding?.[0]?.code || 'No code';
      case 'immunizations':
        return item.vaccineCode?.coding?.[0]?.code || 'No code';
      default:
        return item.code?.coding?.[0]?.code || 'No code';
    }
  }

  getItemDate(section: MergeSectionId, item: any): string | null {
    switch (section) {
      case 'conditions':
        return item.onsetDateTime || item.recordedDate || null;
      case 'procedures':
        return item.performedDateTime || null;
      case 'medications':
        return item.effectiveDateTime || null;
      case 'immunizations':
        return item.occurrenceDateTime || item.recorded || null;
      case 'allergies':
        return item.recordedDate || item.onsetDateTime || null;
    }
  }

  getItemDateLabel(section: MergeSectionId): string {
    switch (section) {
      case 'conditions':
        return 'Onset';
      case 'procedures':
        return 'Performed';
      case 'medications':
        return 'Effective';
      case 'immunizations':
        return 'Occurrence';
      case 'allergies':
        return 'Recorded';
    }
  }

  getSummarySubtitle(): string {
    if (!this.linkedPatient) {
      return 'Link a patient to review the final import summary.';
    }

    if (this.linkedPatientIsDraft && !this.hasSelectedItems()) {
      return `Ready to create a new patient record for ${this.getPatientDisplayName(this.linkedPatient)}.`;
    }

    if (this.linkedPatientIsDraft) {
      return `Ready to create a new patient record and import ${this.getTotalSelectedCount()} selected IPS items into ${this.getPatientDisplayName(this.linkedPatient)}.`;
    }

    return `Ready to import ${this.getTotalSelectedCount()} selected IPS items into ${this.getPatientDisplayName(this.linkedPatient)}.`;
  }

  private toClinicalEntryCondition(condition: any, patientId: string): any {
    const snomedCode = this.patientService.extractSnomedCode(condition);
    const display = this.ipsReaderService.getConditionDisplay(condition) || condition.code?.text || 'Unknown condition';
    return this.patientService.createConditionFromClinicalEntryConcept(patientId, {
      code: snomedCode || undefined,
      display
    }, {
      dateTime: condition.onsetDateTime || condition.recordedDate
    });
  }

  private toClinicalEntryProcedure(procedure: any, patientId: string): any {
    const snomedCode = this.patientService.extractSnomedCode(procedure);
    const display = this.ipsReaderService.getProcedureDisplay(procedure) || procedure.code?.text || 'Unknown procedure';
    return this.patientService.createProcedureFromClinicalEntryConcept(patientId, {
      code: snomedCode || undefined,
      display
    }, {
      dateTime: procedure.performedDateTime || procedure.performedPeriod?.start
    });
  }

  private toClinicalEntryMedication(medication: any, patientId: string): any {
    const snomedCode = this.patientService.extractSnomedCode(medication);
    const display = this.ipsReaderService.getMedicationDisplay(medication) || medication.medicationCodeableConcept?.text || 'Medication';
    return this.patientService.createMedicationFromClinicalEntryConcept(patientId, {
      code: snomedCode || undefined,
      display
    }, {
      effectiveDateTime: medication.effectiveDateTime || medication.effectivePeriod?.start,
      reasonReference: medication.reasonReference
    });
  }

  private toClinicalEntryImmunization(immunization: any, patientId: string): Immunization {
    const snomedCode = this.patientService.extractSnomedCode(immunization);
    const display = immunization.vaccineCode?.text || immunization.vaccineCode?.coding?.[0]?.display || 'Immunization';
    return this.patientService.createImmunizationFromClinicalEntryConcept(patientId, {
      code: snomedCode || undefined,
      display
    }, {
      occurrenceDateTime: immunization.occurrenceDateTime || immunization.recorded,
      status: this.convertImmunizationStatus(immunization.status)
    });
  }

  private toClinicalEntryAllergy(allergy: any, patientId: string): any {
    const snomedCode = this.patientService.extractSnomedCode(allergy);
    const display = this.ipsReaderService.getAllergyDisplay(allergy) || allergy.code?.text || 'Allergy';
    return this.patientService.createAllergyFromClinicalEntryConcept(patientId, {
      code: snomedCode || undefined,
      display
    }, {
      recordedDate: allergy.recordedDate || allergy.onsetDateTime
    });
  }

  private async buildSelectedConditions(patientId: string, selectedConditionsData: any[]): Promise<any[]> {
    const convertedConditions: any[] = [];

    for (const condition of selectedConditionsData) {
      const snomedCode = this.patientService.extractSnomedCode(condition);
      let computedLocation: string | undefined;

      if (snomedCode) {
        try {
          computedLocation = await this.calculateAnatomicLocation(snomedCode);
        } catch (error) {
          console.warn('Could not calculate anatomic location for SNOMED code:', snomedCode, error);
          computedLocation = 'systemic';
        }
      }

      convertedConditions.push({
        ...this.toClinicalEntryCondition(condition, patientId),
        computedLocation: computedLocation || 'systemic'
      });
    }

    return convertedConditions;
  }

  private buildSelectedProcedures(patientId: string, selectedProceduresData: any[]): any[] {
    return selectedProceduresData.map((procedure) => this.toClinicalEntryProcedure(procedure, patientId));
  }

  private buildSelectedMedications(patientId: string, selectedMedicationsData: any[]): any[] {
    return selectedMedicationsData.map((medication) => this.toClinicalEntryMedication(medication, patientId));
  }

  private buildSelectedImmunizations(patientId: string, selectedImmunizationsData: any[]): Immunization[] {
    return selectedImmunizationsData.map((immunization) => this.toClinicalEntryImmunization(immunization, patientId));
  }

  private buildSelectedAllergies(patientId: string, selectedAllergiesData: any[]): any[] {
    return selectedAllergiesData.map((allergy) => this.toClinicalEntryAllergy(allergy, patientId));
  }

  private async buildSelectedImportPayload(
    patientId: string,
    options: { conditions?: boolean; procedures?: boolean; medications?: boolean; immunizations?: boolean; allergies?: boolean }
  ): Promise<{
    conditions: any[];
    procedures: any[];
    medications: any[];
    immunizations: Immunization[];
    allergies: any[];
    provenance: Provenance[];
  }> {
    if (!this.patientData) {
      return {
        conditions: [],
        procedures: [],
        medications: [],
        immunizations: [],
        allergies: [],
        provenance: []
      };
    }

    const selectedConditionsData = options.conditions
      ? this.patientData.conditions.filter(
          condition => this.selectedConditions.has(condition.id) && !this.isConditionAlreadyRecorded(condition)
        )
      : [];
    const selectedProceduresData = options.procedures
      ? this.patientData.procedures.filter(
          procedure => this.selectedProcedures.has(procedure.id) && !this.isProcedureAlreadyRecorded(procedure)
        )
      : [];
    const selectedMedicationsData = options.medications
      ? this.patientData.medications.filter(
          medication => this.selectedMedications.has(medication.id) && !this.isMedicationAlreadyRecorded(medication)
        )
      : [];
    const selectedImmunizationsData = options.immunizations
      ? this.patientData.immunizations.filter(
          immunization => this.selectedImmunizations.has(immunization.id) && !this.isImmunizationAlreadyRecorded(immunization)
        )
      : [];
    const selectedAllergiesData = options.allergies
      ? this.patientData.allergies.filter(
          allergy => this.selectedAllergies.has(allergy.id) && !this.isAllergyAlreadyRecorded(allergy)
        )
      : [];

    const conditions = await this.buildSelectedConditions(patientId, selectedConditionsData);
    const procedures = this.buildSelectedProcedures(patientId, selectedProceduresData);
    const medications = this.buildSelectedMedications(patientId, selectedMedicationsData);
    const immunizations = this.buildSelectedImmunizations(patientId, selectedImmunizationsData);
    const allergies = this.buildSelectedAllergies(patientId, selectedAllergiesData);
    const sourceBundle = this.patientData.sourceBundle;
    const provenance = [
      ...conditions,
      ...procedures,
      ...medications,
      ...immunizations,
      ...allergies
    ].map((resource: any) => this.patientService.buildIpsImportProvenance(patientId, resource, sourceBundle));

    return {
      conditions,
      procedures,
      medications,
      immunizations,
      allergies,
      provenance
    };
  }

  private async importSelectedClinicalItems(patientId: string): Promise<number> {
    return this.importSelectedClinicalItemsBySection(patientId, {
      conditions: true,
      procedures: true,
      medications: true,
      immunizations: true,
      allergies: true
    });
  }

  private async importSelectedClinicalItemsBySection(
    patientId: string,
    options: { conditions?: boolean; procedures?: boolean; medications?: boolean; immunizations?: boolean; allergies?: boolean }
  ): Promise<number> {
    if (!this.patientData) {
      return 0;
    }

    const payload = await this.buildSelectedImportPayload(patientId, options);

    if (
      this.patientService.getCurrentPersistenceMode() === 'fhir' &&
      (
        payload.conditions.length > 0 ||
        payload.procedures.length > 0 ||
        payload.medications.length > 0 ||
        payload.immunizations.length > 0 ||
        payload.allergies.length > 0
      )
    ) {
      await this.patientService.saveAiAssistedEntryTransaction(patientId, {
        encounter: null,
        conditions: payload.conditions,
        procedures: payload.procedures,
        medications: payload.medications,
        immunizations: payload.immunizations,
        allergies: payload.allergies,
        provenance: payload.provenance
      });

      return payload.conditions.length + payload.procedures.length + payload.medications.length + payload.immunizations.length + payload.allergies.length;
    }

    let importedCount = 0;

    for (const condition of payload.conditions) {
      const success = await this.patientService.addPatientConditionEnriched(patientId, condition);
      if (success) {
        await this.patientService.createPatientProvenance(
          patientId,
          this.patientService.buildIpsImportProvenance(patientId, condition, this.patientData.sourceBundle)
        );
        importedCount++;
      }
    }

    for (const procedure of payload.procedures) {
      const success = await this.patientService.addPatientProcedureEnriched(patientId, procedure);
      if (success) {
        await this.patientService.createPatientProvenance(
          patientId,
          this.patientService.buildIpsImportProvenance(patientId, procedure, this.patientData.sourceBundle)
        );
        importedCount++;
      }
    }

    for (const medication of payload.medications) {
      const success = await this.patientService.addPatientMedicationEnriched(patientId, medication);
      if (success) {
        await this.patientService.createPatientProvenance(
          patientId,
          this.patientService.buildIpsImportProvenance(patientId, medication, this.patientData.sourceBundle)
        );
        importedCount++;
      }
    }

    for (const immunization of payload.immunizations) {
      const success = this.patientService.addPatientImmunization(patientId, immunization);
      if (success) {
        await this.patientService.createPatientProvenance(
          patientId,
          this.patientService.buildIpsImportProvenance(patientId, immunization, this.patientData.sourceBundle)
        );
        importedCount++;
      }
    }

    for (const allergy of payload.allergies) {
      const success = this.patientService.addPatientAllergy(patientId, allergy as any);
      if (success) {
        await this.patientService.createPatientProvenance(
          patientId,
          this.patientService.buildIpsImportProvenance(patientId, allergy, this.patientData.sourceBundle)
        );
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * Import all selected items at once
   */
  async importAllSelectedItems(): Promise<void> {
    if (!this.linkedPatient || !this.patientData || this.isImporting) {
      return;
    }

    this.isImporting = true;
    let importedCount = 0;
    try {
      if (this.linkedPatientIsDraft) {
        if (this.hasSelectedItems()) {
          const patientId = this.linkedPatient.id;
          const importPayload = await this.buildSelectedImportPayload(patientId, {
            conditions: true,
            procedures: true,
            medications: true,
            immunizations: true,
            allergies: true
          });

          const savedPackage = await this.patientService.addPatientClinicalPackage(this.linkedPatient, {
            conditions: importPayload.conditions,
            procedures: importPayload.procedures,
            medications: importPayload.medications,
            immunizations: importPayload.immunizations,
            allergies: importPayload.allergies,
            provenance: importPayload.provenance
          });

          this.linkedPatient = savedPackage.patient;
          this.linkedPatientIsDraft = false;
          this.selectedPatientId = savedPackage.patient.id;
          importedCount = savedPackage.conditions.length + savedPackage.procedures.length + savedPackage.medications.length + savedPackage.immunizations.length + savedPackage.allergies.length;
        } else {
          const savedPatient = await this.patientService.addPatient(this.linkedPatient);
          this.linkedPatient = savedPatient;
          this.linkedPatientIsDraft = false;
          this.selectedPatientId = savedPatient.id;
        }
      } else {
        importedCount += await this.importSelectedClinicalItems(this.linkedPatient.id);
      }

      // Clear all selections after import
      this.clearSelections();

      // Navigate to clinical record with patient ID
      const navigated = await this.router.navigate(['/clinical-record', this.linkedPatient.id]);
      if (!navigated) {
        this.isImporting = false;
      }
    } catch (error) {
      console.error('Error importing selected items:', error);
      this.snackBar.open(
        error instanceof Error ? `Import failed: ${error.message}` : 'Import failed. Please try again.',
        'Close',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
      this.isImporting = false;
    }
  }

  async openLinkedPatientRecord(): Promise<void> {
    if (!this.linkedPatient || this.linkedPatientIsDraft || this.isImporting) {
      return;
    }

    await this.router.navigate(['/clinical-record', this.linkedPatient.id]);
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
        this.validateIPSBundleOrThrow(bundle);
        this.processIPSBundleObject(bundle, 'uploaded file');
      } catch (parseError) {
        this.error = parseError instanceof Error
          ? parseError.message
          : 'Invalid JSON file. Please check the file format.';
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

  async startShlQrScan(): Promise<void> {
    this.error = null;
    this.shlScanError = null;

    if (this.isShlScanning) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.shlScanError = 'Camera access is not supported in this browser.';
      return;
    }

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      this.shlScanError = 'QR scanning requires BarcodeDetector support in this browser.';
      return;
    }

    try {
      this.isShlScanning = true;
      this.shlScanInProgress = false;

      this.shlScanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      const videoElement = this.shlScannerVideo?.nativeElement;
      if (!videoElement) {
        throw new Error('Scanner video element is not available.');
      }

      videoElement.srcObject = this.shlScanStream;
      await videoElement.play();

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      this.shlScanIntervalId = window.setInterval(() => {
        void this.scanShlFrame(detector, videoElement);
      }, 250);
    } catch (error) {
      this.stopShlQrScan();
      this.shlScanError = error instanceof Error
        ? error.message
        : 'Unable to start QR scanner.';
    }
  }

  stopShlQrScan(): void {
    this.isShlScanning = false;
    this.shlScanInProgress = false;

    if (this.shlScanIntervalId !== null) {
      window.clearInterval(this.shlScanIntervalId);
      this.shlScanIntervalId = null;
    }

    const videoElement = this.shlScannerVideo?.nativeElement;
    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }

    if (this.shlScanStream) {
      this.shlScanStream.getTracks().forEach(track => track.stop());
      this.shlScanStream = null;
    }
  }

  private async scanShlFrame(detector: any, videoElement: HTMLVideoElement): Promise<void> {
    if (!this.isShlScanning || this.shlScanInProgress || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      this.shlScanInProgress = true;
      const detectedCodes = await detector.detect(videoElement);
      const firstCode = detectedCodes?.[0];
      const rawValue = firstCode?.rawValue;

      if (rawValue) {
        this.stopShlQrScan();
        await this.resolveShlAndLoadIPS(rawValue);
      }
    } catch {
      // Keep scanning; transient detection failures are expected.
    } finally {
      this.shlScanInProgress = false;
    }
  }

  private async resolveShlAndLoadIPS(rawQrValue: string): Promise<void> {
    this.isShlResolving = true;
    this.isLoading = true;
    this.error = null;
    this.shlScanError = null;

    try {
      const shlinkPayload = this.parseShlinkPayload(rawQrValue);
      const bundle = await this.fetchBundleFromShl(shlinkPayload.url, shlinkPayload.key);
      this.validateIPSBundleOrThrow(bundle);
      this.processIPSBundleObject(bundle, 'SHL');
    } catch (error) {
      this.isLoading = false;
      this.error = error instanceof Error ? error.message : 'Failed to load IPS from SHL.';
    } finally {
      this.isShlResolving = false;
    }
  }

  private parseShlinkPayload(rawQrValue: string): { url: string; key?: string } {
    if (!rawQrValue.startsWith('shlink:/')) {
      throw new Error('Scanned QR is not a SMART Health Link (shlink:/...).');
    }

    const encodedPayload = rawQrValue.slice('shlink:/'.length).replace(/^\/+/, '');
    if (!encodedPayload) {
      throw new Error('SHL payload is empty.');
    }

    const payloadText = this.decodeBase64UrlToText(encodedPayload);
    const payload = JSON.parse(payloadText);

    if (!payload?.url || typeof payload.url !== 'string') {
      throw new Error('SHL payload does not contain a valid manifest URL.');
    }

    if (payload.key !== undefined && typeof payload.key !== 'string') {
      throw new Error('SHL payload key must be a base64url string.');
    }

    return { url: payload.url, key: payload.key };
  }

  private decodeBase64UrlToText(base64Url: string): string {
    return new TextDecoder().decode(this.decodeBase64UrlToBytes(base64Url));
  }

  private decodeBase64UrlToBytes(base64Url: string): Uint8Array {
    const base64 = base64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  private async fetchBundleFromShl(manifestUrl: string, shlKey?: string): Promise<any> {
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Unable to download SHL manifest (${manifestResponse.status}).`);
    }

    const manifest = await manifestResponse.json();
    const files = Array.isArray(manifest?.files) ? manifest.files : [];
    if (files.length === 0) {
      throw new Error('SHL manifest does not contain files to retrieve.');
    }

    const firstFile = files[0];
    if (!firstFile?.location || typeof firstFile.location !== 'string') {
      throw new Error('This demo currently supports SHL manifests with files[].location only.');
    }

    const resourceUrl = new URL(firstFile.location, manifestUrl).toString();
    const resourceResponse = await fetch(resourceUrl);
    if (!resourceResponse.ok) {
      throw new Error(`Unable to download SHL file (${resourceResponse.status}).`);
    }

    const resourceText = await resourceResponse.text();
    const trimmedContent = resourceText.trim();

    if (this.isCompactJwe(trimmedContent)) {
      if (!shlKey) {
        throw new Error('SHL payload does not include a decryption key for JWE content.');
      }
      const decryptedPayload = await this.decryptCompactJwe(trimmedContent, shlKey);
      return JSON.parse(decryptedPayload);
    }

    return JSON.parse(resourceText);
  }

  private isCompactJwe(content: string): boolean {
    const parts = content.split('.');
    return parts.length === 5 && parts[0].length > 0;
  }

  private async decryptCompactJwe(compactJwe: string, keyBase64Url: string): Promise<string> {
    const parts = compactJwe.split('.');
    if (parts.length !== 5) {
      throw new Error('Invalid Compact JWE format.');
    }

    const [protectedHeaderB64, encryptedKeyB64, ivB64, ciphertextB64, tagB64] = parts;
    if (encryptedKeyB64 !== '') {
      throw new Error('Only direct encryption (alg=dir) is supported in this demo.');
    }

    const protectedHeaderText = this.decodeBase64UrlToText(protectedHeaderB64);
    const protectedHeader = JSON.parse(protectedHeaderText);
    if (protectedHeader.alg !== 'dir' || protectedHeader.enc !== 'A256GCM') {
      throw new Error('Unsupported JWE algorithm. Expected alg=dir and enc=A256GCM.');
    }

    const keyBytes = this.decodeBase64UrlToBytes(keyBase64Url);
    if (keyBytes.byteLength !== 32) {
      throw new Error('Invalid SHL key length. Expected 32 bytes for A256GCM.');
    }

    const iv = this.decodeBase64UrlToBytes(ivB64);
    const ciphertext = this.decodeBase64UrlToBytes(ciphertextB64);
    const tag = this.decodeBase64UrlToBytes(tagB64);
    const encryptedPayload = this.concatUint8Arrays(ciphertext, tag);
    const aad = new TextEncoder().encode(protectedHeaderB64);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(keyBytes),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(iv),
        additionalData: this.toArrayBuffer(aad),
        tagLength: 128
      },
      cryptoKey,
      this.toArrayBuffer(encryptedPayload)
    );

    return new TextDecoder().decode(new Uint8Array(decryptedBuffer));
  }

  private concatUint8Arrays(first: Uint8Array, second: Uint8Array): Uint8Array {
    const combined = new Uint8Array(first.length + second.length);
    combined.set(first, 0);
    combined.set(second, first.length);
    return combined;
  }

  private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  private validateIPSBundleOrThrow(bundle: any): void {
    if (!bundle || bundle.resourceType !== 'Bundle') {
      throw new Error('The retrieved file is not a FHIR Bundle.');
    }

    if (bundle.type !== 'document') {
      throw new Error('The retrieved Bundle is not an IPS document bundle (Bundle.type must be "document").');
    }

    if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
      throw new Error('The retrieved Bundle has no entries.');
    }

    const hasPatient = bundle.entry.some((entry: any) => entry?.resource?.resourceType === 'Patient');
    const hasComposition = bundle.entry.some((entry: any) => entry?.resource?.resourceType === 'Composition');

    if (!hasPatient || !hasComposition) {
      throw new Error('The retrieved Bundle does not look like an IPS document (missing Patient or Composition).');
    }
  }

  private processIPSBundleObject(bundle: any, sourceLabel: string): void {
    this.ipsReaderService.processIPSBundleFromObject(bundle).subscribe({
      next: (data) => {
        this.patientData = data;
        this.isLoading = false;
        this.resetWizard();
        this.calculateAndSortPatientsByScore();
        this.findSuggestedPatient();
        this.fileInput.nativeElement.value = '';
      },
      error: (error) => {
        this.error = `Failed to parse IPS bundle from ${sourceLabel}: ${error.message}`;
        this.isLoading = false;
        this.fileInput.nativeElement.value = '';
      }
    });
  }

  /**
   * Import IPS data to patient (only selected items)
   */
  private async importIPSToPatient(patientId: string, _ipsData: ProcessedPatientData): Promise<void> {
    await this.importSelectedClinicalItems(patientId);
  }

  /**
   * Import selected conditions only
   */
  async importSelectedConditions(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }
    await this.importSelectedClinicalItemsBySection(this.linkedPatient.id, { conditions: true });

    // Clear selections after import
    this.selectedConditions.clear();
    
  }

  /**
   * Import selected procedures only
   */
  async importSelectedProcedures(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }
    await this.importSelectedClinicalItemsBySection(this.linkedPatient.id, { procedures: true });

    // Clear selections after import
    this.selectedProcedures.clear();
    
  }

  /**
   * Import selected medications only
   */
  async importSelectedMedications(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }
    await this.importSelectedClinicalItemsBySection(this.linkedPatient.id, { medications: true });

    // Clear selections after import
    this.selectedMedications.clear();
    
  }

  async importSelectedImmunizations(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }
    await this.importSelectedClinicalItemsBySection(this.linkedPatient.id, { immunizations: true });

    this.selectedImmunizations.clear();
  }

  /**
   * Import selected allergies only
   */
  async importSelectedAllergies(): Promise<void> {
    if (!this.linkedPatient || !this.patientData) {
      return;
    }
    await this.importSelectedClinicalItemsBySection(this.linkedPatient.id, { allergies: true });

    // Clear selections after import
    this.selectedAllergies.clear();
    
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

  private convertImmunizationStatus(status: string | undefined): "completed" | "entered-in-error" | "not-done" {
    if (status === 'entered-in-error' || status === 'not-done') {
      return status;
    }

    return 'completed';
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
