import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FileProcessingResult, ColumnOption } from '../../models';

@Component({
  selector: 'app-file-preview-section',
  templateUrl: './file-preview-section.component.html',
  styleUrls: ['./file-preview-section.component.scss']
})
export class FilePreviewSectionComponent {
  @Input() showPreview = false;
  @Input() previewData: any[] = [];
  @Input() columns: ColumnOption[] = [];
  @Input() displayedColumns: string[] = [];
  @Input() importForm!: FormGroup;
  @Input() processingResult: FileProcessingResult | null = null;
  @Input() isLoading = false;
  @Input() isEclResult = false;
  
  @Output() formValueChanged = new EventEmitter<{field: string, value: any}>();

  onFormValueChange(field: string, value: any): void {
    this.formValueChanged.emit({ field, value });
  }

  shouldShowColumnForm(): boolean {
    return this.showPreview && 
           !this.processingResult?.isValueSetFile && 
           !this.processingResult?.isMap && 
           !this.processingResult?.isRf2Refset && 
           !this.isEclResult;
  }

  getPreviewData(): any[] {
    return this.previewData.slice(1, 6); // First 5 rows excluding header
  }
}
