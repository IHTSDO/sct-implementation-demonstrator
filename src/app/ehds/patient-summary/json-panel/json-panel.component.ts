import { Component, Input, OnChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { highlightJson } from '../eps-json.util';

/**
 * Back side of an EPS flip card: a titled, syntax-highlighted FHIR JSON view
 * with copy / download actions, mirroring the Laboratory demo's FHIR resource
 * view. The flip toggle itself stays outside the card (patient card for the
 * Bundle, section description line for a section), so it is always visible.
 */
@Component({
  selector: 'app-eps-json-panel',
  templateUrl: './json-panel.component.html',
  styleUrls: ['./json-panel.component.css'],
  standalone: false,
})
export class JsonPanelComponent implements OnChanges {
  @Input() title = '';
  @Input() subtitle = '';
  /** Optional link to the profile page in the implementation guide. */
  @Input() profileUrl?: string;
  @Input() profileLabel = '';
  /** Pretty-printed JSON; when empty, `emptyMessage` is shown instead. */
  @Input() json = '';
  @Input() emptyMessage = '';
  /** Download file name, without extension. */
  @Input() fileName = 'fhir';

  highlighted = '';

  constructor(private snackBar: MatSnackBar) {}

  ngOnChanges(): void {
    this.highlighted = this.json ? highlightJson(this.json) : '';
  }

  copy(): void {
    if (!this.json || !navigator.clipboard) return;
    navigator.clipboard.writeText(this.json).then(() =>
      this.snackBar.open('FHIR JSON copied to the clipboard', undefined, { duration: 2000 })
    );
  }

  download(): void {
    if (!this.json) return;
    const blob = new Blob([this.json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.fileName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
