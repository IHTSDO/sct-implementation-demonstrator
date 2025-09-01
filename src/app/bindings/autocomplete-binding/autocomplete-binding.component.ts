import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, UntypedFormControl } from '@angular/forms';
import {debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap,tap} from 'rxjs/operators';
import {concat, Observable, of, Subject} from 'rxjs';
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
    ],
    standalone: false
})
export class AutocompleteBindingComponent implements OnInit, OnChanges, ControlValueAccessor  {
  @Input() binding: any;
  @Input() term: string = "";
  @Output() selectionChange = new EventEmitter<any>();
  @Output() cleared = new EventEmitter<any>();
  @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;
  
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
    if (value && typeof value === 'object' && value.display) {
        this.formControl.setValue(value.display, { emitEvent: false });
    } else {
        this.formControl.setValue(value, { emitEvent: false });
    }
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

        if (this.term && typeof this.term === 'object' && this.term["display"]) {
            this.formControl.setValue(this.term["display"]);
        } else {
            this.formControl.setValue(this.term);
        }
    }
  }


  ngOnInit(): void {
      this.autoFilter = this.formControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        /** 1️⃣  Launch request only when term ≥ 3 chars */
        switchMap((term: string) => {
          if (term?.length >= 3) {
            this.loading = true;
            /** 2️⃣  Emit [] immediately, then emit the server result */
            return concat(
              of([]),                                                   // clears the panel
              this.terminologyService
                  .expandValueSet(this.binding.ecl, term, 0, 50)
                  .pipe(
                    map(r => r.expansion.contains ?? []),               // extract concepts
                    finalize(() => (this.loading = false))              // turn spinner off
                  )
            );
          }
          /** 3️⃣  Short queries → always empty */
          return of([]);
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
    this.selectionChange.emit(this.selectedConcept);
    this.cleared.emit(null);
  }

  change(event: any) {
    const item = event?.option?.value;
    if (item) {
      this.optionSelected({ code: item.code, display: item.display });
      this.formControl.setValue(item.display); // Set the form control's value to the selected option's display
    }
  }

  focus(): void {
    if (this.inputElement?.nativeElement) {
      this.inputElement.nativeElement.focus();
    }
  }

}
