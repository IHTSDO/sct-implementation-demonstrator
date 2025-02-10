import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';
import {FormBuilder} from '@angular/forms';

@Component({
    selector: 'app-checkbox-multiple-binding',
    templateUrl: './checkbox-multiple-binding.component.html',
    styleUrls: ['./checkbox-multiple-binding.component.css'],
    standalone: false
})
export class CheckBoxMultipleBindingComponent implements OnInit {
  @Input() binding: any;
  @Output() selectionChange = new EventEmitter<any>();

  options: any[] | undefined;
  checkboxes = this._formBuilder.group([])

  present = {
    'display': 'Known present (qualifier value)',
    'system': 'http://snomed.info/sct',
    'code': '410515003'
  };

  absent = {
    'display': 'Known absent (qualifier value)',
    'system': 'http://snomed.info/sct',
    'code': '410516002'
  };

  constructor(private terminologyService: TerminologyService,
              private _formBuilder: FormBuilder) {
  }

  ngOnInit(): void {
    this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => {
      this.options = response.expansion.contains;
      // convert options to an array of form controls (display : false )
      this.options?.forEach((o: any) => {
        this.checkboxes.addControl(o.display, this._formBuilder.control(false));
      });
    });
    // this.options = [ { display: this.binding.title } ];
    // this.options?.forEach((o: any) => {
    //   this.checkboxes.addControl(o.display, this._formBuilder.control(false));
    // });  
  }

  optionClicked() {
    let result: any[] = [];
    this.options?.forEach((o: any) => {
      result.push( {code: o, value : (this.checkboxes.value[o.display]) ? this.present : this.absent} );
    });
    // let result: any[] = [];
    // result.push({
    //   title: this.binding.title,
    //   code: this.binding.ecl,
    //   value: (this.checkboxes.value[this.binding.title]) ? this.present : this.absent
    // });
    this.selectionChange.emit(result);
  }

}
