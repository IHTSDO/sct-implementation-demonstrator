import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { map, Observable, of, startWith } from 'rxjs';

type ResultEntry = {
  id: string;
  value: string;
  unitDisplay: string;
  unitCode: string;
  unitSystem: string;
  referenceLow: string;
  referenceHigh: string;
  isGrouper: boolean;
  isLoaded: boolean;
  serviceRequest: any;
};

@Component({
  selector: 'app-loinc-result-loader-dialog',
  templateUrl: './loinc-result-loader-dialog.component.html',
  styleUrl: './loinc-result-loader-dialog.component.css',
  standalone: false
})
export class LoincResultLoaderDialogComponent implements OnInit {
  unitOptions: Array<{ code: string; display: string; system: string }> = [];
  unitFilteredOptions: Observable<Array<{ code: string; display: string; system: string }>> = of([]);
  unitInputControl = new FormControl('');
  unitOptionsLoading = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { result: ResultEntry; displayText: string },
    private dialogRef: MatDialogRef<LoincResultLoaderDialogComponent>,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadUCUMUnits();
  }

  save() {
    this.data.result.isLoaded = !!this.data.result.value || !!this.data.result.unitDisplay || !!this.data.result.referenceLow || !!this.data.result.referenceHigh;
    this.dialogRef.close(true);
  }

  close() {
    this.dialogRef.close(false);
  }

  displayUnitFn = (option: { code: string; display: string; system: string } | null): string => {
    return option?.display || '';
  };

  onUnitSelected(option: { code: string; display: string; system: string }) {
    this.data.result.unitDisplay = option.display;
    this.data.result.unitCode = option.code;
    this.data.result.unitSystem = option.system;
    this.unitInputControl.setValue(option.display, { emitEvent: false });
  }

  private loadUCUMUnits(): void {
    this.unitOptionsLoading = true;

    this.http.get<any>('assets/data/ucum-units.json')
      .subscribe({
        next: (response) => {
          if (response?.expansion?.contains) {
            this.unitOptions = response.expansion.contains.map((item: any) => ({
              code: item.code || '',
              display: item.display || item.code || '',
              system: item.system || 'http://unitsofmeasure.org'
            }));
            this.unitOptions.sort((a, b) => a.display.localeCompare(b.display));
          }

          if (this.data.result.unitDisplay) {
            this.unitInputControl.setValue(this.data.result.unitDisplay, { emitEvent: false });
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
        const searchTerm = `${term || ''}`.toLowerCase();
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
