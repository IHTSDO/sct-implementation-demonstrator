import { Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, forwardRef, Optional, Host, DoCheck, Injector, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, UntypedFormControl, NgControl } from '@angular/forms';
import {debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap, tap, catchError} from 'rxjs/operators';
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
export class AutocompleteBindingComponent implements OnInit, OnChanges, AfterViewInit, ControlValueAccessor, DoCheck  {
  @Input() binding: any;
  @Input() term: string = "";
  @Input() readonly: boolean = false;
  @Input() terminologyServer?: string; // Optional: FHIR base URL for terminology server
  @Input() editionUri?: string; // Optional: Edition URI (e.g., 'http://snomed.info/sct/11000221109/version/20211130')
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
  errorState = false;
  controlType = 'app-autocomplete-binding';
  id = `app-autocomplete-binding-${AutocompleteBindingComponent.nextId++}`;
  describedBy = '';
  private ngControl: NgControl | null = null;
  private hasAttemptedNgControlInjection = false;

  constructor(
    private terminologyService: TerminologyService,
    private injector: Injector,
    private cdr: ChangeDetectorRef
  ) {
  }

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
        this.selectedConcept = value; // Store the full concept object including code
    } else {
        this.formControl.setValue(value, { emitEvent: false });
        this.selectedConcept = value && typeof value === 'object' ? value : {};
    }
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }



  ngOnInit(): void {
      // Disable form control if readonly
      if (this.readonly) {
        this.formControl.disable();
      }
      
      this.setupAutoFilter();
  }

  ngAfterViewInit(): void {
    // Only attempt to get NgControl once to avoid multiple injection attempts
    if (this.hasAttemptedNgControlInjection) {
      return;
    }
    this.hasAttemptedNgControlInjection = true;
    
    // Get NgControl after view init to avoid circular dependency
    // Use a delay to ensure FormControlName directive is initialized
    setTimeout(() => {
      try {
        // Try to get NgControl - if it causes circular dependency, the error will be caught
        const ngControl = this.injector.get(NgControl, null);
        if (ngControl && ngControl.control) {
          this.ngControl = ngControl;
          const parentControl = ngControl.control;
          
          // Sync validators from parent to internal control so Material detects errors natively
          if (parentControl.validator) {
            this.formControl.setValidators(parentControl.validator);
            this.formControl.updateValueAndValidity({ emitEvent: false });
          }
          if (parentControl.asyncValidator) {
            this.formControl.setAsyncValidators(parentControl.asyncValidator);
          }
          
          // Sync validation state when parent control status changes
          parentControl.statusChanges.subscribe(() => {
            this.syncValidationState();
          });
          
          this.updateErrorState();
        }
      } catch (e: any) {
        // If there's any error (including circular dependency), just continue without error state
        // This is safe because the component will still work, just without automatic error display
        this.ngControl = null;
      }
    }, 100);
  }

  private syncValidationState(): void {
    if (this.ngControl && this.ngControl.control) {
      const parentControl = this.ngControl.control;
      
      // Sync errors from parent to internal control so Material shows error natively
      if (parentControl.invalid && (parentControl.dirty || parentControl.touched)) {
        this.formControl.setErrors(parentControl.errors, { emitEvent: false });
        if (parentControl.touched) {
          this.formControl.markAsTouched({ onlySelf: true });
        }
        if (parentControl.dirty) {
          this.formControl.markAsDirty({ onlySelf: true });
        }
      } else if (parentControl.valid) {
        this.formControl.setErrors(null, { emitEvent: false });
      }
      
      this.updateErrorState();
    }
  }

  ngDoCheck(): void {
    // Update error state on every change detection cycle
    // Also try to get ngControl if not already set
    if (!this.ngControl && !this.hasAttemptedNgControlInjection) {
      try {
        this.ngControl = this.injector.get(NgControl, null);
        if (this.ngControl && this.ngControl.control) {
          // Sync validators when we first get the control
          const parentControl = this.ngControl.control;
          if (parentControl.validator) {
            this.formControl.setValidators(parentControl.validator);
            this.formControl.updateValueAndValidity({ emitEvent: false });
          }
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Sync validation state with parent on every check
    if (this.ngControl && this.ngControl.control) {
      this.syncValidationState();
    }
    
    // Always update error state
    const oldState = this.errorState;
    this.updateErrorState();
    if (oldState !== this.errorState) {
      this.stateChanges.next();
    }
  }

  private updateErrorState(): void {
    // Get error state from NgControl (parent FormControl)
    if (this.ngControl && this.ngControl.control) {
      const control = this.ngControl.control;
      this.errorState = !!(control.invalid && (control.dirty || control.touched));
    } else {
      this.errorState = false;
    }
  }

  hasRequiredError(): boolean {
    return !!(this.ngControl?.control?.hasError('required'));
  }


  private setupAutoFilter(): void {
    this.autoFilter = this.formControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      /** 1️⃣  Launch request only when term ≥ 3 chars */
      switchMap((term: string) => {
        if (this.readonly) {
          return of([]); // Don't search if readonly
        }
        if (term?.length >= 3) {
          this.loading = true;
          /** 2️⃣  Emit [] immediately, then emit the server result */
          return concat(
            of([]),                                                   // clears the panel
            this.getExpansionObservable(term)
              .pipe(
                map(r => r?.expansion?.contains ?? []),               // extract concepts, handle undefined safely
                catchError(err => {
                  console.error('Error expanding value set:', err);
                  return of([]); // Return empty array on error
                }),
                finalize(() => (this.loading = false))              // turn spinner off
              )
          );
        }
        /** 3️⃣  Short queries → always empty */
        return of([]);
      })
    );
  }

  private getExpansionObservable(term: string): Observable<any> {
    // If custom terminology server or edition URI is provided, use expandValueSetFromServer
    if (this.terminologyServer || this.editionUri) {
      return this.terminologyService.expandValueSetFromServer(
        this.terminologyServer || '', // Pass empty string if undefined (service will use default)
        this.editionUri || '', // Pass empty string if undefined (service will use default)
        this.binding.ecl,
        term,
        0,
        50
      );
    }
    // Otherwise, use default service configuration (backward compatible)
    return this.terminologyService.expandValueSet(this.binding.ecl, term, 0, 50);
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['readonly']) {
      if (this.readonly) {
        this.formControl.disable();
      } else {
        this.formControl.enable();
      }
    }
    if (changes['term']) {
        this.term = changes['term'].currentValue;

        if (this.term && typeof this.term === 'object' && this.term["display"]) {
            this.formControl.setValue(this.term["display"]);
            this.selectedConcept = this.term; // Store the full concept object
        } else {
            this.formControl.setValue(this.term);
            this.selectedConcept = {};
        }
    }
    // Re-setup autoFilter if terminologyServer or editionUri changes
    if (changes['terminologyServer'] || changes['editionUri']) {
      this.setupAutoFilter();
    }
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
      const concept = { code: item.code, display: item.display };
      this.selectedConcept = concept; // Update selectedConcept before calling optionSelected
      this.optionSelected(concept);
      this.formControl.setValue(item.display); // Set the form control's value to the selected option's display
      this.updateErrorState();
    }
  }

  onBlur(): void {
    this.focused = false;
    this.onTouched();
    
    // Sync validation state with parent control when blurring
    if (this.ngControl && this.ngControl.control) {
      const parentControl = this.ngControl.control;
      // If parent is invalid, sync errors to internal control
      if (parentControl.invalid) {
        this.formControl.setErrors(parentControl.errors);
        this.formControl.markAsTouched();
      }
    }
    
    // Force update error state after blur
    setTimeout(() => {
      this.updateErrorState();
      this.stateChanges.next();
    }, 0);
  }

  onFocus(): void {
    this.focused = true;
    this.stateChanges.next();
  }

  focus(): void {
    if (this.inputElement?.nativeElement) {
      this.inputElement.nativeElement.focus();
    }
  }

}
