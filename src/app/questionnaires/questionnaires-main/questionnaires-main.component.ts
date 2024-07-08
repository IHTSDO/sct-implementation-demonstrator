import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first, lastValueFrom, map } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { MatSort } from '@angular/material/sort';
import * as saveAs from 'file-saver';
import { FhirService } from 'src/app/services/fhir.service';
import { MatDialog } from '@angular/material/dialog';
import { LoadQuestionnaireModalComponent } from '../load-questionnaire-modal/load-questionnaire-modal.component';
import { FhirServerSettingsModalComponent } from '../fhir-server-settings-modal/fhir-server-settings-modal.component';
import { MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { ListQuestionnairesComponent } from '../list-questionnaires/list-questionnaires.component';
import { CreateRootModuleComponent } from '../create-root-module/create-root-module.component';
import { QuestionnaireService } from 'src/app/services/questionnaire.service';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { QuestionnaireHistoryComponent } from '../questionnaire-history/questionnaire-history.component';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-questionnaires-main',
  templateUrl: './questionnaires-main.component.html',
  styleUrls: ['./questionnaires-main.component.css']
})
export class QuestionnairesMainComponent implements OnInit{
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  @ViewChild('questionnairesList') questionnairesList!: ListQuestionnairesComponent;
  @ViewChild('fileInput') uploadInput!: ElementRef;
  @ViewChild('questionnaireHistory') questionnaireHistory!: QuestionnaireHistoryComponent;

  loading = false;
  validating = false;
  questionnaire: any;
  orderCounter = 0;
  savingQuestionnaire = false;

  selectedFhirServer: string = "";
  selectedUserTag: string = "";

  showFhirSetupModal = false;

  listConfig = { validate : true, preview: true };
  mode = "step1";
  step1Response: any;

  constructor(private http: HttpClient, 
    private terminologyService: TerminologyService,
    private fhirService: FhirService,
    private questionnaireService: QuestionnaireService,
    private activatedRoute: ActivatedRoute,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar) { }

