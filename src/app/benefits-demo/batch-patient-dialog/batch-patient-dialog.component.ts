import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-batch-patient-dialog',
  templateUrl: './batch-patient-dialog.component.html',
  styleUrls: ['./batch-patient-dialog.component.css'],
  standalone: false
})
export class BatchPatientDialogComponent {
  numberOfPatients: number = 10;
  includeDiagnoses: boolean = true;
  isGenerating: boolean = false;
  progress: number = 0;
  currentPatient: number = 0;

  constructor(public dialogRef: MatDialogRef<BatchPatientDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onGenerate(): void {
    if (this.numberOfPatients < 1 || this.numberOfPatients > 100) {
      alert('Please enter a number between 1 and 100');
      return;
    }
    
    this.dialogRef.close({
      numberOfPatients: this.numberOfPatients,
      includeDiagnoses: this.includeDiagnoses
    });
  }
}

