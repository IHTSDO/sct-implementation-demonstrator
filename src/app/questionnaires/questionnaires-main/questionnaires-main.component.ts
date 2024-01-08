import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first, lastValueFrom, map } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { TerminologyService } from 'src/app/services/terminology.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { MatSort } from '@angular/material/sort';
import * as saveAs from 'file-saver';
import { FhirService } from 'src/app/services/fhir.service';
import { MatDialog } from '@angular/material/dialog';
import { LoadQuestionnaireModalComponent } from '../load-questionnaire-modal/load-questionnaire-modal.component';
import { FhirServerSettingsModalComponent } from '../fhir-server-settings-modal/fhir-server-settings-modal.component';
import { MatTabChangeEvent } from '@angular/material/tabs';


@Component({
  selector: 'app-questionnaires-main',
  templateUrl: './questionnaires-main.component.html',
  styleUrls: ['./questionnaires-main.component.css']
})
export class QuestionnairesMainComponent implements OnInit{
  @ViewChild(MatSort) sort!: MatSort;

  loading = false;
  validating = false;
  displayedColumns: string[] = ['order','readablePath', 'code', 'display', 'system', 'status'];
  dataSource = new MatTableDataSource<any>();
  validatingProgress = 0;
  questionnaire: any;
  orderCounter = 0;
  loadResults: any = {
    total: 0,
    active: 0,
    inactive: 0,
    error: 0
  };

  selectedFhirServer: string = "";
  selectedUserTag: string = "";

  showFhirSetupModal = false;
  renderTabVisible = false;

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

  renderForm() {
    if (this.renderTabVisible) {
      if (this.questionnaire) {
        LForms.Util.addFormToPage(this.questionnaire, 'myFormContainer');
      } else {
        LForms.Util.addFormToPage({}, 'myFormContainer');
      }
    }
  }

  onTabChange(event: MatTabChangeEvent) {
    if (event.tab.textLabel === 'Render') {
      this.renderTabVisible = true;
      this.renderForm();
    } else {
      this.renderTabVisible = false;
    }
  }

  loadExampleQuestionnaire() {
    lastValueFrom(this.http.get('assets/questionnaires/Carcinoma-of-the-Exocrine-Pancreas-Histopathology-Reporting-Form.R4 (11).json')).then(data => {
      this.loadQuestionnaire(data);
    });
  }

  clearQuestionnaire() {
    this.questionnaire = null;
    this.dataSource.data = [];
    this.orderCounter = 0;
    this.validatingProgress = 0;
    this.loadResults = {
      total: 0,
      active: 0,
      inactive: 0,
      error: 0
    };
    this.renderForm();
  }

  loadQuestionnaire(data: any) {
    this.loading = true;
    this.clearQuestionnaire();
    // wait a second to show the loading spinner
    setTimeout(() => {
      this.loading = false;
      this.questionnaire = data;
      let extracted = this.extractObjects(data);
      this.dataSource.data = extracted; //.slice(0, 11);
      this.dataSource.sort = this.sort;
      this.renderForm();
    }, 700);
  }

