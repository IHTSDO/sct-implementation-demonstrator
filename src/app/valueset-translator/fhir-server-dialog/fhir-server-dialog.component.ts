import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fhir-server-dialog',
  template: `
    <h2 mat-dialog-title>FHIR Server Details</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>FHIR Server URL</mat-label>
          <input matInput formControlName="serverUrl" placeholder="https://your-fhir-server.com/fhir">
          <mat-error *ngIf="form.get('serverUrl')?.hasError('required')">
            FHIR Server URL is required
          </mat-error>
          <mat-error *ngIf="form.get('serverUrl')?.hasError('pattern')">
            Please enter a valid URL
          </mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!form.valid" (click)="onSubmit()">Submit</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      min-width: 300px;
    }
    mat-dialog-content {
      padding-top: 20px;
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule
  ]
})
export class FhirServerDialogComponent {
  form: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<FhirServerDialogComponent>,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      serverUrl: ['', [
        Validators.required,
        Validators.pattern('https?://.*')
      ]]
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.serverUrl);
    }
  }
} 