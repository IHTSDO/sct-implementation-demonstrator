import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { AllergyIntolerance, Condition, Immunization, MedicationStatement, Procedure } from '../../model';

type ProblemKind = 'Condition' | 'Procedure' | 'Medication' | 'Immunization' | 'Allergy';

interface ProblemItem {
  id: string;
  kind: ProblemKind;
  name: string;
  status: string;
  detail?: string;
  recordedOn?: string;
  sortDate: number;
}

@Component({
  selector: 'app-problems-list-simplified',
  templateUrl: './problems-list-simplified.component.html',
  styleUrls: ['./problems-list-simplified.component.css'],
  standalone: false
})
export class ProblemsListSimplifiedComponent {
  @Input() conditions: Condition[] = [];
  @Input() procedures: Procedure[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Input() immunizations: Immunization[] = [];
  @Input() allergies: AllergyIntolerance[] = [];
  @Output() openProblemsList = new EventEmitter<void>();

  get problemItems(): ProblemItem[] {
    const conditionItems = this.conditions.map((condition) => ({
      id: condition.id,
      kind: 'Condition' as const,
      name: condition.code?.text || 'Condition',
      status: condition.clinicalStatus?.text || condition.clinicalStatus?.coding?.[0]?.display || 'Unknown',
      recordedOn: condition.recordedDate || condition.onsetDateTime,
      sortDate: this.toSortDate(condition.recordedDate || condition.onsetDateTime)
    }));

    const procedureItems = this.procedures.map((procedure) => ({
      id: procedure.id,
      kind: 'Procedure' as const,
      name: procedure.code?.text || 'Procedure',
      status: procedure.status || 'Unknown',
      recordedOn: procedure.performedDateTime,
      sortDate: this.toSortDate(procedure.performedDateTime)
    }));

    const medicationItems = this.medications.map((medication) => ({
      id: medication.id,
      kind: 'Medication' as const,
      name: medication.medicationCodeableConcept?.text || medication.medicationReference?.display || 'Medication',
      status: medication.status || 'Unknown',
      detail: medication.dosage?.[0]?.text,
      recordedOn: medication.effectiveDateTime || medication.dateAsserted,
      sortDate: this.toSortDate(medication.effectiveDateTime || medication.dateAsserted)
    }));

    const immunizationItems = this.immunizations.map((immunization) => ({
      id: immunization.id,
      kind: 'Immunization' as const,
      name: immunization.vaccineCode?.text || immunization.vaccineCode?.coding?.[0]?.display || 'Immunization',
      status: immunization.status || 'Unknown',
      recordedOn: immunization.occurrenceDateTime || immunization.recorded,
      sortDate: this.toSortDate(immunization.occurrenceDateTime || immunization.recorded)
    }));

    const allergyItems = this.allergies.map((allergy) => ({
      id: allergy.id,
      kind: 'Allergy' as const,
      name: allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Allergy',
      status: allergy.verificationStatus?.text || allergy.verificationStatus?.coding?.[0]?.display || 'Recorded',
      recordedOn: allergy.recordedDate || allergy.onsetDateTime,
      sortDate: this.toSortDate(allergy.recordedDate || allergy.onsetDateTime)
    }));

    return [...conditionItems, ...allergyItems, ...procedureItems, ...medicationItems, ...immunizationItems]
      .sort((a, b) => {
        const kindOrder = this.kindRank(a.kind) - this.kindRank(b.kind);
        if (kindOrder !== 0) {
          return kindOrder;
        }

        return b.sortDate - a.sortDate;
      });
  }

  trackByProblem(index: number, item: ProblemItem): string {
    return `${item.kind}-${item.id}-${index}`;
  }

  getKindClass(kind: ProblemKind): string {
    switch (kind) {
      case 'Condition':
        return 'kind-condition';
      case 'Allergy':
        return 'kind-allergy';
      case 'Procedure':
        return 'kind-procedure';
      case 'Medication':
        return 'kind-medication';
      case 'Immunization':
        return 'kind-immunization';
      default:
        return '';
    }
  }

  getKindIcon(kind: ProblemKind): string {
    switch (kind) {
      case 'Condition':
        return 'stethoscope';
      case 'Allergy':
        return 'warning';
      case 'Procedure':
        return 'healing';
      case 'Medication':
        return 'medication';
      case 'Immunization':
        return 'vaccines';
      default:
        return 'description';
    }
  }

  getKindFontSet(kind: ProblemKind): string {
    if (kind === 'Condition') {
      return 'material-symbols-outlined';
    }
    return 'material-icons';
  }

  onOpenProblemsList(): void {
    this.openProblemsList.emit();
  }

  private toSortDate(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsedDate = new Date(value).getTime();
    return Number.isNaN(parsedDate) ? 0 : parsedDate;
  }

  private kindRank(kind: ProblemKind): number {
    switch (kind) {
      case 'Condition':
        return 0;
      case 'Allergy':
        return 1;
      case 'Procedure':
        return 2;
      case 'Medication':
        return 3;
      case 'Immunization':
        return 4;
      default:
        return 99;
    }
  }
}
