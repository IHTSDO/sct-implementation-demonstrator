import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FHIRValueSet, FHIRPackage } from '../../models';

@Component({
  selector: 'app-download-section',
  templateUrl: './download-section.component.html',
  styleUrls: ['./download-section.component.scss']
})
export class DownloadSectionComponent {
  @Input() targetValueSet: FHIRValueSet | null = null;
  @Input() sourceValueSet: FHIRValueSet | null = null;
  @Input() generatedPackage: FHIRPackage | null = null;
  @Input() selectedAction: string | null = null;
  @Input() isLoading = false;
  @Input() fhirServerUrl = '';
  @Input() isUploading = false;
  @Input() showFhirServerUpload = false;
  @Input() instructionTab = 'download';
  
  @Output() downloadTargetValueSet = new EventEmitter<void>();
  @Output() downloadTargetAsExcel = new EventEmitter<void>();
  @Output() downloadSourceValueSet = new EventEmitter<void>();
  @Output() downloadTranslatedFile = new EventEmitter<void>();
  @Output() generateFHIRPackage = new EventEmitter<void>();
  @Output() fhirServerUrlChanged = new EventEmitter<string>();
  @Output() fhirServerUploadToggled = new EventEmitter<void>();
  @Output() uploadToFhirServer = new EventEmitter<void>();
  @Output() instructionTabChanged = new EventEmitter<string>();

  onDownloadTargetValueSet(): void {
    this.downloadTargetValueSet.emit();
  }

  onDownloadTargetAsExcel(): void {
    this.downloadTargetAsExcel.emit();
  }

  onDownloadSourceValueSet(): void {
    this.downloadSourceValueSet.emit();
  }

  onDownloadTranslatedFile(): void {
    this.downloadTranslatedFile.emit();
  }

  onGenerateFHIRPackage(): void {
    this.generateFHIRPackage.emit();
  }

  onFhirServerUrlChange(url: string): void {
    this.fhirServerUrlChanged.emit(url);
  }

  onFhirServerUploadToggle(): void {
    this.fhirServerUploadToggled.emit();
  }

  onUploadToFhirServer(): void {
    this.uploadToFhirServer.emit();
  }

  onInstructionTabChange(tab: string): void {
    this.instructionTabChanged.emit(tab);
  }

  shouldShowDownloadOptions(): boolean {
    return !!this.targetValueSet && !!this.selectedAction;
  }

  shouldShowTargetDownloads(): boolean {
    return this.selectedAction === 'translate' || this.selectedAction === 'target-valueset';
  }

  shouldShowSourceDownloads(): boolean {
    return this.selectedAction === 'source-valueset';
  }

  shouldShowTranslatedDownloads(): boolean {
    return this.selectedAction === 'translate-target';
  }

  shouldShowFHIRPackageDownloads(): boolean {
    return this.selectedAction === 'fhir-package';
  }

  getDownloadButtons(): Array<{id: string, label: string, icon: string, color: string, condition: boolean}> {
    return [
      {
        id: 'target-valueset',
        label: 'Download Target ValueSet',
        icon: 'download',
        color: 'primary',
        condition: this.shouldShowTargetDownloads()
      },
      {
        id: 'target-excel',
        label: 'Download as Excel',
        icon: 'table_view',
        color: 'accent',
        condition: this.shouldShowTargetDownloads()
      },
      {
        id: 'source-valueset',
        label: 'Download Source ValueSet',
        icon: 'download',
        color: 'primary',
        condition: this.shouldShowSourceDownloads()
      },
      {
        id: 'translated-file',
        label: 'Download Translated Map File',
        icon: 'download',
        color: 'primary',
        condition: this.shouldShowTranslatedDownloads()
      },
      {
        id: 'fhir-package',
        label: 'Generate FHIR Package',
        icon: 'archive',
        color: 'primary',
        condition: this.shouldShowFHIRPackageDownloads()
      }
    ].filter(button => button.condition);
  }

  getDownloadHandler(buttonId: string): () => void {
    switch (buttonId) {
      case 'target-valueset':
        return () => this.onDownloadTargetValueSet();
      case 'target-excel':
        return () => this.onDownloadTargetAsExcel();
      case 'source-valueset':
        return () => this.onDownloadSourceValueSet();
      case 'translated-file':
        return () => this.onDownloadTranslatedFile();
      case 'fhir-package':
        return () => this.onGenerateFHIRPackage();
      default:
        return () => {};
    }
  }
}