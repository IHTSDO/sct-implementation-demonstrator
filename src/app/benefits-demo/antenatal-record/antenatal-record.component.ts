import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import type { Encounter, EpisodeOfCare, Patient } from '../../model';
import { AncContactPhase, AncManifest, AncQuestionnaireEntry, AntenatalCareService } from '../../services/antenatal-care.service';
import { CdsService, EncounterCdsHook, EncounterHookResult } from '../../services/cds.service';
import { CdsHooksServersDialogComponent } from '../cds-hooks-servers-dialog/cds-hooks-servers-dialog.component';
import { CdsHooksServicesDialogComponent } from '../cds-hooks-services-dialog/cds-hooks-services-dialog.component';
import { PatientService } from '../../services/patient.service';

interface ContactRow {
  encounter: Encounter;
  number: number;
  gestationalAgeWeeks: number | null;
  completedForms: number;
  totalForms: number;
}

interface FormStep {
  entry: AncQuestionnaireEntry;
  completed: boolean;
  phase: AncContactPhase;
  /** First step of its phase: the phase name is shown above it. */
  firstOfPhase: boolean;
}

const SEVERITY_ORDER = ['critical', 'warning', 'info'] as const;

interface DecisionSupportGroup {
  hook: EncounterCdsHook;
  titleKey: string;
  /** False until the contact has the data the hook needs. */
  enabled: boolean;
  running: boolean;
  result: EncounterHookResult | null;
}

interface ActiveForm {
  entry: AncQuestionnaireEntry;
  questionnaire: any;
  initialResponse: any | null;
}

/**
 * Antenatal care record. The visible screen is derived from the URL query parameters:
 *  - no `contact`, no `form`  -> pregnancy overview (or "start pregnancy" when none is active)
 *  - `contact=<encounter id>` -> that contact, on `form=<questionnaire id>` (default: first pending)
 *  - `form=ANCEnd` alone      -> the end-of-pregnancy form
 */
