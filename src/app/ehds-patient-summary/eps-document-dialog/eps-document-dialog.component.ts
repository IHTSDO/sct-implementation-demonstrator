import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EpsPatient } from '../eps-fhir.service';
import { EpsEntry } from '../eps-fhir.service';
import { EpsSectionMeta } from '../spec/eps-sections.model';

interface DialogData {
  bundle: any;
  patient: EpsPatient;
  sections: { section: EpsSectionMeta; entries: EpsEntry[]; narrative?: string }[];
}

@Component({
  selector: 'app-eps-document-dialog',
  templateUrl: './eps-document-dialog.component.html',
  styleUrls: ['./eps-document-dialog.component.css'],
  standalone: false,
})
export class EpsDocumentDialogComponent {
  json: string;
  /** Syntax-highlighted HTML for the FHIR Bundle (highlight.js is loaded globally via CDN). */
  highlightedJson: string;

  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.json = JSON.stringify(data.bundle, null, 2);
    this.highlightedJson = this.highlight(this.json);
  }

  private highlight(code: string): string {
    const hljs = (window as any).hljs;
    if (hljs?.highlight) {
      try {
        return hljs.highlight(code, { language: 'json' }).value;
      } catch {
        /* fall through to escaped plain text */
      }
    }
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  get nonEmptySections() {
    return this.data.sections.filter(
      (s) => s.entries.length || (s.section.kind === 'narrative' && (s.narrative || '').trim())
    );
  }

  entryLine(section: EpsSectionMeta, entry: EpsEntry): string {
    const primary = section.fields.find((f) => f.control === 'snomed');
    const main = primary ? entry.values[primary.key]?.display : undefined;
    const extras: string[] = [];
    for (const f of section.fields) {
      if (f.control === 'snomed') continue;
      const v = entry.values[f.key];
      if (v) extras.push(v.display || v);
    }
    return [main, ...extras].filter(Boolean).join(' — ');
  }

  copyJson(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.json);
    }
  }

  downloadJson(): void {
    const blob = new Blob([this.json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eps-patient-summary.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
