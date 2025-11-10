import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { PatientService, Patient } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { Subscription } from 'rxjs';

// FHIR Encounter Resource Interface
export interface Encounter {
  resourceType: 'Encounter';
  id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  period: {
    start: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  diagnosis?: Array<{
    condition: {
      reference: string;
      display?: string;
    };
    use?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    rank?: number;
  }>;
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference: string;
    };
  }>;
  // Additional property for display purposes (not part of FHIR spec)
  linkedProcedures?: Procedure[];
}

// FHIR Condition Resource Interface (enhanced)
export interface Condition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  verificationStatus?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  severity?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  bodySite?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: {
    reference: string;
  };
  asserter?: {
    reference: string;
  };
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference: string;
    };
  }>;
}

// FHIR Procedure Resource Interface (enhanced)
export interface Procedure {
  resourceType: 'Procedure';
  id: string;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  encounter?: {
    reference: string;
    display?: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start: string;
    end?: string;
  };
  bodySite?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  outcome?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  report?: Array<{
    reference: string;
  }>;
  complication?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  followUp?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  }>;
  note?: Array<{
    text: string;
    time?: string;
    authorReference?: {
      reference: string;
    };
  }>;
}

@Component({
  selector: 'app-encounter-record',
  templateUrl: './encounter-record.component.html',
  styleUrls: ['./encounter-record.component.css'],
  standalone: false
})
export class EncounterRecordComponent implements OnInit, OnDestroy {
  @Input() patient: Patient | null = null;
  @Output() conditionAdded = new EventEmitter<Condition>();
  @Output() procedureAdded = new EventEmitter<Procedure>();
  
  currentDate = new Date();
  private subscriptions: Subscription[] = [];
  
  // Form data
  encounterDate: string = '';
  encounterTime: string = '';
  
  // Multiple entries support
  reasonsForEncounter: any[] = [];
  currentReasonForEncounter: any = null;
  
  diagnoses: Array<{concept: any, note: string}> = [];
  currentDiagnosis: any = null;
  currentDiagnosisNote: string = '';
  
  procedures: Array<{concept: any, laterality: string}> = [];
  currentProcedure: any = null;
  currentProcedureLaterality: string = '';
  
  encounterNotes: string = '';
  
  // Current encounter ID for linking procedures
  currentEncounterId: string = '';
  
  // Loading states
  isSaving = false;
  
  // Track if laterality should be enabled for current procedure
  isLateralityEnabled = false;
  
  // SNOMED ECL bindings for different fields
  readonly bindings = {
    reasonForEncounter: {
      ecl: '< 404684003 |Clinical finding| OR < 71388002 |Procedure| OR < 243796009 |Situation with explicit context| OR < 272379006 |Event|',
      title: 'Reason for Encounter',
      note: 'Search for the primary reason for this encounter'
    },
    diagnosis: {
      ecl: '< 404684003 |Clinical finding|',
      title: 'Diagnosis',
      note: 'Search for diagnosis using SNOMED CT'
    },
    procedure: {
      ecl: '< 71388002 |Procedure|',
      title: 'Procedure',
      note: 'Search for procedure using SNOMED CT'
    }
  };

  // Laterality options
  lateralityOptions = [
    { value: '', display: 'Not specified' },
    { value: '7771000', display: 'Left' },
    { value: '24028007', display: 'Right' },
    { value: '51440002', display: 'Bilateral' }
  ];

  previousEncounters: Encounter[] = [];

  constructor(
    private patientService: PatientService,
    private terminologyService: TerminologyService
  ) { 
    // Initialize with current date and time
    const now = new Date();
    this.encounterDate = now.toISOString().split('T')[0];
    this.encounterTime = now.toTimeString().split(' ')[0].substring(0, 5);
  }

