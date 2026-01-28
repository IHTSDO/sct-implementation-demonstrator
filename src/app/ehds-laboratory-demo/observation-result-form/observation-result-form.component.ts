import { Component, OnInit, AfterViewInit, Inject, ViewContainerRef, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ValuesetDialogComponent } from '../valueset-dialog/valueset-dialog.component';
import { ConceptLookupDialogComponent } from '../concept-lookup-dialog/concept-lookup-dialog.component';
import { TerminologyService } from '../../services/terminology.service';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, startWith, map, Observable, of } from 'rxjs';

export interface ObservationResultData {
  status: string;
  code: {
    code: string;
    system: string;
    display: string;
    loincCode?: string | null; // LOINC code obtained from alternate identifiers
  } | null;
  subject: {
    reference: string;
    display: string;
  } | null;
  effectiveDateTime: Date | null;
  valueQuantity: {
    value: number;
    unit: string;
    system?: string;
    code?: string;
  } | null;
  valueString: string | null;
  valueCodeableConcept: {
    code: string;
    system: string;
    display: string;
  } | null;
  interpretation: {
    code: string;
    system: string;
    display: string;
  } | null;
  referenceRange: {
    low?: {
      value: number;
      unit: string;
    };
    high?: {
      value: number;
      unit: string;
    };
    text?: string;
  } | null;
  performer: {
    reference: string;
    display: string;
  } | null;
  method: {
    code: string;
    system: string;
    display: string;
  } | null;
  specimen: {
    reference: string;
    display: string;
    data?: any; // Optional: full SpecimenData object when available
  } | null;
  note: string | null;
}

