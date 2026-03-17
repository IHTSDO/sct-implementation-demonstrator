import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AllergyIntolerance,
  Condition,
  Encounter,
  FhirObservation,
  MedicationStatement,
  Patient,
  Procedure,
  QuestionnaireResponse,
  PatientService
} from '../../services/patient.service';
import { saveAs } from 'file-saver';

type SupportedResourceType =
  | 'Patient'
  | 'Condition'
  | 'Procedure'
  | 'MedicationStatement'
  | 'AllergyIntolerance'
  | 'Observation'
  | 'Encounter'
  | 'QuestionnaireResponse';

type SupportedResource =
  | Patient
  | Condition
  | Procedure
  | MedicationStatement
  | AllergyIntolerance
  | FhirObservation
  | Encounter
  | QuestionnaireResponse;

interface ResourceListItem {
  resourceType: SupportedResourceType;
  id: string;
  label: string;
  subtitle: string;
  resource: SupportedResource;
}

interface ResourceGroup {
  resourceType: SupportedResourceType;
  title: string;
  icon: string;
  iconFontSet?: string;
  items: ResourceListItem[];
}

@Component({
  selector: 'app-fhir-data',
  templateUrl: './fhir-data.component.html',
  styleUrls: ['./fhir-data.component.css'],
  standalone: false
})
export class FhirDataComponent implements OnChanges {
  @Input() patient: Patient | null = null;
  @Input() dataVersion = 0;
  @Input() isDeletingEvents = false;
  @Output() deleteAllEventsRequested = new EventEmitter<void>();

  resourceGroups: ResourceGroup[] = [];
  selectedItem: ResourceListItem | null = null;
  selectedResourceJson = '';

