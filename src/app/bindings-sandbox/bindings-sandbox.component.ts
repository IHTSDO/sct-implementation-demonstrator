import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatExpansionPanel } from '@angular/material/expansion';
import { TerminologyService } from '../services/terminology.service';
import { lastValueFrom, map } from 'rxjs';

@Component({
  selector: 'app-bindings-sandbox',
  templateUrl: './bindings-sandbox.component.html',
  styleUrls: ['./bindings-sandbox.component.css']
})
export class BindingsSandboxComponent {
  @ViewChild('newPanel') newPanel!: MatExpansionPanel;

  bindings: any[] = [
    // {
    //   title: 'Diagnosis 1',
    //   type: 'Autocomplete',
    //   ecl: `<< 404684003 |Clinical finding (finding)|`,
    //   value: '',
    //   note: 'The diagnosis for the clinical encounter.'
    // },
    // {
    //   title: 'Appendicitis type',
    //   type: 'Select (Single)',
    //   ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
    //   value: '',
    //   note: 'The type of appendicitis.'
    // },
    // {
    //   title: 'Appendicitis type (M)',
    //   type: 'Select (Multiple)',
    //   ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
    //   value: '',
    //   note: 'The type of appendicitis.'
    // }
  ];

  newBindingForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    type: new FormControl('', [Validators.required]),
    ecl: new FormControl('', [Validators.required]),
    value: new FormControl('', []),
    note: new FormControl('', [Validators.maxLength(500)])
  });

  indexInEdit = -1;
  panelOpenState = false;
  maxSelectCount = 15;

  controlTypes = ['Autocomplete', 'Select (Single)', 'Select (Multiple)'];

  constructor(private terminologyService: TerminologyService) { }

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
            ecl.setErrors({ tooManyResults: true });
          }
        }
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
      if (errors['tooManyResults']) {
        return `Too many results (Max = ${ this.maxSelectCount })`;
      }
    }
    return null;
  }

}
