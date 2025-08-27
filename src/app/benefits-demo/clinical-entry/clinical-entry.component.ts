import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PatientService, Condition, Procedure, MedicationRequest } from '../../services/patient.service';
import { TerminologyService } from '../../services/terminology.service';

export type ClinicalEntryType = 'condition' | 'procedure' | 'medication';

@Component({
  selector: 'app-clinical-entry',
  templateUrl: './clinical-entry.component.html',
  styleUrls: ['./clinical-entry.component.css'],
  standalone: false
})
export class ClinicalEntryComponent {
  @Input() patientId: string = '';
  @Input() entryType: ClinicalEntryType = 'condition';
  @Output() itemAdded = new EventEmitter<any>();

  selectedConcept: any;
  term: string = '';
  loading = false;
  showAddForm = false;

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
      ecl: '< 373873005 |Pharmaceutical / biologic product|', 
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

  updateConcept(event: any) {
    this.selectedConcept = event;
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
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
    const newCondition: Condition = {
      resourceType: 'Condition',
      id: `condition-${Date.now()}`,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        }],
        text: 'Active'
      },
      verificationStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed'
        }],
        text: 'Confirmed'
      },
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.selectedConcept.code,
          display: this.selectedConcept.display
        }],
        text: this.selectedConcept.display
      },
      subject: {
        reference: `Patient/${this.patientId}`,
        display: `Patient ${this.patientId}`
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString()
    };

    this.patientService.addPatientCondition(this.patientId, newCondition);
    this.itemAdded.emit(newCondition);
    this.resetForm();
  }

  private async addProcedure() {
    const newProcedure: Procedure = {
      resourceType: 'Procedure',
      id: `procedure-${Date.now()}`,
      status: 'completed',
      code: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.selectedConcept.code,
          display: this.selectedConcept.display
        }],
        text: this.selectedConcept.display
      },
      subject: {
        reference: `Patient/${this.patientId}`,
        display: `Patient ${this.patientId}`
      },
      performedDateTime: new Date().toISOString()
    };

    this.patientService.addPatientProcedure(this.patientId, newProcedure);
    this.itemAdded.emit(newProcedure);
    this.resetForm();
  }

  private async addMedication() {
    const newMedication: MedicationRequest = {
      resourceType: 'MedicationRequest',
      id: `medication-${Date.now()}`,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.selectedConcept.code,
          display: this.selectedConcept.display
        }],
        text: this.selectedConcept.display
      },
      subject: {
        reference: `Patient/${this.patientId}`,
        display: `Patient ${this.patientId}`
      },
      authoredOn: new Date().toISOString(),
      dosageInstruction: [{
        text: 'Take as prescribed'
      }]
    };

    this.patientService.addPatientMedication(this.patientId, newMedication);
    this.itemAdded.emit(newMedication);
    this.resetForm();
  }

  private resetForm() {
    this.term = '';
    this.selectedConcept = null;
    this.showAddForm = false;
  }
}
