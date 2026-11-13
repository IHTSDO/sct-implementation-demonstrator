import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import type { Encounter, EpisodeOfCare, Patient } from '../../model';
import { AncManifest, AncQuestionnaireEntry, AntenatalCareService } from '../../services/antenatal-care.service';
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

  private subscriptions: Subscription[] = [];
  private loadedPatientId: string | null = null;
  private activeFormKey: string | null = null;

  constructor(
    private antenatalCareService: AntenatalCareService,
    private patientService: PatientService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
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

  get openContact(): ContactRow | null {
    return this.contacts.find((row) => row.encounter.status === 'in-progress') || null;
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
      await this.antenatalCareService.closeContact(this.patient.id, this.contact.encounter);
      this.readRecord();
      this.notify('messages.contactClosed', { number: this.contact.number });
      this.backToPregnancy();
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
        await this.antenatalCareService.applyResponseToContact(this.patient.id, this.contact.encounter, questionnaire, fhirResponse);
        this.readRecord();
        this.notify('messages.formSaved', { title: entry.title });

        const index = this.steps.findIndex((step) => step.entry.id === entry.id);
        const next = this.steps[index + 1];
        if (next) {
          this.openForm(next.entry);
        } else {
          // Last form: stay on it, showing the saved answers.
          this.activeFormKey = null;
          await this.syncSelection();
        }
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
    const forms = this.antenatalCareService.getContactForms(this.manifest!, number);
    const answered = new Set(
      this.antenatalCareService.getContactResponses(this.patient!.id, encounter.id).map((response) => response.questionnaire)
    );
    return {
      encounter,
      number,
      gestationalAgeWeeks: this.antenatalCareService.gestationalAgeWeeks(this.lastMenstrualPeriod, new Date(encounter.period.start)),
      completedForms: forms.filter((form) => answered.has(form.url)).length,
      totalForms: forms.length
    };
  }

  /** Resolves the contact, its steps and the form to show from the URL parameters. */
  private async syncSelection(): Promise<void> {
    if (this.loading || !this.patient || !this.manifest) {
      return;
    }

    this.contact = this.contactId ? this.contacts.find((row) => row.encounter.id === this.contactId) || null : null;

    let entry: AncQuestionnaireEntry | null = null;
    if (this.contact) {
      const answered = new Set(
        this.antenatalCareService.getContactResponses(this.patient.id, this.contact.encounter.id).map((response) => response.questionnaire)
      );
      this.steps = this.antenatalCareService.getContactForms(this.manifest, this.contact.number)
        .map((form) => ({ entry: form, completed: answered.has(form.url) }));
      entry = this.steps.find((step) => step.entry.id === this.formId)?.entry
        || this.steps.find((step) => !step.completed)?.entry
        || this.steps[0]?.entry
        || null;
    } else {
      this.steps = [];
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
        : this.antenatalCareService.buildInitialResponse(questionnaire, this.patient, this.contact.encounter, this.lastMenstrualPeriod);
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
