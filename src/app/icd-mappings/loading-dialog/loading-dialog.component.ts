import { Component } from '@angular/core';

@Component({
  selector: 'app-icd-loading-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Loading ICD maps...</h2>
    <div mat-dialog-content>
      <mat-progress-bar mode="determinate" [value]="progress"></mat-progress-bar>
    </div>
  `,
})
export class IcdLoadingDialogComponent {
  progress = 0;
}
