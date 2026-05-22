import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

export interface TranslationCoverageDialogData {
  lang: string;
  routeSegment: string;
  scope: string;
}

@Component({
  selector: 'app-translation-coverage-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslocoModule],
  templateUrl: './translation-coverage-dialog.component.html',
  styleUrl: './translation-coverage-dialog.component.css',
})
export class TranslationCoverageDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TranslationCoverageDialogData,
    private readonly dialogRef: MatDialogRef<TranslationCoverageDialogComponent>,
    private readonly translocoService: TranslocoService
  ) {}

  close(): void {
    this.dialogRef.close();
  }

  t(key: string, params?: Record<string, unknown>): string {
    const fullKey = `translationCoverage.dialog.${key}`;
    const translated = this.translocoService.translate(fullKey, params ?? {});
    return translated === fullKey ? this.fallback(key, params) : translated;
  }

  private fallback(key: string, params?: Record<string, unknown>): string {
    const fallbacks: Record<string, string> = {
      title: 'Site translation coverage',
      intro: 'The selected Site language is active, but this module has not been translated yet.',
      currentModule: 'Current module: {{route}}',
      currentScope: 'Expected translation scope: {{scope}}',
      terminologyNote: 'Terminology language settings are separate and may still affect SNOMED CT displays.',
      close: 'Got it',
    };
    return (fallbacks[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, paramKey) => String(params?.[paramKey] ?? ''));
  }
}
