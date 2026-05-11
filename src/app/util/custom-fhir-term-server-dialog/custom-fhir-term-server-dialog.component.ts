import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

export interface CustomFhirTermServerDialogData {
  defaultUrl?: string;
}

@Component({
  selector: 'app-custom-fhir-term-server-dialog',
  template: `
    <h2 mat-dialog-title>Local FHIR Terminology Server</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>FHIR terminology base URL</mat-label>
          <input matInput formControlName="serverUrl" placeholder="http://localhost:8080/fhir">
          @if (form.get('serverUrl')?.hasError('required')) {
            <mat-error>A URL is required</mat-error>
          }
          @if (form.get('serverUrl')?.hasError('pattern')) {
            <mat-error>Enter a valid http(s) URL</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!form.valid" (click)="onSubmit()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      min-width: 340px;
    }
    mat-dialog-content {
      padding-top: 12px;
    }
  `],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule
  ]
})
export class CustomFhirTermServerDialogComponent {
  readonly form: FormGroup;

  constructor(
    private readonly dialogRef: MatDialogRef<CustomFhirTermServerDialogComponent, string | undefined>,
    private readonly fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) data: CustomFhirTermServerDialogData | null
  ) {
    const urlPattern = /^https?:\/\/\S+/i;
    const initial =
      (data?.defaultUrl && data.defaultUrl.trim()) || 'http://localhost:8080/fhir';
    this.form = this.fb.group({
      serverUrl: [initial, [Validators.required, Validators.pattern(urlPattern)]]
    });
  }

  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    const url = (this.form.value.serverUrl as string).trim().replace(/\/+$/, '');
    this.dialogRef.close(url);
  }
}