  validate() {
    this.loadResults = {
      total: 0,
      active: 0,
      inactive: 0,
      error: 0
    };
    // Set all statuses to "Not checked"
    this.dataSource.data.forEach((item: any) => {
      item.status = "Not checked";
    });
    this.validating = true;
    let length = this.dataSource.data.length;
    let count = 0;
    this.asyncForEach(this.dataSource.data, async (item) => {
      this.loadResults.total++;
      item.status = "Validating";
      count++;
      this.validatingProgress = Math.round((count / length) * 100);
      try {
        const data = await this.terminologyService.lookupConcept(item.code, item.system).pipe(first()).toPromise();
        let designations: string[] = [];
        let fsn: string = "";
        for (const param of data.parameter) {
            if (param.name === "designation") {
              let term = "";
              let type = "";
              for (const part of param.part) {
                if (part.name === "value") {
                  term = part.valueString;
                }
                if (part.name === "use") {
                  type = part.valueCoding?.code;
                }
              }
              designations.push(term);
              if (type === "900000000000003001") {
                fsn = term;
              }
            }
            if (param.name === "inactive") {
                if (param.valueBoolean) {
                    item.status = "Inactive";
                    this.loadResults.inactive++;
                } else {
                    item.status = "Active";
                    this.loadResults.active++;
                }
            }
        }
        if (!item.display || !designations.includes(item.display)) {
          item.serverDisplay = fsn;
        }
        // Search replacements for inactive concepts
        if (item.status == "Inactive") {
          const sameAsReplacement = await this.getHistoricalAssociationsTarget("900000000000527005", item.code);
          const alternativeReplacement = await this.getHistoricalAssociationsTarget("900000000000530003", item.code);
          const possibilyEquivalentReplacement = await this.getHistoricalAssociationsTarget("900000000000523009", item.code);
          const replacedBy = await this.getHistoricalAssociationsTarget("900000000000526001", item.code);
          // join all arrays
          const replacements = sameAsReplacement.concat(alternativeReplacement, possibilyEquivalentReplacement, replacedBy);
          item.replacements = replacements;
        }
      } catch (error) {
          item.status = "Error";
          this.loadResults.error++;
      }
    }).then(() => {
      this.validating = false;
    });
  }

  async getHistoricalAssociationsTarget(mapId: string, code: string) {
    let result: any[] = [];
    const response = this.terminologyService.translate(mapId, code);
    let lastValue = await lastValueFrom(response.pipe(map(res => res)));
    if (lastValue.parameter) {
      for (const parameter of lastValue.parameter) {
        if (parameter.name === "match") {
          let resultItem: any = {
            replacement: {},
            equivalence: ""
          }
          for (const part of parameter.part) {
            if (part.name === "concept") {
              if (part.valueCoding) {
                resultItem.replacement = {
                  code: part.valueCoding.code,
                  display: part.valueCoding.display,
                  system: part.valueCoding.system
                };
              }
            }
            if (part.name === "equivalence") {
              if (part.valueCode) {
                resultItem.equivalence = part.valueCode;
              }
            }
          }
          result.push(resultItem);
        }
      }
    }
    return result;
  }

  removeSemanticTag(term: string) {
    return term.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
  }

  async asyncForEach(array: any[], callback: (item: any, index: number, array: any[]) => Promise<void>): Promise<void> {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
  }

  extractObjects(data: any, currentPath: string = "", readablePath: string = ""): Array<any> {
    let result: Array<any> = [];
    // Base case: if data is not an object or array, return
    if (typeof data !== 'object' || data === null) {
        return result;
    }

    // Update the readable path if the current object has a 'text' property
    if (data.text) {
        readablePath = readablePath ? `${readablePath} -> ${data.text}` : data.text;
    }

    // Check if the current data object has the desired properties and system starts with "http://snomed.info/sct"
    if (data.system && data.system.startsWith("http://snomed.info/sct") && data.code && data.display) {
        this.orderCounter++;
        const newObj: any = {
            order: this.orderCounter,
            system: data.system,
            code: data.code,
            display: data.display,
            path: currentPath,
            readablePath: readablePath,
            status: 'Not checked'
        };

        // Check for duplicates before adding (based on system, code, and display)
        if (!result.some(obj => obj.system === newObj.system && obj.code === newObj.code && obj.display === newObj.display)) {
            result.push(newObj);
        }
    }

    // If the current data object is an array, recursively extract objects from its items
    if (Array.isArray(data)) {
        for (let index in data) {
            const newPath = `${currentPath}[${index}]`;
            result = result.concat(this.extractObjects(data[index], newPath, readablePath));
        }
    } else {
        // If the current data object is not an array, check all its properties
        for (let key in data) {
            if (data.hasOwnProperty(key)) {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                result = result.concat(this.extractObjects(data[key], newPath, readablePath));
            }
        }
    }

    // Check if this has an ECL
    if (data.answerValueSet) {
      const url = new URL(data.answerValueSet);
      const fhir_vs = url.searchParams.get("fhir_vs");
      if (fhir_vs) {
          const unescapedValue = decodeURIComponent(fhir_vs);
  
          const pattern = /(\d{5,})(?:\s*\|\s*([^|]*)\s*\|)?/g;
          let match;
  
          while ((match = pattern.exec(unescapedValue)) !== null) {
            this.orderCounter++;
            result.push({
                order: this.orderCounter,
                code: match[1],
                display: match[2] ? match[2].trim() : undefined,
                system: 'http://snomed.info/sct',
                path: currentPath + '.answerValueSet',
                readablePath: readablePath + ' -> answerValueSet [ECL]',
                status: 'Not checked'
            });
          }
      }
    }

    return result;
  }
  replaceInactiveConcept(item: any, replacement: any) {
    let changesMade = this.searchAndReplace(this.questionnaire, item, replacement, false);
    if (changesMade) {
      this.loadQuestionnaire(this.questionnaire);
    }
  }

