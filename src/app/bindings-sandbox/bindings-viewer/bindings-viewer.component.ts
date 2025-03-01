import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-bindings-viewer',
    templateUrl: './bindings-viewer.component.html',
    styleUrl: './bindings-viewer.component.css',
    standalone: false
})
export class BindingsViewerComponent {

  @Input() spec: any;

  output: any = {};
  outputStr: string = '{}';

  response: any = {};
  responseStr: string = '{}';
  responseBundle: any = {};
  responseBundleStr: string = '{}';

  constructor() { } 


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

  refreshResponse() {
    this.response = {};
    for (let binding of this.spec.bindings) {
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
    this.refreshResponseBundle();
  }

  refreshResponseBundle() {
    this.responseBundle = {
      "resourceType": "Bundle",
      "type": "collection",
      "entry": []
    };
    for (let [key, valuet] of Object.entries(this.response)) {
      let value = valuet as any;
      // Using optional chaining to safely access nested properties
      const code = value.code ? {
        "coding": [{
          "system": 'http://snomed.info/sct',
          "code": value.code.code,
          "display": value.code.display
        }]
      } : undefined;
      const valueCodeableConcept = value.value?.code ? {
        "coding": [{
          "system": 'http://snomed.info/sct',
          "code": value.value.code,
          "display": value.value.display
        }]
      } : undefined;

      let observation: any = {
        "resourceType": "Observation",
        "status": "final",
        "category": [{
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
            "code": "survey",
            "display": "Survey"
          }]
        }],
        "subject": {
          "reference": "Patient/123"
        },
      };

      if (code) {
        observation['code'] = code;
      } else {
        observation['code'] = {
          "coding": [{
            "system": "http://snomed.info/sct",
            "code": "363788007",
            "display": "Clinical history/examination observable (observable entity)"
          }]
        };
      }
      if (valueCodeableConcept) {
        observation['valueCodeableConcept'] = valueCodeableConcept;
      }
      // if value si string populate valueString
      if (value.value && typeof value.value === 'string') {
        observation['valueString'] = value.value;
      }
  
      // Check if 'code' is not undefined before pushing to the entry array
      if (observation.valueCodeableConcept || observation.valueString) {
        this.responseBundle.entry.push(observation);
      }
    }
    this.responseBundleStr = JSON.stringify(this.responseBundle, null, 2);
  }
}
