import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConceptValidationDialogRelation {
  label: string;
  code: string;
  relationLabel: string;
}

export interface ConceptValidationDialogState {
  title: string;
  message: string;
  loading: boolean;
  progressCurrent: number;
  progressTotal: number;
  candidateLabel: string;
  primaryActionLabel: string;
  hasConflict: boolean;
  relations: ConceptValidationDialogRelation[];
}

@Component({
  selector: 'app-concept-validation-dialog',
  templateUrl: './concept-validation-dialog.component.html',
  styleUrls: ['./concept-validation-dialog.component.css'],
  standalone: false
})
export class ConceptValidationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConceptValidationDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public state: ConceptValidationDialogState
  ) {}

  get progressValue(): number {
    if (!this.state.progressTotal) {
      return 0;
    }

    return Math.min((this.state.progressCurrent / this.state.progressTotal) * 100, 100);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
