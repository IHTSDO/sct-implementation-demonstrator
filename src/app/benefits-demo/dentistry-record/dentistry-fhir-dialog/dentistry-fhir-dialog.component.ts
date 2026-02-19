import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';

export interface DentistryFhirDialogData {
  title: string;
  links: Array<{ label: string; href: string }>;
  jsonString: string;
  fileName: string;
}

@Component({
  selector: 'app-dentistry-fhir-dialog',
  templateUrl: './dentistry-fhir-dialog.component.html',
  styleUrls: ['./dentistry-fhir-dialog.component.css'],
  standalone: false
})
export class DentistryFhirDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DentistryFhirDialogData,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  saveFhirResource(): void {
    const blob = new Blob([this.data.jsonString], { type: 'application/fhir+json;charset=utf-8' });
    saveAs(blob, this.data.fileName);
  }

  copyToClipboard(): void {
    this.clipboard.copy(this.data.jsonString);
    this.snackBar.open('FHIR JSON copied to clipboard', 'Close', { duration: 2000 });
  }
}
