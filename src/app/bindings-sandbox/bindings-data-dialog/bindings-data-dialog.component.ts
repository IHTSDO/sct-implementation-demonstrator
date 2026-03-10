import { Clipboard } from '@angular/cdk/clipboard';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { saveAs } from 'file-saver';

interface BindingsDataDialogData {
  formTitle: string;
  outputStr: string;
  responseStr: string;
  responseBundleStr: string;
  fhirQuestionnaireStr: string;
}

@Component({
  selector: 'app-bindings-data-dialog',
  templateUrl: './bindings-data-dialog.component.html',
  styleUrls: ['./bindings-data-dialog.component.css'],
  standalone: false
})
export class BindingsDataDialogComponent {
  selectedTab = 0;

  constructor(
    public dialogRef: MatDialogRef<BindingsDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BindingsDataDialogData,
    private clipboard: Clipboard
  ) {}

  downloadCurrentTab(): void {
    switch (this.selectedTab) {
      case 0:
        this.saveFile(this.data.outputStr, `${this.data.formTitle}-data.json`);
        break;
      case 1:
        this.saveFile(this.data.responseBundleStr, `${this.data.formTitle}-fhir-bundle.json`);
        break;
      default:
        this.saveFile(this.data.fhirQuestionnaireStr, `${this.data.formTitle}-fhir-questionnaire.json`);
        break;
    }
  }

  copyCurrentTab(): void {
    switch (this.selectedTab) {
      case 0:
        this.clipboard.copy(this.data.outputStr);
        break;
      case 1:
        this.clipboard.copy(this.data.responseBundleStr);
        break;
      default:
        this.clipboard.copy(this.data.fhirQuestionnaireStr);
        break;
    }
  }

  private saveFile(text: string, fileName: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, fileName);
  }
}
