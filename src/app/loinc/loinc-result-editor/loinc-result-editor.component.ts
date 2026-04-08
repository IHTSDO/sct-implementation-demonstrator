import { Component, Input, OnInit } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { FormControl } from '@angular/forms';
import { map, Observable, of, startWith } from 'rxjs';
import { UcumUnitsService, type UcumUnit } from '../ucum-units.service';

type EditableResult = {
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
};

@Component({
  selector: 'app-loinc-result-editor',
  templateUrl: './loinc-result-editor.component.html',
  styleUrl: './loinc-result-editor.component.css',
  standalone: false
})
export class LoincResultEditorComponent implements OnInit {
  @Input({ required: true }) result!: EditableResult;
  @Input({ required: true }) displayText = '';

  unitOptions: UcumUnit[] = [];
  unitFilteredOptions: Observable<UcumUnit[]> = of([]);
  unitInputControl = new FormControl('');
  unitOptionsLoading = false;

  constructor(private ucumUnitsService: UcumUnitsService) {}

  ngOnInit() {
    this.loadUCUMUnits();
  }

  displayUnitFn = (option: UcumUnit | string | null): string => {
    if (!option) {
      return '';
    }

    if (typeof option === 'string') {
      return option;
    }

    return option.display || '';
  };

  onUnitSelected(event: MatAutocompleteSelectedEvent) {
    const option = event.option.value as UcumUnit;
    this.result.unitDisplay = option.display;
    this.result.unitCode = option.code;
    this.result.unitSystem = option.system;
  }

  onUnitAutocompleteClosed() {
    const currentValue = this.unitInputControl.value;

    if (this.result.unitCode) {
      const matchedUnit = this.unitOptions.find((unit) => unit.code === this.result.unitCode);
      if (matchedUnit && currentValue !== matchedUnit.display) {
        this.unitInputControl.setValue(matchedUnit.display, { emitEvent: false });
      }
      return;
    }

    if (currentValue && typeof currentValue === 'object' && 'display' in currentValue) {
      this.unitInputControl.setValue((currentValue as UcumUnit).display, { emitEvent: false });
    }
  }

  private loadUCUMUnits(): void {
    this.unitOptionsLoading = true;

    this.ucumUnitsService.getUnits().subscribe({
      next: (units) => {
        this.unitOptions = units;
        if (this.result.unitDisplay) {
          this.unitInputControl.setValue(this.result.unitDisplay, { emitEvent: false });
        }
        this.setupUnitFilter();
        this.unitOptionsLoading = false;
      },
      error: () => {
        this.unitOptions = [];
        this.setupUnitFilter();
        this.unitOptionsLoading = false;
      }
    });
  }

  private setupUnitFilter(): void {
    this.unitFilteredOptions = this.unitInputControl.valueChanges.pipe(
      startWith(this.unitInputControl.value || ''),
      map((term) => {
        let termValue = '';
        if (typeof term === 'string') {
          termValue = term;
        } else if (term && typeof term === 'object' && 'display' in term) {
          termValue = (term as UcumUnit).display || '';
        }

        const searchTerm = termValue.toLowerCase();
        if (!searchTerm) {
          return [...this.unitOptions];
        }

        return this.unitOptions.filter((option) =>
          option.display.toLowerCase().includes(searchTerm) || option.code.toLowerCase().includes(searchTerm)
        );
      })
    );
  }
}
