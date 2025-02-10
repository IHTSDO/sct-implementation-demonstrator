import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { FhirService } from 'src/app/services/fhir.service';
import { saveAs } from 'file-saver';
import { combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
    selector: 'app-questionnaire-history',
    templateUrl: './questionnaire-history.component.html',
    styleUrls: ['./questionnaire-history.component.css'],
    standalone: false
})
export class QuestionnaireHistoryComponent implements OnInit, OnChanges {

  @Input() questionnaire: any;
  @Output() previewQuestionnaire = new EventEmitter<any>();
  @Output() restoreQuestionnaireVersion = new EventEmitter<any>();

  versions: any[] = [];
  loading = false;

  selectedFhirServer: string = "";
  selectedUserTag: string = "";

  displayedColumns: string[] = ['title','status', 'version', 'lastUpdated', 'type', 'actions'];
  dataSource = new MatTableDataSource<any>();

  constructor(private fhirService: FhirService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionnaire'] && changes['questionnaire'].currentValue && changes['questionnaire'].currentValue.id) {
      this.loadVersions();
    }
  }

  ngOnInit(): void {
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
          this.loadVersions();
        }
      }
    });
  }

  loadVersions(questionnaire?:any) {
    this.versions = [];
    this.dataSource.data = this.versions;
    if (questionnaire) {
      this.questionnaire = questionnaire;
    }
    if (this.questionnaire) {
      this.loading = true;
      this.fhirService.getQuestionnaireHistory(this.questionnaire.id).subscribe(
        (bundle: any) => {
          this.versions = bundle.entry.map((entry: any) => entry.resource);
          this.dataSource.data = this.versions;
          this.loading = false;
        },
        (error: any) => {
          this.loading = false;
        }
      );
    }
  }

  preview(version: any) {
    this.previewQuestionnaire.emit(version);
    this.loadVersions();
  }

  openInNewTab(questionnaire: any) {
    let url = this.selectedFhirServer + '/Questionnaire/' + questionnaire.id + '/_history/' + questionnaire.meta.versionId;
    window.open(url, '_blank');
  }

  saveQuestionnaire(questionnaire: any) {
    var blob = new Blob([JSON.stringify(questionnaire, null, 2)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${questionnaire.title}-v${questionnaire.meta.versionId}.json`);
  }

  restore(questionnaire: any) {
    this.restoreQuestionnaireVersion.emit(questionnaire);
  }

  isRootQuestionnaire(questionnaire: any): boolean {
    if (questionnaire.extension && Array.isArray(questionnaire.extension)) {
      return questionnaire.extension.some( (ext: any) => 
        ext.url === "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assemble-expectation" &&
        ext.valueCode === "assemble-root"
      );
    } else return false;
  }
}
