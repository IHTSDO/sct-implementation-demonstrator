import { Clipboard } from '@angular/cdk/clipboard';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { saveAs } from 'file-saver';

export interface ResponseDialogData {
  title: string;
  responseJson: string;
}

@Component({
  selector: 'app-response-dialog',
  templateUrl: './response-dialog.component.html',
  styleUrls: ['./response-dialog.component.css'],
  standalone: false
})
export class ResponseDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ResponseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResponseDialogData,
    private clipboard: Clipboard
  ) {}

  copy() {
    this.clipboard.copy(this.data.responseJson);
  }

  download() {
    const blob = new Blob([this.data.responseJson], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `${this.data.title}-QuestionnaireResponse.json`);
  }
}
