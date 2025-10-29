import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ValueSetMetadata, PreviewData } from '../../models';

@Component({
  selector: 'app-translation-section',
  templateUrl: './translation-section.component.html',
  styleUrls: ['./translation-section.component.scss']
})
export class TranslationSectionComponent {
  @Input() selectedAction: string | null = null;
  @Input() terminologyContext: any = null;
  @Input() editionsDetails: any[] = [];
  @Input() languages: string[] = [];
  @Input() contexts: any[] = [];
  @Input() languageRefsets: any[] = [];
  @Input() selectedContext: any = null;
  @Input() selectedLanguageDisplayLabel = 'Language';
  @Input() selectedLanRefsetConcept: any = null;
  @Input() valueSetMetadata: ValueSetMetadata = { uri: '', name: '', version: '1.0.0' };
  @Input() targetPreviewData: PreviewData[] = [];
  @Input() isTranslationLoading = false;
  @Input() canExecuteAction = false;
  @Input() isLoading = false;
  
  @Output() editionChanged = new EventEmitter<string>();
  @Output() languageChanged = new EventEmitter<string>();
  @Output() contextChanged = new EventEmitter<any>();
  @Output() languageRefsetChanged = new EventEmitter<any>();
  @Output() metadataChanged = new EventEmitter<{field: string, value: string}>();
  @Output() actionExecuted = new EventEmitter<void>();

  onEditionChange(editionName: string): void {
    this.editionChanged.emit(editionName);
  }

  onLanguageChange(language: string): void {
    this.languageChanged.emit(language);
  }

  onContextChange(context: any): void {
    this.contextChanged.emit(context);
  }

  onLanguageRefsetChange(langRefset: any): void {
    this.languageRefsetChanged.emit(langRefset);
  }

  onMetadataChange(field: string, value: string): void {
    this.metadataChanged.emit({ field, value });
  }

  onExecuteAction(): void {
    this.actionExecuted.emit();
  }

  shouldShowTranslationSelectors(): boolean {
    return this.selectedAction === 'translate' || 
           this.selectedAction === 'target-valueset' || 
           this.selectedAction === 'translate-target' || 
           this.selectedAction === 'fhir-package';
  }

  shouldShowValueSetMetadata(): boolean {
    return this.selectedAction === 'source-valueset' || 
           this.selectedAction === 'target-valueset' || 
           this.selectedAction === 'fhir-package';
  }

  shouldShowExecuteButton(): boolean {
    return !!this.selectedAction;
  }

  shouldShowTargetPreview(): boolean {
    return this.targetPreviewData.length > 0 || this.isTranslationLoading;
  }

  getActionIcon(): string {
    switch (this.selectedAction) {
      case 'translate': return 'translate';
      case 'source-valueset': return 'code';
      case 'target-valueset': return 'expand_more';
      case 'translate-target': return 'swap_horiz';
      case 'fhir-package': return 'archive';
      default: return 'play_arrow';
    }
  }

  getActionButtonText(): string {
    switch (this.selectedAction) {
      case 'translate': return 'Generate Translation Preview';
      case 'source-valueset': return 'Generate Source ValueSet';
      case 'target-valueset': return 'Generate Target ValueSet';
      case 'translate-target': return 'Translate Target Column';
      case 'fhir-package': return 'Generate FHIR Package';
      default: return 'Execute Action';
    }
  }
}
