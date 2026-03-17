import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { AllergyIntolerance, Condition, Procedure, MedicationStatement } from '../../services/patient.service';

export interface TimelineEvent {
  id: string;
  type: 'condition' | 'procedure' | 'medication' | 'allergy' | 'encounter';
  title: string;
  date: Date;
  conceptId: string;
  status: string;
  details: string;
  originalEvent: any;
  color: string;
}

@Component({
  selector: 'app-clinical-timeline',
  templateUrl: './clinical-timeline.component.html',
  styleUrls: ['./clinical-timeline.component.css'],
  standalone: false
})
export class ClinicalTimelineComponent implements OnInit, OnChanges {
  @Input() conditions: Condition[] = [];
  @Input() procedures: Procedure[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Input() allergies: AllergyIntolerance[] = [];
  @Input() encounters: any[] = [];

  timelineEvents: TimelineEvent[] = [];
  sortedEvents: TimelineEvent[] = [];

  // Color scheme for different event types
  readonly eventColors = {
    condition: '#8e44ad',
    procedure: '#17a2b8',
    medication: '#28a745',
    allergy: '#f39c12',
    encounter: '#4e5d6c'
  };

  // Utility method to determine if an event should be on the left or right
  isLeftSide(index: number): boolean {
    return index % 2 === 0;
  }

  ngOnInit(): void {
    this.processEvents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conditions'] || changes['procedures'] || changes['medications'] || changes['allergies'] || changes['encounters']) {
      this.processEvents();
    }
  }

  // Public method to manually refresh the timeline
  refreshTimeline(): void {
    this.processEvents();
  }

