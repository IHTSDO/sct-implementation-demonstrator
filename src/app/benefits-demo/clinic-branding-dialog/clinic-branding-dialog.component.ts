import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { AppMaterialModule } from '../../shared/app-material.module';
import { CLINIC_COLORS, ClinicBrandingService, ClinicColor } from '../../services/clinic-branding.service';

@Component({
  selector: 'app-clinic-branding-dialog',
  standalone: true,
  imports: [FormsModule, AppMaterialModule, TranslocoModule],
  template: `
    <ng-container *transloco="let t; scope: 'benefits-demo'; prefix: 'benefitsDemo.branding'">
      <h2 mat-dialog-title>{{ t('title') }}</h2>
      <mat-dialog-content>
        <p class="dialog-copy">{{ t('description') }}</p>

        <mat-form-field appearance="outline" class="name-field">
          <mat-label>{{ t('nameLabel') }}</mat-label>
          <input
            matInput
            [(ngModel)]="draftName"
            name="clinicName"
            maxlength="60"
            [placeholder]="t('namePlaceholder')"
            cdkFocusInitial />
          <mat-hint align="end">{{ draftName.length }}/60</mat-hint>
        </mat-form-field>

        <div class="color-label" id="clinic-color-label">{{ t('colorLabel') }}</div>
        <div class="swatches" role="radiogroup" aria-labelledby="clinic-color-label">
          @for (color of colors; track color.id) {
            <button
              type="button"
              class="swatch"
              role="radio"
              [attr.aria-checked]="color.id === draftColorId"
              [attr.aria-label]="t('colors.' + color.id)"
              [matTooltip]="t('colors.' + color.id)"
              [style.background]="color.accent"
              (click)="draftColorId = color.id">
              @if (color.id === draftColorId) {
                <mat-icon>check</mat-icon>
              }
            </button>
          }
        </div>

        <div class="color-label">{{ t('preview') }}</div>
        <div class="preview" [style.--clinic-accent]="selectedColor.accent" [style.--clinic-accent-soft]="selectedColor.soft">
          <div class="preview-brand">
            <span class="preview-dot"></span>
            <span class="preview-copy">
              <strong>{{ draftName.trim() || t('namePlaceholder') }}</strong>
              <span>EHR Lab</span>
            </span>
          </div>
          <div class="preview-item">
            <mat-icon fontSet="material-symbols-outlined">stethoscope</mat-icon>
            <span>{{ t('previewItem') }}</span>
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button type="button" (click)="resetBranding()">{{ t('reset') }}</button>
        <span class="actions-spacer"></span>
        <button mat-button type="button" mat-dialog-close>{{ t('cancel') }}</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">{{ t('save') }}</button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: [`
    .dialog-copy {
      margin: 0 0 16px;
      color: #475569;
    }

    .name-field {
      width: 100%;
    }

    .color-label {
      margin: 8px 0;
      font-size: 0.85rem;
      font-weight: 500;
      color: #475569;
    }

    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
    }

    .swatch {
      width: 32px;
      height: 32px;
      border: 2px solid transparent;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      cursor: pointer;
      padding: 0;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
    }

    .swatch[aria-checked='true'] {
      border-color: #ffffff;
      box-shadow: 0 0 0 2px #0f172a;
    }

    .swatch:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }

    .swatch mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .preview {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid #e9ecef;
      border-radius: 12px;
      max-width: 280px;
    }

    .preview-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e9ecef;
    }

    .preview-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--clinic-accent);
      flex-shrink: 0;
    }

    .preview-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .preview-copy strong {
      font-size: 0.9rem;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview-copy span {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .preview-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--clinic-accent);
      border-radius: 8px;
      background: var(--clinic-accent-soft);
      color: var(--clinic-accent);
      font-weight: 500;
    }

    .actions-spacer {
      flex: 1;
    }
  `]
})
export class ClinicBrandingDialogComponent {
  readonly colors: ClinicColor[] = CLINIC_COLORS;
  draftName: string;
  draftColorId: string;

  constructor(
    private brandingService: ClinicBrandingService,
    private dialogRef: MatDialogRef<ClinicBrandingDialogComponent>
  ) {
    this.draftName = brandingService.branding.name;
    this.draftColorId = brandingService.branding.colorId;
  }

  get selectedColor(): ClinicColor {
    return this.brandingService.getColor(this.draftColorId);
  }

  resetBranding(): void {
    this.brandingService.reset();
    this.dialogRef.close(true);
  }

  save(): void {
    this.brandingService.save({ name: this.draftName, colorId: this.draftColorId });
    this.dialogRef.close(true);
  }
}
