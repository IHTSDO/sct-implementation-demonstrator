import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatExpansionPanel } from '@angular/material/expansion';
import { TerminologyService } from '../services/terminology.service';
import { lastValueFrom, map } from 'rxjs';
import { saveAs } from 'file-saver';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { EclBuilderDialogComponent } from '../bindings/ecl-builder-dialog/ecl-builder-dialog.component';
import {
  trigger,
  state,
  style,
  animate,
  transition
} from '@angular/animations';
@Component({
  selector: 'app-bindings-sandbox',
  templateUrl: './bindings-sandbox.component.html',
  styleUrls: ['./bindings-sandbox.component.css'],
  animations: [
    trigger('openClose', [
      state('open', style({
        opacity: 1,
        width: '50%'
      })),
      state('closed', style({
        opacity: 0,
        width: '0'
      })),
      transition('open <=> closed', [
        animate('0.5s')
      ]),
    ]),
    trigger('growShrink', [
      state('open', style({
        width: '50%'
      })),
      state('closed', style({
        width: '100%'
      })),
      transition('open <=> closed', [
        animate('0.5s')
      ]),
    ]),
  ]
})
export class BindingsSandboxComponent {
  @ViewChild('newPanel') newPanel!: MatExpansionPanel;

  bindings: any[] = [];
  output: any = {};
  outputStr: string = '{}';
  fhirQuestionnaire: any = {};
  fhirQuestionnaireStr: string = '{}';

  example1 = [
    {
      title: 'Appendicitis data entry form (example)',
      type: 'Title',
      ecl: ``,
      value: '',
      note: ''
    },
    {
      title: 'Diagnosis (type of appendicitis)',
      type: 'Autocomplete',
      ecl: `<< 74400008 |Appendicitis|`,
      value: '',
      note: 'An autocomplete field to select between all descendants of appendicitis.'
    },
    {
      title: 'Clinical note',
      type: 'Text box',
      ecl: `74400008 |Appendicitis|`,
      value: '',
      note: 'A text box for entering free text clinical information.'
    },
    {
      title: 'Appendicitis type',
      type: 'Select (Single)',
      ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
      value: '',
      note: 'A single selection dropdown field for a shorter selection of the type of appendicitis.'
    },
    {
      title: 'Appendicitis type (M)',
      type: 'Select (Multiple)',
      ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
      value: '',
      note: 'A multiple selection dropdown field for a shorter selection of the type of appendicitis.'
    },
    {
      title: 'Appendicectomy type',
      type: 'Options',
      ecl: `<< 174036004 |Emergency appendectomy (procedure)|`,
      value: '',
      note: 'A radio buttons selector for the type of appendicectomy procedure.'
    }
  ];

  newBindingForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    type: new FormControl('', [Validators.required]),
    ecl: new FormControl('', []),
    value: new FormControl('', []),
    note: new FormControl('', [Validators.maxLength(500)])
  });

  indexInEdit = -1;
  panelOpenState = false;
  maxSelectCount = 50;
  maxOptionsCount = 10;

  controlTypes = ['Autocomplete', 'Select (Single)', 'Select (Multiple)', 'Options', 'Title', 'Text box', 'Checkbox'].sort((a, b) => a.localeCompare(b));

  showRightContainer = false;

  constructor(private terminologyService: TerminologyService, private clipboard: Clipboard, public dialog: MatDialog) { }

  get stateName() {
    return this.showRightContainer ? 'open' : 'closed';
  }

  async addBinding() {
    this.newBindingForm.markAllAsTouched();
    if (this.newBindingForm.invalid) {
      return;
    }
    const { title, type, ecl, value, note } = this.newBindingForm.controls;
    let binding = {
      title: title.value,
      type: type.value,
      ecl: ecl.value,
      value: value.value,
      note: note.value
    }
    let errors = false;
    if (ecl.value) {
        if (typeof binding.type?.indexOf('Select') !== 'undefined' && binding.type?.indexOf('Select') > -1) {
          let results = await this.getEclPreview(ecl.value);
          if (results.expansion.contains.length > this.maxSelectCount) {
            errors = true;
            ecl.setErrors({ selectTooManyResults: true });
          }
        } else if (typeof binding.type?.indexOf('Options') !== 'undefined' && binding.type?.indexOf('Options') > -1) {
          let results = await this.getEclPreview(ecl.value);
          if (results.expansion.contains.length > this.maxOptionsCount) {
            errors = true;
            ecl.setErrors({ optionsTooManyResults: true });
          }
        }
    } else if (binding.type != 'Title' && binding.type != 'Text box') {
      errors = true;
      ecl.setErrors({ required: true });
    }
    if (errors) {
      return;
    }
    if (this.indexInEdit > -1) {
      this.bindings[this.indexInEdit] = binding;
    } else {
      this.bindings.push(binding);
    }
    this.newBindingForm.reset();
    this.newPanel.close();
    this.indexInEdit = -1;
    this.refreshFhirQuestionnaire();
  }

  refreshFhirQuestionnaire() {
    this.fhirQuestionnaire = {
      "resourceType": "Questionnaire",
      "title": "Test form ALO",
      "status": "draft",
      "item": []
    };
    for (let [index, binding] of this.bindings.entries()) {
      if (binding.type == 'Title') {
        let item = {
          "linkId": index*100,
          "type": "display",
          "text": binding.title
        };
        this.fhirQuestionnaire.item.push(item);
      }
      if (binding.type == 'Select (Single)' || binding.type == 'Options') {
        let item = {
          "linkId": index*100,
          "type": "choice",
          "extension": [
            {
              "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer",
              "valueUrl": "https://snowstorm.ihtsdotools.org/fhir"
            }
          ],
          "text": binding.title,
          "answerValueSet": `http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${encodeURIComponent(binding.ecl)}`
        };
        this.fhirQuestionnaire.item.push(item);
      }
      if (binding.type == 'Select (Multiple)') {
        let item = {
          "linkId": index*100,
          "type": "choice",
          "repeats": true,
          "extension": [
            {
              "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer",
              "valueUrl": "https://snowstorm.ihtsdotools.org/fhir"
            }
          ],
          "text": binding.title,
          "answerValueSet": `http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${encodeURIComponent(binding.ecl)}`
        };
        this.fhirQuestionnaire.item.push(item);
      }
      if (binding.type == 'Autocomplete') {
        let item = {
          "linkId": index*100,
          "type": "choice",
          "extension": [
            {
              "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer",
              "valueUrl": "https://snowstorm.ihtsdotools.org/fhir"
            },
            {
              "url": "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
              "valueCodeableConcept": {
                "coding": [
                  {
                    "system": "http://hl7.org/fhir/questionnaire-item-control",
                    "code": "autocomplete",
                    "display": "Auto-complete"
                  }
                ]
              }
            }
          ],
          "text": binding.title,
          "answerValueSet": `http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${encodeURIComponent(binding.ecl)}`
        };
        this.fhirQuestionnaire.item.push(item);
      }
      if (binding.type == 'Text box') {
        let item = {
          "linkId": index*100,
          "type": "text",
          "text": binding.title
        };
        this.fhirQuestionnaire.item.push(item);
      }
      // if (binding.type == 'Checkbox') {
      //   let item = {
      //     "linkId": index*100,
      //     "type": "boolean",
      //     "text": binding.title,
      //     "code": [
      //       {
      //         "system": "Asthma",
      //         "code": "195967001",
      //         "display": "http://snomed.info/sct"
      //       }
      //     ]
      //   };
      //   this.fhirQuestionnaire.item.push(item);
      // }
    }
    this.fhirQuestionnaireStr = JSON.stringify(this.fhirQuestionnaire, null, 2);
  }

  async getEclPreview(ecl: string): Promise<any> {
    const response = await this.terminologyService.expandValueSet(ecl, '');
    return lastValueFrom(response.pipe(map(res => res)));
  }

  edit(i: number) {
    this.indexInEdit = i;
    const binding = this.bindings[i];
    this.newBindingForm.setValue({
      title: binding.title,
      type: binding.type,
      ecl: binding.ecl,
      value: binding.value,
      note: binding.note
    });
    this.newPanel.open();
  }

  onDrop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.bindings, event.previousIndex, event.currentIndex);
  }
  
  getErrors(controlName: string) {
    const control = this.newBindingForm.get(controlName);
    if (control) {
      return control.errors;
    }
    return null;
  }

  getErrorMessage(controlName: string) {
    const errors = this.getErrors(controlName);
    if (errors) {
      if (errors['required']) {
        return 'This field is required';
      }
      if (errors['maxlength']) {
        return `This field must be less than ${errors['maxlength'].requiredLength} characters`;
      }
      if (errors['selectTooManyResults']) {
        return `Too many results (Max = ${ this.maxSelectCount })`;
      }
      if (errors['optionsTooManyResults']) {
        return `Too many results (Max = ${ this.maxOptionsCount })`;
      }
    }
    return null;
  }

  optionSelected(title: string, event: any) {
    this.output[title] = event;
    this.outputStr = JSON.stringify(this.output, null, 2);
  }

  loadExample1() {
    this.bindings = this.example1;
    this.refreshFhirQuestionnaire();
  }

  cancelEdit() {
    this.newBindingForm.reset();
    this.newPanel.close();
    this.indexInEdit = -1;
  }

  clear() {
    this.bindings = [];
    this.clearOutput();
    this.newBindingForm.reset();
  }

  clearOutput() {
    this.output = {};
    this.outputStr = '{}';
    // Clone bindings
    const savedBindings = JSON.parse(JSON.stringify(this.bindings));
    this.bindings = [];
    this.bindings = savedBindings;
  }

  saveForm() {
    var blob = new Blob([JSON.stringify(this.bindings, null, 2)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "Sandbox-form.json");
  }

  saveOutput(text: string) {
    var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "export.json");
  }

  copyOutputToClipboard(text: string) {
    this.clipboard.copy(text);
  }

  uploadFile(event: any) {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
    } else {
      const reader = new FileReader();
      reader.onloadend = (e) => {
        if (reader.result) {
          const uploadedVersion = JSON.parse(reader.result?.toString());
          this.bindings = uploadedVersion;
          this.clearOutput();
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }

  // eclChanged(event: any) {
  //   console.log(event);
  // }

  openEclBuilder(ecl: any, controlName: string) {
    const dialogRef = this.dialog.open(EclBuilderDialogComponent, {
      data: { ecl },
      width: '80%',
      height: '80%'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const control = this.newBindingForm.get(controlName);
        if (control) {
          control.setValue(result.ecl);
        }
      }
    });
  }

}
