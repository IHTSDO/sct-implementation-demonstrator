import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientService, Patient, Condition, Procedure } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { Subscription } from 'rxjs';

export interface EncounterRecord {
  id: string;
  patientId: string;
  date: string;
  time: string;
  reasonForEncounter: {
    code: string;
    display: string;
    system: string;
  } | null;
  diagnosis: {
    code: string;
    display: string;
    system: string;
    note?: string;
  } | null;
  procedure: {
    code: string;
    display: string;
    system: string;
    laterality?: string;
    note?: string;
  } | null;
  encounterNotes: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-encounter-record',
  templateUrl: './encounter-record.component.html',
  styleUrls: ['./encounter-record.component.css'],
  standalone: false
})
export class EncounterRecordComponent implements OnInit, OnDestroy {
  patient: Patient | null = null;
  currentDate = new Date();
  private subscriptions: Subscription[] = [];
  
  // Form data
  encounterDate: string = '';
  encounterTime: string = '';
  selectedReasonForEncounter: any = null;
  selectedDiagnosis: any = null;
  diagnosisNote: string = '';
  selectedProcedure: any = null;
  procedureLaterality: string = '';
  procedureNote: string = '';
  encounterNotes: string = '';
  
  // Loading states
  isSaving = false;
  
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

  // Track if laterality should be enabled
  isLateralityEnabled = false;

  constructor(
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private terminologyService: TerminologyService
  ) { 
    // Initialize with current date and time
    const now = new Date();
    this.encounterDate = now.toISOString().split('T')[0];
    this.encounterTime = now.toTimeString().split(' ')[0].substring(0, 5);
  }

