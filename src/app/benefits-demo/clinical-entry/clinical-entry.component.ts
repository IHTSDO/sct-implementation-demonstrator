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
  @ViewChild('autocompleteBinding') autocompleteBinding: any;

  selectedConcept: any;
  selectedAssociation: {type: 'condition' | 'procedure', resource: Condition | Procedure} | null = null;
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
      // Focus the input field after the form is shown
      setTimeout(() => {
        if (this.autocompleteBinding) {
          this.autocompleteBinding.focus();
        }
      }, 100);
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
    const newMedication: MedicationStatement = {
      resourceType: 'MedicationStatement',
      id: `medication-${Date.now()}`,
      status: 'active',
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
      effectiveDateTime: new Date().toISOString(),
      dosage: [{
        text: 'Take as prescribed'
      }]
    };

    // Add association if selected
    if (this.selectedAssociation) {
      newMedication.reasonReference = [{
        reference: `${this.selectedAssociation.resource.resourceType}/${this.selectedAssociation.resource.id}`,
        display: this.selectedAssociation.resource.code.text
      }];
    }

    this.patientService.addPatientMedication(this.patientId, newMedication);
    this.itemAdded.emit(newMedication);
    this.resetForm();
  }

  private resetForm() {
    this.term = '';
    this.selectedConcept = null;
    this.selectedAssociation = null;
    this.showAddForm = false;
  }

  compareAssociations(a1: any, a2: any): boolean {
    if (!a1 || !a2) return a1 === a2;
    return a1.type === a2.type && a1.resource?.id === a2.resource?.id;
  }
}
