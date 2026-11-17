import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { PatientService } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import type { Patient } from '../../model';

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
  /** Existing Condition or Procedure resources that are the reason for the encounter. */
  reasonReference?: Array<{
    reference: string;
    display?: string;
  }>;
  // Additional properties for display purposes (not part of FHIR spec)
  linkedProcedures?: Procedure[];
  /** Diagnosis entries that reference a Condition (procedure references are listed with procedures). */
  conditionDiagnoses?: Encounter['diagnosis'];
  /** Existing procedures referenced by the encounter (picked from the patient record). */
  referencedProcedures?: Procedure[];
}

/** Where an encounter entry picked from the patient record comes from. */
export interface RecordReference {
  resourceType: 'Condition' | 'Procedure';
  id: string;
}

/** A condition or procedure of the patient offered by the "from patient record" menus. */
export interface RecordPick {
  ref: RecordReference;
  code: string;
  display: string;
  /** Date shown in the menu (onset / performed / recorded). */
  date: string;
  /** Condition clinical status key, e.g. active / resolved; empty for procedures. */
  statusKey: string;
  bodySite: string | null;
  /** Resolved or inactive problems, and procedures not done; listed last and dimmed. */
  inactive: boolean;
  /** Laterality code carried by a procedure's body site, if any. */
  laterality: string;
}

const ACTIVE_CONDITION_STATUSES = ['active', 'recurrence', 'relapse'];
const INACTIVE_PROCEDURE_STATUSES = ['not-done', 'entered-in-error', 'stopped'];
/** Filter box appears in the record menus above this many entries. */
const RECORD_FILTER_THRESHOLD = 8;

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
export class EncounterRecordComponent implements OnInit, OnDestroy, OnChanges {
  @Input() patient: Patient | null = null;
  /** The patient's conditions and procedures, offered as shortcuts next to each field. */
  @Input() patientConditions: any[] = [];
  @Input() patientProcedures: any[] = [];
  @Output() conditionAdded = new EventEmitter<Condition>();
  @Output() procedureAdded = new EventEmitter<Procedure>();
  @Output() encounterAdded = new EventEmitter<any>();
  
  currentDate = new Date();
  private subscriptions: Subscription[] = [];
  
  // Form data
  encounterDate: string = '';
  encounterTime: string = '';
  
  // Multiple entries support. `recordRef` marks an entry picked from the patient record:
  // it is referenced on save instead of creating a new resource.
  reasonsForEncounter: any[] = [];
  currentReasonForEncounter: any = null;
  
  diagnoses: Array<{concept: any, note: string, recordRef?: RecordReference}> = [];
  currentDiagnosis: any = null;
  currentDiagnosisNote: string = '';
  
  procedures: Array<{concept: any, laterality: string, recordRef?: RecordReference}> = [];

