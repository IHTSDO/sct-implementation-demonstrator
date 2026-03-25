import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { PatientService } from '../../../services/patient.service';
import type { FhirObservation, Patient } from '../../../model';

@Component({
  selector: 'app-nursing-vital-card',
  templateUrl: './nursing-vital-card.component.html',
  styleUrls: ['./nursing-vital-card.component.css'],
  standalone: false
})
export class NursingVitalCardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() emoji = '🩺';
  @Input() label = '';
  @Input() unit = '';
  @Input() code = '';
  @Input() codeSystem = 'http://loinc.org';
  @Input() snomedCode = '';
  @Input() isBloodPressure = false;
  @Input() systolicSnomedCode = '271649006';
  @Input() diastolicSnomedCode = '271650006';
  @Input() allowEntry = true;
  @Input() step = 0.1;
  @Input() min = 1;
  @Input() noDataLabel = 'No data recorded';

  latestObservation: FhirObservation | null = null;
  editOpen = false;
  draftValue: number | null = null;
  draftSystolic: number | null = null;
  draftDiastolic: number | null = null;

  private observationsChangedSub: Subscription | null = null;

  constructor(private patientService: PatientService) {}

  ngOnInit(): void {
    this.observationsChangedSub = this.patientService.getObservationsChanged().subscribe((patientId) => {
      if (this.patient?.id === patientId) {
        this.loadLatestObservation();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] || changes['code']) {
      this.loadLatestObservation();
    }
  }

  ngOnDestroy(): void {
    this.observationsChangedSub?.unsubscribe();
  }

  get latestValue(): string {
    const obs = this.latestObservation;
    if (!obs) {
      return this.noDataLabel;
    }

    if (this.isBloodPressure) {
      const systolic = this.getComponentValue(obs, '8480-6');
      const diastolic = this.getComponentValue(obs, '8462-4');
      if (systolic === null || diastolic === null) {
        return this.noDataLabel;
      }
      return `${systolic}/${diastolic}`;
    }

    const value = obs.valueQuantity?.value;
    if (value === undefined || value === null || Number.isNaN(value)) {
      return this.noDataLabel;
    }
    return this.formatNumeric(value);
  }

  get latestTimestamp(): string {
    const obs = this.latestObservation;
    if (!obs) {
      return this.noDataLabel;
    }
    const dateValue = obs.effectiveDateTime || obs.issued;
    if (!dateValue) {
      return this.noDataLabel;
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return this.noDataLabel;
    }
    return date.toLocaleString();
  }

  openEditor(): void {
    if (!this.allowEntry) {
      return;
    }
    this.editOpen = true;
  }

  closeEditor(): void {
    this.editOpen = false;
    this.draftValue = null;
    this.draftSystolic = null;
    this.draftDiastolic = null;
  }

  save(): void {
    if (!this.patient || !this.allowEntry || !this.code) {
      return;
    }

    const now = new Date().toISOString();
    let observation: FhirObservation | null = null;

    if (this.isBloodPressure) {
      const systolic = this.toPositiveNumber(this.draftSystolic);
      const diastolic = this.toPositiveNumber(this.draftDiastolic);
      if (systolic === null || diastolic === null) {
        return;
      }
      observation = {
        resourceType: 'Observation',
        id: `vital-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'final',
        subject: { reference: `Patient/${this.patient.id}` },
        effectiveDateTime: now,
        issued: now,
        code: {
          coding: this.buildPrimaryCodings(),
          text: this.label
        },
        component: [
          {
            code: {
              coding: [
                { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
                { system: 'http://snomed.info/sct', code: this.systolicSnomedCode, display: 'Systolic blood pressure (observable entity)' }
              ],
              text: 'Systolic blood pressure'
            },
            valueQuantity: { value: systolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          },
          {
            code: {
              coding: [
                { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
                { system: 'http://snomed.info/sct', code: this.diastolicSnomedCode, display: 'Diastolic blood pressure (observable entity)' }
              ],
              text: 'Diastolic blood pressure'
            },
            valueQuantity: { value: diastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          }
        ]
      };
    } else {
      const value = this.toPositiveNumber(this.draftValue);
      if (value === null) {
        return;
      }
      observation = {
        resourceType: 'Observation',
        id: `vital-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'final',
        subject: { reference: `Patient/${this.patient.id}` },
        effectiveDateTime: now,
        issued: now,
        code: {
          coding: this.buildPrimaryCodings(),
          text: this.label
        },
        valueQuantity: {
          value,
          unit: this.unit,
          system: 'http://unitsofmeasure.org',
          code: this.unit
        }
      };
    }

    this.patientService.addPatientObservation(this.patient.id, observation);
    this.closeEditor();
  }

  private loadLatestObservation(): void {
    this.latestObservation = null;
    if (!this.patient || !this.code) {
      return;
    }

    const observations = this.patientService.getPatientObservations(this.patient.id);
    const latest = observations
      .filter((obs) => obs.code?.coding?.some((coding) => coding.code === this.code))
      .sort((a, b) => this.getTimestampMillis(b) - this.getTimestampMillis(a))[0];

    this.latestObservation = latest || null;
  }

  private buildPrimaryCodings(): Array<{ system: string; code: string; display: string }> {
    const codings: Array<{ system: string; code: string; display: string }> = [
      { system: this.codeSystem, code: this.code, display: this.label }
    ];
    if (this.snomedCode) {
      codings.push({ system: 'http://snomed.info/sct', code: this.snomedCode, display: `${this.label} (observable entity)` });
    }
    return codings;
  }

  private getTimestampMillis(observation: FhirObservation): number {
    const dateValue = observation.effectiveDateTime || observation.issued;
    if (!dateValue) {
      return 0;
    }
    const millis = new Date(dateValue).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }

  private getComponentValue(observation: FhirObservation, code: string): number | null {
    const component = observation.component?.find((item) => item.code?.coding?.some((coding) => coding.code === code));
    const value = component?.valueQuantity?.value;
    if (value === undefined || value === null || Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  private toPositiveNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    return value > 0 ? value : null;
  }

  private formatNumeric(value: number): string {
    if (Number.isInteger(value)) {
      return `${value}`;
    }
    return value.toFixed(1);
  }
}
