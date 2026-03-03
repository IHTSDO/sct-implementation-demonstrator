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
      entry: observations.map((resource) => ({ resource: this.normalizeObservationCodings(resource) }))
    };
  }

  private getPatientObservations(patientId: string): FhirObservation[] {
    return this.patientService.getPatientObservations(patientId);
  }

  private normalizeObservationCodings(observation: FhirObservation): FhirObservation {
    const copy: FhirObservation = JSON.parse(JSON.stringify(observation));
    const loincCode = copy.code?.coding?.find((coding) => coding.system === 'http://loinc.org')?.code;
    const snomedByLoinc: Record<string, string> = {
      '8867-4': '364075005',   // Heart rate
      '2708-6': '103228002',   // Oxygen saturation
      '29463-7': '27113001',   // Body weight
      '8302-2': '1153637007',  // Body height
      '8310-5': '386725007',   // Body temperature
      '9279-1': '86290005'     // Respiratory rate
    };

    const snomedCode = loincCode ? snomedByLoinc[loincCode] : undefined;
    if (snomedCode) {
      copy.code = copy.code || { coding: [], text: observation.code?.text };
      copy.code.coding = copy.code.coding || [];
      const hasSnomed = copy.code.coding.some(
        (coding) => coding.system === 'http://snomed.info/sct' && coding.code === snomedCode
      );
      if (!hasSnomed) {
        copy.code.coding.push({
          system: 'http://snomed.info/sct',
          code: snomedCode,
          display: `${copy.code.text || 'Vital sign'} (observable entity)`
        });
      }
    }

    if (loincCode === '85354-9' && copy.component?.length) {
      for (const component of copy.component) {
        const componentLoinc = component.code?.coding?.find((coding) => coding.system === 'http://loinc.org')?.code;
        const componentSnomed = componentLoinc === '8480-6'
          ? '271649006'
          : componentLoinc === '8462-4'
            ? '271650006'
            : '';
        if (!componentSnomed) {
          continue;
        }
        component.code.coding = component.code.coding || [];
        const hasSnomed = component.code.coding.some(
          (coding) => coding.system === 'http://snomed.info/sct' && coding.code === componentSnomed
        );
        if (!hasSnomed) {
          component.code.coding.push({
            system: 'http://snomed.info/sct',
            code: componentSnomed,
            display: `${component.code.text || 'Blood pressure component'} (observable entity)`
          });
        }
      }
    }

    return copy;
  }
}