  // "From patient record" shortcuts
  conditionPicks: RecordPick[] = [];
  procedurePicks: RecordPick[] = [];
  recordFilter = '';
  readonly recordFilterThreshold = RECORD_FILTER_THRESHOLD;
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
    private terminologyService: TerminologyService,
    private translocoService: TranslocoService
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientConditions']) {
      this.conditionPicks = this.buildConditionPicks(this.patientConditions || []);
    }
    if (changes['patientProcedures']) {
      this.procedurePicks = this.buildProcedurePicks(this.patientProcedures || []);
      this.refreshEncounterDisplay();
    }
  }

  // ---- "From patient record" shortcuts ----

  private buildConditionPicks(conditions: any[]): RecordPick[] {
    const picks = conditions
      .map((condition): RecordPick | null => {
        const coding = this.getSnomedCoding(condition.code);
        if (!condition?.id || !coding) {
          return null;
        }
        const statusKey = `${condition.clinicalStatus?.coding?.[0]?.code || ''}`.toLowerCase();
        return {
          ref: { resourceType: 'Condition', id: condition.id },
          code: coding.code,
          display: condition.code?.text || coding.display || coding.code,
          date: condition.onsetDateTime || condition.recordedDate || '',
          statusKey,
          bodySite: this.patientService.getBodySiteText(condition),
          inactive: !!statusKey && !ACTIVE_CONDITION_STATUSES.includes(statusKey),
          laterality: ''
        };
      })
      .filter((pick): pick is RecordPick => !!pick);
    return this.sortPicks(picks);
  }

  private buildProcedurePicks(procedures: any[]): RecordPick[] {
    const picks = procedures
      .map((procedure): RecordPick | null => {
        const coding = this.getSnomedCoding(procedure.code);
        if (!procedure?.id || !coding) {
          return null;
        }
        return {
          ref: { resourceType: 'Procedure', id: procedure.id },
          code: coding.code,
          display: procedure.code?.text || coding.display || coding.code,
          date: procedure.performedDateTime || procedure.performedPeriod?.start || '',
          statusKey: '',
          bodySite: this.patientService.getBodySiteText(procedure),
          inactive: INACTIVE_PROCEDURE_STATUSES.includes(procedure.status),
          laterality: this.getRecordedLaterality(procedure)
        };
      })
      .filter((pick): pick is RecordPick => !!pick);
    return this.sortPicks(picks);
  }

  /** Active entries first, then newest first. */
  private sortPicks(picks: RecordPick[]): RecordPick[] {
    const time = (date: string) => {
      const value = date ? new Date(date).getTime() : 0;
      return Number.isNaN(value) ? 0 : value;
    };
    return picks.sort((a, b) =>
      Number(a.inactive) - Number(b.inactive) || time(b.date) - time(a.date)
    );
  }

  private getSnomedCoding(code: any): { code: string; display: string } | null {
    const coding = (code?.coding || []).find((c: any) => c?.system === 'http://snomed.info/sct' && c?.code)
      || code?.coding?.[0];
    return coding?.code ? { code: `${coding.code}`, display: coding.display || '' } : null;
  }

  /**
   * Laterality recorded on a procedure: the side of a postcoordinated body site
   * (`<site>:272741003=<side>`) or, for encounter procedures, a side code stored as body site.
   */
  private getRecordedLaterality(procedure: any): string {
    const sideCodes = this.lateralityOptions.map(option => option.value).filter(Boolean);
    for (const site of procedure?.bodySite || []) {
      for (const coding of site?.coding || []) {
        if (coding?.system !== 'http://snomed.info/sct' || !coding?.code) {
          continue;
        }
        const code = `${coding.code}`;
        const match = code.match(/272741003\s*=\s*(\d+)/);
        if (match && sideCodes.includes(match[1])) {
          return match[1];
        }
        if (sideCodes.includes(code)) {
          return code;
        }
      }
    }
    return '';
  }

  /** Entries matching the menu's filter box (by name or code). */
  filterPicks(picks: RecordPick[]): RecordPick[] {
    const term = this.recordFilter.trim().toLowerCase();
    if (!term) {
      return picks;
    }
    return picks.filter(pick => pick.display.toLowerCase().includes(term) || pick.code.includes(term));
  }

  get reasonPickCount(): number {
    return this.conditionPicks.length + this.procedurePicks.length;
  }

  isReasonPicked(pick: RecordPick): boolean {
    return this.reasonsForEncounter.some(reason => reason.code === pick.code);
  }

  isDiagnosisPicked(pick: RecordPick): boolean {
    return this.diagnoses.some(diagnosis => diagnosis.concept.code === pick.code);
  }

  isProcedurePicked(pick: RecordPick): boolean {
    return this.procedures.some(procedure => procedure.concept.code === pick.code);
  }

  pickReason(pick: RecordPick): void {
    if (this.isReasonPicked(pick)) {
      return;
    }
    this.reasonsForEncounter.push({ code: pick.code, display: pick.display, recordRef: { ...pick.ref } });
  }

  pickDiagnosis(pick: RecordPick): void {
    if (this.isDiagnosisPicked(pick)) {
      return;
    }
    this.diagnoses.push({ concept: { code: pick.code, display: pick.display }, note: '', recordRef: { ...pick.ref } });
  }

  pickProcedure(pick: RecordPick): void {
    if (this.isProcedurePicked(pick)) {
      return;
    }
    this.procedures.push({
      concept: { code: pick.code, display: pick.display },
      laterality: pick.laterality,
      recordRef: { ...pick.ref }
    });
  }

  formatPickDate(date: string): string {
    if (!date) {
      return '';
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleDateString(this.translocoService.getActiveLang() || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
      const reasonsForEncounter = this.getPendingReasonsForEncounter();
      const diagnoses = this.getPendingDiagnoses();
      const procedures = this.getPendingProcedures();

      const encounterId = this.generateId();
      this.currentEncounterId = encounterId;

      // Entries picked from the patient record are referenced, not created again.
      const reasonConditions = reasonsForEncounter
        .filter(reason => !reason.recordRef)
        .map(reason => this.buildEncounterCondition(reason, 'Reason for encounter'));
      const diagnosisEntries = diagnoses.map(diag => diag.recordRef
        ? { reference: `Condition/${diag.recordRef.id}`, display: diag.concept.display, condition: null as Condition | null }
        : (() => {
            const condition = this.buildEncounterCondition(diag.concept, diag.note);
            return { reference: `Condition/${condition.id}`, display: condition.code.text, condition };
          })()
      );
      const diagnosisConditions = diagnosisEntries
        .map(entry => entry.condition)
        .filter((condition): condition is Condition => !!condition);
      const encounterProcedures = procedures
        .filter(proc => !proc.recordRef)
        .map(proc => this.buildEncounterProcedure(proc.concept, proc.laterality));
      // R4 Encounter.diagnosis.condition accepts Procedure: used for existing procedures
      // that are relevant to this encounter but were not performed in it.
      const referencedProcedures = procedures
        .filter(proc => !!proc.recordRef)
        .map(proc => ({ reference: `Procedure/${proc.recordRef!.id}`, display: proc.concept.display }));
      const reasonReference = reasonsForEncounter
        .filter(reason => !!reason.recordRef)
        .map(reason => ({
          reference: `${reason.recordRef.resourceType}/${reason.recordRef.id}`,
          display: reason.display
        }));

      // Build reasonCode array from multiple reasons
      const reasonCode = reasonsForEncounter.length > 0 
        ? reasonsForEncounter.map(reason => ({
            coding: [{
              system: 'http://snomed.info/sct',
              code: reason.code,
              display: reason.display
            }],
            text: reason.display
          }))
        : undefined;

      // Build diagnosis array from multiple diagnoses (new or existing conditions)
      const conditionDiagnoses = diagnosisEntries.map((entry, index) => ({
        condition: {
          reference: entry.reference,
          display: entry.display
        },
        use: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }]
        },
        rank: index + 1
      }));
      const procedureDiagnoses = referencedProcedures.map(procedure => ({ condition: procedure }));
      const diagnosis = conditionDiagnoses.length + procedureDiagnoses.length > 0
        ? [...conditionDiagnoses, ...procedureDiagnoses]
        : undefined;

      const encounterRecord: Encounter = {
        resourceType: 'Encounter',
        id: encounterId,
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
        reasonReference: reasonReference.length > 0 ? reasonReference : undefined,
        diagnosis,
        note: this.encounterNotes ? [{
          text: this.encounterNotes
        }] : undefined
      };

      this.encounterAdded.emit({
        encounter: encounterRecord,
        conditions: [...reasonConditions, ...diagnosisConditions],
        procedures: encounterProcedures
      });

    } catch (error) {
      this.isSaving = false;
      alert(this.translocoService.translate('benefitsDemo.encounterRecord.messages.saveError'));
    }
  }

  finishSaving(success = true): void {
    if (success) {
      this.resetForm();
    }
    this.isSaving = false;
  }

  private buildEncounterCondition(concept: any, note: string): Condition {
    return {
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
          code: concept.code,
          display: concept.display
        }],
        text: concept.display
      },
      subject: {
        reference: `Patient/${this.patient!.id}`
      },
      encounter: {
        reference: `Encounter/${this.currentEncounterId}`
      },
      onsetDateTime: `${this.encounterDate}T${this.encounterTime}:00Z`,
      recordedDate: new Date().toISOString(),
      note: note ? [{
        text: note
      }] : undefined
    };
  }

  private buildEncounterProcedure(procedureConcept: any, laterality: string): Procedure {
    return {
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
        reference: `Patient/${this.patient!.id}`
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
             (this.getPendingReasonsForEncounter().length > 0 || 
              this.getPendingDiagnoses().length > 0 || 
              this.getPendingProcedures().length > 0 || 
              this.encounterNotes.trim()));
  }

  private getPendingReasonsForEncounter(): any[] {
    const reasons = [...this.reasonsForEncounter];

    if (this.currentReasonForEncounter &&
        !reasons.some(reason => reason.code === this.currentReasonForEncounter.code)) {
      reasons.push({ ...this.currentReasonForEncounter });
    }

    return reasons;
  }

  private getPendingDiagnoses(): Array<{concept: any, note: string, recordRef?: RecordReference}> {
    const diagnoses = [...this.diagnoses];

    if (this.currentDiagnosis &&
        !diagnoses.some(diagnosis => diagnosis.concept.code === this.currentDiagnosis.code)) {
      diagnoses.push({
        concept: { ...this.currentDiagnosis },
        note: this.currentDiagnosisNote
      });
    }

    return diagnoses;
  }

  private getPendingProcedures(): Array<{concept: any, laterality: string, recordRef?: RecordReference}> {
    const procedures = [...this.procedures];

    if (this.currentProcedure &&
        !procedures.some(procedure => procedure.concept.code === this.currentProcedure.code)) {
      procedures.push({
        concept: { ...this.currentProcedure },
        laterality: this.currentProcedureLaterality
      });
    }

    return procedures;
  }

  loadPreviousEncounters(): void {
    if (this.patient) {
      this.previousEncounters = this.getEncountersFromStorage(this.patient.id);
      
      // Sort encounters by date in descending order (newest first)
      this.previousEncounters.sort((a, b) => {
        return this.getEncounterSortTimestamp(b) - this.getEncounterSortTimestamp(a);
      });
      
      // Enhance encounters with diagnosis display terms and linked procedures
      this.previousEncounters.forEach(encounter => {
        this.enhanceDiagnosisDisplay(encounter);
        this.addLinkedProceduresToEncounter(encounter);
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

    // Split diagnosis entries: Condition references stay as diagnoses, Procedure
    // references (picked from the patient record) are listed with the procedures.
    const diagnoses = encounter.diagnosis || [];
    encounter.conditionDiagnoses = diagnoses.filter(d => !`${d.condition?.reference || ''}`.startsWith('Procedure/'));
    const procedureIds = diagnoses
      .map(d => `${d.condition?.reference || ''}`)
      .filter(reference => reference.startsWith('Procedure/'))
      .map(reference => reference.slice('Procedure/'.length));
    const allProcedures = this.patient ? this.patientService.getPatientProcedures(this.patient.id) : [];
    encounter.referencedProcedures = procedureIds.map(id => {
      const stored = allProcedures.find(proc => proc.id === id);
      if (stored) {
        return this.convertToLocalProcedure(stored);
      }
      const entry = diagnoses.find(d => d.condition?.reference === `Procedure/${id}`);
      return {
        resourceType: 'Procedure',
        id,
        status: 'unknown',
        code: { coding: [], text: entry?.condition?.display || '' },
        subject: { reference: `Patient/${this.patient?.id}` }
      } as Procedure;
    });
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

  getEncounterDateLabel(encounter: Encounter): string {
    return this.formatEncounterDate(this.getEncounterDisplayDate(encounter));
  }

  getDiagnosisDisplay(diagnosis: any): string {
    // First try to get the display from the diagnosis condition
    if (diagnosis.condition?.display) {
      return diagnosis.condition.display;
    }
    
    // If no display, try to get it from the use coding
    if (diagnosis.use?.coding?.[0]?.display) {
      return diagnosis.use?.coding?.[0]?.display;
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
      return procedure.code?.coding?.[0]?.display;
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
    const encounterDate = this.getEncounterDisplayDate(encounter);
    alert(`Encounter Details:\nDate: ${this.formatEncounterDate(encounterDate)}\nStatus: ${encounter.status}\nReason: ${encounter.reasonCode?.[0]?.text || 'None'}`);
  }

  deleteEncounter(encounterId: string): void {
    if (confirm(this.translocoService.translate('benefitsDemo.encounterRecord.messages.deleteConfirm'))) {
      if (this.patient) {
        // Use PatientService method to ensure consistent storage and notifications
        this.patientService.deletePatientEncounter(this.patient.id, encounterId);

        // Reload, sort and enhance the remaining encounters
        this.loadPreviousEncounters();

        alert(this.translocoService.translate('benefitsDemo.encounterRecord.messages.deleteSuccess'));
      }
    }
  }

  private getEncounterDisplayDate(encounter: Encounter): string {
    const encounterMeta = (encounter as any).meta;
    return encounter.period?.start
      || encounter.period?.end
      || (encounter as any).actualPeriod?.start
      || (encounter as any).actualPeriod?.end
      || encounterMeta?.lastUpdated
      || '';
  }

  private getEncounterSortTimestamp(encounter: Encounter): number {
    const encounterDate = this.getEncounterDisplayDate(encounter);
    if (!encounterDate) {
      return 0;
    }

    const parsedDate = new Date(encounterDate).getTime();
    return Number.isNaN(parsedDate) ? 0 : parsedDate;
  }
}