  searchAndReplace(data:any, item: any, replacement: any, changesMade: boolean): boolean {
    // Base case: if data is not an object or array, return
    if (typeof data !== 'object' || data === null) {
        return changesMade;
    }

    // Check if the current data object is the one to be replaced
    if (data.system == item.system && data.code == item.code && data.display == item.display) {
      data.system = replacement.system;
      data.code = replacement.code;
      data.display = replacement.display;
      changesMade = true;
    }

    // Check if this has an ECL
    if (data.answerValueSet) {
      const url = new URL(data.answerValueSet);
      const fhir_vs = url.searchParams.get("fhir_vs");
      if (fhir_vs) {
          const unescapedValue = decodeURIComponent(fhir_vs);
          // check if unscapedValue contains item.code as a whole word, separated by spaces or a pipe at the end
          const pattern = new RegExp(`(\\s|^)${item.code}(\\s|$|\\|)`, 'g');
          if (pattern.test(unescapedValue)) {
            // replace the code in the ECL
            const newEcl = unescapedValue.replace(pattern, `$1${replacement.code}$2`);
            changesMade = true;
            // now replace item.display if it exists bewteen pipes, with or without spaces
            const pattern2 = new RegExp(`\\|\\s*${item.display}\\s*\\|`, 'g');
            if (pattern2.test(newEcl)) {
              // replace the display in the ECL
              const newEcl2 = newEcl.replace(pattern2, `| ${replacement.display} |`);
              // replace the ECL in the answerValueSet
              url.searchParams.set("fhir_vs", encodeURIComponent(newEcl2));
              data.answerValueSet = url.toString();
            }
            // replace the ECL in the answerValueSet
            url.searchParams.set("fhir_vs", encodeURIComponent(newEcl));
            data.answerValueSet = url.toString();
          }
      }
    }

    // If the current data object is an array, recursively search and replace objects from its items
    if (Array.isArray(data)) {
      for (let index in data) {
        changesMade = this.searchAndReplace(data[index], item, replacement, changesMade);
      }
    } else {
        // If the current data object is not an array, check all its properties
        for (let key in data) {
            if (data.hasOwnProperty(key)) {
              changesMade = this.searchAndReplace(data[key], item, replacement, changesMade);
            }
        }
    }
    return changesMade;
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
          }
      ]
  };
    this.fhirService.postQuestionnaire(this.questionnaire).pipe(first()).subscribe(
      (data: any) => {
        this._snackBar.openFromComponent(SnackAlertComponent, {
          duration: 5 * 1000,
          data: "Questionnaire saved successfully",
          panelClass: ['green-snackbar']
        });
        console.log(data)
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
        console.log(data);
      },
      (error: any) => {
        console.log(error);
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
}
