import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FhirService } from 'src/app/services/fhir.service';

@Component({
  selector: 'app-list-questionnaires',
  templateUrl: './list-questionnaires.component.html',
  styleUrls: ['./list-questionnaires.component.css']
})
export class ListQuestionnairesComponent implements OnInit {

  @Output() questionnaireSelected = new EventEmitter<any>();
  questionnaires: any[] = [];
  loading = false;
  selectedFhirServer: string = "";
  selectedUserTag: string = "";
  notFound = false;

  constructor(private fhirService: FhirService) { }

  ngOnInit() {
    this.selectedFhirServer = this.fhirService.getBaseUrl();
    this.selectedUserTag = this.fhirService.getUserTag();
    this.loadQuestionnaires();
  }

  loadQuestionnaires() {
    this.loading = true;
    console.log(`Loading questionnaires with tag ${this.selectedUserTag} from ${this.selectedFhirServer}`);
    this.fhirService.getQuestionnairesByTag(this.selectedUserTag).subscribe((data: any) => {
      if (data['entry']) {
        this.questionnaires = data['entry'].map((entry: any) => entry.resource);
        this.loading = false;
      } else {
        this.questionnaires = [];
        this.loading = false;
        this.notFound = true;
      }
    });
  }

  deleteQuestionnaire(questionnaire: any) {
    this.loading = true;
    this.fhirService.deleteQuestionnaire(questionnaire.id).subscribe(() => {
      this.loadQuestionnaires();
    });
  }

  selectQuestionnaire(questionnaire: any) {
    this.questionnaireSelected.emit(questionnaire);
  }
}
