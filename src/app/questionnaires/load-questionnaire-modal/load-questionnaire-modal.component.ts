// In load-questionnaire-modal.component.ts
import { Component, OnInit } from '@angular/core';
import { FhirService } from '../../services/fhir.service';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-load-questionnaire-modal',
  templateUrl: './load-questionnaire-modal.component.html',
  styleUrls: ['./load-questionnaire-modal.component.css']
})
export class LoadQuestionnaireModalComponent implements OnInit {
  questionnaires: any[] = [];
  loading = false;

  constructor(private fhirService: FhirService, public dialogRef: MatDialogRef<LoadQuestionnaireModalComponent>) { }

  ngOnInit() {
    this.loadQuestionnaires();
  }

  loadQuestionnaires() {
    this.loading = true;
    this.fhirService.getQuestionnairesByTag('snomed-qtag').subscribe((data: any) => {
      this.questionnaires = data['entry'].map((entry: any) => entry.resource);
      this.loading = false;
    });
  }

  selectAndDownload(questionnaire: any) {
    this.dialogRef.close(questionnaire);
  }

  deleteQuestionnaire(questionnaire: any) {
    this.loading = true;
    this.fhirService.deleteQuestionnaire(questionnaire.id).subscribe(() => {
      this.loadQuestionnaires();
    });
  }
}