  ngOnInit(): void {
    // Subscribe to patient changes to reload encounters when patient data changes
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.patient = patient;
        if (patient) {
          this.loadPreviousEncounters();
        }
      })
    );

    // If patient is already provided as input, load encounters immediately
    if (this.patient) {
      this.loadPreviousEncounters();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

  getFormattedDateTime(): string {
    if (!this.encounterDate || !this.encounterTime) return '';
    const date = new Date(`${this.encounterDate}T${this.encounterTime}`);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  onReasonForEncounterSelected(concept: any): void {
    this.currentReasonForEncounter = concept;
  }

  addReasonForEncounter(): void {
    if (this.currentReasonForEncounter && !this.reasonsForEncounter.find(r => r.code === this.currentReasonForEncounter.code)) {
      this.reasonsForEncounter.push({...this.currentReasonForEncounter});
      this.currentReasonForEncounter = null;
    }
  }

  removeReasonForEncounter(index: number): void {
    this.reasonsForEncounter.splice(index, 1);
  }

  onDiagnosisSelected(concept: any): void {
    this.currentDiagnosis = concept;
  }

  addDiagnosis(): void {
    if (this.currentDiagnosis && !this.diagnoses.find(d => d.concept.code === this.currentDiagnosis.code)) {
      this.diagnoses.push({
        concept: {...this.currentDiagnosis},
        note: this.currentDiagnosisNote
      });
      this.currentDiagnosis = null;
      this.currentDiagnosisNote = '';
    }
  }

  removeDiagnosis(index: number): void {
    this.diagnoses.splice(index, 1);
  }

  onProcedureSelected(concept: any): void {
    this.currentProcedure = concept;
    this.checkLateralityEligibility(concept);
  }

  addProcedure(): void {
    if (this.currentProcedure && !this.procedures.find(p => p.concept.code === this.currentProcedure.code)) {
      this.procedures.push({
        concept: {...this.currentProcedure},
        laterality: this.currentProcedureLaterality
      });
      this.currentProcedure = null;
      this.currentProcedureLaterality = '';
      this.isLateralityEnabled = false;
    }
  }

  removeProcedure(index: number): void {
    this.procedures.splice(index, 1);
  }

  private async checkLateralityEligibility(procedure: any): Promise<void> {
    if (!procedure || !procedure.code) {
      this.isLateralityEnabled = false;
      return;
    }

    try {
      // Check if the procedure has body structure targets that are lateralizable
      const isLateralizable = await this.isProcedureLateralizable(procedure);
      this.isLateralityEnabled = isLateralizable;
      
      // Clear laterality if not eligible
      if (!isLateralizable) {
        this.currentProcedureLaterality = '';
      }
    } catch (error) {
      this.isLateralityEnabled = false;
    }
  }

  private async isProcedureLateralizable(procedureConcept: any): Promise<boolean> {
    if (!procedureConcept || !procedureConcept.code) {
      return false;
    }

    try {
      // Build ECL expression to check if the procedure has body structure targets
      // that are members of the lateralizable body structures reference set
      const ecl = `(${procedureConcept.code} |${procedureConcept.display}| . << 363704007 |Procedure site|) AND (^723264001 |Lateralizable body structure reference set (foundation metadata concept)|)`;
      
      // Use terminology service to expand the ECL
      const response = await this.terminologyService.expandValueSet(ecl, '', 0, 10).toPromise();
      
      // If we have any results, the procedure is lateralizable
      const hasResults = response && 
                        response.expansion && 
                        response.expansion.contains && 
                        response.expansion.contains.length > 0;
      
      return hasResults;
    } catch (error) {
      return false;
    }
  }

  clearCurrentReasonForEncounter(): void {
    this.currentReasonForEncounter = null;
  }

  clearCurrentDiagnosis(): void {
    this.currentDiagnosis = null;
    this.currentDiagnosisNote = '';
  }

  clearCurrentProcedure(): void {
    this.currentProcedure = null;
    this.currentProcedureLaterality = '';
    this.isLateralityEnabled = false;
  }

  async saveEncounter(): Promise<void> {
    if (!this.patient || this.isSaving) return;

    this.isSaving = true;
    
    try {
      // Build reasonCode array from multiple reasons
      const reasonCode = this.reasonsForEncounter.length > 0 
        ? this.reasonsForEncounter.map(reason => ({
            coding: [{
              system: 'http://snomed.info/sct',
              code: reason.code,
              display: reason.display
            }],
            text: reason.display
          }))
        : undefined;

      // Build diagnosis array from multiple diagnoses
      const diagnosis = this.diagnoses.length > 0
        ? this.diagnoses.map((diag, index) => ({
            condition: {
              reference: `Condition/${this.generateId()}`,
              display: diag.concept.display
            },
            use: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
                display: 'Active'
              }]
            },
            rank: index + 1
          }))
        : undefined;

      const encounterRecord: Encounter = {
        resourceType: 'Encounter',
        id: this.generateId(),
        status: 'finished',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
          display: 'Ambulatory'
        },
        subject: {
          reference: `Patient/${this.patient.id}`
        },
        period: {
          start: `${this.encounterDate}T${this.encounterTime}:00Z`
        },
        reasonCode,
        diagnosis,
        note: this.encounterNotes ? [{
          text: this.encounterNotes
        }] : undefined
      };

      // Set current encounter ID for linking procedures
      this.currentEncounterId = encounterRecord.id;

      // Save to localStorage for persistence
      this.saveEncounterToStorage(encounterRecord);

      // Emit events for all diagnoses
      for (const diag of this.diagnoses) {
        await this.addConditionFromDiagnosis(diag.concept, diag.note);
      }

      // Emit events for all procedures
      for (const proc of this.procedures) {
        await this.addProcedureFromEncounter(proc.concept, proc.laterality);
      }

      // Reset form
      this.resetForm();

      // Reload encounters to reflect the new encounter
      // The subscription will handle updating previousEncounters

    } catch (error) {
      alert('Error saving encounter record. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  private async addConditionFromDiagnosis(diagnosisConcept: any, note: string): Promise<void> {
    if (!diagnosisConcept || !this.patient) return;

    const newCondition: Condition = {
      resourceType: 'Condition',
      id: this.generateId(),
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: diagnosisConcept.code,
          display: diagnosisConcept.display
        }],
        text: diagnosisConcept.display
      },
      subject: {
        reference: `Patient/${this.patient.id}`
      },
      onsetDateTime: `${this.encounterDate}T${this.encounterTime}:00Z`,
      recordedDate: new Date().toISOString(),
      note: note ? [{
        text: note
      }] : undefined
    };

    // Emit the condition event - let the parent component (clinical-record) handle saving
    // This ensures consistent duplicate detection and single source of truth for condition storage
    this.conditionAdded.emit(newCondition);
  }

  private async addProcedureFromEncounter(procedureConcept: any, laterality: string): Promise<void> {
    if (!procedureConcept || !this.patient) return;

    const newProcedure: Procedure = {
      resourceType: 'Procedure',
      id: this.generateId(),
      status: 'completed',
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: procedureConcept.code,
          display: procedureConcept.display
        }],
        text: procedureConcept.display
      },
      subject: {
        reference: `Patient/${this.patient.id}`
      },
      encounter: {
        reference: `Encounter/${this.currentEncounterId}`
      },
      performedDateTime: `${this.encounterDate}T${this.encounterTime}:00Z`,
      bodySite: laterality ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: laterality,
          display: this.lateralityOptions.find(opt => opt.value === laterality)?.display || ''
        }],
        text: this.lateralityOptions.find(opt => opt.value === laterality)?.display || ''
      }] : undefined
    };

    // Emit the procedure event - let the parent component (clinical-record) handle saving
    // This ensures consistent duplicate detection and single source of truth for procedure storage
    this.procedureAdded.emit(newProcedure);
  }

  private saveEncounterToStorage(encounter: Encounter): void {
    // Use PatientService method to ensure consistent storage
    const patientId = encounter.subject.reference.split('/')[1];
    this.patientService.addPatientEncounter(patientId, encounter);
  }



  private getEncountersFromStorage(patientId: string): Encounter[] {
    // Use the same storage key format as PatientService
    return this.patientService.getPatientEncounters(patientId);
  }



  resetForm(): void {
    const now = new Date();
    this.encounterDate = now.toISOString().split('T')[0];
    this.encounterTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    // Clear arrays
    this.reasonsForEncounter = [];
    this.diagnoses = [];
    this.procedures = [];
    
    // Clear current selections
    this.currentReasonForEncounter = null;
    this.currentDiagnosis = null;
    this.currentDiagnosisNote = '';
    this.currentProcedure = null;
    this.currentProcedureLaterality = '';
    this.isLateralityEnabled = false;
    
    this.encounterNotes = '';
  }

  private generateId(): string {
    // Add microsecond precision and ensure uniqueness
    return 'enc-' + Date.now() + '-' + performance.now().toString().replace('.', '') + '-' + Math.random().toString(36).substr(2, 9);
  }

  isFormValid(): boolean {
    return !!(this.encounterDate && this.encounterTime && 
             (this.reasonsForEncounter.length > 0 || 
              this.diagnoses.length > 0 || 
              this.procedures.length > 0 || 
              this.encounterNotes.trim()));
  }

  loadPreviousEncounters(): void {
    if (this.patient) {
      this.previousEncounters = this.getEncountersFromStorage(this.patient.id);
      
      // Sort encounters by date in descending order (newest first)
      this.previousEncounters.sort((a, b) => {
        const dateA = new Date(a.period.start);
        const dateB = new Date(b.period.start);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Enhance encounters with linked procedures and diagnosis display terms
      this.previousEncounters.forEach(encounter => {
        this.addLinkedProceduresToEncounter(encounter);
        this.enhanceDiagnosisDisplay(encounter);
      });
    }
  }

  refreshEncounterDisplay(): void {
    // Re-enhance all encounters with updated procedure links
    this.previousEncounters.forEach(encounter => {
      this.addLinkedProceduresToEncounter(encounter);
    });
  }

  private addLinkedProceduresToEncounter(encounter: Encounter): void {
    // Get procedures that reference this encounter
    const linkedProcedures = this.getProceduresForEncounter(encounter.id);
    // Add procedures to encounter object for display purposes
    (encounter as any).linkedProcedures = linkedProcedures;
  }

  private enhanceDiagnosisDisplay(encounter: Encounter): void {
    // Enhance diagnosis with display terms if they're missing
    if (encounter.diagnosis) {
      encounter.diagnosis.forEach(diagnosis => {
        if (diagnosis.condition && !diagnosis.condition.display) {
          // Try to extract display from reference if it's a SNOMED CT concept
          const reference = diagnosis.condition.reference;
          if (reference && reference.includes('Condition/')) {
            // For now, we'll use a fallback display
            // In a real implementation, you might want to look up the concept
            diagnosis.condition.display = 'Diagnosis (details not available)';
          }
        }
      });
    }
  }

  private getProceduresForEncounter(encounterId: string): Procedure[] {
    if (!this.patient) return [];
    
    // Get procedures from patient service
    const patientProcedures = this.patientService.getPatientProcedures(this.patient.id);
    if (patientProcedures && patientProcedures.length > 0) {
      return patientProcedures.filter(proc => 
        proc.encounter && proc.encounter.reference === `Encounter/${encounterId}`
      ).map(proc => this.convertToLocalProcedure(proc));
    }
    
    return [];
  }

  private convertToLocalProcedure(serviceProcedure: any): Procedure {
    // Convert patient service procedure to local Procedure interface
    return {
      resourceType: 'Procedure',
      id: serviceProcedure.id,
      status: serviceProcedure.status || 'completed',
      code: {
        coding: [{
          system: serviceProcedure.code?.coding?.[0]?.system || 'http://snomed.info/sct',
          code: serviceProcedure.code?.coding?.[0]?.code || '',
          display: serviceProcedure.code?.coding?.[0]?.display || ''
        }],
        text: serviceProcedure.code?.text || ''
      },
      subject: {
        reference: serviceProcedure.subject?.reference || `Patient/${this.patient?.id}`
      },
      encounter: serviceProcedure.encounter,
      performedDateTime: serviceProcedure.performedDateTime || serviceProcedure.performedPeriod?.start || '',
      bodySite: serviceProcedure.bodySite
    };
  }

  trackByEncounterId(index: number, encounter: Encounter): string {
    return encounter.id;
  }

  formatEncounterDate(dateString: string): string {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDiagnosisDisplay(diagnosis: any): string {
    // First try to get the display from the diagnosis condition
    if (diagnosis.condition?.display) {
      return diagnosis.condition.display;
    }
    
    // If no display, try to get it from the use coding
    if (diagnosis.use?.coding?.[0]?.display) {
      return diagnosis.use.coding[0].display;
    }
    
    // Fallback to reference if no display is available
    return diagnosis.condition?.reference || 'Unknown diagnosis';
  }

  getProcedureDisplay(procedure: any): string {
    // First try to get the display from the procedure code text
    if (procedure.code?.text) {
      return procedure.code.text;
    }
    
    // If no text, try to get it from the coding display
    if (procedure.code?.coding?.[0]?.display) {
      return procedure.code.coding[0].display;
    }
    
    // Fallback to a generic message if no display is available
    return 'Procedure (details not available)';
  }

  getLateralityDisplay(lateralityCode: string): string {
    const option = this.lateralityOptions.find(opt => opt.value === lateralityCode);
    return option ? option.display : lateralityCode;
  }

  getProcedureLaterality(procedure: any): string | null {
    // Extract laterality from procedure bodySite if available
    if (procedure.bodySite && procedure.bodySite.length > 0) {
      const bodySite = procedure.bodySite[0];
      if (bodySite.coding && bodySite.coding.length > 0) {
        return bodySite.coding[0].display || bodySite.text || null;
      }
      return bodySite.text || null;
    }
    return null;
  }

  viewEncounterDetails(encounter: Encounter): void {
    // TODO: Implement detailed view modal or navigation
    alert(`Encounter Details:\nDate: ${this.formatEncounterDate(encounter.period.start)}\nStatus: ${encounter.status}\nReason: ${encounter.reasonCode?.[0]?.text || 'None'}`);
  }

  deleteEncounter(encounterId: string): void {
    if (confirm('Are you sure you want to delete this encounter?')) {
      if (this.patient) {
        // Use PatientService method to ensure consistent storage and notifications
        this.patientService.deletePatientEncounter(this.patient.id, encounterId);
        
        // Update local state and sort encounters by date
        this.previousEncounters = this.patientService.getPatientEncounters(this.patient.id);
        this.previousEncounters.sort((a, b) => {
          const dateA = new Date(a.period.start);
          const dateB = new Date(b.period.start);
          return dateB.getTime() - dateA.getTime();
        });
        
        alert('Encounter deleted successfully');
      }
    }
  }
}
