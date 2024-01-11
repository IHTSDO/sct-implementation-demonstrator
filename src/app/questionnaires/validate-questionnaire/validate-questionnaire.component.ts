import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatTabGroup } from '@angular/material/tabs';
import { first, lastValueFrom, map } from 'rxjs';
import { ListQuestionnairesComponent } from '../list-questionnaires/list-questionnaires.component';
import { TerminologyService } from 'src/app/services/terminology.service';

@Component({
  selector: 'app-validate-questionnaire',
  templateUrl: './validate-questionnaire.component.html',
  styleUrls: ['./validate-questionnaire.component.css']
})
export class ValidateQuestionnaireComponent implements OnChanges {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;
  @ViewChild('questionnairesList') questionnairesList!: ListQuestionnairesComponent;

  @Input() questionnaire: any;

  loading = false;
  validating = false;
  displayedColumns: string[] = ['order','readablePath', 'code', 'display', 'system', 'status'];
  dataSource = new MatTableDataSource<any>();
  validatingProgress = 0;
  orderCounter = 0;
  loadResults: any = {
    total: 0,
    active: 0,
    inactive: 0,
    error: 0
  };

  constructor(private terminologyService: TerminologyService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionnaire']) {
      if (!this.questionnaire) {
        this.clearQuestionnaire();
      } else {
        this.loadQuestionnaire(this.questionnaire);
      }
    }
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
    // if (data.system && data.code && data.display) {
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

}
