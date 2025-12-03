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
  minDiagnoses: number = 1;
  maxDiagnoses: number = 4;
  genderDistribution: number = 0.5; // 0.0 = all female, 0.5 = 50/50, 1.0 = all male
  ageDistribution: {
    children: number;    // 0-18 years
    adults: number;     // 18-65 years
    elderly: number;    // 65+ years
  } = {
    children: 30,
    adults: 40,
    elderly: 30
  };

  // Options for age distribution selects (0% to 100% in 10% increments)
  ageDistributionOptions: number[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  isGenerating: boolean = false;
  progress: number = 0;
  currentPatient: number = 0;

  get genderDistributionLabel(): string {
    if (this.genderDistribution === 0.5) {
      return '50% Male / 50% Female';
    }
    const malePercent = Math.round(this.genderDistribution * 100);
    const femalePercent = 100 - malePercent;
    return `${malePercent}% Male / ${femalePercent}% Female`;
  }

  formatGenderLabel(value: number): string {
    const malePercent = Math.round(value * 100);
    return `${malePercent}%`;
  }

  get ageDistributionTotal(): number {
    return this.ageDistribution.children + this.ageDistribution.adults + this.ageDistribution.elderly;
  }

  get ageDistributionValid(): boolean {
    return this.ageDistributionTotal === 100;
  }


  constructor(public dialogRef: MatDialogRef<BatchPatientDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onGenerate(): void {
    if (this.numberOfPatients < 1 || this.numberOfPatients > 100) {
      alert('Please enter a number between 1 and 100');
      return;
    }
    
    if (this.minDiagnoses < 1 || this.minDiagnoses > 10) {
      alert('Minimum diagnoses must be between 1 and 10');
      return;
    }
    
    if (this.maxDiagnoses < 1 || this.maxDiagnoses > 10) {
      alert('Maximum diagnoses must be between 1 and 10');
      return;
    }
    
    if (this.minDiagnoses > this.maxDiagnoses) {
      alert('Minimum diagnoses cannot be greater than maximum diagnoses');
      return;
    }
    
    if (!this.ageDistributionValid) {
      alert('Age distribution percentages must sum to 100%');
      return;
    }
    
    this.dialogRef.close({
      numberOfPatients: this.numberOfPatients,
      includeDiagnoses: this.includeDiagnoses,
      minDiagnoses: this.minDiagnoses,
      maxDiagnoses: this.maxDiagnoses,
      genderDistribution: this.genderDistribution,
      ageDistribution: this.ageDistribution
    });
  }
}

