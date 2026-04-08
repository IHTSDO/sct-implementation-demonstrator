import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

type ResultEntry = {
  id: string;
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
  isLoaded: boolean;
  serviceRequest: any;
};

@Component({
  selector: 'app-loinc-result-loader-dialog',
  templateUrl: './loinc-result-loader-dialog.component.html',
  styleUrl: './loinc-result-loader-dialog.component.css',
  standalone: false
})
export class LoincResultLoaderDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { result: ResultEntry; displayText: string },
    private dialogRef: MatDialogRef<LoincResultLoaderDialogComponent>
  ) {}

  save() {
    this.data.result.isLoaded = !!this.data.result.value || !!this.data.result.unitDisplay || !!this.data.result.referenceLow || !!this.data.result.referenceHigh;
    this.dialogRef.close(true);
  }

  close() {
    this.dialogRef.close(false);
  }
}
