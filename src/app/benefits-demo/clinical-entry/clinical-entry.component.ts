import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { PatientService, Condition, Procedure, MedicationStatement } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';

export type ClinicalEntryType = 'condition' | 'procedure' | 'medication';

@Component({
  selector: 'app-clinical-entry',
  templateUrl: './clinical-entry.component.html',
  styleUrls: ['./clinical-entry.component.css'],
  standalone: false
})
export class ClinicalEntryComponent implements AfterViewInit {
  @Input() patientId: string = '';
  @Input() entryType: ClinicalEntryType = 'condition';
  @Input() hideButton: boolean = false;
  @Input() availableConditions: Condition[] = [];
  @Input() availableProcedures: Procedure[] = [];
  @Output() itemAdded = new EventEmitter<any>();
  @Output() formOpened = new EventEmitter<ClinicalEntryType>();
  @ViewChild('autocompleteBinding') autocompleteBinding: any;

  selectedConcept: any;
  selectedAssociation: {type: 'condition' | 'procedure', resource: Condition | Procedure} | null = null;
  term: string = '';
  entryDate: Date = this.getDefaultEntryDate();
  medicationDoseValue: number | null = null;
  medicationDoseUnit: string = '';
  medicationPeriod: number | null = null;
  medicationPeriodUnit: 'h' | 'd' | 'wk' = 'h';
  loading = false;
  showAddForm = false;
  readonly medicationDoseUnitOptions = ['tablet', 'capsule', 'drop', 'puff', 'mL', 'mg', 'g', 'unit'];

  // SNOMED ECL bindings for different clinical entry types
  readonly bindings = {
    condition: { 
      ecl: '< 404684003 |Clinical finding|', 
      title: 'Search for condition...',
      placeholder: 'Enter condition name...'
    },
    procedure: { 
      ecl: '< 71388002 |Procedure|', 
      title: 'Search for procedure...',
      placeholder: 'Enter procedure name...'
    },
    medication: { 
      ecl: '< 373873005 |Pharmaceutical / biologic product| : 762949000 |Has precise active ingredient (attribute)| = *', 
      title: 'Search for medication...',
      placeholder: 'Enter medication name...'
    }
  };

  constructor(
    private patientService: PatientService,
    private terminologyService: TerminologyService
  ) { }

  get currentBinding() {
    return this.bindings[this.entryType];
  }

  get sectionTitle() {
    const titles = {
      condition: 'Add Condition',
      procedure: 'Add Procedure', 
      medication: 'Add Medication'
    };
    return titles[this.entryType];
  }

  ngAfterViewInit() {
    // Focus will be handled when form opens
  }

  updateConcept(event: any) {
    this.selectedConcept = event;
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    } else {
      // Notify parent that this form was opened
      this.formOpened.emit(this.entryType);
      
      // Focus the input field after the form is shown
      setTimeout(() => {
        if (this.autocompleteBinding) {
          this.autocompleteBinding.focus();
        }
      }, 100);
    }
  }

  // Method to close the form from outside (called by parent)
  closeForm() {
    if (this.showAddForm) {
      this.showAddForm = false;
      this.resetForm();
    }
  }

  async addItem() {
    if (this.selectedConcept && this.patientId) {
      this.loading = true;
      
      try {
        switch (this.entryType) {
          case 'condition':
            await this.addCondition();
            break;
          case 'procedure':
            await this.addProcedure();
            break;
          case 'medication':
            await this.addMedication();
            break;
        }
      } finally {
        this.loading = false;
      }
    }
  }

  private async addCondition() {
    const newCondition: Condition = this.patientService.createConditionFromClinicalEntryConcept(
      this.patientId,
      {
        code: this.selectedConcept.code,
        display: this.selectedConcept.display
      },
      {
        dateTime: this.getEntryDateValue()
      }
    );

    // Let the parent component handle adding to the service
    this.itemAdded.emit(newCondition);
    this.resetForm();
  }

  private async addProcedure() {
    const newProcedure: Procedure = this.patientService.createProcedureFromClinicalEntryConcept(
      this.patientId,
      {
        code: this.selectedConcept.code,
        display: this.selectedConcept.display
      },
      {
        dateTime: this.getEntryDateValue()
      }
    );

    // Let the parent component handle adding to the service
    this.itemAdded.emit(newProcedure);
    this.resetForm();
  }

  private async addMedication() {
    const reasonReference = this.selectedAssociation ? [{
      reference: `${this.selectedAssociation.resource.resourceType}/${this.selectedAssociation.resource.id}`,
      display: this.selectedAssociation.resource.code.text
    }] : undefined;

    const newMedication: MedicationStatement = this.patientService.createMedicationFromClinicalEntryConcept(
      this.patientId,
      {
        code: this.selectedConcept.code,
        display: this.selectedConcept.display
      },
      {
        effectiveDateTime: this.getEntryDateValue(),
        reasonReference,
        dosage: this.buildMedicationDosage()
      }
    );

    // Let the parent component handle adding to the service
    this.itemAdded.emit(newMedication);
    this.resetForm();
  }

  private resetForm() {
    this.term = '';
    this.selectedConcept = null;
    this.selectedAssociation = null;
    this.entryDate = this.getDefaultEntryDate();
    this.medicationDoseValue = null;
    this.medicationDoseUnit = '';
    this.medicationPeriod = null;
    this.medicationPeriodUnit = 'h';
    this.showAddForm = false;
  }

  private getDefaultEntryDate(): Date {
    return new Date();
  }

  private getEntryDateValue(): string {
    const date = this.entryDate || new Date();
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildMedicationDosage(): MedicationStatement['dosage'] {
    const hasDoseQuantity = this.medicationDoseValue !== null && this.medicationDoseValue > 0 && !!this.medicationDoseUnit.trim();
    const hasTiming = this.medicationPeriod !== null && this.medicationPeriod > 0;

    if (!hasDoseQuantity && !hasTiming) {
      return [{
        text: 'Take as prescribed'
      }];
    }

    const dosage: NonNullable<MedicationStatement['dosage']>[number] = {};

    if (hasTiming) {
      dosage.timing = {
        repeat: {
          frequency: 1,
          period: this.medicationPeriod!,
          periodUnit: this.medicationPeriodUnit
        }
      };
    }

    if (hasDoseQuantity) {
      dosage.doseAndRate = [{
        doseQuantity: {
          value: this.medicationDoseValue!,
          unit: this.medicationDoseUnit.trim()
        }
      }];
    }

    const textParts: string[] = [];

    if (hasDoseQuantity) {
      textParts.push(`${this.medicationDoseValue} ${this.medicationDoseUnit.trim()}`);
    }

    if (hasTiming) {
      textParts.push(`every ${this.medicationPeriod} ${this.medicationPeriodUnit}`);
    }

    dosage.text = textParts.join(', ');

    return [dosage];
  }

  compareAssociations(a1: any, a2: any): boolean {
    if (!a1 || !a2) return a1 === a2;
    return a1.type === a2.type && a1.resource?.id === a2.resource?.id;
  }
}
