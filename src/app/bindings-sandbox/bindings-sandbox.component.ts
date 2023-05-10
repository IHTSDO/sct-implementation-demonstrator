import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatExpansionPanel } from '@angular/material/expansion';

@Component({
  selector: 'app-bindings-sandbox',
  templateUrl: './bindings-sandbox.component.html',
  styleUrls: ['./bindings-sandbox.component.css']
})
export class BindingsSandboxComponent {
  @ViewChild('newPanel') newPanel!: MatExpansionPanel;

  bindings: any[] = [
    {
      title: 'Diagnosis',
      type: 'Autocomplete',
      ecl: `<< 404684003 |Clinical finding (finding)|`,
      value: '',
      note: 'The diagnosis for the clinical encounter.'
    }
  ];

  newBindingForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    type: new FormControl('', [Validators.required]),
    ecl: new FormControl('', [Validators.required]),
    value: new FormControl('', []),
    note: new FormControl('', [Validators.maxLength(500)])
  });

  panelOpenState = false;

  controlTypes = ['Autocomplete', 'Select', 'Text'];

  addBinding() {
    this.newBindingForm.markAllAsTouched();
    if (this.newBindingForm.invalid) {
      return;
    }
    const { title, type, ecl, value, note } = this.newBindingForm.controls;
    this.bindings.push({
      title: title.value,
      type: type.value,
      ecl: ecl.value,
      value: value.value,
      note: note.value
    });
    this.newBindingForm.reset();
    this.newPanel.close();
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
    }
    return null;
  }

}
