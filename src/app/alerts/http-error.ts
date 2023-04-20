import { Component, Inject } from "@angular/core";
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from "@angular/material/snack-bar";

@Component({
    selector: 'snack-http-error',
    templateUrl: './http-error.html',
    styles: [
      `
      .example-alert {
        color: hotpink;
      }
    `,
    ],
  })
  export class HttpErrorComponent {
    constructor(
        public sbRef: MatSnackBarRef<HttpErrorComponent>,
        @Inject(MAT_SNACK_BAR_DATA) public data: any
      ) {}
  }