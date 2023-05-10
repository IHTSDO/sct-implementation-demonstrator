import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap,tap} from 'rxjs/operators';
import {Observable, of, Subject} from 'rxjs';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-autocomplete-binding',
  templateUrl: './autocomplete-binding.component.html',
  styleUrls: ['./autocomplete-binding.component.css']
})
export class AutocompleteBindingComponent implements OnInit, OnChanges {
  @Input() binding: any;
  @Input() term: string = "";
  @Input() label: string = "";
  @Input() hint: string = "";
  @Output() selectionChange = new EventEmitter<any>();
  
  formControl = new UntypedFormControl();
  autoFilter: Observable<any> | undefined;
  loading = false;
  selectedConcept: any = {};
  constructor(private terminologyService: TerminologyService) { }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['term']) {
      this.term = changes['term'].currentValue;
      this.formControl.setValue(this.term);
    }
  }

  ngOnInit(): void {
    this.autoFilter  = this.formControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) =>  {
        if (term?.length >= 3) {
          this.loading = true;
          let response = this.terminologyService.expandValueSet(this.binding, term, 0, 50)
          return response;
        } else {
          return of([]);
        }
        
      }),
      tap(data => {
        this.loading = false;
      })
    );  
  }

  onTermChange() {
    this.formControl.setValue(this.term);
  }

  optionSelected(value: any) {
    this.selectedConcept = value;
    this.selectionChange.emit(value);
  }

  clearInput() {
    this.formControl.reset();
    this.selectedConcept = { code: '', display:''};
  }

  change(event: any) {
    const item = event?.option?.value;
    if (item) {
      this.optionSelected({ code: item.code, display: item.display });
    }
  }

}
