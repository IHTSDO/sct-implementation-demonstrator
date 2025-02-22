import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-language-config',
  templateUrl: './language-config.component.html',
  styleUrls: ['./language-config.component.css'],
  standalone: false
})
export class LanguageConfigComponent {

  languageCodes: string[] = [];
  languageRefsets: any[] = [];

  // This array holds the contexts to be edited.
  context: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<LanguageConfigComponent>, 
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { 
    this.languageCodes = data.languageCodes;
    this.languageRefsets = data.languageRefsets;
    // Optionally, initialize context from incoming data.
    this.context = data.context || [{ languageCode: '', languageRefset: {} }];
  }

  // Add a new context with empty values.
  addContext(): void {
    this.context.push({
      languageCode: '',
      languageRefset: ''
    });
  }

  // Remove a context by index.
  removeContext(index: number): void {
    this.context.splice(index, 1);
  }

  // Handle drag and drop to reorder the context array.
  drop(event: CdkDragDrop<any[]>): void {
    moveItemInArray(this.context, event.previousIndex, event.currentIndex);
  }

  // Close the dialog and pass the updated context back.
  save(): void {
    this.dialogRef.close(this.context);
  }

  // Optionally, a cancel/close method.
  close(): void {
    this.dialogRef.close('Dialog closed');
  }
}
