import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first, lastValueFrom } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { TerminologyService } from 'src/app/services/terminology.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';
import { MatSort } from '@angular/material/sort';


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
  }

  constructor(private http: HttpClient, private terminologyService: TerminologyService, private _snackBar: MatSnackBar) { }

  ngOnInit(): void {
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
    this.loadResults = {
      total: 0,
      active: 0,
      inactive: 0,
      error: 0
    };
  }

  loadQuestionnaire(data: any) {
    this.loading = true;
    this.clearQuestionnaire();
    // wait a second to show the loading spinner
    setTimeout(() => {
      this.loading = false;
      this.questionnaire = data;
      let extracted = this.extractObjects(data);
      this.dataSource.data = extracted; //.slice(0, 5);
      this.dataSource.sort = this.sort;
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
            // if (param.name === "display") {
            //     const serverDisplay = param.valueString;
            //     if (!item.display || this.removeSemanticTag(item.display) !== this.removeSemanticTag(serverDisplay)) {
            //       item.serverDisplay = param.valueString;
            //     }
            // }
        }
        // check if item.display is in the designations array
        if (!item.display || !designations.includes(item.display)) {
          item.serverDisplay = fsn;
        }
      } catch (error) {
          item.status = "Error";
          this.loadResults.error++;
      }
    }).then(() => {
      this.validating = false;
    });
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

}
