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
          <input
            matInput
            [(ngModel)]="baseUrl"
            name="baseUrl"
            placeholder="https://hapi.fhir.org/baseR4"
            [matAutocomplete]="serverAutocomplete"
          />
          <mat-icon matSuffix>arrow_drop_down</mat-icon>
        </mat-form-field>

        <mat-autocomplete #serverAutocomplete="matAutocomplete" (optionSelected)="selectRecentServer($event.option.value)">
          @for (serverUrl of filteredRecentBaseUrls(); track serverUrl) {
            <mat-option [value]="serverUrl">
              <div class="recent-server-option">
                <span>{{ serverUrl }}</span>
                @if (isDefaultDemoServer(serverUrl)) {
                  <span class="recent-server-tag">Public demo</span>
                }
              </div>
            </mat-option>
          }
        </mat-autocomplete>
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

    .recent-server-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }

    .recent-server-tag {
      color: #546e7a;
      font-size: 0.75rem;
      font-weight: 700;
    }
  `]
})
export class FhirServerDialogComponent {
  baseUrl = '';
  recentBaseUrls: string[] = [];

  constructor(
    private fhirService: FhirService,
    private dialogRef: MatDialogRef<FhirServerDialogComponent>
  ) {
    this.baseUrl = this.fhirService.getBaseUrl();
    this.recentBaseUrls = this.fhirService.getRecentBaseUrls();
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

  selectRecentServer(serverUrl: string): void {
    this.baseUrl = serverUrl;
  }

  isDefaultDemoServer(serverUrl: string): boolean {
    return serverUrl === FhirService.DEFAULT_BASE_URL;
  }

  filteredRecentBaseUrls(): string[] {
    const normalizedTerm = this.baseUrl.trim().toLowerCase();
    if (!normalizedTerm) {
      return this.recentBaseUrls;
    }

    const normalizedRecentUrls = this.recentBaseUrls.map((serverUrl) => serverUrl.toLowerCase());
    if (normalizedRecentUrls.includes(normalizedTerm)) {
      return this.recentBaseUrls;
    }

    const matchingUrls = this.recentBaseUrls.filter((serverUrl) => serverUrl.toLowerCase().includes(normalizedTerm));
    if (matchingUrls.includes(FhirService.DEFAULT_BASE_URL)) {
      return matchingUrls;
    }

    return [...matchingUrls, FhirService.DEFAULT_BASE_URL];
  }
}