@Component({
  selector: 'app-antenatal-record',
  templateUrl: './antenatal-record.component.html',
  styleUrls: ['./antenatal-record.component.css'],
  standalone: false
})
export class AntenatalRecordComponent implements OnInit, OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;

  readonly today = new Date();

  loading = true;
  saving = false;
  loadError = false;

  manifest: AncManifest | null = null;
  activePregnancy: EpisodeOfCare | null = null;
  pastPregnancies: EpisodeOfCare[] = [];
  lastMenstrualPeriod: string | null = null;
  contacts: ContactRow[] = [];

  // Start-pregnancy form
  lmpInput: Date | null = null;

  // URL-driven selection
  contactId: string | null = null;
  formId: string | null = null;
  contact: ContactRow | null = null;
  steps: FormStep[] = [];
  activeForm: ActiveForm | null = null;

  // WHO decision support for the selected contact. The cards are transient guidance for
  // this contact: they live here, not in the patient-level CDS alert store.
  decisionSupport: DecisionSupportGroup[] = this.emptyDecisionSupport();
  private decisionSupportContactId: string | null = null;

  private subscriptions: Subscription[] = [];
  private loadedPatientId: string | null = null;
  private activeFormKey: string | null = null;

  constructor(
    private antenatalCareService: AntenatalCareService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdsService: CdsService,
    private translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.queryParamMap.subscribe((params) => {
        this.contactId = params.get('contact');
        this.formId = params.get('form');
        void this.syncSelection();
      }),
      // Storage writes (and lazy FHIR loads) re-emit the selected patient.
      this.patientService.getSelectedPatient().subscribe((selected) => {
        if (selected && this.patient && selected.id === this.patient.id && !this.loading) {
          this.readRecord();
          void this.syncSelection();
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient && this.patient.id !== this.loadedPatientId) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  // ─── Derived values ─────────────────────────────────────────────────────────

  get gestationalAgeToday(): { weeks: number; days: number } | null {
    const days = this.antenatalCareService.gestationalAgeDays(this.lastMenstrualPeriod);
    return days === null ? null : { weeks: Math.floor(days / 7), days: days % 7 };
  }

  get estimatedDateOfDelivery(): string | null {
    return this.antenatalCareService.estimatedDateOfDelivery(this.lastMenstrualPeriod);
  }

  /** Preview of the dating for the date typed in the start-pregnancy form. */
  get lmpPreview(): { weeks: number; days: number; estimatedDateOfDelivery: string } | null {
    if (!this.lmpInput) {
      return null;
    }
    const lmp = this.toDateOnly(this.lmpInput);
    const days = this.antenatalCareService.gestationalAgeDays(lmp);
    const estimatedDateOfDelivery = this.antenatalCareService.estimatedDateOfDelivery(lmp);
    if (days === null || !estimatedDateOfDelivery) {
      return null;
    }
    return { weeks: Math.floor(days / 7), days: days % 7, estimatedDateOfDelivery };
  }

  /** Reached through a link or bookmark for a patient antenatal care does not apply to. */
  get notApplicable(): boolean {
    return !this.activePregnancy && !this.antenatalCareService.isEligible(this.patient);
  }

  get openContact(): ContactRow | null {
    return this.contacts.find((row) => row.encounter.status === 'in-progress') || null;
  }

  /** 1-based position of the form on screen within the contact workflow. */
  get activeStepNumber(): number {
    return this.steps.findIndex((step) => step.entry.id === this.activeForm?.entry.id) + 1;
  }

  get isLastStep(): boolean {
    return this.activeStepNumber === this.steps.length;
  }

  get isEndOfPregnancyForm(): boolean {
    return !this.contactId && !!this.formId;
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async startPregnancy(): Promise<void> {
    if (!this.patient || !this.lmpInput || this.saving) {
      return;
    }
    this.saving = true;
    try {
      await this.antenatalCareService.startPregnancy(this.patient, this.lmpInput);
      this.lmpInput = null;
      await this.load();
      this.notify('messages.pregnancyStarted');
    } catch (error) {
      console.error('Error starting pregnancy:', error);
      this.notify('messages.saveFailed');
    } finally {
      this.saving = false;
    }
  }

  async startContact(): Promise<void> {
    if (!this.patient || !this.activePregnancy || this.saving) {
      return;
    }
    this.saving = true;
    try {
      const encounter = await this.antenatalCareService.startContact(this.patient, this.activePregnancy);
      this.readRecord();
      this.openContactById(encounter.id);
    } catch (error) {
      console.error('Error starting antenatal contact:', error);
      this.notify('messages.saveFailed');
    } finally {
      this.saving = false;
    }
  }

  async closeContact(): Promise<void> {
    if (!this.patient || !this.contact || this.saving) {
      return;
    }
    this.saving = true;
    try {
      const number = this.contact.number;
      // Final check before the contact ends, on everything recorded in it.
      await this.runHook('encounter-discharge');
      await this.antenatalCareService.closeContact(this.patient.id, this.contact.encounter);
      this.readRecord();
      await this.syncSelection();
      this.notify('messages.contactClosed', { number });
    } catch (error) {
      console.error('Error closing antenatal contact:', error);
      this.notify('messages.saveFailed');
    } finally {
      this.saving = false;
    }
  }

  openContactById(encounterId: string): void {
    this.navigate({ contact: encounterId, form: null });
  }

  openForm(entry: AncQuestionnaireEntry): void {
    this.navigate({ form: entry.id });
  }

  openEndOfPregnancyForm(): void {
    const entry = this.manifest?.questionnaires.find((candidate) => candidate.role === 'end-of-pregnancy');
    if (entry) {
      this.navigate({ contact: null, form: entry.id });
    }
  }

  backToPregnancy(): void {
    this.navigate({ contact: null, form: null });
  }

  async onFormSubmitted(event: any): Promise<void> {
    if (!this.patient || !this.activeForm || this.saving) {
      return;
    }
    const { entry, questionnaire } = this.activeForm;
    const fhirResponse = event?.fhirResponse;
    this.saving = true;

    try {
      if (this.contact) {
        this.antenatalCareService.saveResponse(this.patient, questionnaire, fhirResponse, this.contact.encounter);
        const encounter = this.contact.encounter;
        const extracted = this.antenatalCareService.extractContactObservations(this.patient, encounter, questionnaire, fhirResponse);
        this.readRecord();
        this.notify(extracted > 0 ? 'messages.formSavedWithObservations' : 'messages.formSaved', {
          title: this.translocoService.translate(`benefitsDemo.antenatalRecord.forms.${entry.id}`),
          count: extracted
        });

        // Rebuilt after saving: the answers can add a step (the referral form).
        this.steps = this.buildSteps(encounter.id);
        const index = this.steps.findIndex((step) => step.entry.id === entry.id);
        const next = this.steps[index + 1];
        const hooks = this.antenatalCareService.hooksFedByForm(entry.id);
        if (next) {
          this.openForm(next.entry);
        } else {
          // Last form: stay on it, showing the saved answers.
          this.activeFormKey = null;
          await this.syncSelection();
        }
        // The decision services read what was just recorded: re-run the ones this form feeds.
        this.contact = this.contacts.find((row) => row.encounter.id === encounter.id) || this.contact;
        this.refreshDecisionSupportAvailability();
        void Promise.all(hooks.map((hook) => this.runHook(hook)));
      } else if (this.activePregnancy) {
        this.antenatalCareService.saveResponse(this.patient, questionnaire, fhirResponse);
        await this.antenatalCareService.endPregnancy(this.patient.id, this.activePregnancy);
        await this.load();
        this.notify('messages.pregnancyEnded');
        this.backToPregnancy();
      }
    } catch (error) {
      console.error('Error saving antenatal form:', error);
      this.notify('messages.saveFailed');
    } finally {
      this.saving = false;
    }
  }

  onFormCancelled(): void {
    this.backToPregnancy();
  }

  async runHook(hook: EncounterCdsHook): Promise<void> {
    const group = this.decisionSupport.find((candidate) => candidate.hook === hook);
    if (!this.patient || !this.contact || !group || !group.enabled || group.running) {
      return;
    }
    const contactId = this.contact.encounter.id;
    group.running = true;
    try {
      const result = await this.antenatalCareService.runContactHook(hook, this.patient, this.contact.encounter);
      if (this.decisionSupportContactId === contactId) {
        // Most severe first: an urgent referral must not sit below a routine test order.
        const rank = (indicator: string) => SEVERITY_ORDER.indexOf(indicator as typeof SEVERITY_ORDER[number]);
        group.result = { ...result, cards: [...result.cards].sort((a, b) => rank(a.card.indicator) - rank(b.card.indicator)) };
      }
    } catch (error) {
      console.error(`Error running ${hook} decision support:`, error);
      group.result = { hook, cards: [], errors: [String(error)], servicesCalled: 0, disabledServices: [], executedAt: new Date().toISOString() };
    } finally {
      group.running = false;
    }
  }

  /**
   * Opens the CDS configuration where the problem can be fixed: the service selection of
   * the active server when the service is switched off there, the server list otherwise.
   * The recommendations run again when the dialog closes.
   */
  openCdsSettings(group: DecisionSupportGroup): void {
    const disabled = group.result?.disabledServices[0];
    const server = disabled ? this.cdsService.getActiveServers().find((candidate) => candidate.id === disabled.serverId) : null;
    const dialogRef = server
      ? this.dialog.open(CdsHooksServicesDialogComponent, { data: { server }, width: '720px', maxWidth: '95vw' })
      : this.dialog.open(CdsHooksServersDialogComponent, { width: '720px', maxWidth: '95vw' });
    dialogRef.afterClosed().subscribe(() => {
      this.decisionSupport.forEach((candidate) => void this.runHook(candidate.hook));
    });
  }

  /**
   * Splits a card detail into the guidance and the "Why" paragraph (the decision logic
   * that was met). The guidance keeps everything else, the reference included.
   */
  splitCardDetail(detail: string | undefined): { guidance: string; why: string | null } {
    if (!detail) {
      return { guidance: '', why: null };
    }
    const paragraphs = detail.split(/\n{2,}/);
    const whyIndex = paragraphs.findIndex((paragraph) => /^\s*\*\*Why:\*\*/.test(paragraph));
    if (whyIndex === -1) {
      return { guidance: detail, why: null };
    }
    const why = paragraphs[whyIndex].replace(/^\s*\*\*Why:\*\*\s*/, '').trim();
    const guidance = paragraphs.filter((_, index) => index !== whyIndex).join('\n\n');
    return { guidance, why: why || null };
  }

  severityIcon(indicator: string): string {
    return indicator === 'critical' ? 'error' : indicator === 'warning' ? 'warning' : 'info';
  }

  /** Highest severity among the recommendations of a group, for its header. */
  highestSeverity(group: DecisionSupportGroup): string | null {
    const indicators = new Set((group.result?.cards || []).map((item) => item.card.indicator));
    return SEVERITY_ORDER.find((indicator) => indicators.has(indicator)) || null;
  }

  get hasDecisionSupport(): boolean {
    return this.decisionSupport.some((group) => group.enabled);
  }

  private emptyDecisionSupport(): DecisionSupportGroup[] {
    return [
      { hook: 'encounter-start', titleKey: 'decisionSupport.startOfContact', enabled: false, running: false, result: null },
      { hook: 'encounter-discharge', titleKey: 'decisionSupport.endOfContact', enabled: false, running: false, result: null }
    ];
  }

  /** Enables each hook once the contact has the forms it needs. */
  private refreshDecisionSupportAvailability(): void {
    if (!this.patient || !this.contact || !this.manifest) {
      return;
    }
    const answeredUrls = new Set(
      this.antenatalCareService.getContactResponses(this.patient.id, this.contact.encounter.id).map((response) => response.questionnaire)
    );
    const answered = this.manifest.questionnaires.filter((entry) => answeredUrls.has(entry.url)).map((entry) => entry.id);
    for (const group of this.decisionSupport) {
      group.enabled = this.antenatalCareService.isHookEnabled(group.hook, answered);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    if (!this.patient) {
      return;
    }
    const patientId = this.patient.id;
    this.loadedPatientId = patientId;
    this.loading = true;
    this.loadError = false;

    try {
      const [manifest] = await Promise.all([
        this.antenatalCareService.loadManifest(),
        this.antenatalCareService.loadPregnancies(patientId)
      ]);
      if (this.patient?.id !== patientId) {
        return;
      }
      this.manifest = manifest;
      this.loading = false;
      this.readRecord();
      await this.syncSelection();
    } catch (error) {
      console.error('Error loading antenatal care record:', error);
      this.loadError = true;
      this.loading = false;
    }
  }

  /** Re-reads pregnancies and contacts from the patient record (synchronous, from cache). */
  private readRecord(): void {
    if (!this.patient || !this.manifest) {
      return;
    }
    const patientId = this.patient.id;
    const pregnancies = this.patientService.getPatientEpisodesOfCare(patientId)
      .filter((episode) => episode.type?.some((type) => type.coding?.some((coding) => coding.code === 'ANC.Case')))
      .sort((a, b) => (b.period?.start || '').localeCompare(a.period?.start || ''));

    this.activePregnancy = pregnancies.find((episode) => episode.status === 'active') || null;
    this.pastPregnancies = pregnancies.filter((episode) => episode.status !== 'active');
    this.lastMenstrualPeriod = this.activePregnancy
      ? this.antenatalCareService.getLastMenstrualPeriod(patientId, this.activePregnancy.id)
      : null;

    this.contacts = this.activePregnancy
      ? this.antenatalCareService.getContacts(patientId, this.activePregnancy.id).map((encounter) => this.toContactRow(encounter))
      : [];
  }

  private toContactRow(encounter: Encounter): ContactRow {
    const number = this.antenatalCareService.getContactNumber(encounter);
    const steps = this.buildSteps(encounter.id);
    return {
      encounter,
      number,
      gestationalAgeWeeks: this.antenatalCareService.gestationalAgeWeeks(this.lastMenstrualPeriod, new Date(encounter.period.start)),
      completedForms: steps.filter((step) => step.completed).length,
      totalForms: steps.length
    };
  }

  /** Forms of a contact with their completion state, from what is saved in it. */
  private buildSteps(encounterId: string): FormStep[] {
    const patientId = this.patient!.id;
    const answered = new Set(
      this.antenatalCareService.getContactResponses(patientId, encounterId).map((response) => response.questionnaire)
    );
    const referred = this.antenatalCareService.isReferralRecorded(patientId, encounterId);
    let previousPhase: AncContactPhase | null = null;
    return this.antenatalCareService.getContactForms(this.manifest!, referred).map((entry) => {
      const phase = this.antenatalCareService.getFormPhase(entry);
      const step: FormStep = { entry, completed: answered.has(entry.url), phase, firstOfPhase: phase !== previousPhase };
      previousPhase = phase;
      return step;
    });
  }

  /** Resolves the contact, its steps and the form to show from the URL parameters. */
  private async syncSelection(): Promise<void> {
    if (this.loading || !this.patient || !this.manifest) {
      return;
    }

    this.contact = this.contactId ? this.contacts.find((row) => row.encounter.id === this.contactId) || null : null;

    let entry: AncQuestionnaireEntry | null = null;
    if (this.contact) {
      this.steps = this.buildSteps(this.contact.encounter.id);
      entry = this.steps.find((step) => step.entry.id === this.formId)?.entry
        || this.steps.find((step) => !step.completed)?.entry
        || this.steps[0]?.entry
        || null;

      // Opening a contact shows its decision support for the data already recorded.
      this.refreshDecisionSupportAvailability();
      if (this.decisionSupportContactId !== this.contact.encounter.id) {
        this.decisionSupportContactId = this.contact.encounter.id;
        this.decisionSupport.forEach((group) => { group.result = null; group.running = false; });
        void Promise.all(this.decisionSupport.map((group) => this.runHook(group.hook)));
      }
    } else {
      this.steps = [];
      this.decisionSupportContactId = null;
      this.decisionSupport = this.emptyDecisionSupport();
      if (this.formId && this.activePregnancy) {
        entry = this.manifest.questionnaires.find((candidate) => candidate.id === this.formId && candidate.role === 'end-of-pregnancy') || null;
      }
    }

    if (!entry) {
      this.activeForm = null;
      this.activeFormKey = null;
      return;
    }

    // Keep the rendered form when only the surrounding data changed.
    const key = `${this.contact?.encounter.id || 'pregnancy'}:${entry.id}`;
    if (key === this.activeFormKey) {
      return;
    }
    this.activeFormKey = key;

    const questionnaire = await this.antenatalCareService.loadQuestionnaire(entry);
    if (key !== this.activeFormKey) {
      return;
    }

    let initialResponse: any | null = null;
    if (this.contact) {
      const saved = this.antenatalCareService.getContactResponses(this.patient.id, this.contact.encounter.id)
        .find((response) => response.questionnaire === questionnaire.url);
      initialResponse = saved
        ? { resourceType: 'QuestionnaireResponse', status: saved.status, item: saved.item }
        : this.antenatalCareService.buildInitialResponse(
            questionnaire, this.patient.id, this.contact.encounter, this.activePregnancy?.id || '', this.lastMenstrualPeriod
          );
    }

    this.activeForm = { entry, questionnaire, initialResponse };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private notify(key: string, params: Record<string, unknown> = {}): void {
    this.snackBar.open(
      this.translocoService.translate(`benefitsDemo.antenatalRecord.${key}`, params),
      this.translocoService.translate('benefitsDemo.antenatalRecord.actions.dismiss'),
      { duration: 4000 }
    );
  }

  private toDateOnly(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
