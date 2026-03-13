import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackAlertComponent } from 'src/app/alerts/snack-alert';

@Component({
    selector: 'app-bindings-viewer',
    templateUrl: './bindings-viewer.component.html',
    styleUrl: './bindings-viewer.component.css',
    standalone: false
})
export class BindingsViewerComponent implements OnInit, OnChanges {

  @Input() spec: any;
  @Input() showTitle: boolean = true;

  output: any = {};
  outputStr: string = '{}';

  response: any = {};
  responseStr: string = '{}';
  responseBundle: any = {};
  responseBundleStr: string = '{}';

  constructor(private _snackBar: MatSnackBar) { } 
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spec']) {
      this.spec?.bindings?.forEach((binding: any) => {
        binding.count = binding.count ?? 1;
        binding.type = this.normalizeBindingType(binding.type);
      });
    }
  }

  ngOnInit(): void {
  }

  addRow(binding: any) {
    binding.count++;
  }

  removeRow(binding: any) {
    binding.count--;
  }

  getBindingType(binding: any): string {
    return this.normalizeBindingType(binding?.type);
  }

  isSupportedBindingType(binding: any): boolean {
    return [
      'Autocomplete',
      'Select (Single)',
      'Select (Multiple)',
      'Options',
      'Multi-prefix search select',
      'Section header',
      'Text box',
      'Integer',
      'Decimal',
      'Checkbox',
      'Checkbox multiple'
    ].includes(this.getBindingType(binding));
  }

  private normalizeBindingType(type: string | null | undefined): string {
    const normalizedType = (type || '').trim().toLowerCase();
    switch (normalizedType) {
      case 'autocomplete':
        return 'Autocomplete';
      case 'select':
      case 'select (single)':
        return 'Select (Single)';
      case 'select (multiple)':
        return 'Select (Multiple)';
      case 'options':
        return 'Options';
      case 'multi-prefix search select':
        return 'Multi-prefix search select';
      case 'section header':
        return 'Section header';
      case 'text box':
      case 'textbox':
        return 'Text box';
      case 'integer':
        return 'Integer';
      case 'decimal':
        return 'Decimal';
      case 'checkbox':
        return 'Checkbox';
      case 'checkbox multiple':
        return 'Checkbox multiple';
      default:
        return type || '';
    }
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

  refreshResponse() {
    this.response = {};
    for (let binding of this.spec.bindings) {
      this.response[binding.title] = {};
      if (binding.code) {
        this.response[binding.title].code = binding.code;
      }
      if (binding.unit) {
        this.response[binding.title].unit = binding.unit;
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
      const unit = value.unit ? {
        "coding": [{
          "system": 'http://snomed.info/sct',
          "code": value.unit.code,
          "display": value.unit.display
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
      if (unit) {
        observation['valueQuantity'] = {
          "value": value.value,
          "unit": unit.coding[0].display,
          "system": unit.coding[0].system,
          "code": unit.coding[0].code
        };
      }
  
      // Check if 'code' is not undefined before pushing to the entry array
      if (observation.valueCodeableConcept || observation.valueString || observation.valueQuantity) {
        this.responseBundle.entry.push(observation);
      }
    }
    this.responseBundleStr = JSON.stringify(this.responseBundle, null, 2);
  }

  copyToClipboard(ecl: string) {
    navigator.clipboard.writeText(ecl);
    this._snackBar.openFromComponent(SnackAlertComponent, {
      duration: 2000,
      data: "Copied to clipboard"
    });
  }
}
