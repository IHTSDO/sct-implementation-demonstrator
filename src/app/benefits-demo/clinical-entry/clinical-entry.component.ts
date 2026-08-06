import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { PatientService } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';
import type { Condition, Immunization, MedicationStatement, Procedure } from '../../model';
import type { CDSCard } from '../../services/cds.service';

export type ClinicalEntryType = 'condition' | 'procedure' | 'medication' | 'immunization';

// Sensible starting posology so a common order (one tablet daily) is one click to save.
const DEFAULT_MEDICATION_DOSAGE: { value: number; unit: string; period: number; periodUnit: 'h' | 'd' | 'wk' } = {
  value: 1,
  unit: 'tablet',
  period: 1,
  periodUnit: 'd'
};

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
  @Input() saving: boolean = false;
  @Input() availableConditions: Condition[] = [];
  @Input() availableProcedures: Procedure[] = [];
  @Input() cdsAlerts: CDSCard[] = [];

  // Highest-severity CDS alert on the current medication draft, used to mark the form's
  // action buttons so an alerted order isn't saved without a deliberate second look.
  get cdsAlertSeverity(): 'critical' | 'warning' | 'info' | null {
    if (this.entryType !== 'medication' || !this.cdsAlerts || this.cdsAlerts.length === 0) {
      return null;
    }
    const indicators = this.cdsAlerts.map((card) => card.indicator);
    if (indicators.includes('critical')) {
      return 'critical';
    }
    if (indicators.includes('warning')) {
      return 'warning';
    }
    if (indicators.includes('info')) {
      return 'info';
    }
    return null;
  }

  get cdsAlertIcon(): string {
    switch (this.cdsAlertSeverity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  get cdsAlertNote(): string {
    const count = this.cdsAlerts?.length || 0;
    const noun = count === 1 ? 'CDS alert' : 'CDS alerts';
    return `${count} ${noun} — review before saving`;
  }
  @Output() itemAdded = new EventEmitter<any>();
  @Output() draftMedicationChanged = new EventEmitter<MedicationStatement | null>();
  @Output() formOpened = new EventEmitter<ClinicalEntryType>();
  @ViewChild('autocompleteBinding') autocompleteBinding: any;

  selectedConcept: any;
  selectedAssociation: {type: 'condition' | 'procedure', resource: Condition | Procedure} | null = null;
  term: string = '';
  entryDate: Date = this.getDefaultEntryDate();
  medicationDoseValue: number | null = DEFAULT_MEDICATION_DOSAGE.value;
  medicationDoseUnit: string = DEFAULT_MEDICATION_DOSAGE.unit;
  medicationPeriod: number | null = DEFAULT_MEDICATION_DOSAGE.period;
  medicationPeriodUnit: 'h' | 'd' | 'wk' = DEFAULT_MEDICATION_DOSAGE.periodUnit;
  immunizationStatus: Immunization['status'] = 'completed';
  loading = false;
  showAddForm = false;
  private medicationDraftId = '';
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
    },
    immunization: {
      ecl: '< 787859002 |Vaccine product (medicinal product)|',
      title: 'Search for vaccine...',
      placeholder: 'Enter vaccine name...'
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
      medication: 'Add Medication',
      immunization: 'Add Immunization'
    };
    return titles[this.entryType];
  }

  ngAfterViewInit() {
    // Focus will be handled when form opens
  }

  updateConcept(event: any) {
    this.selectedConcept = event;
    this.emitDraftMedicationIfNeeded();
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.resetForm();
    } else {
      if (this.entryType === 'medication') {
        this.medicationDraftId = `draft-medication-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }
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
          case 'immunization':
            await this.addImmunization();
            break;
        }
      } finally {
        setTimeout(() => {
          this.loading = false;
        }, 0);
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
    this.draftMedicationChanged.emit(null);
  }

  private async addImmunization() {
    const newImmunization: Immunization = this.patientService.createImmunizationFromClinicalEntryConcept(
      this.patientId,
      {
        code: this.selectedConcept.code,
        display: this.selectedConcept.display
      },
      {
        occurrenceDateTime: this.getEntryDateValue(),
        status: this.immunizationStatus
      }
    );

    this.itemAdded.emit(newImmunization);
  }

  resetAndCloseForm(): void {
    this.resetForm();
  }

  private resetForm() {
    this.term = '';
    this.selectedConcept = null;
    this.selectedAssociation = null;
    this.entryDate = this.getDefaultEntryDate();
    this.medicationDoseValue = DEFAULT_MEDICATION_DOSAGE.value;
    this.medicationDoseUnit = DEFAULT_MEDICATION_DOSAGE.unit;
    this.medicationPeriod = DEFAULT_MEDICATION_DOSAGE.period;
    this.medicationPeriodUnit = DEFAULT_MEDICATION_DOSAGE.periodUnit;
    this.immunizationStatus = 'completed';
    this.showAddForm = false;
    this.medicationDraftId = '';
    this.draftMedicationChanged.emit(null);
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

  onMedicationDraftInputChanged(): void {
    this.emitDraftMedicationIfNeeded();
  }

  private emitDraftMedicationIfNeeded(): void {
    if (this.entryType !== 'medication') {
      return;
    }

    if (!this.showAddForm || !this.selectedConcept || !this.patientId) {
      this.draftMedicationChanged.emit(null);
      return;
    }

    if (!this.medicationDraftId) {
      this.medicationDraftId = `draft-medication-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }

    const reasonReference = this.selectedAssociation ? [{
      reference: `${this.selectedAssociation.resource.resourceType}/${this.selectedAssociation.resource.id}`,
      display: this.selectedAssociation.resource.code.text
    }] : undefined;

    const draftMedication = this.patientService.createMedicationFromClinicalEntryConcept(
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

    draftMedication.id = this.medicationDraftId;
    this.draftMedicationChanged.emit(draftMedication);
  }
}
