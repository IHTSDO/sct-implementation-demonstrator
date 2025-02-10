import { Component, Inject } from "@angular/core";
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from "@angular/material/snack-bar";

@Component({
    selector: 'snack-alert',
    templateUrl: './snack-alert.html',
    styles: [
        `
      .example-alert {
        color: white;
      }
    `,
    ],
    standalone: false
})
  export class SnackAlertComponent {
    constructor(
        public sbRef: MatSnackBarRef<SnackAlertComponent>,
        @Inject(MAT_SNACK_BAR_DATA) public data: any
      ) {}
  }