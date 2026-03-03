import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FhirObservation, Patient, PatientService } from '../../../services/patient.service';
import { DentistryFhirDialogComponent, DentistryFhirDialogData } from '../../dentistry-record/dentistry-fhir-dialog/dentistry-fhir-dialog.component';

type VitalSignKey = 'heartRate' | 'bloodPressure' | 'temperature' | 'respiratoryRate' | 'oxygenSaturation' | 'weight';

interface VitalSignConfig {
  key: VitalSignKey;
  emoji: string;
  label: string;
  unit: string;
  loincCode: string;
  snomedCode?: string;
  isBloodPressure?: boolean;
}

@Component({
  selector: 'app-nursing-vital-signs',
  templateUrl: './nursing-vital-signs.component.html',
  styleUrls: ['./nursing-vital-signs.component.css'],
  standalone: false
})
export class NursingVitalSignsComponent {
  @Input() patient: Patient | null = null;

  readonly vitalSigns: VitalSignConfig[] = [
    { key: 'heartRate', emoji: '❤️', label: 'Heart Rate', unit: 'bpm', loincCode: '8867-4', snomedCode: '364075005' },
    { key: 'bloodPressure', emoji: '🩸', label: 'Blood Pressure', unit: 'mmHg', loincCode: '85354-9', isBloodPressure: true },
    { key: 'temperature', emoji: '🌡️', label: 'Temperature', unit: '°C', loincCode: '8310-5', snomedCode: '386725007' },
    { key: 'respiratoryRate', emoji: '🫁', label: 'Respiratory Rate', unit: 'breaths/min', loincCode: '9279-1', snomedCode: '86290005' },
    { key: 'oxygenSaturation', emoji: '🧪', label: 'Oxygen Saturation (SpO₂)', unit: '%', loincCode: '2708-6', snomedCode: '103228002' },
    { key: 'weight', emoji: '🏋️', label: 'Weight', unit: 'kg', loincCode: '29463-7', snomedCode: '27113001' }
  ];

  constructor(private dialog: MatDialog, private patientService: PatientService) {}

  trackByKey(_: number, item: VitalSignConfig): VitalSignKey {
    return item.key;
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
    const vitalCodes = new Set(this.vitalSigns.map((vital) => vital.loincCode));
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
