import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/**
 * Dialog Component (Embedded in the same file).
 * This component is opened by the MaturityMainComponent using MatDialog.
 */
@Component({
    selector: 'app-maturity-results-dialog',
    template: `
      <h2 mat-dialog-title>Maturity Results</h2>
      <div mat-dialog-content>
        <!-- 
          We embed MaturityResultsComponent here. 
          We assume MaturityResultsComponent has an @Input() named 'maturityResponse'.
        -->
        <app-maturity-results [maturityResponse]="maturityResponse"></app-maturity-results>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </div>
    `
  })
  export class MaturityResultsDialogComponent {
    public maturityResponse: any;
  
    constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private dialogRef: MatDialogRef<MaturityResultsDialogComponent>
    ) {
      this.maturityResponse = data.maturityResponse;
    }
  
    closeDialog(): void {
      this.dialogRef.close();
    }
  }