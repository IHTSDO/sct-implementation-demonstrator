import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-dialog',
  template: `
    <h2 mat-dialog-title>Loading ICD 11 map...</h2>
    <div mat-dialog-content>
        <mat-progress-bar mode="determinate" [value]="progress"></mat-progress-bar>

      <!-- <div class="progress">
        <div class="progress-bar" [style.width.%]="progress"></div>
      </div> -->
    </div>
  `,
})
export class LoadingDialogComponent {
  progress = 0;
}
