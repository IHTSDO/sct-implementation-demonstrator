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

  // Interpretation options from FHIR Observation Interpretation ValueSet
  // https://hl7.org/fhir/valueset-observation-interpretation.html
  // Includes all non-deprecated codes from the valueset (excluding abstract codes)
  interpretationOptions = [
    // Normal/Abnormal interpretations
    { code: 'N', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Normal', definition: 'Interpretation within normal range.' },
    { code: 'A', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Abnormal', definition: 'Interpretation outside normal range.' },
    { code: 'AA', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Critical Abnormal', definition: 'Interpretation critically outside normal range.' },
    
    // High/Low interpretations
    { code: 'H', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'High', definition: 'Interpretation above normal range.' },
    { code: 'HH', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Critical High', definition: 'Interpretation critically above normal range.' },
    { code: 'L', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Low', definition: 'Interpretation below normal range.' },
    { code: 'LL', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Critical Low', definition: 'Interpretation critically below normal range.' },
    
    // Susceptibility interpretations
    { code: 'S', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Susceptible', definition: 'Susceptible interpretation.' },
    { code: 'R', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Resistant', definition: 'Resistant interpretation.' },
    { code: 'I', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Intermediate', definition: 'Intermediate interpretation.' },
    { code: 'MS', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Moderately Susceptible', definition: 'Moderately susceptible interpretation.' },
    { code: 'VS', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Very Susceptible', definition: 'Very susceptible interpretation.' },
    { code: 'NCL', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'No CLSI defined breakpoint', definition: 'No CLSI defined breakpoint.' },
    { code: 'SDD', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Susceptible-dose dependent', definition: 'Susceptible-dose dependent interpretation.' },
    { code: 'SYN-R', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Synergy - resistant', definition: 'Synergy - resistant interpretation.' },
    { code: 'SYN-S', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Synergy - susceptible', definition: 'Synergy - susceptible interpretation.' },
    
    // Change interpretations
    { code: 'B', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Better', definition: 'The current result or observation value has improved compared to the previous result or observation value.' },
    { code: 'W', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Worse', definition: 'The current result or observation value has deteriorated compared to the previous result or observation value.' },
    { code: 'U', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Significant change up', definition: 'Significant change up.' },
    { code: 'D', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Significant change down', definition: 'Significant change down.' },
    
    // Expectation interpretations
    { code: 'EXP', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Expected', definition: 'This result has been evaluated in light of known contraindicators. Once those contraindicators have been taken into account the result is determined to be "Expected".' },
    { code: 'UNE', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Unexpected', definition: 'This result has been evaluated in light of known contraindicators. Once those contraindicators have been taken into account the result is determined to be "Unexpected".' },
    
    // Reactivity interpretations
    { code: 'NR', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Non-reactive', definition: 'An absence finding used to indicate that the specified component / analyte did not react measurably with the reagent.' },
    { code: 'RR', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Reactive', definition: 'A presence finding used to indicate that the specified component / analyte reacted with the reagent above the reliably measurable limit of the performed test.' },
    { code: 'WR', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Weakly reactive', definition: 'A weighted presence finding used to indicate that the specified component / analyte reacted with the reagent, but below the reliably measurable limit of the performed test.' },
    
    // Genetic interpretations
    { code: 'CAR', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Carrier', definition: 'The patient is considered as carrier based on the testing results. A carrier is an individual who carries an altered form of a gene which can lead to having a child or offspring in future generations with a genetic disorder.' },
    { code: 'POS', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Positive', definition: 'Positive interpretation.' },
    { code: 'NEG', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Negative', definition: 'Negative interpretation.' },
    { code: 'IND', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Indeterminate', definition: 'Indeterminate interpretation.' },
    { code: 'DET', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Detected', definition: 'Detected interpretation.' },
    { code: 'ND', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Not Detected', definition: 'Not detected interpretation.' },
    { code: 'HU', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Homozygote', definition: 'Homozygote interpretation.' },
    
    // Scale/Instrument interpretations
    { code: '<', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Below absolute low-off instrument scale', definition: 'Below absolute low-off instrument scale interpretation.' },
    { code: '>', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Above absolute high-off instrument scale', definition: 'Above absolute high-off instrument scale interpretation.' },
    { code: '<LLOQ', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Below lower limit of quantitation', definition: 'Below lower limit of quantitation interpretation.' },
    { code: '>ULOQ', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Above upper limit of quantitation', definition: 'Above upper limit of quantitation interpretation.' },
    
    // Other interpretations
    { code: 'IE', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Insufficient evidence', definition: 'Insufficient evidence interpretation.' },
    { code: 'QCF', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Quality control failure', definition: 'Quality control failure interpretation.' },
    { code: 'TOX', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Toxic', definition: 'Toxic interpretation.' },
    { code: 'ACUTE', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Acute', definition: 'Acute interpretation.' },
    { code: 'CHRONIC', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Chronic', definition: 'Chronic interpretation.' },
    { code: 'REACT', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Reactive', definition: 'Reactive interpretation.' },
    { code: 'NONR', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Non-reactive', definition: 'Non-reactive interpretation.' },
    { code: 'HIGHRES', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'High Resolution', definition: 'High resolution interpretation.' },
    { code: 'RES', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Resistant', definition: 'Resistant interpretation.' },
    { code: 'MOD', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Moderate', definition: 'Moderate interpretation.' },
    { code: 'SENS', system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', display: 'Sensitive', definition: 'Sensitive interpretation.' }
  ];

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
    // Check if data contains viewOnly flag
    if (this.data && typeof this.data === 'object') {
      if ('viewOnly' in this.data) {
        this.isViewOnly = this.data.viewOnly === true;
      }
      if (this.isViewOnly) {
        this.observationForm.disable();
        // Also explicitly disable nested form groups and controls
        this.observationForm.get('valueQuantity')?.disable();
        this.observationForm.get('referenceRange')?.disable();
        // Disable individual nested controls
        this.valueQuantityUnitControl?.disable();
        this.valueQuantityValueControl?.disable();
        this.referenceRangeTextControl?.disable();
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
        },
        error: (err) => {
          console.error('Error loading UCUM units from assets:', err);
          // Fallback to common units on error
          this.unitOptions = this.getFallbackUnits();
          // Initialize filtered options Observable
          this.setupUnitFilter();
          this.unitOptionsLoading = false;
          this.updateUnitControlState();
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
        this.referenceRangeTextControl?.disable({ emitEvent: false });
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

      this.observationForm.patchValue({
        status: data.status || '',
        code: codeValue,
        subject: data.subject || null,
        effectiveDateTime: data.effectiveDateTime ? new Date(data.effectiveDateTime) : null,
        valueQuantity: data.valueQuantity ? {
          value: data.valueQuantity.value || null,
          unit: data.valueQuantity.unit || ''
        } : { value: null, unit: '' },
        valueString: data.valueString || '',
        valueCodeableConcept: data.valueCodeableConcept || null,
        interpretation: matchedInterpretation || null,
        referenceRange: data.referenceRange ? {
          text: data.referenceRange.text || ''
        } : { text: '' },
        performer: data.performer || null,
        method: data.method || null,
        note: data.note || ''
      }, { emitEvent: false });

      // Sync unit control with form control
      if (data.valueQuantity?.unit) {
        const unitCode = data.valueQuantity.unit;
        // Set the unit code directly - it will be matched when units load
        this.valueQuantityUnitControl.setValue(unitCode, { emitEvent: false });
        // Wait for options to load, then sync input control
        setTimeout(() => {
          const matchedUnit = this.unitOptions.find(u => u.code === unitCode);
          if (matchedUnit) {
            this.unitInputControl.setValue(matchedUnit.display, { emitEvent: false });
          } else {
            this.unitInputControl.setValue(unitCode, { emitEvent: false });
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
        text: ['']
      }),
      performer: [null],
      method: [null],
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
        referenceRange: formValue.referenceRange?.text ? {
          text: formValue.referenceRange.text
        } : null,
        performer: formValue.performer,
        method: formValue.method || null,
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


  get referenceRangeTextControl(): FormControl {
    return this.observationForm.get('referenceRange')?.get('text') as FormControl;
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

