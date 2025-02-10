// In load-questionnaire-modal.component.ts
import { Component, OnChanges } from '@angular/core';
import { FhirService } from '../../services/fhir.service';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-load-questionnaire-modal',
    templateUrl: './load-questionnaire-modal.component.html',
    styleUrls: ['./load-questionnaire-modal.component.css'],
    standalone: false
})
export class LoadQuestionnaireModalComponent {

  listConfig = { select : true };

  constructor(public dialogRef: MatDialogRef<LoadQuestionnaireModalComponent>) { }

  selectAndDownload(questionnaire: any) {
    this.dialogRef.close(questionnaire);
  }

}