  ngOnInit() {
    this.fhirService.baseUrl$.subscribe(url => {
      this.selectedFhirServer = url;
    });
    this.fhirService.userTag$.subscribe(tag => {
      this.selectedUserTag = tag;
    });
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['utility'] === 'true') {
        this.mode = 'utility';
      } else {  
        this.mode = 'step1';
      }
    });
    this.loadScript();
  }

  loadScript() {
    const script = document.createElement('script');
    script.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/35.0.4/webcomponent/lhc-forms.js'; // Replace with the actual URL of your JS library
    script.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/35.0.4/fhir/R4/lformsFHIR.min.js'; // Replace with the actual URL of your JS library
      script2.onload = () => {
        // Script has loaded
        // Initialize or use the library here, if necessary
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script);

  }

  toggleMode() {
    if (this.mode === "Validator") {
      const dialogRef = this.dialog.open(FhirServerSettingsModalComponent, {
        width: '60%',
        disableClose: true
      });
    
      dialogRef.afterClosed().subscribe(result => {
        if (result === 'save') {
          this.mode = "Manager";
          setTimeout(() => {
            this.tabGroup.selectedIndex = 0;
          }, 500);
        } else if (result === 'close') {
          // Nothing
        }
      });
    } else {
      this.mode = "Validator";
    }
  }

  previewForm() {
    if (this.getCurrentTabName() == "Preview") {
      if (this.questionnaire) {
        LForms.Util.addFormToPage(this.questionnaire, 'myFormContainer');
      } else {
        LForms.Util.addFormToPage({}, 'myFormContainer');
      }
    }
  }

  getFormData() {
    if (this.questionnaire) {
      const formData = LForms.Util.getFormData('myFormContainer', true, true, true);
      console.log(formData);
    }
  }

  displayHistory(questionnaire: any) {
    if (questionnaire) {
      this.questionnaireHistory.loadVersions(questionnaire);
    }
  }

  loadExampleQuestionnaire() {
    lastValueFrom(this.http.get('assets/questionnaires/Carcinoma-of-the-Exocrine-Pancreas-Histopathology-Reporting-Form.R4 (11).json')).then(data => {
      this.loadQuestionnaire(data);
      if (this.mode === "Manager") {
        this.tabGroup.selectedIndex = 1;
      }
    });
  }

  clearQuestionnaire() {
    this.questionnaire = null;
    this.orderCounter = 0;
    this.previewForm();
  }

  createQuestionnaire() {
    this.questionnairesList.createQuestionnaire();
  }

  loadQuestionnaire(data: any) {
    this.loading = true;
    this.clearQuestionnaire();
    // wait a second to show the loading spinner
    setTimeout(() => {
      this.loading = false;
      this.questionnaire = data;
      this.previewForm();
    }, 700);
  }

  saveQuestionnaireToDisk() {
    var blob = new Blob([JSON.stringify(this.questionnaire, null, 2)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${this.questionnaire.title}.json`);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          if (jsonData.resourceType === "Questionnaire") {
            this.loadQuestionnaire(jsonData);
              setTimeout(() => {
                if (this.mode === "Manager") {
                this.postCurrentQuestionnaire();
                } else {
                  this.tabGroup.selectedIndex = 1;
                }
              }, 1000);
          } else {
            this._snackBar.openFromComponent(SnackAlertComponent, {
              duration: 5 * 1000,
              data: "The file is not a FHIR Questionnaire Resource",
              panelClass: ['red-snackbar']
            });
          }
        } catch (error) {
          console.error(error);
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Invalid JSON file",
            panelClass: ['red-snackbar']
          });
        }
      };
      reader.readAsText(file);
      (event.target as HTMLInputElement).value = '';
    }
  }

  postCurrentQuestionnaire() {
    this.postQuestionnaire(this.questionnaire);
  }

  postQuestionnaire(questionnaire: any) {
    console.log("Posting questionnaire", questionnaire);
    const index = this.questionnairesList.questionnaires.findIndex((q: any) => q.title === questionnaire.title && q.id !== questionnaire.id);
    if (index !== -1) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        width: '400px',
        data: {
          title: 'Confirm Action',
          message: 'A questionnaire with the same title and different ID already exists. Do you want to proceed?'
        }
      });
  
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.saveQuestionnaire(questionnaire);
        } else {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Questionnaire save action cancelled",
            panelClass: ['red-snackbar']
          });
        }
      });
    } else {
      // find if there is a questionnaire with the same title, same id, and newer or equal version
      const index2 = this.questionnairesList.questionnaires.findIndex((q: any) => q.title === questionnaire.title && q.id === questionnaire.id && q.meta?.versionId >= questionnaire.meta?.versionId);
      let newerQuestionnaire = this.questionnairesList.questionnaires[index2];
      if (index2 !== -1) {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
          width: '400px',
          data: {
            title: 'Confirm Action',
            message: 'A newer version or identical of this questionnaire already exists. Do you want to proceed?'
          }
        });
    
        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.saveQuestionnaire(questionnaire);
          } else {
            this._snackBar.openFromComponent(SnackAlertComponent, {
              duration: 5 * 1000,
              data: "Questionnaire save action cancelled",
              panelClass: ['red-snackbar']
            });
          }
        });
      } else {
        this.saveQuestionnaire(questionnaire);
      }
    }
  }

  saveQuestionnaire(questionnaire: any) {
    this.savingQuestionnaire = true;
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 5 * 1000,
      data: "Saving Questionnaire...",
      panelClass: ['green-snackbar']
    });
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
    this.fhirService.updateOrCreateQuestionnaire(questionnaire, this.selectedUserTag).pipe(first()).subscribe(
      (data: any) => {
        setTimeout(() => {
          this.tabGroup.selectedIndex = 0;
          setTimeout(() => {
            this.savingQuestionnaire = false;
            this.questionnairesList.addQuestionnaire(data);
          }, 300);
        }, 300);
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Questionnaire saved successfully",
          panelClass: ['green-snackbar']
        });
      },
      (error: any) => {
        this.savingQuestionnaire = false;
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Error saving questionnaire",
          panelClass: ['red-snackbar']
        });
      });
  }

  listQuestionnaires() {
    this.fhirService.getQuestionnairesByTag(this.selectedUserTag).pipe(first()).subscribe(
      (data: any) => {
      },
      (error: any) => {
        console.error(error);
      });
  }

  openLoadQuestionnairesDialog(): void {
    const dialogRef = this.dialog.open(LoadQuestionnaireModalComponent, {
      width: '70%'
      // additional configuration if needed
    });
  
    dialogRef.afterClosed().subscribe(result => {
      this.loadQuestionnaire(result);
    });
  }

  setFhirServer() {
    this.fhirService.setBaseUrl(this.selectedFhirServer);
    this.fhirService.setUserTag(this.selectedUserTag);
  }

  setupFhirServer(): void {
    this.dialog.open(FhirServerSettingsModalComponent, {
      width: '60%',
      // additional configurations if needed
    });
  }

  switchToValidateTab(questionnaire: any) {
    this.loadQuestionnaire(questionnaire);
    this.tabGroup.selectedIndex = 2;
  }

  switchToPreviewTab(questionnaire: any) {
    this.loadQuestionnaire(questionnaire);
    this.tabGroup.selectedIndex = 1;
  }

  switchToHistoryTab(questionnaire: any) {
    this.displayHistory(questionnaire);
    this.tabGroup.selectedIndex = 3;
  }

  advanceFromStep1() {
    if (this.step1Response == "edit") {
      window.open('https://lhcformbuilder.nlm.nih.gov/', '_blank');
    } else if (this.step1Response == "validate") {
      this.mode = "Validator";
      setTimeout(() => {
        this.uploadInput.nativeElement.click();
      }, 200);
    } else if (this.step1Response == "repository") {
      const dialogRef = this.dialog.open(FhirServerSettingsModalComponent, {
        width: '60%'
      });
  
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.mode = "Manager";
        }
      });
    } else if (this.step1Response == "example") {
      this.mode = "Validator";
      setTimeout(() => {
        this.loadExampleQuestionnaire();
      }, 300);
    } else if (this.step1Response == "reconnect") {
      this.mode = "Manager";
    }
    this.step1Response = "";
  }

  getCurrentTabName(): string {
    const tabIndex = this.tabGroup.selectedIndex;
    if (tabIndex !== null && tabIndex !== undefined) {
      const tab = this.tabGroup._tabs.toArray()[tabIndex];
      return tab.textLabel;
    } else {
      return "";
    }
  }

  onTabChange(index: number) {
    const tabLabel = this.tabGroup._tabs.toArray()[index].textLabel;
    if (tabLabel === "Preview") {
      setTimeout(() => {
        this.previewForm();
      }, 300);
    }
  }

  openModularQuestionnaireModal() {
    const dialogRef = this.dialog.open(CreateRootModuleComponent, {
      width: '75%'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Process the result here
        this.questionnaireService.generateRootQuestionnaire(result.title, result.questionnaires).then(rootForm => {
          this.postQuestionnaire(rootForm);
        }).catch(error => {
          console.error('Error:', error);
          // Handle error
        });
      }
    });
  }

}
