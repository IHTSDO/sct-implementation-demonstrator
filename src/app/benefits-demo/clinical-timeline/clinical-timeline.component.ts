import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import Plotly from 'plotly.js-dist';
import type { AllergyIntolerance, Condition, MedicationStatement, Procedure } from '../../model';

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
export class ClinicalTimelineComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('overviewTimelineChart') overviewTimelineChart?: ElementRef<HTMLDivElement>;
  @Input() conditions: Condition[] = [];
  @Input() procedures: Procedure[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Input() allergies: AllergyIntolerance[] = [];
  @Input() encounters: any[] = [];

  timelineEvents: TimelineEvent[] = [];
  sortedEvents: TimelineEvent[] = [];
  readonly timelineTrackOrder: TimelineEvent['type'][] = ['encounter', 'allergy', 'medication', 'procedure', 'condition'];
  private plotlyInitialized = false;
  private renderRetryHandle: ReturnType<typeof setTimeout> | null = null;

  readonly eventColors = {
    condition: '#8e44ad',
    procedure: '#17a2b8',
    medication: '#28a745',
    allergy: '#f39c12',
    encounter: '#4e5d6c'
  };

  isLeftSide(index: number): boolean {
    return index % 2 === 0;
  }

  ngOnInit(): void {
    this.processEvents();
  }

  ngAfterViewInit(): void {
    this.renderOverviewTimeline();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conditions'] || changes['procedures'] || changes['medications'] || changes['allergies'] || changes['encounters']) {
      this.processEvents();
      this.renderOverviewTimeline();
    }
  }

  ngOnDestroy(): void {
    if (this.renderRetryHandle) {
      clearTimeout(this.renderRetryHandle);
      this.renderRetryHandle = null;
    }
    this.purgeOverviewTimeline();
  }

  refreshTimeline(): void {
    this.processEvents();
    this.renderOverviewTimeline();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.plotlyInitialized && this.overviewTimelineChart?.nativeElement) {
      Plotly.Plots.resize(this.overviewTimelineChart.nativeElement);
    }
  }

  get overviewTrackLegend(): Array<{ type: TimelineEvent['type']; label: string; color: string }> {
    return this.timelineTrackOrder.map((type) => ({
      type,
      label: this.getEventTypeLegendLabel(type),
      color: this.eventColors[type]
    }));
  }

  private processEvents(): void {
    this.timelineEvents = [];

    this.conditions.forEach((condition) => {
      const date = this.getBestDate(condition, 'condition');
      if (date) {
        this.timelineEvents.push({
          id: condition.id,
          type: 'condition',
          title: condition.code.text || 'Unknown Condition',
          date,
          conceptId: this.getConceptId(condition),
          status: this.getConditionStatus(condition),
          details: this.getConditionDetails(condition),
          originalEvent: condition,
          color: this.eventColors.condition
        });
      }
    });

    this.procedures.forEach((procedure) => {
      const date = this.getBestDate(procedure, 'procedure');
      if (date) {
        this.timelineEvents.push({
          id: procedure.id,
          type: 'procedure',
          title: procedure.code.text || 'Unknown Procedure',
          date,
          conceptId: this.getConceptId(procedure),
          status: procedure.status || 'Unknown',
          details: this.getProcedureDetails(procedure),
          originalEvent: procedure,
          color: this.eventColors.procedure
        });
      }
    });

    this.medications.forEach((medication) => {
      const date = this.getBestDate(medication, 'medication');
      if (date) {
        this.timelineEvents.push({
          id: medication.id,
          type: 'medication',
          title: medication.medicationCodeableConcept?.text || 'Unknown Medication',
          date,
          conceptId: this.getConceptId(medication),
          status: medication.status || 'Unknown',
          details: this.getMedicationDetails(medication),
          originalEvent: medication,
          color: this.eventColors.medication
        });
      }
    });

    this.allergies.forEach((allergy) => {
      const date = this.getBestDate(allergy, 'allergy');
      if (date) {
        this.timelineEvents.push({
          id: allergy.id,
          type: 'allergy',
          title: this.getAllergyTitle(allergy),
          date,
          conceptId: this.getAllergyConceptId(allergy),
          status: this.getAllergyStatus(allergy),
          details: this.getAllergyDetails(allergy),
          originalEvent: allergy,
          color: this.eventColors.allergy
        });
      }
    });

    this.encounters.forEach((encounter) => {
      const date = this.getBestDate(encounter, 'encounter');
      if (date) {
        this.timelineEvents.push({
          id: encounter.id,
          type: 'encounter',
          title: this.getEncounterTitle(encounter),
          date,
          conceptId: this.getEncounterConceptId(encounter),
          status: encounter.status || 'Unknown',
          details: this.getEncounterDetails(encounter),
          originalEvent: encounter,
          color: this.eventColors.encounter
        });
      }
    });

    this.sortedEvents = [...this.timelineEvents].sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private renderOverviewTimeline(): void {
    if (!this.overviewTimelineChart?.nativeElement) {
      return;
    }

    if (this.timelineEvents.length === 0) {
      this.purgeOverviewTimeline();
      return;
    }

    const chartElement = this.overviewTimelineChart.nativeElement;
    if (chartElement.offsetWidth === 0 || chartElement.offsetHeight === 0) {
      if (this.renderRetryHandle) {
        clearTimeout(this.renderRetryHandle);
      }
      this.renderRetryHandle = setTimeout(() => {
        this.renderRetryHandle = null;
        this.renderOverviewTimeline();
      }, 150);
      return;
    }

    const data = this.buildOverviewTimelineData();
    const layout = this.buildOverviewTimelineLayout();
    const config = {
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']
    };

    Plotly.react(chartElement, data, layout, config)
      .then(() => {
        this.plotlyInitialized = true;
        requestAnimationFrame(() => {
          if (this.overviewTimelineChart?.nativeElement) {
            Plotly.Plots.resize(this.overviewTimelineChart.nativeElement);
          }
        });
        setTimeout(() => {
          if (this.overviewTimelineChart?.nativeElement) {
            Plotly.Plots.resize(this.overviewTimelineChart.nativeElement);
          }
        }, 120);
      })
      .catch(() => {
        this.plotlyInitialized = false;
      });
  }

  private purgeOverviewTimeline(): void {
    if (this.plotlyInitialized && this.overviewTimelineChart?.nativeElement) {
      Plotly.purge(this.overviewTimelineChart.nativeElement);
    }
    this.plotlyInitialized = false;
  }

  private buildOverviewTimelineData(): any[] {
    return this.timelineTrackOrder.map((type) => {
      const events = this.getOverviewEventsForType(type);

      return {
        type: 'scatter',
        mode: 'markers',
        name: this.getEventTypeLabel(type),
        x: events.map((event) => event.date),
        y: events.map((event) => event.y),
        text: events.map((event) => event.title),
        customdata: events.map((event) => [
          this.getEventTypeLabel(event.type),
          this.formatDate(event.date.toISOString()),
          event.status,
          event.details || 'No additional details'
        ]),
        hovertemplate:
          '<b>%{text}</b><br>' +
          '%{customdata[0]}<br>' +
          'Date: %{customdata[1]}<br>' +
          'Status: %{customdata[2]}<br>' +
          '%{customdata[3]}' +
          '<extra></extra>',
        marker: {
          size: 16,
          color: this.eventColors[type],
          symbol: this.getOverviewMarkerSymbol(type),
          line: {
            width: 2,
            color: '#ffffff'
          }
        }
      };
    });
  }

  private getOverviewEventsForType(type: TimelineEvent['type']): Array<TimelineEvent & { y: number }> {
    const baseY = this.getOverviewTrackPosition(type);
    const events = this.timelineEvents
      .filter((event) => event.type === type)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const counts = new Map<number, number>();
    const indices = new Map<number, number>();

    events.forEach((event) => {
      const key = event.date.getTime();
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return events.map((event) => {
      const key = event.date.getTime();
      const currentIndex = indices.get(key) || 0;
      const total = counts.get(key) || 1;
      indices.set(key, currentIndex + 1);

      const offset = total === 1 ? 0 : (currentIndex - (total - 1) / 2) * 0.16;
      return {
        ...event,
        y: baseY + offset
      };
    });
  }

  private buildOverviewTimelineLayout(): any {
    const { start, end } = this.getOverviewDateRange();

    return {
      height: 280,
      margin: { l: 92, r: 24, t: 12, b: 42 },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#fbfcfe',
      hovermode: 'closest',
      showlegend: false,
      xaxis: {
        type: 'date',
        range: [start.toISOString(), end.toISOString()],
        showgrid: true,
        gridcolor: '#dfe6ee',
        griddash: 'dot',
        zeroline: false,
        tickformatstops: [
          { dtickrange: [null, 1000 * 60 * 60 * 24 * 32], value: '%b %d' },
          { dtickrange: [1000 * 60 * 60 * 24 * 32, 1000 * 60 * 60 * 24 * 366], value: '%b %Y' },
          { dtickrange: [1000 * 60 * 60 * 24 * 366, null], value: '%Y' }
        ]
      },
      yaxis: {
        range: [-0.5, this.timelineTrackOrder.length - 0.5],
        tickmode: 'array',
        tickvals: this.timelineTrackOrder.map((type) => this.getOverviewTrackPosition(type)),
        ticktext: this.timelineTrackOrder.map((type) => this.getEventTypeLabel(type)),
        showgrid: true,
        gridcolor: '#edf1f5',
        zeroline: false,
        fixedrange: true,
        automargin: true
      },
      shapes: this.timelineTrackOrder.map((type) => ({
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        yref: 'y',
        y0: this.getOverviewTrackPosition(type),
        y1: this.getOverviewTrackPosition(type),
        layer: 'below',
        line: {
          color: '#e8edf3',
          width: 1
        }
      }))
    };
  }

  private getOverviewDateRange(): { start: Date; end: Date } {
    const times = this.timelineEvents.map((event) => event.date.getTime()).sort((a, b) => a - b);
    const firstEvent = times[0];
    const lastEvent = times[times.length - 1];
    const now = Date.now();

    if (times.length === 1) {
      const bufferMs = 1000 * 60 * 60 * 24 * 30;
      return {
        start: new Date(firstEvent - bufferMs),
        end: new Date(Math.max(firstEvent + bufferMs, now))
      };
    }

    const rangeMs = Math.max(lastEvent - firstEvent, 1000 * 60 * 60 * 24);
    const bufferMs = Math.max(1000 * 60 * 60 * 24 * 30, Math.round(rangeMs * 0.05));

    return {
      start: new Date(firstEvent - bufferMs),
      end: new Date(Math.max(lastEvent + bufferMs, now))
    };
  }

  private getOverviewTrackPosition(type: TimelineEvent['type']): number {
    return this.timelineTrackOrder.indexOf(type);
  }

  private getOverviewMarkerSymbol(type: TimelineEvent['type']): string {
    switch (type) {
      case 'condition':
        return 'circle';
      case 'procedure':
        return 'diamond';
      case 'medication':
        return 'square';
      case 'allergy':
        return 'triangle-up';
      case 'encounter':
        return 'hexagon';
      default:
        return 'circle';
    }
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

  private getEventTypeLegendLabel(type: TimelineEvent['type']): string {
    switch (type) {
      case 'condition': return 'Conditions';
      case 'procedure': return 'Procedures';
      case 'medication': return 'Medications';
      case 'allergy': return 'Allergies';
      case 'encounter': return 'Encounters';
      default: return 'Events';
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
