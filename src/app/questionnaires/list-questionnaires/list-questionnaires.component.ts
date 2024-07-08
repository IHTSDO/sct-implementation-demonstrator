import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, combineLatest, debounceTime, distinctUntilChanged, first } from 'rxjs';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { FhirService } from 'src/app/services/fhir.service';
import * as saveAs from 'file-saver';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { QuestionnaireService } from 'src/app/services/questionnaire.service';
import { MatDialog } from '@angular/material/dialog';
import { CreateRootModuleComponent } from '../create-root-module/create-root-module.component';
import { MatTooltip } from '@angular/material/tooltip';
import { MatPaginator } from '@angular/material/paginator';

@Component({
  selector: 'app-list-questionnaires',
  templateUrl: './list-questionnaires.component.html',
  styleUrls: ['./list-questionnaires.component.css']
})
export class ListQuestionnairesComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  @Output() questionnaireSelected = new EventEmitter<any>();
  @Output() validateQuestionnaire = new EventEmitter<any>();
  @Output() previewQuestionnaire = new EventEmitter<any>();
  @Output() viewQuestionaireHistory = new EventEmitter<any>();


  @Input() config: any = {};

  displayedColumns: string[] = ['title','status', 'version', 'lastUpdated', 'type', 'actions'];
  dataSource = new MatTableDataSource<any>();

  questionnaires: any[] = [];
  loading = false;
  selectedFhirServer: string = "";
  selectedUserTag: string = "";
  notFound = false;

  private baseUrlChanged = new Subject<string>();
  private userTagChanged = new Subject<string>();

  fbUrl = 'https://formbuilder.nlm.nih.gov';

  blankQuestionnaire = {
    "resourceType": "Questionnaire",
    "title": "New Form",
    "status": "draft",
    "item": [
      {
        "type": "string",
        "linkId": "4009522077787",
        "text": "Item 0"
      }
    ]
  };

  constructor(
    private fhirService: FhirService, 
    private questionnaireService: QuestionnaireService,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar) { }

  ngOnInit() {
    // Moved to after view init
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'type':
          return this.isRootQuestionnaire(item) ? 'Modular root' : 'Questionnaire';
        case 'version':
          return item.meta && item.meta.versionId ? item.meta.versionId : '';
        case 'lastUpdated':
          return item.meta && item.meta.lastUpdated ? new Date(item.meta.lastUpdated) : '';
        default:
          return item[property];
      }
    };

    if (this.selectedUserTag && this.selectedFhirServer) {
      this.loadQuestionnaires();
    }

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
        this.dataSource.data = this.questionnaires; 
        this.dataSource.sort = this.sort;
        this.loading = false;
        // Set default sort
        this.sort.active = 'title';
        this.sort.direction = 'asc';
        this.sort.sortChange.emit();
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

  viewHistory(questionnaire: any) {
    this.viewQuestionaireHistory.emit(questionnaire);
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

  isRootQuestionnaire(questionnaire: any): boolean {
    if (questionnaire.extension && Array.isArray(questionnaire.extension)) {
      return questionnaire.extension.some( (ext: any) => 
        ext.url === "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-assemble-expectation" &&
        ext.valueCode === "assemble-root"
      );
    } else return false;
  }
  
  assemble(questionnaire: any) {
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 2 * 1000,
      data: "Assembling Questionnaire...",
      panelClass: ['green-snackbar']
    });
    this.questionnaireService.assembleQuestionnaire(questionnaire).then(assembledQuestionnaire => {
      assembledQuestionnaire.title = questionnaire.title + " (assembled)";
      this.previewQuestionnaire.emit(assembledQuestionnaire);
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 2 * 1000,
        data: "Questionnaire ready",
        panelClass: ['green-snackbar']
      });
    }).catch(error => {
      console.error('Error assembling questionnaire:', error);
      // Handle the error
    });
  }

  createQuestionnaire() {
    let questionnaire: any = this.blankQuestionnaire;
    if (!questionnaire.meta) {
      questionnaire.meta = {};
    }
    questionnaire.meta.tag = [
      {
          system: "http://snomed.org/tags",
          code: this.selectedUserTag,
          display: this.selectedUserTag
      },
      {
        system: "http://snomed.org/tags",
        code: "questionnaireManagerTool",
        display: "questionnaireManagerTool"
      }
    ];
    this.editQuestionnaire(questionnaire);
  }

  editQuestionnaire(questionnaire: any) {
    const fbWin = window.open(this.fbUrl + '/window-open?referrer='+encodeURIComponent(window.location.href));
    window.addEventListener('message', handleFormBuilderMessages, true);
    let context = this
    function handleFormBuilderMessages(event: any) {
      if(event.origin === context.fbUrl) {
        const eventType = event.data.type;
        const reveivedQuestionnaire = event.data.questionnaire;
        switch (eventType) {
          case 'initialized':
            fbWin?.postMessage({type: 'initialQuestionnaire', questionnaire: questionnaire}, context.fbUrl);
            break;
    
          case 'updateQuestionnaire':
            // Use this to get continuous updates. The message is triggered by every
            // change in the form builder with about 0.5 second debounce.
            break;
    
          case 'closed':
            context.fhirService.updateOrCreateQuestionnaire(reveivedQuestionnaire, context.selectedUserTag).pipe(first()).subscribe(
              (data: any) => {
                context._snackBar.openFromComponent(SnackAlertComponent, {
                  duration: 5 * 1000,
                  data: "Questionnaire updated successfully",
                  panelClass: ['green-snackbar']
                });
                context.updateQuestionnairesList(data);
              },
              (error: any) => {
                context._snackBar.openFromComponent(SnackAlertComponent, {
                  duration: 5 * 1000,
                  data: "Error saving questionnaire",
                  panelClass: ['red-snackbar']
                });
              });
            break;
        }
      }
    } 
  }

  async openModularQuestionnaireModal(modularQuestionnaire: any) {
    let data = await this.questionnaireService.getRootQuestionnaireData(modularQuestionnaire);
    const dialogRef = this.dialog.open(CreateRootModuleComponent, {
      data: data,
      width: '75%'
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.handleDialogResult(result, modularQuestionnaire);
      }
    });
  }
  
  async handleDialogResult(result: any, modularQuestionnaire: any) {
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 5 * 1000,
      data: "Updating questionnaire...",
      panelClass: ['green-snackbar']
    });
    try {
      let newRootQuestionnaire = await this.questionnaireService.generateRootQuestionnaire(result.title, result.questionnaires);
      if (newRootQuestionnaire) {
        modularQuestionnaire.title = result.title;
        modularQuestionnaire.item = newRootQuestionnaire.item;
        this.addQuestionnaire(modularQuestionnaire);
        this.fhirService.updateOrCreateQuestionnaire(modularQuestionnaire, this.selectedUserTag).pipe(first()).subscribe(
          (data: any) => {
            this._snackBar.openFromComponent(SnackAlertComponent, {
              duration: 5 * 1000,
              data: "Questionnaire updated successfully",
              panelClass: ['green-snackbar']
            });
            this.updateQuestionnairesList(data);
          },
          (error: any) => {
            this._snackBar.openFromComponent(SnackAlertComponent, {
              duration: 5 * 1000,
              data: "Error saving questionnaire",
              panelClass: ['red-snackbar']
            });
          });
      }
    } catch (error) {
      console.error('Error handling dialog result:', error);
      // Handle the error
    }
  }

  // Download the questionnaires array as a bundle
  downloadAllQuestionnaires() {
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 5 * 1000,
      data: "Downloading Questionnaires...",
      panelClass: ['green-snackbar']
    });
    this.fhirService.getQuestionnairesByTag(this.selectedUserTag).subscribe((data: any) => {
      var blob = new Blob([JSON.stringify(data, null, 2)], {type: "text/plain;charset=utf-8"});
      saveAs(blob, `questionnaires-bundle.json`);
      this._snackBar.openFromComponent(SnackAlertComponent, {
        duration: 5 * 1000,
        data: "Questionnaires downloaded successfully",
        panelClass: ['green-snackbar']
      });
    });
  }

  getReferencingQuestionnaires(questionnaire: any): any[] {
    let baseUrl = this.fhirService.getBaseUrl();
    let urlToMatch = `${baseUrl}/Questionnaire/${questionnaire.id}`;
  
    let referencingQuestionnaires = this.dataSource.data.filter((q) => {
      // Check if any top-level item has subitems with the specified extension
      return q.item && Array.isArray(q.item) && q.item.some((item: any) => {
        return item.item && Array.isArray(item.item) && item.item.some((subItem: any) => {
          return subItem.extension && Array.isArray(subItem.extension) && subItem.extension.some((ext: any) => {
            return ext.url === "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-subQuestionnaire" && ext.valueCanonical === urlToMatch;
          });
        });
      });
    });
  
    return referencingQuestionnaires;
  }

  getDeleteTooltip(element: any): string {
    const referencingQuestionnaires = this.getReferencingQuestionnaires(element);
    if (referencingQuestionnaires.length === 0) {
      return 'Delete Questionnaire'; // No referencing questionnaires
    } else {
      // Adding quotes around each title and then joining them
      const titles = referencingQuestionnaires.map(q => `"${q.title}"`).join(', ');
      return `Cannot delete: Referenced by ${titles}`;
    }
  }
  
}
