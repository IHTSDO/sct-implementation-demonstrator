import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { TRANSLOCO_SCOPE } from "@jsverse/transloco";

/**
 * Dialog Component (Embedded in the same file).
 * This component is opened by the MaturityMainComponent using MatDialog.
 */
@Component({
    selector: 'app-maturity-results-dialog',
    template: `
      <ng-container *transloco="let t; prefix: 'maturity'">
        <h2 mat-dialog-title>{{ t('resultsDialog.title') }} {{ stakeholderName }}</h2>
        <div mat-dialog-content>
          <app-maturity-results
            [maturityResponse]="maturityResponse"
            [allQuestions]="allQuestions">
          </app-maturity-results>
        </div>
        <div mat-dialog-actions align="end">
          <button mat-button mat-dialog-close>{{ t('resultsDialog.close') }}</button>
        </div>
      </ng-container>
    `,
    providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'maturity' }],
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