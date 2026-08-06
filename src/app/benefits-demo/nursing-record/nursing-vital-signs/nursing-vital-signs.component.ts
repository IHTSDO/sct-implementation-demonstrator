import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, firstValueFrom } from 'rxjs';
import { PatientService } from '../../../services/patient.service';
import type { FhirObservation, Patient } from '../../../model';
import { DentistryFhirDialogComponent, DentistryFhirDialogData } from '../../dentistry-record/dentistry-fhir-dialog/dentistry-fhir-dialog.component';
import { ConfirmationDialogComponent } from '../../../questionnaires/confirmation-dialog/confirmation-dialog.component';

type VitalSignKey = 'heartRate' | 'bloodPressure' | 'temperature' | 'respiratoryRate' | 'oxygenSaturation' | 'weight';

interface VitalSignConfig {
  key: VitalSignKey;
  emoji: string;
  label: string;
  unit: string;
  snomedCode: string;
  loincCode?: string;
  isBloodPressure?: boolean;
}

interface VitalMeasurementRow {
  id: string;
  timestamp: number;
  dateLabel: string;
  emoji: string;
  label: string;
  valueDisplay: string;
  unit: string;
}

const SYSTOLIC_SNOMED_CODE = '271649006';
const DIASTOLIC_SNOMED_CODE = '271650006';

@Component({
  selector: 'app-nursing-vital-signs',
  templateUrl: './nursing-vital-signs.component.html',
  styleUrls: ['./nursing-vital-signs.component.css'],
  standalone: false
})
export class NursingVitalSignsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;

  readonly vitalSigns: VitalSignConfig[] = [
    { key: 'heartRate', emoji: '❤️', label: 'Heart Rate', unit: 'bpm', loincCode: '8867-4', snomedCode: '364075005' },
    { key: 'bloodPressure', emoji: '🩸', label: 'Blood Pressure', unit: 'mmHg', loincCode: '85354-9', snomedCode: '75367002', isBloodPressure: true },
    { key: 'temperature', emoji: '🌡️', label: 'Temperature', unit: '°C', loincCode: '8310-5', snomedCode: '386725007' },
    { key: 'respiratoryRate', emoji: '🫁', label: 'Respiratory Rate', unit: 'breaths/min', loincCode: '9279-1', snomedCode: '86290005' },
    { key: 'oxygenSaturation', emoji: '🧪', label: 'Oxygen Saturation (SpO₂)', unit: '%', loincCode: '2708-6', snomedCode: '103228002' },
    { key: 'weight', emoji: '🏋️', label: 'Weight', unit: 'kg', loincCode: '29463-7', snomedCode: '27113001' }
  ];

  measurements: VitalMeasurementRow[] = [];

  private observationsChangedSub: Subscription | null = null;

  constructor(private dialog: MatDialog, private patientService: PatientService) {}

  ngOnInit(): void {
    this.observationsChangedSub = this.patientService.getObservationsChanged().subscribe((patientId) => {
      if (this.patient?.id === patientId) {
        this.loadMeasurements();
      }
    });
    this.loadMeasurements();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) {
      this.loadMeasurements();
    }
  }

  ngOnDestroy(): void {
    this.observationsChangedSub?.unsubscribe();
  }

  trackByKey(_: number, item: VitalSignConfig): VitalSignKey {
    return item.key;
  }

  trackByMeasurementId(_: number, row: VitalMeasurementRow): string {
    return row.id;
  }

  async deleteMeasurement(row: VitalMeasurementRow): Promise<void> {
    if (!this.patient || !row.id) {
      return;
    }
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, {
        width: '460px',
        data: {
          title: 'Confirm Deletion',
          message: `Delete this ${row.label} measurement (${row.valueDisplay} ${row.unit})?`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          confirmColor: 'warn'
        }
      }).afterClosed()
    );
    if (!confirmed || !this.patient) {
      return;
    }
    this.patientService.deletePatientObservation(this.patient.id, row.id);
    // The observations-changed subscription reloads the list.
  }

  private loadMeasurements(): void {
    this.measurements = [];
    if (!this.patient) {
      return;
    }

    const configByCode = new Map(this.vitalSigns.map((vital) => [vital.snomedCode, vital] as const));
    this.measurements = this.getPatientObservations(this.patient.id)
      .map((observation) => this.toMeasurementRow(observation, configByCode))
      .filter((row): row is VitalMeasurementRow => row !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private toMeasurementRow(
    observation: FhirObservation,
    configByCode: Map<string, VitalSignConfig>
  ): VitalMeasurementRow | null {
    const primaryCode = observation.code?.coding?.find((coding) => !!coding.code && configByCode.has(coding.code as string))?.code;
    if (!primaryCode || !observation.id) {
      return null;
    }
    const config = configByCode.get(primaryCode as string)!;

    let valueDisplay: string;
    if (config.isBloodPressure) {
      const systolic = this.getComponentValue(observation, SYSTOLIC_SNOMED_CODE);
      const diastolic = this.getComponentValue(observation, DIASTOLIC_SNOMED_CODE);
      if (systolic === null || diastolic === null) {
        return null;
      }
      valueDisplay = `${this.formatNumeric(systolic)}/${this.formatNumeric(diastolic)}`;
    } else {
      const value = observation.valueQuantity?.value;
      if (value === undefined || value === null || Number.isNaN(value)) {
        return null;
      }
      valueDisplay = this.formatNumeric(value);
    }

    const timestamp = this.getTimestampMillis(observation);
    return {
      id: observation.id,
      timestamp,
      dateLabel: timestamp > 0 ? new Date(timestamp).toLocaleString() : '—',
      emoji: config.emoji,
      label: config.label,
      valueDisplay,
      unit: config.unit
    };
  }

  private getComponentValue(observation: FhirObservation, snomedCode: string): number | null {
    const component = observation.component?.find((item) => item.code?.coding?.some((coding) => coding.code === snomedCode));
    const value = component?.valueQuantity?.value;
    if (value === undefined || value === null || Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  private getTimestampMillis(observation: FhirObservation): number {
    const dateValue = observation.effectiveDateTime || observation.issued;
    if (!dateValue) {
      return 0;
    }
    const millis = new Date(dateValue).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }

  private formatNumeric(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  openVitalFhirDialog(): void {
    if (!this.patient) {
      return;
    }

    const data: DentistryFhirDialogData = {
      title: 'Vital Signs HL7 FHIR Resources',
      links: [
        { label: 'Observation', href: 'https://hl7.org/fhir/observation.html' }
      ],
      jsonString: JSON.stringify(this.buildVitalFhirBundle(this.patient.id), null, 2),
      fileName: `vital-signs-fhir-${this.patient.id}.json`
    };

    this.dialog.open(DentistryFhirDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data
    });
  }

  private buildVitalFhirBundle(patientId: string): { resourceType: 'Bundle'; type: 'collection'; entry: Array<{ resource: FhirObservation }> } {
    const vitalCodes = new Set(this.vitalSigns.map((vital) => vital.snomedCode));
    const observations = this.getPatientObservations(patientId)
      .filter((obs) => obs.code?.coding?.some((coding) => !!coding.code && vitalCodes.has(coding.code as string)));

    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: observations.map((resource) => ({ resource }))
    };
  }

  private getPatientObservations(patientId: string): FhirObservation[] {
    return this.patientService.getPatientObservations(patientId);
  }
}
