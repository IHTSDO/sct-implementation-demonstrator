import { Component, OnInit, ViewChild } from '@angular/core';
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


@Component({
  selector: 'app-questionnaires-main',
  templateUrl: './questionnaires-main.component.html',
  styleUrls: ['./questionnaires-main.component.css']
})
export class QuestionnairesMainComponent implements OnInit{
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  @ViewChild('questionnairesList') questionnairesList!: ListQuestionnairesComponent;

  loading = false;
  validating = false;
  questionnaire: any;
  orderCounter = 0;

  selectedFhirServer: string = "";
  selectedUserTag: string = "";

  showFhirSetupModal = false;
  previewTabVisible = true;

  listConfig = { validate : true, preview: true };
  mode = "Validator";

  constructor(private http: HttpClient, 
    private terminologyService: TerminologyService,
    private fhirService: FhirService,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar) { }

  ngOnInit() {
    this.fhirService.baseUrl$.subscribe(url => {
      this.selectedFhirServer = url;
    });
    this.fhirService.userTag$.subscribe(tag => {
      this.selectedUserTag = tag;
    });
    this.loadScript();
  }

  loadScript() {
    const script = document.createElement('script');
    script.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/34.3.1/webcomponent/lhc-forms.js'; // Replace with the actual URL of your JS library
    script.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/34.0.0/fhir/R4/lformsFHIR.min.js'; // Replace with the actual URL of your JS library
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
    if (this.previewTabVisible) {
      if (this.questionnaire) {
        LForms.Util.addFormToPage(this.questionnaire, 'myFormContainer');
      } else {
        LForms.Util.addFormToPage({}, 'myFormContainer');
      }
    }
  }

  onTabChange(event: MatTabChangeEvent) {
    if (event.tab.textLabel === 'Preview') {
      this.previewTabVisible = true;
      this.previewForm();
    } else {
      this.previewTabVisible = false;
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

  saveQuestionnaire() {
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
            if (this.mode === "Manager") {
              this.tabGroup.selectedIndex = 1;
            }
          } else {
            this._snackBar.openFromComponent(SnackAlertComponent, {
              duration: 5 * 1000,
              data: "The file is not a FHIR Questionnaire Resource",
              panelClass: ['red-snackbar']
            });
          }
        } catch (error) {
          this._snackBar.openFromComponent(SnackAlertComponent, {
            duration: 5 * 1000,
            data: "Invalid JSON file",
            panelClass: ['red-snackbar']
          });
        }
      };
      reader.readAsText(file);
    }
  }

  postQuestionnaire() {
    this.questionnaire.meta = {
      tag: [
          {
              system: "http://snomed.org/tags",
              code: this.selectedUserTag,
              display: "Test tag"
          },
          {
            system: "http://snomed.org/tags",
            code: this.selectedUserTag,
            display: "questionnaireManagerTool"
        }
      ]
  };
    this.fhirService.postQuestionnaire(this.questionnaire).pipe(first()).subscribe(
      (data: any) => {
        setTimeout(() => {
          this.tabGroup.selectedIndex = 0;
          setTimeout(() => {
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

  openDialog(): void {
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

}
