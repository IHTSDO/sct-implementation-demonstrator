import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';
import { FileProcessingService } from '../../services/file-processing.service';
import { ValueSetTranslatorStateService } from '../../services/state.service';
import { FileProcessingResult } from '../../models';

@Component({
  selector: 'app-file-upload-section',
  templateUrl: './file-upload-section.component.html',
  styleUrls: ['./file-upload-section.component.scss']
})
export class FileUploadSectionComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;
  
  @Input() showEclInput = false;
  @Input() eclExpression = '';
  @Input() file: File | null = null;
  @Input() processingResult: FileProcessingResult | null = null;
  @Input() isFileLoading = false;
  
  @Output() fileSelected = new EventEmitter<File>();
  @Output() eclInputToggled = new EventEmitter<void>();
  @Output() eclExpressionChanged = new EventEmitter<string>();
  @Output() eclExpanded = new EventEmitter<string>();

  constructor(
    private fileProcessingService: FileProcessingService,
    private stateService: ValueSetTranslatorStateService
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }

  onEclInputToggle(): void {
    this.eclInputToggled.emit();
  }

  onEclExpressionChange(expression: string): void {
    this.eclExpressionChanged.emit(expression);
  }

  onEclExpand(): void {
    if (this.eclExpression.trim()) {
      this.eclExpanded.emit(this.eclExpression);
    }
  }

  getFileTypeNotice(): string {
    if (!this.processingResult) return '';
    
    if (this.processingResult.isMap) {
      return 'Snap2Snomed Map detected - Columns configured automatically';
    } else if (this.processingResult.isRf2Refset) {
      return 'RF2 Refset detected';
    } else if (this.processingResult.isValueSetFile) {
      return 'FHIR ValueSet JSON detected';
    } else if (this.processingResult.data.length > 0) {
      return 'Simple spreadsheet detected';
    }
    
    return '';
  }

  getFileTypeIcon(): string {
    if (!this.processingResult) return '';
    
    if (this.processingResult.isMap) return 'info';
    if (this.processingResult.isRf2Refset) return 'description';
    if (this.processingResult.isValueSetFile) return 'schema';
    return 'table_chart';
  }

  getFileTypeColor(): string {
    if (!this.processingResult) return 'primary';
    
    if (this.processingResult.isMap) return 'primary';
    if (this.processingResult.isRf2Refset) return 'accent';
    if (this.processingResult.isValueSetFile) return 'primary';
    return 'primary';
  }
}
