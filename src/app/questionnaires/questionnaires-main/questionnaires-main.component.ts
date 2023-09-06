import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { count, first, lastValueFrom } from 'rxjs';
import { MatTableDataSource } from '@angular/material/table';
import { TerminologyService } from 'src/app/services/terminology.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';

@Component({
  selector: 'app-questionnaires-main',
  templateUrl: './questionnaires-main.component.html',
  styleUrls: ['./questionnaires-main.component.css']
})
export class QuestionnairesMainComponent implements OnInit{

  loading = false;
  validating = false;
  displayedColumns: string[] = ['readablePath', 'code', 'display', 'system', 'status'];
  dataSource = new MatTableDataSource<any>();
  validatingProgress = 0;
  questionnaire: any;

  constructor(private http: HttpClient, private terminologyService: TerminologyService, private _snackBar: MatSnackBar) { }

  ngOnInit(): void {}

  loadExampleQuestionnaire() {
    lastValueFrom(this.http.get('assets/questionnaires/Carcinoma-of-the-Exocrine-Pancreas-Histopathology-Reporting-Form.R4 (11).json')).then(data => {
      this.loadQuestionnaire(data);
    });
  }

  loadQuestionnaire(data: any) {
    this.loading = true;
    this.questionnaire = null;
    this.dataSource.data = [];
    // wait a second to show the loading spinner
    setTimeout(() => {
      this.loading = false;
      this.questionnaire = data;
      let extracted = this.extractObjects(data);
      this.dataSource.data = extracted; //.slice(0, 5);
    }, 700);
  }

  validate() {
    this.validating = true;
    let length = this.dataSource.data.length;
    let count = 0;
    this.asyncForEach(this.dataSource.data, async (item) => {
      item.status = "Validating";
      count++;
      this.validatingProgress = Math.round((count / length) * 100);
      try {
        const data = await this.terminologyService.lookupConcept(item.code, item.system).pipe(first()).toPromise();
        for (const param of data.parameter) {
            if (param.name === "inactive") {
                if (param.valueBoolean) {
                    item.status = "Inactive";
                } else {
                    item.status = "Active";
                }
            }
        }
      } catch (error) {
          item.status = "Error";
      }
    }).then(() => {
      this.validating = false;
    });
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
        const newObj: any = {
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
