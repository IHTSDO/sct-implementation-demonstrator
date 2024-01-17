import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { FhirService } from 'src/app/services/fhir.service';
import * as saveAs from 'file-saver';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'app-list-questionnaires',
  templateUrl: './list-questionnaires.component.html',
  styleUrls: ['./list-questionnaires.component.css']
})
export class ListQuestionnairesComponent implements OnInit, OnChanges {

  @ViewChild(MatSort) sort!: MatSort;

  @Output() questionnaireSelected = new EventEmitter<any>();
  @Output() validateQuestionnaire = new EventEmitter<any>();
  @Output() previewQuestionnaire = new EventEmitter<any>();

  @Input() config: any = {};

  displayedColumns: string[] = ['title','status', 'version', 'actions'];
  dataSource = new MatTableDataSource<any>();

  questionnaires: any[] = [];
  loading = false;
  selectedFhirServer: string = "";
  selectedUserTag: string = "";
  notFound = false;

  private baseUrlChanged = new Subject<string>();
  private userTagChanged = new Subject<string>();

  constructor(private fhirService: FhirService, private _snackBar: MatSnackBar) { }

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
        this.dataSource.data = this.questionnaires; //.slice(0, 11);
        this.dataSource.sort = this.sort;
        this.loading = false;
      } else {
        this.questionnaires = [];
        this.dataSource.data = this.questionnaires;
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
      this.dataSource.data = this.questionnaires;
    } else {
      // Questionnaire does not exist, add it to the array
      this.questionnaires.push(newQuestionnaire);
      this.dataSource.data = this.questionnaires;
    }
  }

  addQuestionnaire(questionnaire: any) {
    this.updateQuestionnairesList(questionnaire);
  }

  deleteQuestionnaire(questionnaire: any) {
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 5 * 1000,
      data: "Deleting Questionnaire...",
      panelClass: ['green-snackbar']
    });
    this.fhirService.deleteQuestionnaire(questionnaire.id).subscribe(() => {
      // remove from the list by id
      this.questionnaires = this.questionnaires.filter((q) => q.id !== questionnaire.id);
      this.dataSource.data = this.questionnaires;
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5 * 1000,
        data: "Questionnaire deleted successfully",
        panelClass: ['green-snackbar']
      });
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

  saveQuestionnaire(questionnaire: any) {
    var blob = new Blob([JSON.stringify(questionnaire, null, 2)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${questionnaire.title}-v${questionnaire.meta.versionId}.json`);
  }

}
