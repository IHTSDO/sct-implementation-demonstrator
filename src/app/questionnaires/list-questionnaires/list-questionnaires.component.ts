import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { FhirService } from 'src/app/services/fhir.service';

@Component({
  selector: 'app-list-questionnaires',
  templateUrl: './list-questionnaires.component.html',
  styleUrls: ['./list-questionnaires.component.css']
})
export class ListQuestionnairesComponent implements OnInit, OnChanges {

  @Output() questionnaireSelected = new EventEmitter<any>();
  @Output() validateQuestionnaire = new EventEmitter<any>();
  @Output() previewQuestionnaire = new EventEmitter<any>();

  @Input() config: any = {};

  questionnaires: any[] = [];
  loading = false;
  selectedFhirServer: string = "";
  selectedUserTag: string = "";
  notFound = false;

  private baseUrlChanged = new Subject<string>();
  private userTagChanged = new Subject<string>();

  constructor(private fhirService: FhirService) { }

  ngOnInit() {
    combineLatest([
      this.fhirService.baseUrl$.pipe(
        debounceTime(1000),
        distinctUntilChanged()
      ),
      this.fhirService.userTag$.pipe(
        debounceTime(1000),
        distinctUntilChanged()
      )
    ]).subscribe(([baseUrl, userTag]) => {
      if (this.selectedFhirServer !== baseUrl || this.selectedUserTag !== userTag) {
        this.selectedFhirServer = baseUrl;
        this.selectedUserTag = userTag;
        if (this.selectedUserTag && this.selectedFhirServer) {
          this.loadQuestionnaires();
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
  }

  loadQuestionnaires() {
    this.loading = true;
    this.notFound = false;
    this.questionnaires = [];
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

  updateQuestionnairesList(newQuestionnaire: any): void {
    // Find the index of the existing questionnaire
    const index = this.questionnaires.findIndex(q => q.id === newQuestionnaire.id);
  
    if (index !== -1) {
      // Questionnaire exists, replace it
      this.questionnaires[index] = newQuestionnaire;
    } else {
      // Questionnaire does not exist, add it to the array
      this.questionnaires.push(newQuestionnaire);
    }
  }

  addQuestionnaire(questionnaire: any) {
    this.updateQuestionnairesList(questionnaire);
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

  validate(questionnaire: any) {
    this.validateQuestionnaire.emit(questionnaire);
  }

  preview(questionnaire: any) {
    this.previewQuestionnaire.emit(questionnaire);
  }

  openInNewTab(questionnaire: any) {
    let url = this.selectedFhirServer + '/Questionnaire/' + questionnaire.id;
    window.open(url, '_blank');
  }
}