import { AfterViewInit, Component, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Patient, Condition, Procedure, MedicationStatement } from '../../services/patient.service';
import { ClinicalFormsComponent } from '../clinical-forms/clinical-forms.component';

export interface AllergyFormDialogData {
  patient: Patient | null;
  conditions: Condition[];
  procedures: Procedure[];
  medications: MedicationStatement[];
}

@Component({
  selector: 'app-allergy-form-dialog',
  templateUrl: './allergy-form-dialog.component.html',
  styleUrls: ['./allergy-form-dialog.component.css'],
  standalone: false
})
export class AllergyFormDialogComponent implements AfterViewInit {
  @ViewChild(ClinicalFormsComponent) clinicalFormsComponent?: ClinicalFormsComponent;

  constructor(
    private dialogRef: MatDialogRef<AllergyFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AllergyFormDialogData
  ) {}

  ngAfterViewInit(): void {
    // Reuse the current clinical forms logic but jump straight into the allergy form.
    setTimeout(() => {
      if (!this.clinicalFormsComponent) {
        return;
      }

      this.clinicalFormsComponent.selectedTabIndex = 0;
      this.clinicalFormsComponent.selectedForm = 'allergies';
    });
  }

  onFormSubmitted(event: any): void {
    if (event?.type === 'allergy') {
      this.dialogRef.close(event);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
