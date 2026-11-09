import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EPS_PACKAGE, EPS_SECTIONS } from './spec/eps-sections.generated';
import { EpsSectionMeta } from './spec/eps-sections.model';
import { EpsEntry, EpsFhirService, EpsPatient, EpsSectionEntries } from './eps-fhir.service';
import { EpsDocumentDialogComponent } from './eps-document-dialog/eps-document-dialog.component';
import { ValuesetDialogComponent } from '../laboratory-demo/valueset-dialog/valueset-dialog.component';

interface SectionState {
  section: EpsSectionMeta;
  entries: EpsEntry[];
  /** Free text for narrative sections. */
  narrative: string;
  /** Whether the section card is flipped to its FHIR JSON view. */
  showJson: boolean;
  /** Pretty-printed FHIR JSON of the section, computed when flipping. */
  json: string;
}

@Component({
  selector: 'app-ehds-patient-summary',
  templateUrl: './ehds-patient-summary.component.html',
  styleUrls: ['./ehds-patient-summary.component.css'],
  standalone: false,
})
export class EhdsPatientSummaryComponent implements OnInit {
  patients: EpsPatient[] = [
    { id: this.fhir.uuid(), name: 'Maria Garcia', gender: 'female', birthDate: '1975-04-12' },
    { id: this.fhir.uuid(), name: 'Johann Müller', gender: 'male', birthDate: '1962-11-03' },
  ];
  patient: EpsPatient = this.patients[0];

  sections: SectionState[] = [];

  /** Whether the sections area is flipped to the full Bundle JSON view. */
  showBundle = false;
  bundleJson = '';
  readonly epsPackage = EPS_PACKAGE;
  readonly xtehrPatientSummaryUrl = 'https://www.xt-ehr.eu/fhir/models/en/StructureDefinition-EHDSPatientSummary.html';
  readonly bundleProfileUrl ='https://hl7.eu/fhir/eps/StructureDefinition-bundle-eu-eps.html';

  constructor(private fhir: EpsFhirService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.sections = EPS_SECTIONS.map((section) => ({
      section,
      entries: [],
      narrative: '',
      showJson: false,
      json: '',
    }));
  }

  private toSectionEntries(s: SectionState): EpsSectionEntries {
    return { section: s.section, entries: s.entries, narrative: s.narrative };
  }

  toggleBundle(): void {
    this.showBundle = !this.showBundle;
    if (this.showBundle) this.refreshBundleJson();
  }

  toggleSectionJson(state: SectionState): void {
    state.showJson = !state.showJson;
    if (state.showJson) this.refreshSectionJson(state);
  }

  /** Keep any visible JSON in sync when the patient changes. */
  onPatientChange(): void {
    if (this.showBundle) this.refreshBundleJson();
    this.sections.filter((s) => s.showJson).forEach((s) => this.refreshSectionJson(s));
  }

  private refreshBundleJson(): void {
    const bundle = this.fhir.buildBundle(this.patient, this.sections.map((s) => this.toSectionEntries(s)));
    this.bundleJson = JSON.stringify(bundle, null, 2);
  }

  /**
   * Resource sections show the FHIR resources they contribute; narrative
   * sections show their Composition.section (title, code and narrative text).
   */
  private refreshSectionJson(state: SectionState): void {
    const built = this.fhir.buildSection(this.toSectionEntries(state), this.patient);
    const content = state.section.kind === 'narrative' ? built.section : built.resources;
    const hasContent = state.section.kind === 'narrative' ? !!built.section : built.resources.length > 0;
    state.json = hasContent ? JSON.stringify(content, null, 2) : '';
  }

  sectionJsonTitle(state: SectionState): string {
    return state.section.kind === 'narrative'
      ? `${state.section.title} — Composition section`
      : `${state.section.title} — FHIR ${state.section.resourceType} resources`;
  }

  sectionJsonEmpty(state: SectionState): string {
    return state.section.kind === 'narrative'
      ? 'Write the section narrative to see its Composition section.'
      : `Add an entry to see its FHIR ${state.section.resourceType} resource.`;
  }

  /** Number of captured items: resource entries + narrative sections that have text. */
  get totalEntries(): number {
    return this.sections.reduce((n, s) => {
      if (s.section.kind === 'narrative') return n + (s.narrative.trim() ? 1 : 0);
      return n + s.entries.length;
    }, 0);
  }

  onEntryAdded(state: SectionState, entry: EpsEntry): void {
    state.entries = [...state.entries, entry];
  }

  removeEntry(state: SectionState, entry: EpsEntry): void {
    state.entries = state.entries.filter((e) => e.id !== entry.id);
  }

  /** Best-effort human label for an entry row: the primary coded field's display. */
  entryLabel(state: SectionState, entry: EpsEntry): string {
    const primary =
      state.section.fields.find((f) => f.control === 'snomed') ||
      state.section.fields.find((f) => f.control === 'dropdown');
    const coded = primary ? entry.values[primary.key] : undefined;
    return coded?.display || 'Entry';
  }

  entryDetails(state: SectionState, entry: EpsEntry): string {
    const primary =
      state.section.fields.find((f) => f.control === 'snomed') ||
      state.section.fields.find((f) => f.control === 'dropdown');
    const parts: string[] = [];
    for (const f of state.section.fields) {
      if (f.key === primary?.key) continue;
      const v = entry.values[f.key];
      if (!v) continue;
      parts.push(`${f.label}: ${v.display || v}`);
    }
    return parts.join(' · ');
  }

  /** Full EPS implementation guide, embedded in a dialog (Laboratory-style FHIR badge). */
  private readonly guideUrl = 'https://hl7.eu/fhir/eps/index.html';

  openGuide(): void {
    this.openFhirPage(this.guideUrl, 'HL7 Europe Patient Summary', 'Implementation Guide');
  }

  /** Last segment of a profile canonical, e.g. `condition-obl-eu-eps`. */
  profileName(canonical: string): string {
    return canonical.split('/').pop() || canonical;
  }

  openSectionProfile(section: EpsSectionMeta): void {
    this.openFhirPage(section.profilePageUrl, section.title, `${section.resourceType} profile`);
  }

  private openFhirPage(url: string, fieldName: string, dialogTitle: string): void {
    ValuesetDialogComponent.openPage(this.dialog, { url, fieldName, dialogTitle });
  }

  generateDocument(): void {
    const bundle = this.fhir.buildBundle(this.patient, this.sections.map((s) => this.toSectionEntries(s)));
    this.dialog.open(EpsDocumentDialogComponent, {
      data: { bundle, patient: this.patient, sections: this.sections },
      width: '900px',
      maxHeight: '90vh',
    });
  }
}