  private processEvents(): void {
    this.timelineEvents = [];
    
    // Process conditions
    this.conditions.forEach(condition => {
      const date = this.getBestDate(condition, 'condition');
      if (date) {
        this.timelineEvents.push({
          id: condition.id,
          type: 'condition',
          title: condition.code.text || 'Unknown Condition',
          date: date,
          conceptId: this.getConceptId(condition),
          status: this.getConditionStatus(condition),
          details: this.getConditionDetails(condition),
          originalEvent: condition,
          color: this.eventColors.condition
        });
      }
    });

    // Process procedures
    this.procedures.forEach(procedure => {
      const date = this.getBestDate(procedure, 'procedure');
      if (date) {
        this.timelineEvents.push({
          id: procedure.id,
          type: 'procedure',
          title: procedure.code.text || 'Unknown Procedure',
          date: date,
          conceptId: this.getConceptId(procedure),
          status: procedure.status || 'Unknown',
          details: this.getProcedureDetails(procedure),
          originalEvent: procedure,
          color: this.eventColors.procedure
        });
      }
    });

    // Process medications
    this.medications.forEach(medication => {
      const date = this.getBestDate(medication, 'medication');
      if (date) {
        this.timelineEvents.push({
          id: medication.id,
          type: 'medication',
          title: medication.medicationCodeableConcept?.text || 'Unknown Medication',
          date: date,
          conceptId: this.getConceptId(medication),
          status: medication.status || 'Unknown',
          details: this.getMedicationDetails(medication),
          originalEvent: medication,
          color: this.eventColors.medication
        });
      }
    });

    // Process allergies
    this.allergies.forEach(allergy => {
      const date = this.getBestDate(allergy, 'allergy');
      if (date) {
        this.timelineEvents.push({
          id: allergy.id,
          type: 'allergy',
          title: this.getAllergyTitle(allergy),
          date: date,
          conceptId: this.getAllergyConceptId(allergy),
          status: this.getAllergyStatus(allergy),
          details: this.getAllergyDetails(allergy),
          originalEvent: allergy,
          color: this.eventColors.allergy
        });
      }
    });

    // Process encounters
    this.encounters.forEach(encounter => {
      const date = this.getBestDate(encounter, 'encounter');
      if (date) {
        this.timelineEvents.push({
          id: encounter.id,
          type: 'encounter',
          title: this.getEncounterTitle(encounter),
          date: date,
          conceptId: this.getEncounterConceptId(encounter),
          status: encounter.status || 'Unknown',
          details: this.getEncounterDetails(encounter),
          originalEvent: encounter,
          color: this.eventColors.encounter
        });
      }
    });

    // Sort events by date (newest first for vertical timeline)
    this.sortedEvents = this.timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private getBestDate(event: any, type: string): Date | null {
    let dateString: string | null = null;

    switch (type) {
      case 'condition':
        dateString = event.onsetDateTime || event.recordedDate;
        break;
      case 'procedure':
        dateString = event.performedDateTime || event.recordedDate;
        break;
      case 'medication':
        dateString = event.effectiveDateTime || event.recordedDate;
        break;
      case 'allergy':
        dateString = event.recordedDate || event.onsetDateTime;
        break;
      case 'encounter':
        dateString = event.period?.start || event.recordedDate;
        break;
    }

    return dateString ? new Date(dateString) : null;
  }

  private getConceptId(resource: any): string {
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return '';
  }

  private getAllergyConceptId(allergy: AllergyIntolerance): string {
    if (allergy.code?.coding && allergy.code.coding.length > 0) {
      return allergy.code.coding[0].code || '';
    }
    if (allergy.reaction?.[0]?.substance?.[0]?.coding && allergy.reaction[0].substance[0].coding.length > 0) {
      return allergy.reaction[0].substance[0].coding[0].code || '';
    }
    return '';
  }

  private getConditionStatus(condition: Condition): string {
    if (condition.clinicalStatus?.text) {
      return condition.clinicalStatus.text;
    }
    if (condition.clinicalStatus?.coding && condition.clinicalStatus.coding.length > 0) {
      return condition.clinicalStatus.coding[0].display || condition.clinicalStatus.coding[0].code || 'Unknown';
    }
    return 'Unknown';
  }

  private getConditionDetails(condition: Condition): string {
    const details = [];
    if (condition.onsetDateTime) {
      details.push(`Onset: ${this.formatDate(condition.onsetDateTime)}`);
    }
    if (condition.recordedDate) {
      details.push(`Recorded: ${this.formatDate(condition.recordedDate)}`);
    }
    return details.join(' • ');
  }

  private getProcedureDetails(procedure: Procedure): string {
    const details = [];
    if (procedure.performedDateTime) {
      details.push(`Performed: ${this.formatDate(procedure.performedDateTime)}`);
    }
    return details.join(' • ');
  }

  private getMedicationDetails(medication: MedicationStatement): string {
    const details = [];
    if (medication.effectiveDateTime) {
      details.push(`Started: ${this.formatDate(medication.effectiveDateTime)}`);
    }
    if (medication.dosage && medication.dosage.length > 0) {
      details.push(`Dosage: ${medication.dosage[0].text}`);
    }
    return details.join(' • ');
  }

  private getAllergyTitle(allergy: AllergyIntolerance): string {
    if (allergy.code?.text) {
      return allergy.code.text;
    }
    if (allergy.code?.coding && allergy.code.coding.length > 0) {
      return allergy.code.coding[0].display || 'Unknown Allergy';
    }
    return 'Unknown Allergy';
  }

  private getAllergyStatus(allergy: AllergyIntolerance): string {
    if (allergy.verificationStatus?.text) {
      return allergy.verificationStatus.text;
    }
    if (allergy.verificationStatus?.coding && allergy.verificationStatus.coding.length > 0) {
      return allergy.verificationStatus.coding[0].display || allergy.verificationStatus.coding[0].code || 'Unknown';
    }
    return 'Unknown';
  }

  private getAllergyDetails(allergy: AllergyIntolerance): string {
    const details = [];
    if (allergy.recordedDate) {
      details.push(`Recorded: ${this.formatDate(allergy.recordedDate)}`);
    }
    if (typeof allergy.criticality === 'string' && allergy.criticality.length > 0) {
      details.push(`Criticality: ${allergy.criticality.charAt(0).toUpperCase()}${allergy.criticality.slice(1).replace(/-/g, ' ')}`);
    }
    const reactions = allergy.reaction?.flatMap((reaction) =>
      reaction.manifestation?.map((manifestation) =>
        manifestation.text || manifestation.coding?.[0]?.display || ''
      ) || []
    ).filter((reaction) => reaction);
    if (reactions && reactions.length > 0) {
      details.push(`Reaction: ${reactions.join(', ')}`);
    }
    return details.join(' • ');
  }

  private getEncounterTitle(encounter: any): string {
    if (encounter.reasonCode && encounter.reasonCode.length > 0) {
      return encounter.reasonCode[0].text || 'Patient Encounter';
    }
    if (encounter.diagnosis && encounter.diagnosis.length > 0) {
      return `Encounter - ${encounter.diagnosis[0].condition.display || 'Diagnosis'}`;
    }
    return 'Patient Encounter';
  }

  private getEncounterConceptId(encounter: any): string {
    if (encounter.reasonCode && encounter.reasonCode.length > 0 && encounter.reasonCode[0].coding) {
      return encounter.reasonCode[0].coding[0].code || '';
    }
    if (encounter.diagnosis && encounter.diagnosis.length > 0 && encounter.diagnosis[0].condition) {
      // Extract concept ID from condition reference if available
      return '';
    }
    return '';
  }

  private getEncounterDetails(encounter: any): string {
    const details = [];
    if (encounter.period?.start) {
      details.push(`Date: ${this.formatDate(encounter.period.start)}`);
    }
    if (encounter.diagnosis && encounter.diagnosis.length > 0) {
      const diagnosis = encounter.diagnosis[0].condition.display || 'Diagnosis recorded';
      details.push(`Diagnosis: ${diagnosis}`);
    }
    if (encounter.linkedProcedures && encounter.linkedProcedures.length > 0) {
      const procedure = encounter.linkedProcedures[0];
      details.push(`Procedure: ${procedure.code.text || 'Procedure recorded'}`);
    }
    return details.join(' • ');
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getEventTypeLabel(type: string): string {
    switch (type) {
      case 'condition': return 'Condition';
      case 'procedure': return 'Procedure';
      case 'medication': return 'Medication';
      case 'allergy': return 'Allergy';
      case 'encounter': return 'Encounter';
      default: return 'Event';
    }
  }

  getEventIcon(type: string): string {
    switch (type) {
      case 'condition': return 'medical_services';
      case 'procedure': return 'healing';
      case 'medication': return 'medication';
      case 'allergy': return 'warning';
      case 'encounter': return 'person_pin';
      default: return 'event';
    }
  }

  isDentalCondition(condition: any): boolean {
    const categories = condition?.category;
    if (!Array.isArray(categories)) {
      return false;
    }

    return categories.some((category: any) =>
      Array.isArray(category?.coding) &&
      category.coding.some((coding: any) =>
        typeof coding?.code === 'string' && coding.code.toLowerCase() === 'dental'
      )
    );
  }
}
