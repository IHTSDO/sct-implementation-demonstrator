import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { FhirObservation, Patient, PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-nursing-nutritional-careplan',
  templateUrl: './nursing-nutritional-careplan.component.html',
  styleUrls: ['./nursing-nutritional-careplan.component.css'],
  standalone: false
})
export class NursingNutritionalCareplanComponent implements OnInit, OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;

  private readonly WEIGHT_LOINC_CODE = '29463-7';
  private readonly HEIGHT_LOINC_CODE = '8302-2';
  private readonly goalsEcl =
    '1145522009 OR 1156885001 OR 1144549003 OR 1145004001 OR 248324001 OR 1144522003 OR 733739009 OR 288936000 OR 161825005 OR 162056003 OR 162028008 OR 162062008 OR 43664005 OR 271398006 OR 69840006 OR 289148009 OR 1141692002 OR 1144674006 OR 1145005000 OR 249480002';

  readonly nursingDiagnosisBinding = {
    title: 'Nursing diagnosis',
    type: 'Select (Single)',
    ecl: '61578001 OR 284670008 OR 129689002 OR 706871001 OR 705051002 OR 704343001 OR 714669006 OR 129863004 OR 58424009 OR 1156957002 OR 45346005 OR 48501009 OR 699653008 OR 704361005 OR 88202002 OR 129845004 OR 445261000124106 OR 704358009 OR 129904008 OR 288939007 OR 87715008 OR 16331000 OR 79890006 OR 422587007 OR 162031009 OR 422400008 OR 704413004 OR 444673007 OR 8765009 OR 301336003 OR 248342006 OR 1144779008 OR 371597004 OR 238131007 OR 1145307003 OR 704375003 OR 289084000 OR 161838002 OR 713448008 OR 58219009 OR 1149253002 OR 237355007 OR 55222007 OR 289159000 OR 190902006 OR 1217126006 OR 129849005 OR 50048006 OR 34095006 OR 704420006 OR 249481003'
  };

  readonly mainGoalExpectedOutcomeBinding = {
    title: 'Main goal and expected outcome',
    type: 'Select (Single)',
    ecl: this.goalsEcl
  };

  readonly subgoalExpectedOutcomeBinding = {
    title: 'Subgoal and expected outcome',
    type: 'Select (Single)',
    ecl: this.goalsEcl
  };

  readonly interventionsBinding = {
    title: 'Interventions',
    type: 'Select (Single)',
    ecl: '792805006 OR 167197004 OR 386372009 OR 1759002 OR 710836004 OR 61310001 OR 422972009 OR 103699006 OR 710563008 OR 1156958007 OR 386374005 OR 410171007 OR 229912004 OR 408910007 OR 25156005 OR 408913009 OR 385808007 OR 408914003 OR 710847006 OR 710215009 OR 710747003 OR 709543002 OR 709544008 OR 710848001 OR 710881000 OR 700258004 OR 225388007 OR 408909002 OR 410175003 OR 1156886000 OR 226010006 OR 225285007 OR 113148007 OR 75118006 OR 61420007 OR 182923009 OR 709542007 OR 385816003 OR 710999009 OR 710925007 OR 226077000 OR 385938002 OR 7476006 OR 309056006 OR 440363007 OR 709263008 OR 408882007 OR 408881000 OR 386495004 OR 39857003 OR 307818003 OR 410200000 OR 388962008 OR 710970004 OR 710345009 OR 431868002 OR 710123001 OR 710952002 OR 408883002 OR 712745001 OR 243094003 OR 711029005 OR 710716009 OR 710740001 OR 709261005 OR 711082003 OR 171053005 OR 385817007 OR 1156583001 OR 40043006 OR 711099002'
  };

  selectedNursingDiagnosis: { code: string; display: string } | null = null;
  selectedMainGoalExpectedOutcome: { code: string; display: string } | null = null;
  selectedSubgoalExpectedOutcome: { code: string; display: string } | null = null;
  selectedInterventions: ({ code: string; display: string } | null)[] = [null];
  weightKg: number | null = null;
  heightCm: number | null = null;
  private observationsChangedSub: Subscription | null = null;

  get bmiValue(): number | null {
    const weight = this.toPositiveNumber(this.weightKg);
    const heightCm = this.toPositiveNumber(this.heightCm);
    if (!weight || !heightCm) {
      return null;
    }
    const heightMeters = heightCm / 100;
    return weight / (heightMeters * heightMeters);
  }

  get bmiDisplay(): string {
    const bmi = this.bmiValue;
    return bmi === null ? '' : bmi.toFixed(1);
  }

  get bmiCategoryClass(): string {
    const bmi = this.bmiValue;
    if (bmi === null) {
      return '';
    }
    if (bmi < 18.5) {
      return 'bmi-risk';
    }
    if (bmi < 25) {
      return 'bmi-normal';
    }
    if (bmi < 30) {
      return 'bmi-overweight';
    }
    return 'bmi-risk';
  }

  get bmiBackgroundColor(): string {
    const bmi = this.bmiValue;
    if (bmi === null) {
      return '';
    }
    if (bmi < 18.5) {
      return '#ffebee';
    }
    if (bmi < 25) {
      return '#e8f5e9';
    }
    if (bmi < 30) {
      return '#fff8e1';
    }
    return '#ffebee';
  }

  get bmiCardClass(): string {
    return this.bmiCategoryClass;
  }

  constructor(private patientService: PatientService) {}

  ngOnInit(): void {
    this.observationsChangedSub = this.patientService.getObservationsChanged().subscribe((patientId) => {
      if (this.patient?.id === patientId) {
        this.loadAnthropometry();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) {
      this.loadAnthropometry();
    }
  }

  onNursingDiagnosisChange(selection: { code: string; display: string } | { code: string; display: string }[] | null): void {
    this.selectedNursingDiagnosis = Array.isArray(selection) ? null : selection;
  }

  onMainGoalExpectedOutcomeChange(selection: { code: string; display: string } | { code: string; display: string }[] | null): void {
    this.selectedMainGoalExpectedOutcome = Array.isArray(selection) ? null : selection;
  }

  onSubgoalExpectedOutcomeChange(selection: { code: string; display: string } | { code: string; display: string }[] | null): void {
    this.selectedSubgoalExpectedOutcome = Array.isArray(selection) ? null : selection;
  }

  onInterventionsChange(index: number, selection: { code: string; display: string } | { code: string; display: string }[] | null): void {
    this.selectedInterventions[index] = Array.isArray(selection) ? null : selection;
  }

  addInterventionRow(): void {
    if (!this.canAddIntervention()) {
      return;
    }
    this.selectedInterventions.push(null);
  }

  removeInterventionRow(index: number): void {
    if (this.selectedInterventions.length <= 1) {
      return;
    }
    this.selectedInterventions.splice(index, 1);
  }

  canAddIntervention(): boolean {
    return this.selectedInterventions.some((intervention) => !!intervention);
  }

  ngOnDestroy(): void {
    this.observationsChangedSub?.unsubscribe();
  }

  private loadAnthropometry(): void {
    if (!this.patient) {
      this.weightKg = null;
      this.heightCm = null;
      return;
    }

    const observations = this.patientService.getPatientObservations(this.patient.id);

    const latestWeight = observations
      .filter((obs) => obs.code?.coding?.some((coding) => coding.code === this.WEIGHT_LOINC_CODE))
      .sort((a, b) => this.getTimestampMillis(b) - this.getTimestampMillis(a))[0];

    const latestHeight = observations
      .filter((obs) => obs.code?.coding?.some((coding) => coding.code === this.HEIGHT_LOINC_CODE))
      .sort((a, b) => this.getTimestampMillis(b) - this.getTimestampMillis(a))[0];

    const weightValue = latestWeight?.valueQuantity?.value;
    this.weightKg = weightValue !== undefined && weightValue !== null && Number.isFinite(weightValue) ? weightValue : null;

    const heightValue = latestHeight?.valueQuantity?.value;
    this.heightCm = heightValue !== undefined && heightValue !== null && Number.isFinite(heightValue) ? heightValue : null;
  }

  private getTimestampMillis(observation: FhirObservation): number {
    const dateValue = observation.effectiveDateTime || observation.issued;
    if (!dateValue) {
      return 0;
    }
    const millis = new Date(dateValue).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }

  private toPositiveNumber(value: number | string | null | undefined): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }
    return numeric;
  }
}
