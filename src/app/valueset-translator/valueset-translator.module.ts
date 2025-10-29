import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Main component
import { ValuesetTranslatorRefactoredComponent } from './valueset-translator-refactored.component';

// Child components
import { FileUploadSectionComponent } from './components/file-upload-section/file-upload-section.component';
import { FilePreviewSectionComponent } from './components/file-preview-section/file-preview-section.component';
import { ActionSelectionSectionComponent } from './components/action-selection-section/action-selection-section.component';
import { TranslationSectionComponent } from './components/translation-section/translation-section.component';
import { DownloadSectionComponent } from './components/download-section/download-section.component';

// Services
import { FileProcessingService } from './services/file-processing.service';
import { ValueSetService } from './services/valueset.service';
import { TranslationService } from './services/translation.service';
import { ValueSetTranslatorStateService } from './services/state.service';

@NgModule({
  declarations: [
    ValuesetTranslatorRefactoredComponent,
    FileUploadSectionComponent,
    FilePreviewSectionComponent,
    ActionSelectionSectionComponent,
    TranslationSectionComponent,
    DownloadSectionComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  providers: [
    FileProcessingService,
    ValueSetService,
    TranslationService,
    ValueSetTranslatorStateService
  ],
  exports: [
    ValuesetTranslatorRefactoredComponent
  ]
})
export class ValuesetTranslatorModule { }
