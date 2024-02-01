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
import { AutocompleteBindingComponent } from '../bindings/autocomplete-binding/autocomplete-binding.component';
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

  formTitle: string = 'My new form';
  titleEditMode = false;
  bindings: any[] = [];
  output: any = {};
  outputStr: string = '{}';
  response: any = {};
  responseStr: string = '{}';
  fhirQuestionnaire: any = {};
  fhirQuestionnaireStr: string = '{}';

  observableBinding: any = {
    title: 'Question code',
    type: 'Autocomplete',
    ecl: `<< 363787002 |Observable entity (observable entity)|`,
    value: '',
    // note: 'Select observable for question code.'
  };

  codeBinding: any = {
    title: 'Question code',
    type: 'Autocomplete',
    ecl: `<< 363787002 |Observable entity (observable entity)| OR << 404684003 |Clinical finding (finding)| OR << 71388002 |Procedure (procedure)|`,
    value: '',
    // note: 'Select observable for question code.'
  };

  checkboxBinding: any = {
    title: 'Checkbox code',
    type: 'Autocomplete',
    ecl: `<< 363787002 |Observable entity (observable entity)| OR << 404684003 |Clinical finding (finding)| OR << 71388002 |Procedure (procedure)|`,
    value: '',
    // note: 'Select observable for question code.'
  };


  example1 = {
    title: 'Appendicitis data entry form (example)',
    bindings: [
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
    ]
  };

  newBindingForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    code: new FormControl('', []),
    type: new FormControl('', [Validators.required]),
    ecl: new FormControl('', []),
    value: new FormControl('', []),
    note: new FormControl('', [Validators.maxLength(500)])
  });

  indexInEdit = -1;
  panelOpenState = false;
  maxSelectCount = 50;
  maxOptionsCount = 10;

  controlTypes = ['Autocomplete', 'Select (Single)', 'Select (Multiple)', 'Options', 'Section header', 'Text box', 'Integer', 'Decimal', 'Checkbox'].sort((a, b) => a.localeCompare(b));

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
    const { title, code, type, ecl, value, note } = this.newBindingForm.controls;
    let binding = {
      title: title.value,
      code: code.value,
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
    } else if (binding.type != 'Section header' && binding.type != 'Text box' && binding.type != 'Integer' && binding.type != 'Decimal') {
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
    setTimeout(() => {
      this.refreshFhirQuestionnaire();
      this.refreshResponse();
    },100);
  }

  refreshFhirQuestionnaire() {
    console.log('refreshFhirQuestionnaire');

    this.fhirQuestionnaire = {
      "resourceType": "Questionnaire",
      "title": this.formTitle,
      "status": "draft",
      "item": []
    };

    this.bindings.forEach((binding, index) => {
      const item = this.createItemForBinding(binding, index);
      if (item) {
        this.fhirQuestionnaire.item.push(item);
      }
    });

    this.fhirQuestionnaireStr = JSON.stringify(this.fhirQuestionnaire, null, 2);
  }

  createItemForBinding(binding: any, index: number) {
    const baseItem: any = this.initializeBaseItem(binding, index);

    if (['Select (Single)', 'Select (Multiple)', 'Options', 'Autocomplete'].includes(binding.type)) {
      baseItem['extension'] = this.getExtensionForSelectableTypes();
      baseItem['answerValueSet'] = this.getAnswerValueSet(binding);
    }

    if (binding.type === 'Autocomplete') {
      baseItem['extension'].push(this.getAutocompleteExtension());
    }

    if (binding.type === 'Select (Multiple)') {
      baseItem['repeats'] = true;
    }

    return baseItem;
  }

  initializeBaseItem(binding: any, index: number) {
    const item: any = {
      "linkId": index + 1,
      "text": binding.title,
      "type": this.getQuestionnaireItemType(binding.type)
    };

    if (binding.code) {
      item['code'] = [
        {
          "system": "http://snomed.info/sct",
          "code": binding.code.code,
          "display": binding.code.display
        }
      ];
    }

    return item;
  }

  getQuestionnaireItemType(type: any) {
    switch (type) {
      case 'Section header': 
        return 'display';
      case 'Select (Single)': 
      case 'Select (Multiple)': 
      case 'Options': 
      case 'Autocomplete': 
        return 'choice';
      case 'Text box': 
        return 'text';
      case 'Integer': 
        return 'integer';
      case 'Decimal': 
        return 'decimal';
      default: 
        console.warn(`Unhandled binding type: ${type}`);
        return null;
    }
  }

  getExtensionForSelectableTypes() {
    return [{
      "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer",
      "valueUrl": "https://snowstorm.ihtsdotools.org/fhir"
    }];
  }

  getAutocompleteExtension() {
    return {
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
    };
  }

  getAnswerValueSet(binding: any) {
    return `http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${encodeURIComponent(binding.ecl)}`;
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
      code: binding.code,
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

  refreshResponse() {
    console.log('refreshResponse');
    this.response = {};
    for (let binding of this.bindings) {
      this.response[binding.title] = {};
      if (binding.code) {
        this.response[binding.title].code = binding.code;
      }
    }
    for (let [key, value] of Object.entries(this.output)) {
        if (this.output[key].code) {
          this.response[key].code = this.output[key].code;
        }
        if (this.output[key].value) {
          this.response[key].value = this.output[key].value;
        }
    }
    this.responseStr = JSON.stringify(this.response, null, 2);
  }

  optionSelected(title: string, code: string, event: any) {
    this.output[title] = {
      code: code,
      value: event
    }

    // remove code property if null
    if (!code) {
      delete this.output[title].code;
    }
   
    this.outputStr = JSON.stringify(this.output, null, 2);
    this.refreshResponse();
  }

  loadExample1() {
    this.formTitle = this.example1.title;
    this.bindings = this.example1.bindings;
    this.refreshFhirQuestionnaire();
    this.clearOutput();
    this.refreshResponse();
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
    this.formTitle = 'My new form';
    this.showRightContainer = false;
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
    var blob = new Blob([JSON.stringify({ title: this.formTitle, bindings: this.bindings }, null, 2)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${this.formTitle}.json`);
  }

  saveOutput(text: string) {
    var blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${this.formTitle}-fhir.json`);
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
          // if uploaded version is array, assume it's the bindings
          if (Array.isArray(uploadedVersion)) {
            this.bindings = uploadedVersion;
            this.formTitle = 'My new form';
          } else {
            this.bindings = [];
            this.bindings = uploadedVersion.bindings;
            this.formTitle = uploadedVersion.title;
          }
          this.clearOutput();
          this.refreshResponse();
          this.refreshFhirQuestionnaire();
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }

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
