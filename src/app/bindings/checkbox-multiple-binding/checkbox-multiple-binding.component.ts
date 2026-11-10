import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import {FormBuilder} from '@angular/forms';

@Component({
    selector: 'app-checkbox-multiple-binding',
    templateUrl: './checkbox-multiple-binding.component.html',
    styleUrls: ['./checkbox-multiple-binding.component.css'],
    standalone: false
})
export class CheckBoxMultipleBindingComponent implements OnInit, OnDestroy {
  @Input() binding: any;
  @Output() selectionChange = new EventEmitter<any>();

  options: any[] | undefined;
  checkboxes = this._formBuilder.group({} as Record<string, any>);

  private destroy$ = new Subject<void>();

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
    // Re-expand when the edition or language changes so displays follow the selection.
    // Controls are keyed by code, so checked state survives a reload with new displays.
    this.terminologyService.editionAndLanguageNow$()
      .pipe(
        switchMap(() => this.terminologyService.expandBindingAnswerValueSet(this.binding, '', 0, 1500)),
        takeUntil(this.destroy$)
      )
      .subscribe(response => {
        this.options = response?.expansion?.contains ?? [];
        this.options?.forEach((o: any) => {
          if (!this.checkboxes.contains(`${o.code}`)) {
            this.checkboxes.addControl(`${o.code}`, this._formBuilder.control(false));
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  optionClicked() {
    let result: any[] = [];
    this.options?.forEach((o: any) => {
      result.push( {code: o, value : ((this.checkboxes.value as any)[`${o.code}`]) ? this.present : this.absent} );
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