  ngOnInit(): void {
    // Subscribe to selected patient
    this.subscriptions.push(
      this.patientService.getSelectedPatient().subscribe(patient => {
        this.patient = patient;
        if (!patient) {
          this.router.navigate(['/benefits-demo']);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  goBack(): void {
    this.router.navigate(['/benefits-demo']);
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
    this.selectedReasonForEncounter = concept;
  }

  onDiagnosisSelected(concept: any): void {
    this.selectedDiagnosis = concept;
  }

  onProcedureSelected(concept: any): void {
    this.selectedProcedure = concept;
    this.checkLateralityEligibility(concept);
  }

  private async checkLateralityEligibility(procedure: any): Promise<void> {
    if (!procedure || !procedure.code) {
      this.isLateralityEnabled = false;
      return;
    }

    try {
      // Check if the procedure has body structure targets that are lateralizable
      const isLateralizable = await this.isProcedureLateralizable(procedure.code);
      this.isLateralityEnabled = isLateralizable;
      
      // Clear laterality if not eligible
      if (!isLateralizable) {
        this.procedureLaterality = '';
      }
    } catch (error) {
      console.error('Error checking laterality eligibility:', error);
      this.isLateralityEnabled = false;
    }
  }

  private async isProcedureLateralizable(procedureCode: any): Promise<boolean> {
    if (!procedureCode || !procedureCode.code) {
      return false;
    }

    try {
      // Build ECL expression to check if the procedure has body structure targets
      // that are members of the lateralizable body structures reference set
      const ecl = `(${procedureCode.code} |${procedureCode.display}| . << 363704007 |Procedure site|) AND (^723264001 |Lateralizable body structure reference set (foundation metadata concept)|)`;
      
      // Use terminology service to expand the ECL
      const response = await this.terminologyService.expandValueSet(ecl, '', 0, 10).toPromise();
      
      // If we have any results, the procedure is lateralizable
      const hasResults = response && 
                        response.expansion && 
                        response.expansion.contains && 
                        response.expansion.contains.length > 0;
      
      return hasResults;
    } catch (error) {
      console.error('Error checking procedure lateralizability:', error);
      return false;
    }
  }

  clearReasonForEncounter(): void {
    this.selectedReasonForEncounter = null;
  }

  clearDiagnosis(): void {
    this.selectedDiagnosis = null;
    this.diagnosisNote = '';
  }

  clearProcedure(): void {
    this.selectedProcedure = null;
    this.procedureLaterality = '';
    this.procedureNote = '';
  }

  async saveEncounter(): Promise<void> {
    if (!this.patient) return;

    this.isSaving = true;
    
    try {
      const encounterRecord: EncounterRecord = {
        id: this.generateId(),
        patientId: this.patient.id,
        date: this.encounterDate,
        time: this.encounterTime,
        reasonForEncounter: this.selectedReasonForEncounter ? {
          code: this.selectedReasonForEncounter.code,
          display: this.selectedReasonForEncounter.display,
          system: 'http://snomed.info/sct'
        } : null,
        diagnosis: this.selectedDiagnosis ? {
          code: this.selectedDiagnosis.code,
          display: this.selectedDiagnosis.display,
          system: 'http://snomed.info/sct',
          note: this.diagnosisNote || undefined
        } : null,
        procedure: this.selectedProcedure ? {
          code: this.selectedProcedure.code,
          display: this.selectedProcedure.display,
          system: 'http://snomed.info/sct',
          laterality: this.procedureLaterality || undefined,
          note: this.procedureNote || undefined
        } : null,
        encounterNotes: this.encounterNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to localStorage for persistence
      this.saveEncounterToStorage(encounterRecord);

      // If diagnosis is selected, also add it as a condition to the patient
      if (this.selectedDiagnosis) {
        await this.addConditionFromDiagnosis();
      }

      // If procedure is selected, also add it as a procedure to the patient
      if (this.selectedProcedure) {
        await this.addProcedureFromEncounter();
      }

      // Reset form
      this.resetForm();

      // Show success message (you could use a snackbar here)
      alert('Encounter record saved successfully!');

    } catch (error) {
      console.error('Error saving encounter:', error);
      alert('Error saving encounter record. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  private async addConditionFromDiagnosis(): Promise<void> {
    if (!this.selectedDiagnosis || !this.patient) return;

    const newCondition: Condition = {
      resourceType: 'Condition',
      id: this.generateId(),
      subject: { reference: `Patient/${this.patient.id}` },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.selectedDiagnosis.code,
          display: this.selectedDiagnosis.display
        }],
        text: this.selectedDiagnosis.display
      },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      onsetDateTime: `${this.encounterDate}T${this.encounterTime}:00Z`,
      recordedDate: new Date().toISOString()
    };

    this.patientService.addPatientCondition(this.patient.id, newCondition);
  }

  private async addProcedureFromEncounter(): Promise<void> {
    if (!this.selectedProcedure || !this.patient) return;

    const newProcedure: Procedure = {
      resourceType: 'Procedure',
      id: this.generateId(),
      subject: { reference: `Patient/${this.patient.id}` },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.selectedProcedure.code,
          display: this.selectedProcedure.display
        }],
        text: this.selectedProcedure.display
      },
      status: 'completed',
      performedDateTime: `${this.encounterDate}T${this.encounterTime}:00Z`
    };

    this.patientService.addPatientProcedure(this.patient.id, newProcedure);
  }

  private saveEncounterToStorage(encounter: EncounterRecord): void {
    const storageKey = `encounters_${encounter.patientId}`;
    const existingEncounters = this.getEncountersFromStorage(encounter.patientId);
    existingEncounters.push(encounter);
    localStorage.setItem(storageKey, JSON.stringify(existingEncounters));
  }

  private getEncountersFromStorage(patientId: string): EncounterRecord[] {
    const storageKey = `encounters_${patientId}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  resetForm(): void {
    const now = new Date();
    this.encounterDate = now.toISOString().split('T')[0];
    this.encounterTime = now.toTimeString().split(' ')[0].substring(0, 5);
    this.selectedReasonForEncounter = null;
    this.selectedDiagnosis = null;
    this.diagnosisNote = '';
    this.selectedProcedure = null;
    this.procedureLaterality = '';
    this.procedureNote = '';
    this.encounterNotes = '';
  }

  private generateId(): string {
    return 'enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  isFormValid(): boolean {
    return !!(this.encounterDate && this.encounterTime && 
             (this.selectedReasonForEncounter || this.selectedDiagnosis || this.selectedProcedure || this.encounterNotes.trim()));
  }
}