  constructor(
    private patientService: PatientService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] || changes['dataVersion']) {
      this.refreshResources();
    }
  }

  selectItem(item: ResourceListItem): void {
    this.selectedItem = item;
    this.selectedResourceJson = JSON.stringify(item.resource, null, 2);
  }

  isSelected(item: ResourceListItem): boolean {
    return !!this.selectedItem
      && this.selectedItem.resourceType === item.resourceType
      && this.selectedItem.id === item.id;
  }

  hasAnyResources(): boolean {
    return this.resourceGroups.some(group => group.items.length > 0);
  }

  copySelectedResource(): void {
    if (!this.selectedResourceJson) {
      return;
    }
    this.clipboard.copy(this.selectedResourceJson);
    this.snackBar.open('FHIR JSON copied to clipboard', 'Close', { duration: 2000 });
  }

  downloadSelectedResource(): void {
    if (!this.selectedResourceJson || !this.selectedItem) {
      return;
    }

    const fileName = `${this.selectedItem.resourceType}-${this.selectedItem.id}.json`;
    const blob = new Blob([this.selectedResourceJson], { type: 'application/fhir+json;charset=utf-8' });
    saveAs(blob, fileName);
  }

  requestDeleteAllEvents(): void {
    this.deleteAllEventsRequested.emit();
  }

  private refreshResources(): void {
    if (!this.patient) {
      this.resourceGroups = [];
      this.selectedItem = null;
      this.selectedResourceJson = '';
      return;
    }

    const patientId = this.patient.id;
    const freshPatient = this.patientService.getPatientById(patientId) || this.patient;

    const groups: ResourceGroup[] = [
      {
        resourceType: 'Patient',
        title: 'Patient',
        icon: 'person',
        items: [this.toPatientItem(freshPatient)]
      },
      {
        resourceType: 'Condition',
        title: 'Condition',
        icon: 'stethoscope',
        iconFontSet: 'material-symbols-outlined',
        items: this.patientService.getPatientConditions(patientId).map(resource => this.toConditionItem(resource))
      },
      {
        resourceType: 'Procedure',
        title: 'Procedure',
        icon: 'healing',
        items: this.patientService.getPatientProcedures(patientId).map(resource => this.toProcedureItem(resource))
      },
      {
        resourceType: 'MedicationStatement',
        title: 'MedicationStatement',
        icon: 'medication',
        items: this.patientService.getPatientMedications(patientId).map(resource => this.toMedicationItem(resource))
      },
      {
        resourceType: 'AllergyIntolerance',
        title: 'AllergyIntolerance',
        icon: 'warning',
        items: this.patientService.getPatientAllergies(patientId).map(resource => this.toAllergyItem(resource))
      },
      {
        resourceType: 'Observation',
        title: 'Observation',
        icon: 'monitor_heart',
        items: this.patientService.getPatientObservations(patientId).map(resource => this.toObservationItem(resource))
      },
      {
        resourceType: 'Encounter',
        title: 'Encounter',
        icon: 'event_note',
        items: this.patientService.getPatientEncounters(patientId).map(resource => this.toEncounterItem(resource))
      },
      {
        resourceType: 'QuestionnaireResponse',
        title: 'QuestionnaireResponse',
        icon: 'assignment',
        items: this.patientService.getPatientQuestionnaireResponses(patientId).map(resource => this.toQuestionnaireItem(resource))
      }
    ];

    this.resourceGroups = groups;
    this.syncSelection();
  }

  private syncSelection(): void {
    if (!this.hasAnyResources()) {
      this.selectedItem = null;
      this.selectedResourceJson = '';
      return;
    }

    if (this.selectedItem) {
      const existing = this.findItem(this.selectedItem.resourceType, this.selectedItem.id);
      if (existing) {
        this.selectItem(existing);
        return;
      }
    }

    for (const group of this.resourceGroups) {
      if (group.items.length > 0) {
        this.selectItem(group.items[0]);
        return;
      }
    }
  }

  private findItem(resourceType: SupportedResourceType, id: string): ResourceListItem | null {
    for (const group of this.resourceGroups) {
      if (group.resourceType !== resourceType) {
        continue;
      }
      const found = group.items.find(item => item.id === id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private toPatientItem(resource: Patient): ResourceListItem {
    const label = this.getPatientLabel(resource);
    const subtitle = resource.id ? `id: ${resource.id}` : 'Patient resource';
    return {
      resourceType: 'Patient',
      id: resource.id,
      label,
      subtitle,
      resource
    };
  }

  private toConditionItem(resource: Condition): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    return {
      resourceType: 'Condition',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.recordedDate || resource.onsetDateTime),
      resource
    };
  }

  private toProcedureItem(resource: Procedure): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    const dateValue = resource.performedDateTime || resource.performedPeriod?.start;
    return {
      resourceType: 'Procedure',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toMedicationItem(resource: MedicationStatement): ResourceListItem {
    const label = resource.medicationCodeableConcept?.text
      || resource.medicationCodeableConcept?.coding?.[0]?.display
      || resource.id;
    return {
      resourceType: 'MedicationStatement',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.effectiveDateTime),
      resource
    };
  }

  private toAllergyItem(resource: AllergyIntolerance): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    return {
      resourceType: 'AllergyIntolerance',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.recordedDate),
      resource
    };
  }

  private toObservationItem(resource: FhirObservation): ResourceListItem {
    const label = resource.code?.text || resource.code?.coding?.[0]?.display || resource.id;
    const dateValue = resource.effectiveDateTime || resource.issued;
    return {
      resourceType: 'Observation',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toEncounterItem(resource: Encounter): ResourceListItem {
    const label = resource.type?.[0]?.text || resource.type?.[0]?.coding?.[0]?.display || resource.id;
    const dateValue = resource.period?.start;
    return {
      resourceType: 'Encounter',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(dateValue),
      resource
    };
  }

  private toQuestionnaireItem(resource: QuestionnaireResponse): ResourceListItem {
    const label = resource.questionnaireTitle || resource.questionnaireName || resource.id;
    return {
      resourceType: 'QuestionnaireResponse',
      id: resource.id,
      label,
      subtitle: this.buildDateSubtitle(resource.authored),
      resource
    };
  }

  private getPatientLabel(resource: Patient): string {
    const nameEntry = resource.name?.[0];
    if (!nameEntry) {
      return resource.id;
    }
    if (nameEntry.text) {
      return nameEntry.text;
    }
    const given = nameEntry.given?.join(' ') || '';
    const family = nameEntry.family || '';
    const fullName = `${given} ${family}`.trim();
    return fullName || resource.id;
  }

  private buildDateSubtitle(value?: string): string {
    if (!value) {
      return 'No recorded date';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }
}
