import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

/**
 * Dialog Component (Embedded in the same file).
 * This component is opened by the MaturityMainComponent using MatDialog.
 */
@Component({
    selector: 'app-maturity-results-dialog',
    template: `
      <h2 mat-dialog-title>Maturity Results: {{ stakeholderName }}</h2>
      <div mat-dialog-content>
        <!-- 
          We embed MaturityResultsComponent here. 
          We assume MaturityResultsComponent has an @Input() named 'maturityResponse' and 'allQuestions'.
        -->
        <app-maturity-results 
          [maturityResponse]="maturityResponse"
          [allQuestions]="allQuestions">
        </app-maturity-results>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </div>
    `,
    standalone: false
})
  export class MaturityResultsDialogComponent {
    public maturityResponse: any;
    public allQuestions: any[] = [];
    public stakeholderName: string = '';
  
    constructor(
      @Inject(MAT_DIALOG_DATA) public data: any,
      private dialogRef: MatDialogRef<MaturityResultsDialogComponent>
    ) {
      this.maturityResponse = data.maturityResponse;
      this.allQuestions = data.allQuestions || [];
      // Get stakeholder name from maturityResponse or data
      this.stakeholderName = data.maturityResponse?.name || 
                            data.stakeholderName || 
                            data.maturityResponse?.stakeHolderName || 
                            'Unknown Stakeholder';
    }
  
    closeDialog(): void {
      this.dialogRef.close();
    }
  }