@Component({
  selector: 'app-observation-result-form',
  templateUrl: './observation-result-form.component.html',
  styleUrls: ['./observation-result-form.component.css'],
  standalone: false
})
export class ObservationResultFormComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  observationForm: FormGroup;
  isViewOnly: boolean = false;
  valueType: 'quantity' | 'string' | 'codeableConcept' = 'quantity';

  // Status options from FHIR ObservationStatus ValueSet
  // https://hl7.org/fhir/R4/valueset-observation-status.html
  statusOptions = [
    { code: 'registered', display: 'Registered', definition: 'The existence of the observation is registered, but there is no result yet available.' },
    { code: 'preliminary', display: 'Preliminary', definition: 'This is an initial or interim observation: data may be incomplete or unverified.' },
    { code: 'final', display: 'Final', definition: 'The observation is complete and verified by an authorized person.' },
    { code: 'amended', display: 'Amended', definition: 'Subsequent to being Final, the observation has been modified subsequent to being Final.' },
    { code: 'corrected', display: 'Corrected', definition: 'Subsequent to being Final, the observation has been modified to correct an error in the original result.' },
    { code: 'cancelled', display: 'Cancelled', definition: 'The observation is unavailable because the measurement was not started or not completed.' },
    { code: 'entered-in-error', display: 'Entered in Error', definition: 'The observation has been withdrawn following previous Final release.' },
    { code: 'unknown', display: 'Unknown', definition: 'The authoring/source system does not know which of the status values currently applies for this observation.' }
  ];

  // Code options - Common laboratory test codes (LOINC)
  codeOptions = [
    { code: '718-7', system: 'http://loinc.org', display: 'Hemoglobin [Mass/volume] in Blood' },
    { code: '789-8', system: 'http://loinc.org', display: 'Erythrocytes [#/volume] in Blood by Automated count' },
    { code: '786-4', system: 'http://loinc.org', display: 'Leukocytes [#/volume] in Blood by Automated count' },
    { code: '777-3', system: 'http://loinc.org', display: 'Platelets [#/volume] in Blood by Automated count' },
    { code: '6690-2', system: 'http://loinc.org', display: 'Leukocytes [#/volume] in Blood by Manual count' },
    { code: '2160-0', system: 'http://loinc.org', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
    { code: '33914-3', system: 'http://loinc.org', display: 'Glucose [Mass/volume] in Blood' },
    { code: '2085-9', system: 'http://loinc.org', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
    { code: '2571-8', system: 'http://loinc.org', display: 'Triglyceride [Mass/volume] in Serum or Plasma' },
    { code: '2089-1', system: 'http://loinc.org', display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma' }
  ];

  // eHDSI Observation Interpretation with exceptions options loaded from FHIR ValueSet
  // https://fhir.ehdsi.eu/laboratory/ValueSet-eHDSIObservationInterpretationWithExceptions.html
  interpretationOptions: Array<{ code: string; display: string; system: string }> = [];
  interpretationOptionsLoading = false;

  // eHDSI Results Coded Value Laboratory options loaded from FHIR ValueSet
  valueCodeableConceptOptions: Array<{ code: string; display: string; system: string }> = [];
  valueCodeableConceptFilteredOptions: Observable<Array<{ code: string; display: string; system: string }>> = of([]);
  valueCodeableConceptOptionsLoading = false;
  valueCodeableConceptInputControl = new FormControl('');

  // eHDSI Laboratory Technique with exceptions options loaded from FHIR ValueSet
  methodOptions: Array<{ code: string; display: string; system: string }> = [];
  methodFilteredOptions: Observable<Array<{ code: string; display: string; system: string }>> = of([]);
  methodOptionsLoading = false;
  methodInputControl = new FormControl('');

  // Binding for Observation Code (LOINC via SNOMED CT)
  codeBinding = {
    ecl: '^ 635121010000106 |Logical Observation Identifiers Names and Codes Observation Reference Set (foundation metadata concept)|',
    title: 'Test Code',
    note: 'Search for laboratory test codes'
  };

  // UCUM units loaded from FHIR ValueSet
  unitOptions: Array<{ code: string; display: string; system: string }> = [];
  unitFilteredOptions: Observable<Array<{ code: string; display: string; system: string }>> = of([]);
  unitOptionsLoading = false;
  unitInputControl = new FormControl('');

  // Available specimens from Diagnostic Report (passed via data)
  availableSpecimens: Array<{ reference: string; display: string; data: any }> = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ObservationResultFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar,
    private viewContainerRef: ViewContainerRef,
    private http: HttpClient
  ) {
    this.observationForm = this.createForm();
    // Check if data contains viewOnly flag and available specimens
    if (this.data && typeof this.data === 'object') {
      if ('viewOnly' in this.data) {
        this.isViewOnly = this.data.viewOnly === true;
      }
      // Get available specimens from data
      if ('availableSpecimens' in this.data && Array.isArray(this.data.availableSpecimens)) {
        this.availableSpecimens = this.data.availableSpecimens.map((spec: any, index: number) => ({
          reference: `specimen-${index + 1}`,
          display: spec.referenceNumber || `Specimen ${index + 1}`,
          data: spec
        }));
      }
      if (this.isViewOnly) {
        this.observationForm.disable();
        // Also explicitly disable nested form groups and controls
        this.observationForm.get('valueQuantity')?.disable();
        this.observationForm.get('referenceRange')?.disable();
        // Disable individual nested controls
        this.valueQuantityUnitControl?.disable();
        this.valueQuantityValueControl?.disable();
        this.referenceRangeLowValueControl?.disable();
        this.referenceRangeLowUnitControl?.disable();
        this.referenceRangeHighValueControl?.disable();
        this.referenceRangeHighUnitControl?.disable();
      }
    }
  }

  ngOnInit(): void {
    this.loadUCUMUnits();
    this.setupUnitFilter();
    this.updateUnitControlState();
    this.loadEHDSIResultsCodedValue();
    this.setupValueCodeableConceptFilter();
    // Initialize method filter first, then load data
    this.setupMethodFilter();
    this.loadEHDSILabTechnique();
    this.loadEHDSIObservationInterpretation();
    this.setupReferenceRangeUnitSync();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUCUMUnits(): void {
    this.unitOptionsLoading = true;
    
    // Load from static JSON file in assets
    this.http.get<any>('assets/data/ucum-units.json')
      .subscribe({
        next: (response) => {
          if (response?.expansion?.contains) {
            this.unitOptions = response.expansion.contains.map((item: any) => ({
              code: item.code || '',
              display: item.display || item.code || '',
              system: item.system || 'http://unitsofmeasure.org'
            }));
            // Sort by display name for better UX
            this.unitOptions.sort((a, b) => a.display.localeCompare(b.display));
            
            // If we have a unit code in the form, try to match it now
            const currentUnitCode = this.valueQuantityUnitControl?.value;
            if (currentUnitCode && typeof currentUnitCode === 'string') {
              const matchedUnit = this.unitOptions.find(u => u.code === currentUnitCode);
              if (matchedUnit) {
                this.valueQuantityUnitControl.setValue(matchedUnit.code, { emitEvent: false });
                this.unitInputControl.setValue(matchedUnit.display, { emitEvent: false });
              }
            }
            
            // Initialize filtered options Observable
            this.setupUnitFilter();
          } else {
          // Fallback to common units if expansion fails
          this.unitOptions = this.getFallbackUnits();
        }
        // Initialize filtered options Observable
        this.setupUnitFilter();
        this.unitOptionsLoading = false;
        this.updateUnitControlState();
        // Sync reference range units after units are loaded
        this.syncReferenceRangeUnits();
        },
        error: (err) => {
          console.error('Error loading UCUM units from assets:', err);
          // Fallback to common units on error
          this.unitOptions = this.getFallbackUnits();
          // Initialize filtered options Observable
          this.setupUnitFilter();
          this.unitOptionsLoading = false;
          this.updateUnitControlState();
          // Sync reference range units after units are loaded
          this.syncReferenceRangeUnits();
        }
      });
  }

  private updateUnitControlState(): void {
    if (this.isViewOnly || this.unitOptionsLoading) {
      this.valueQuantityUnitControl?.disable({ emitEvent: false });
    } else {
      this.valueQuantityUnitControl?.enable({ emitEvent: false });
    }
  }

  private setupReferenceRangeUnitSync(): void {
    // Make unit controls readonly
    this.referenceRangeLowUnitControl?.disable({ emitEvent: false });
    this.referenceRangeHighUnitControl?.disable({ emitEvent: false });
    
    // Sync reference range units with value quantity unit
    this.valueQuantityUnitControl?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(unitCode => {
        this.syncReferenceRangeUnits();
      });
  }

  private syncReferenceRangeUnits(): void {
    const referenceRangeGroup = this.observationForm.get('referenceRange');
    if (!referenceRangeGroup) {
      return;
    }
    
    const currentUnitCode = this.valueQuantityUnitControl?.value;
    if (currentUnitCode && typeof currentUnitCode === 'string') {
      // Find the unit display name
      const matchedUnit = this.unitOptions.find(u => u.code === currentUnitCode);
      const unitDisplay = matchedUnit ? matchedUnit.display : currentUnitCode;
      
      // Update both reference range unit fields using patchValue on the group
      referenceRangeGroup.patchValue({
        low: {
          ...referenceRangeGroup.get('low')?.value,
          unit: unitDisplay
        },
        high: {
          ...referenceRangeGroup.get('high')?.value,
          unit: unitDisplay
        }
      }, { emitEvent: false });
    } else {
      // Clear units if no unit is selected
      referenceRangeGroup.patchValue({
        low: {
          ...referenceRangeGroup.get('low')?.value,
          unit: ''
        },
        high: {
          ...referenceRangeGroup.get('high')?.value,
          unit: ''
        }
      }, { emitEvent: false });
    }
  }

  private loadEHDSIResultsCodedValue(): void {
    this.valueCodeableConceptOptionsLoading = true;
    
    // Load from static JSON file in assets
    this.http.get<any>('assets/data/ehdsi-results-coded-value-laboratory.json')
      .subscribe({
        next: (response) => {
          if (response?.expansion?.contains) {
            this.valueCodeableConceptOptions = response.expansion.contains.map((item: any) => ({
              code: item.code || '',
              display: item.display || item.code || '',
              system: item.system || 'http://snomed.info/sct'
            }));
            // Sort by display name for better UX
            this.valueCodeableConceptOptions.sort((a, b) => a.display.localeCompare(b.display));
            
            // If we have a valueCodeableConcept in the form, try to match it now
            const currentValueCodeableConcept = this.observationForm.get('valueCodeableConcept')?.value;
            if (currentValueCodeableConcept) {
              if (typeof currentValueCodeableConcept === 'object' && currentValueCodeableConcept.code) {
                const matchedOption = this.valueCodeableConceptOptions.find(
                  o => o.code === currentValueCodeableConcept.code && o.system === currentValueCodeableConcept.system
                );
                if (matchedOption) {
                  this.observationForm.patchValue({ valueCodeableConcept: matchedOption }, { emitEvent: false });
                  this.valueCodeableConceptInputControl.setValue(matchedOption.display, { emitEvent: false });
                }
              } else if (typeof currentValueCodeableConcept === 'string') {
                const matchedOption = this.valueCodeableConceptOptions.find(o => o.code === currentValueCodeableConcept);
                if (matchedOption) {
                  this.observationForm.patchValue({ valueCodeableConcept: matchedOption }, { emitEvent: false });
                  this.valueCodeableConceptInputControl.setValue(matchedOption.display, { emitEvent: false });
                }
              }
            }
          }
          // Initialize filtered options Observable
          this.setupValueCodeableConceptFilter();
          this.valueCodeableConceptOptionsLoading = false;
        },
        error: (err) => {
          console.error('Error loading eHDSI Results Coded Value from assets:', err);
          this.valueCodeableConceptOptions = [];
          this.valueCodeableConceptFilteredOptions = of([]);
          this.valueCodeableConceptOptionsLoading = false;
        }
      });
  }

  private setupValueCodeableConceptFilter(): void {
    this.valueCodeableConceptFilteredOptions = this.valueCodeableConceptInputControl.valueChanges.pipe(
      startWith(''),
      map(term => {
        const searchTerm = (term ?? '').toLowerCase();
        if (!searchTerm || searchTerm.length === 0) {
          return [...this.valueCodeableConceptOptions];
        }
        
        // Filter and sort by match length (shorter matches first)
        return this.valueCodeableConceptOptions
          .filter(option => {
            const displayLower = option.display.toLowerCase();
            const codeLower = option.code.toLowerCase();
            return displayLower.includes(searchTerm) || codeLower.includes(searchTerm);
          })
          .map(option => {
            const displayLower = option.display.toLowerCase();
            const codeLower = option.code.toLowerCase();
            
            // Calculate match length - prefer exact matches, then display matches, then code matches
            let matchLength = Infinity;
            
            if (displayLower === searchTerm || codeLower === searchTerm) {
              // Exact match - highest priority
              matchLength = 0;
            } else if (displayLower.startsWith(searchTerm) || codeLower.startsWith(searchTerm)) {
              // Starts with term - high priority
              matchLength = displayLower.startsWith(searchTerm) ? displayLower.length : codeLower.length;
            } else if (displayLower.includes(searchTerm)) {
              // Contains in display
              matchLength = displayLower.length;
            } else if (codeLower.includes(searchTerm)) {
              // Contains in code
              matchLength = codeLower.length;
            }
            
            return { option, matchLength };
          })
          .sort((a, b) => {
            // Sort by match length (shorter first), then alphabetically
            if (a.matchLength !== b.matchLength) {
              return a.matchLength - b.matchLength;
            }
            return a.option.display.localeCompare(b.option.display);
          })
          .map(item => item.option);
      }),
      takeUntil(this.destroy$)
    );
  }

  displayValueCodeableConceptFn = (option: { code: string; display: string; system: string }): string => {
    return option ? option.display : '';
  }

  onValueCodeableConceptSelected(event: any): void {
    const option = event.option?.value;
    if (option && typeof option === 'object' && option.code) {
      this.observationForm.patchValue({ valueCodeableConcept: option });
      this.valueCodeableConceptInputControl.setValue(option.display, { emitEvent: false });
    }
  }

  getValueCodeableConceptDisplay = (codeableConcept: { code: string; display: string; system: string } | null | string): string => {
    if (!codeableConcept) {
      return '';
    }
    // If it's a string, try to find the display
    if (typeof codeableConcept === 'string') {
      const found = this.valueCodeableConceptOptions.find(o => o.code === codeableConcept);
      return found ? found.display : codeableConcept;
    }
    // If it's an object with display property
    if (typeof codeableConcept === 'object' && 'display' in codeableConcept && codeableConcept.display) {
      return codeableConcept.display;
    }
    // If it's an object with code but no display, try to find it
    if (typeof codeableConcept === 'object' && 'code' in codeableConcept) {
      const found = this.valueCodeableConceptOptions.find(o => o.code === codeableConcept.code);
      return found ? found.display : (codeableConcept.code || '');
    }
    return '';
  }

  private loadEHDSILabTechnique(): void {
    this.methodOptionsLoading = true;
    
    // Load from static JSON file in assets
    this.http.get<any>('assets/data/ehdsi-lab-technique-with-exceptions.json')
      .subscribe({
        next: (response) => {
          if (response?.expansion?.contains) {
            this.methodOptions = response.expansion.contains.map((item: any) => ({
              code: item.code || '',
              display: item.display || item.code || '',
              system: item.system || 'http://snomed.info/sct'
            }));
            // Sort by display name for better UX
            this.methodOptions.sort((a, b) => a.display.localeCompare(b.display));
            
            // If we have a method in the form, try to match it now
            const currentMethod = this.observationForm.get('method')?.value;
            if (currentMethod) {
              if (typeof currentMethod === 'object' && currentMethod.code) {
                const matchedOption = this.methodOptions.find(
                  o => o.code === currentMethod.code && o.system === currentMethod.system
                );
                if (matchedOption) {
                  this.observationForm.patchValue({ method: matchedOption }, { emitEvent: false });
                  this.methodInputControl.setValue(matchedOption.display, { emitEvent: false });
                }
              } else if (typeof currentMethod === 'string') {
                const matchedOption = this.methodOptions.find(o => o.code === currentMethod);
                if (matchedOption) {
                  this.observationForm.patchValue({ method: matchedOption }, { emitEvent: false });
                  this.methodInputControl.setValue(matchedOption.display, { emitEvent: false });
                }
              }
            }
          }
          // Re-setup filter with loaded options
          this.setupMethodFilter();
          // Trigger the Observable to emit with current value (empty string) to show all options
          this.methodInputControl.updateValueAndValidity({ emitEvent: true });
          this.methodOptionsLoading = false;
        },
        error: (err) => {
          console.error('Error loading eHDSI Laboratory Technique from assets:', err);
          this.methodOptions = [];
          this.methodFilteredOptions = of([]);
          this.methodOptionsLoading = false;
        }
      });
  }

  private loadEHDSIObservationInterpretation(): void {
    this.interpretationOptionsLoading = true;
    
    // Load from static JSON file in assets
    this.http.get<any>('assets/data/ehdsi-observation-interpretation-with-exceptions.json')
      .subscribe({
        next: (response) => {
          if (response?.expansion?.contains) {
            this.interpretationOptions = response.expansion.contains.map((item: any) => ({
              code: item.code || '',
              display: item.display || item.code || '',
              system: item.system || 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
            }));
            // Sort by display name for better UX
            this.interpretationOptions.sort((a, b) => a.display.localeCompare(b.display));
            
            // If we have an interpretation in the form, try to match it now
            const currentInterpretation = this.observationForm.get('interpretation')?.value;
            if (currentInterpretation) {
              if (typeof currentInterpretation === 'object' && currentInterpretation.code) {
                const matchedOption = this.interpretationOptions.find(
                  o => o.code === currentInterpretation.code && o.system === currentInterpretation.system
                );
                if (matchedOption) {
                  this.observationForm.patchValue({ interpretation: matchedOption }, { emitEvent: false });
                }
              } else if (typeof currentInterpretation === 'string') {
                const matchedOption = this.interpretationOptions.find(o => o.code === currentInterpretation);
                if (matchedOption) {
                  this.observationForm.patchValue({ interpretation: matchedOption }, { emitEvent: false });
                }
              }
            }
          }
          this.interpretationOptionsLoading = false;
        },
        error: (err) => {
          console.error('Error loading eHDSI Observation Interpretation from assets:', err);
          this.interpretationOptions = [];
          this.interpretationOptionsLoading = false;
        }
      });
  }

  private setupMethodFilter(): void {
    // Recreate the Observable to pick up the latest methodOptions
    const currentValue = this.methodInputControl.value || '';
    this.methodFilteredOptions = this.methodInputControl.valueChanges.pipe(
      startWith(currentValue),
      map(term => {
        // Handle both string and object values
        let termValue: string = '';
        if (typeof term === 'string') {
          termValue = term;
        } else if (term && typeof term === 'object' && 'display' in term) {
          termValue = (term as { display: string }).display || '';
        }
        const searchTerm = termValue.toLowerCase();
        // If no options loaded yet, return empty array
        if (!this.methodOptions || this.methodOptions.length === 0) {
          return [];
        }
        
        if (!searchTerm || searchTerm.length === 0) {
          return [...this.methodOptions];
        }
        
        // Filter and sort by match length (shorter matches first)
        return this.methodOptions
          .filter(option => {
            const displayLower = option.display.toLowerCase();
            const codeLower = option.code.toLowerCase();
            return displayLower.includes(searchTerm) || codeLower.includes(searchTerm);
          })
          .map(option => {
            const displayLower = option.display.toLowerCase();
            const codeLower = option.code.toLowerCase();
            
            // Calculate match length - prefer exact matches, then display matches, then code matches
            let matchLength = Infinity;
            
            if (displayLower === searchTerm || codeLower === searchTerm) {
              // Exact match - highest priority
              matchLength = 0;
            } else if (displayLower.startsWith(searchTerm) || codeLower.startsWith(searchTerm)) {
              // Starts with term - high priority
              matchLength = displayLower.startsWith(searchTerm) ? displayLower.length : codeLower.length;
            } else if (displayLower.includes(searchTerm)) {
              // Contains in display
              matchLength = displayLower.length;
            } else if (codeLower.includes(searchTerm)) {
              // Contains in code
              matchLength = codeLower.length;
            }
            
            return { option, matchLength };
          })
          .sort((a, b) => {
            // Sort by match length (shorter first), then alphabetically
            if (a.matchLength !== b.matchLength) {
              return a.matchLength - b.matchLength;
            }
            return a.option.display.localeCompare(b.option.display);
          })
          .map(item => item.option);
      }),
      takeUntil(this.destroy$)
    );
  }

  @ViewChild('methodAutoTrigger') methodAutoTrigger!: MatAutocompleteTrigger;

  displayMethodFn = (method: { code: string; display: string; system: string } | string | null): string => {
    if (!method) {
      return '';
    }
    if (typeof method === 'string') {
      return method;
    }
    return method.display || '';
  }

  onMethodSelected(event: any): void {
    const method = event.option?.value;
    if (method && typeof method === 'object' && method.code) {
      // Set the form control value (the actual method object)
      this.observationForm.patchValue({ method: method }, { emitEvent: false });
      
      // The autocomplete will set the object in methodInputControl, but we'll fix it in onMethodAutocompleteClosed
    }
  }

  onMethodAutocompleteClosed(): void {
    // After autocomplete closes, ensure the input shows the display string, not the object
    const currentValue = this.methodInputControl.value;
    const formMethod = this.observationForm.get('method')?.value;
    
    if (formMethod && typeof formMethod === 'object' && 'display' in formMethod) {
      // If we have a method object in the form, show its display in the input
      const methodDisplay = (formMethod as { display: string }).display;
      if (currentValue !== methodDisplay) {
        this.methodInputControl.setValue(methodDisplay, { emitEvent: false });
      }
    } else if (currentValue && typeof currentValue === 'object' && 'display' in currentValue) {
      // If the input has an object, extract the display
      const currentDisplay = (currentValue as { display: string }).display;
      this.methodInputControl.setValue(currentDisplay, { emitEvent: false });
    }
  }

  onMethodInputFocus(): void {
    // Open autocomplete panel automatically when input is focused and empty
    if (!this.methodInputControl.value && this.methodOptions.length > 0) {
      setTimeout(() => {
        if (this.methodAutoTrigger) {
          this.methodAutoTrigger.openPanel();
        }
      }, 100);
    }
  }

  private getFallbackUnits(): Array<{ code: string; display: string; system: string }> {
    return [
      { code: 'g/L', display: 'g/L', system: 'http://unitsofmeasure.org' },
      { code: 'mg/dL', display: 'mg/dL', system: 'http://unitsofmeasure.org' },
      { code: 'mmol/L', display: 'mmol/L', system: 'http://unitsofmeasure.org' },
      { code: '10*3/uL', display: '10³/µL', system: 'http://unitsofmeasure.org' },
      { code: '10*6/uL', display: '10⁶/µL', system: 'http://unitsofmeasure.org' },
      { code: '%', display: '%', system: 'http://unitsofmeasure.org' },
      { code: 'fL', display: 'fL', system: 'http://unitsofmeasure.org' },
      { code: 'pg', display: 'pg', system: 'http://unitsofmeasure.org' }
    ];
  }

  private setupUnitFilter(): void {
    this.unitFilteredOptions = this.unitInputControl.valueChanges.pipe(
      startWith(''),
      map(term => {
        // Handle both string and object values
        let termValue: string = '';
        if (typeof term === 'string') {
          termValue = term;
        } else if (term && typeof term === 'object' && 'display' in term) {
          termValue = (term as { display: string }).display || '';
        }
        const searchTerm = termValue.toLowerCase();
        if (!searchTerm || searchTerm.length === 0) {
          return [...this.unitOptions];
        }
        
        // Filter and sort by match length (shorter matches first)
        return this.unitOptions
          .filter(unit => {
            const displayLower = unit.display.toLowerCase();
            const codeLower = unit.code.toLowerCase();
            return displayLower.includes(searchTerm) || codeLower.includes(searchTerm);
          })
          .map(unit => {
            const displayLower = unit.display.toLowerCase();
            const codeLower = unit.code.toLowerCase();
            
            // Calculate match length - prefer exact matches, then display matches, then code matches
            let matchLength = Infinity;
            
            if (displayLower === searchTerm || codeLower === searchTerm) {
              // Exact match - highest priority
              matchLength = 0;
            } else if (displayLower.startsWith(searchTerm) || codeLower.startsWith(searchTerm)) {
              // Starts with term - high priority
              matchLength = displayLower.startsWith(searchTerm) ? displayLower.length : codeLower.length;
            } else if (displayLower.includes(searchTerm)) {
              // Contains in display
              matchLength = displayLower.length;
            } else if (codeLower.includes(searchTerm)) {
              // Contains in code
              matchLength = codeLower.length;
            }
            
            return { unit, matchLength };
          })
          .sort((a, b) => {
            // Sort by match length (shorter first), then alphabetically
            if (a.matchLength !== b.matchLength) {
              return a.matchLength - b.matchLength;
            }
            return a.unit.display.localeCompare(b.unit.display);
          })
          .map(item => item.unit);
      }),
      takeUntil(this.destroy$)
    );
  }

  displayUnitFn = (unit: { code: string; display: string; system: string } | string | null): string => {
    if (!unit) {
      return '';
    }
    if (typeof unit === 'string') {
      return unit;
    }
    return unit.display || '';
  }

  onUnitSelected(event: any): void {
    const unit = event.option?.value;
    if (unit && typeof unit === 'object' && unit.code) {
      // Set the form control value (the actual unit code)
      this.valueQuantityUnitControl.setValue(unit.code, { emitEvent: false });
      // Sync reference range units immediately
      this.syncReferenceRangeUnits();
      // The autocomplete will set the object in unitInputControl, but we'll fix it in onUnitAutocompleteClosed
    }
  }

  onUnitAutocompleteClosed(): void {
    // After autocomplete closes, ensure the input shows the display string, not the object
    const currentValue = this.unitInputControl.value;
    const formUnitCode = this.valueQuantityUnitControl?.value;
    
    if (formUnitCode && typeof formUnitCode === 'string') {
      // Find the unit object by code
      const matchedUnit = this.unitOptions.find(u => u.code === formUnitCode);
      if (matchedUnit) {
        // If we have a unit code in the form, show its display in the input
        if (currentValue !== matchedUnit.display) {
          this.unitInputControl.setValue(matchedUnit.display, { emitEvent: false });
        }
        // Ensure reference range units are synced
        this.syncReferenceRangeUnits();
      }
    } else if (currentValue && typeof currentValue === 'object' && 'display' in currentValue) {
      // If the input has an object, extract the display
      const currentDisplay = (currentValue as { display: string }).display;
      this.unitInputControl.setValue(currentDisplay, { emitEvent: false });
    }
  }

  ngAfterViewInit(): void {
    // Load data after view is initialized to ensure all form controls are ready
    if (this.data) {
      const dataToLoad = (this.data && typeof this.data === 'object' && 'observation' in this.data) ? this.data.observation : this.data;
      this.loadFormData(dataToLoad);
      // Disable form if viewOnly mode
      if (this.isViewOnly) {
        this.observationForm.disable();
        // Also explicitly disable nested form groups and controls
        this.observationForm.get('valueQuantity')?.disable({ emitEvent: false });
        this.observationForm.get('referenceRange')?.disable({ emitEvent: false });
        // Disable individual nested controls
        this.valueQuantityUnitControl?.disable({ emitEvent: false });
        this.valueQuantityValueControl?.disable({ emitEvent: false });
        this.referenceRangeLowValueControl?.disable({ emitEvent: false });
        this.referenceRangeLowUnitControl?.disable({ emitEvent: false });
        this.referenceRangeHighValueControl?.disable({ emitEvent: false });
        this.referenceRangeHighUnitControl?.disable({ emitEvent: false });
      }
      // Update unit control state after view init
      this.updateUnitControlState();
    }
  }

  private loadFormData(data: ObservationResultData): void {
    setTimeout(() => {
      // For code, use data.code directly (autocomplete-binding expects {code, display} format)
      const codeValue = data.code ? {
        code: data.code.code,
        display: data.code.display
      } : null;
      const matchedInterpretation = data.interpretation && data.interpretation.code ? this.interpretationOptions.find(opt => opt.code === data.interpretation!.code) : null;

      // Determine value type
      if (data.valueQuantity) {
        this.valueType = 'quantity';
      } else if (data.valueString) {
        this.valueType = 'string';
      } else if (data.valueCodeableConcept) {
        this.valueType = 'codeableConcept';
      }

      // Find matching specimen from available specimens
      const matchedSpecimen = data.specimen && data.specimen.reference 
        ? this.availableSpecimens.find(s => s.reference === data.specimen!.reference || s.data === data.specimen)
        : null;

      this.observationForm.patchValue({
        status: data.status || '',
        code: codeValue,
        subject: data.subject || null,
        effectiveDateTime: data.effectiveDateTime ? new Date(data.effectiveDateTime) : null,
        specimen: matchedSpecimen || data.specimen || null,
        valueQuantity: data.valueQuantity ? {
          value: data.valueQuantity.value || null,
          unit: data.valueQuantity.unit || ''
        } : { value: null, unit: '' },
        valueString: data.valueString || '',
        valueCodeableConcept: data.valueCodeableConcept || null,
        interpretation: matchedInterpretation || null,
        referenceRange: data.referenceRange ? {
          low: data.referenceRange.low ? {
            value: data.referenceRange.low.value || null,
            unit: data.referenceRange.low.unit || ''
          } : { value: null, unit: '' },
          high: data.referenceRange.high ? {
            value: data.referenceRange.high.value || null,
            unit: data.referenceRange.high.unit || ''
          } : { value: null, unit: '' }
        } : {
          low: { value: null, unit: '' },
          high: { value: null, unit: '' }
        },
        performer: data.performer || null,
        method: data.method || null,
        note: data.note || ''
      }, { emitEvent: false });

      // Sync unit control with form control
      if (data.valueQuantity?.unit) {
        const unitCode = data.valueQuantity.unit;
        // Set the unit code directly - it will be matched when units load
        this.valueQuantityUnitControl.setValue(unitCode, { emitEvent: false });
        // Wait for options to load, then sync input control and reference range units
        setTimeout(() => {
          const matchedUnit = this.unitOptions.find(u => u.code === unitCode);
          if (matchedUnit) {
            this.unitInputControl.setValue(matchedUnit.display, { emitEvent: false });
            // Sync reference range units
            this.referenceRangeLowUnitControl?.setValue(matchedUnit.display, { emitEvent: false });
            this.referenceRangeHighUnitControl?.setValue(matchedUnit.display, { emitEvent: false });
          } else {
            this.unitInputControl.setValue(unitCode, { emitEvent: false });
            // Sync reference range units with code if no match found
            this.referenceRangeLowUnitControl?.setValue(unitCode, { emitEvent: false });
            this.referenceRangeHighUnitControl?.setValue(unitCode, { emitEvent: false });
          }
        }, 100);
      }

      // Sync valueCodeableConcept input control with form control
      if (data.valueCodeableConcept && typeof data.valueCodeableConcept === 'object' && data.valueCodeableConcept.display) {
        // Wait for options to load, then sync
        setTimeout(() => {
          const valueCodeableConcept = data.valueCodeableConcept;
          if (valueCodeableConcept && typeof valueCodeableConcept === 'object' && valueCodeableConcept.code) {
            const matchedOption = this.valueCodeableConceptOptions.find(
              o => o.code === valueCodeableConcept.code && o.system === valueCodeableConcept.system
            );
            if (matchedOption) {
              this.valueCodeableConceptInputControl.setValue(matchedOption.display, { emitEvent: false });
            } else if (valueCodeableConcept.display) {
              this.valueCodeableConceptInputControl.setValue(valueCodeableConcept.display, { emitEvent: false });
            }
          }
        }, 100);
      }

      // Sync method input control with form control
      if (data.method && typeof data.method === 'object' && data.method.display) {
        // Wait for options to load, then sync
        setTimeout(() => {
          const method = data.method;
          if (method && typeof method === 'object' && method.code) {
            const matchedOption = this.methodOptions.find(
              o => o.code === method.code && o.system === method.system
            );
            if (matchedOption) {
              this.methodInputControl.setValue(matchedOption.display, { emitEvent: false });
            } else if (method.display) {
              this.methodInputControl.setValue(method.display, { emitEvent: false });
            }
          }
        }, 100);
      }

      this.updateValueType();
    }, 100);
  }

  private createForm(): FormGroup {
    return this.fb.group({
      status: ['final', Validators.required],
      code: [null, Validators.required],
      subject: [null],
      effectiveDateTime: [null],
      valueQuantity: this.fb.group({
        value: [null],
        unit: ['']
      }),
      valueString: [''],
      valueCodeableConcept: [null],
      interpretation: [null],
      referenceRange: this.fb.group({
        low: this.fb.group({
          value: [null],
          unit: ['']
        }),
        high: this.fb.group({
          value: [null],
          unit: ['']
        })
      }),
      performer: [null],
      method: [null],
      specimen: [null],
      note: ['']
    });
  }

  updateValueType(): void {
    // Clear other value types when switching
    if (this.valueType === 'quantity') {
      this.observationForm.patchValue({ 
        valueString: '', 
        valueCodeableConcept: null 
      });
    } else if (this.valueType === 'string') {
      this.observationForm.patchValue({ 
        valueQuantity: { value: null, unit: '' }, 
        valueCodeableConcept: null 
      });
    } else if (this.valueType === 'codeableConcept') {
      this.observationForm.patchValue({ 
        valueQuantity: { value: null, unit: '' }, 
        valueString: '' 
      });
    }
  }

  onSubmit(): void {
    if (this.observationForm.valid) {
      const formValue = this.observationForm.value;
      const formData: ObservationResultData = {
        status: formValue.status,
        code: formValue.code,
        subject: formValue.subject,
        effectiveDateTime: formValue.effectiveDateTime,
        valueQuantity: (this.valueType === 'quantity' && formValue.valueQuantity?.value) ? {
          value: formValue.valueQuantity.value,
          unit: formValue.valueQuantity.unit || '',
          system: 'http://unitsofmeasure.org',
          code: formValue.valueQuantity.unit || ''
        } : null,
        valueString: this.valueType === 'string' ? formValue.valueString : null,
        valueCodeableConcept: this.valueType === 'codeableConcept' ? formValue.valueCodeableConcept : null,
        interpretation: formValue.interpretation,
        referenceRange: (() => {
          const hasLow = formValue.referenceRange?.low?.value !== null && formValue.referenceRange?.low?.value !== undefined;
          const hasHigh = formValue.referenceRange?.high?.value !== null && formValue.referenceRange?.high?.value !== undefined;
          
          if (!hasLow && !hasHigh) {
            return null;
          }
          
          // Get the unit code from valueQuantity (not from referenceRange unit fields which are readonly displays)
          const unitCode = formValue.valueQuantity?.unit || '';
          
          const range: any = {};
          
          if (hasLow) {
            range.low = {
              value: formValue.referenceRange.low.value,
              unit: unitCode,
              system: 'http://unitsofmeasure.org',
              code: unitCode
            };
          }
          
          if (hasHigh) {
            range.high = {
              value: formValue.referenceRange.high.value,
              unit: unitCode,
              system: 'http://unitsofmeasure.org',
              code: unitCode
            };
          }
          
          return range;
        })(),
        performer: formValue.performer,
        method: formValue.method || null,
        specimen: formValue.specimen || null,
        note: formValue.note || null
      };
      this.dialogRef.close(formData);
    } else {
      Object.keys(this.observationForm.controls).forEach(key => {
        this.observationForm.get(key)?.markAsTouched();
      });
      
      // Show validation error snackbar inside the modal
      const invalidFields = Object.keys(this.observationForm.controls)
        .filter(key => this.observationForm.get(key)?.invalid)
        .length;
      
      const message = invalidFields === 1 
        ? 'Please fill in all required fields' 
        : `Please fill in all required fields (${invalidFields} fields are invalid)`;
      
      // Use the component's viewContainerRef to show snackbar inside the dialog
      this.snackBar.open(message, 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['error-snackbar', 'dialog-snackbar'],
        viewContainerRef: this.viewContainerRef
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getStatusDefinition(code: string): string {
    const status = this.statusOptions.find(opt => opt.code === code);
    return status ? status.definition : '';
  }

  openValuesetDialog(valuesetUrl: string, fieldName: string, dialogTitle?: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      autoFocus: false,
      restoreFocus: true,
      data: { url: valuesetUrl, fieldName: fieldName, dialogTitle: dialogTitle },
      panelClass: 'valueset-dialog-container'
    });
  }


  get valueQuantityValueControl(): FormControl {
    return this.observationForm.get('valueQuantity')?.get('value') as FormControl;
  }

  get valueQuantityUnitControl(): FormControl {
    return this.observationForm.get('valueQuantity')?.get('unit') as FormControl;
  }


  get referenceRangeLowValueControl(): FormControl {
    return this.observationForm.get('referenceRange')?.get('low')?.get('value') as FormControl;
  }

  get referenceRangeLowUnitControl(): FormControl {
    return this.observationForm.get('referenceRange')?.get('low')?.get('unit') as FormControl;
  }

  get referenceRangeHighValueControl(): FormControl {
    return this.observationForm.get('referenceRange')?.get('high')?.get('value') as FormControl;
  }

  get referenceRangeHighUnitControl(): FormControl {
    return this.observationForm.get('referenceRange')?.get('high')?.get('unit') as FormControl;
  }

  get loincCode(): string | null {
    const codeValue = this.observationForm.get('code')?.value;
    return codeValue?.loincCode || null;
  }

  onCodeSelected(concept: any): void {
    if (concept && concept.code) {
      // Get LOINC code from alternate identifiers using the LOINC SNOMED server
      const loincSnomedServer = 'https://browser.loincsnomed.org/fhir';
      this.terminologyService.getAlternateIdentifiers(concept.code, loincSnomedServer).subscribe({
        next: (alternateIdentifiers) => {
          const loincCode = this.getAlternateIdentifierByScheme(alternateIdentifiers, '30051010000102');
          
          // Update the form control with both SNOMED CT and LOINC codes
          const currentCodeValue = this.observationForm.get('code')?.value;
          if (currentCodeValue) {
            // Store LOINC code as a property on the code object
            const updatedCode = {
              ...currentCodeValue,
              loincCode: loincCode || null
            };
            this.observationForm.patchValue({ code: updatedCode }, { emitEvent: false });
          }
        },
        error: (err) => {
          console.error('Error fetching LOINC code:', err);
          // Continue without LOINC code if there's an error
        }
      });
    }
  }

  getAlternateIdentifierByScheme(alternateIdentifiers: any[], identifierSchemeConceptId: string): string | null {
    // Find the alternate identifier that matches the given identifier scheme concept ID
    const matchingIdentifier = alternateIdentifiers.find(
      (identifier: any) => identifier.identifierScheme?.conceptId === identifierSchemeConceptId
    );
    
    // Return the alternateIdentifier value if found, otherwise return null
    return matchingIdentifier ? matchingIdentifier.alternateIdentifier : null;
  }

  openSnomedLookup(): void {
    const codeValue = this.observationForm.get('code')?.value;
    if (!codeValue || !codeValue.code) {
      return;
    }
    
    const display = codeValue.display || '';
    const snomedCode = codeValue.code; // Use SNOMED CT concept ID
    const loincCode = codeValue.loincCode || null;
    
    this.dialog.open(ConceptLookupDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      autoFocus: false,
      restoreFocus: true,
      data: {
        system: 'http://snomed.info/sct',
        code: snomedCode,
        display: display,
        loincCode: loincCode,
        fhirBase: 'https://browser.loincsnomed.org/fhir'
      },
      panelClass: 'concept-lookup-dialog'
    });
  }
}

