import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, UntypedFormControl } from '@angular/forms';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap,tap} from 'rxjs/operators';
import {Observable, of, Subject} from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import { MatFormFieldControl } from '@angular/material/form-field';

@Component({
  selector: 'app-autocomplete-binding',
  templateUrl: './autocomplete-binding.component.html',
  styleUrls: ['./autocomplete-binding.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteBindingComponent),
      multi: true
    },
    {
      provide: MatFormFieldControl,
      useExisting: AutocompleteBindingComponent
    }
  ]
})
export class AutocompleteBindingComponent implements OnInit, OnChanges, ControlValueAccessor  {
  @Input() binding: any;
  @Input() term: string = "";
  @Output() selectionChange = new EventEmitter<any>();
  
  formControl = new UntypedFormControl();
  autoFilter: Observable<any> | undefined;
  loading = false;
  selectedConcept: any = {};

  static nextId = 0;
  stateChanges = new Subject<void>();
  focused = false;
  ngControl = null;
  errorState = false;
  controlType = 'app-autocomplete-binding';
  id = `app-autocomplete-binding-${AutocompleteBindingComponent.nextId++}`;
  describedBy = '';

  constructor(private terminologyService: TerminologyService) { }

  private onChange: (value: any) => void = () => {};

  private onTouched: () => void = () => {};

  get empty() {
    return !this.formControl.value;
  }

  setDescribedByIds(ids: string[]): void {
    this.describedBy = ids.join(' ');
  }

  onContainerClick(event: MouseEvent): void {
    // Handle the action when the container is clicked
  }
  
  writeValue(value: any): void {
    this.term = value;
    this.formControl.setValue(value, { emitEvent: false });  // use emitEvent to avoid triggering valueChanges again.
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

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
          let response = this.terminologyService.expandValueSet(this.binding.ecl, term, 0, 50)
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
    this.onChange(value);
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
