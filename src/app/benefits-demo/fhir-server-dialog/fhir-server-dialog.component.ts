import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { FhirService } from '../../services/fhir.service';
import { AppMaterialModule } from '../../shared/app-material.module';

@Component({
  selector: 'app-fhir-server-dialog',
  standalone: true,
  imports: [FormsModule, AppMaterialModule],
  template: `
    <div class="dialog-shell">
      <h2 mat-dialog-title>FHIR Server</h2>
      <mat-dialog-content>
        <p class="dialog-copy">
          Benefits Demo can connect to the default public HAPI server or any other FHIR R4 endpoint you provide here.
        </p>

        <mat-form-field appearance="outline">
          <mat-label>FHIR Server Base URL</mat-label>
          <input matInput [(ngModel)]="baseUrl" name="baseUrl" placeholder="https://hapi.fhir.org/baseR4" />
        </mat-form-field>

        @if (shouldShowPublicDemoShortcut()) {
          <button class="demo-server-link" mat-button type="button" (click)="usePublicDemoServer()">
            Use public demo server
          </button>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()">Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="!baseUrl.trim()">
          Save
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-shell {
      min-width: 420px;
    }

    .dialog-copy {
      color: #5f6b7a;
      margin: 0 0 16px;
      line-height: 1.45;
    }

    mat-form-field {
      width: 100%;
    }

    .demo-server-link {
      margin-top: 4px;
      padding-left: 0;
      min-width: 0;
      color: #546e7a;
    }
  `]
})
export class FhirServerDialogComponent {
  private readonly publicDemoServerUrl = 'http://hapi.fhir.org/baseR4';
  baseUrl = '';

  constructor(
    private fhirService: FhirService,
    private dialogRef: MatDialogRef<FhirServerDialogComponent>
  ) {
    this.baseUrl = this.fhirService.getBaseUrl();
  }

  shouldShowPublicDemoShortcut(): boolean {
    return this.baseUrl.trim().replace(/\/$/, '') !== this.publicDemoServerUrl;
  }

  usePublicDemoServer(): void {
    this.baseUrl = this.publicDemoServerUrl;
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    const normalizedUrl = this.baseUrl.trim().replace(/\/$/, '');
    if (!normalizedUrl) {
      return;
    }

    this.fhirService.setBaseUrl(normalizedUrl);
    this.dialogRef.close('save');
  }
}
