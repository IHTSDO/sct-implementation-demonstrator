import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EPS_SECTIONS } from './spec/eps-sections.generated';
import { EpsSectionMeta } from './spec/eps-sections.model';
import { EpsEntry, EpsFhirService, EpsPatient, EpsSectionEntries } from './eps-fhir.service';
import { EpsDocumentDialogComponent } from './eps-document-dialog/eps-document-dialog.component';
import { ValuesetDialogComponent } from '../ehds-laboratory-demo/valueset-dialog/valueset-dialog.component';

interface SectionState {
  section: EpsSectionMeta;
  entries: EpsEntry[];
  /** Free text for narrative sections. */
  narrative: string;
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

  constructor(private fhir: EpsFhirService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.sections = EPS_SECTIONS.map((section) => ({ section, entries: [], narrative: '' }));
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

  openSectionProfile(section: EpsSectionMeta): void {
    this.openFhirPage(section.profilePageUrl, section.title, `${section.resourceType} profile`);
  }

  private openFhirPage(url: string, fieldName: string, dialogTitle: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url, fieldName, dialogTitle },
      panelClass: 'valueset-dialog-container',
    });
  }

  generateDocument(): void {
    const sectionEntries: EpsSectionEntries[] = this.sections.map((s) => ({
      section: s.section,
      entries: s.entries,
      narrative: s.narrative,
    }));
    const bundle = this.fhir.buildBundle(this.patient, sectionEntries);
    this.dialog.open(EpsDocumentDialogComponent, {
      data: { bundle, patient: this.patient, sections: this.sections },
      width: '900px',
      maxHeight: '90vh',
    });
  }
}
