import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import {
  Condition,
  DeathRecord,
  DeathRecordDiagnosis,
  Patient,
  PatientService
} from '../../services/patient.service';

type Part1LineCode = 'a' | 'b' | 'c' | 'd';

interface DeathDiagnosisFormLine {
  line?: Part1LineCode;
  sourceType: 'existing-condition' | 'snomed-search';
  selectedConditionId?: string;
  selectedConcept?: { code?: string; display?: string } | null;
  text: string;
  intervalText: string;
}

interface DeathRegistrationDialogData {
  patient: Patient;
  conditions: Condition[];
  existingRecord: DeathRecord | null;
}

@Component({
  selector: 'app-death-registration-dialog',
  templateUrl: './death-registration-dialog.component.html',
  styleUrls: ['./death-registration-dialog.component.css'],
  standalone: false
})
export class DeathRegistrationDialogComponent {
  readonly conditionBinding = {
    ecl: '< 404684003 |Clinical finding|',
    title: 'Search for condition...',
    placeholder: 'Search SNOMED CT condition...'
  };

  deceasedDate: Date | null = null;
  deceasedTime: Date | null = null;
  isSaving = false;
  errorMessage = '';

  part1Lines: DeathDiagnosisFormLine[] = [
    this.createPart1Line('a'),
    this.createPart1Line('b'),
    this.createPart1Line('c'),
    this.createPart1Line('d')
  ];

  part2Lines: DeathDiagnosisFormLine[] = [this.createPart2Line()];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DeathRegistrationDialogData,
    private dialogRef: MatDialogRef<DeathRegistrationDialogComponent>,
    private patientService: PatientService,
    private terminologyService: TerminologyService
  ) {
    this.initializeFromExistingRecord();
  }

  close(): void {
    this.dialogRef.close(false);
  }

  addPart2Line(): void {
    this.part2Lines = [...this.part2Lines, this.createPart2Line()];
  }

  removePart2Line(index: number): void {
    this.part2Lines = this.part2Lines.filter((_, currentIndex) => currentIndex !== index);
    if (this.part2Lines.length === 0) {
      this.part2Lines = [this.createPart2Line()];
    }
  }

  onExistingConditionSelected(line: DeathDiagnosisFormLine): void {
    const condition = this.getConditionById(line.selectedConditionId);
    if (!condition) {
      return;
    }

    const snomed = this.getConditionSnomed(condition);
    line.text = condition.code?.text || snomed.display || '';
    line.selectedConcept = snomed.code ? { code: snomed.code, display: snomed.display || line.text } : null;
  }

  onConceptSelected(line: DeathDiagnosisFormLine, concept: any): void {
    line.selectedConcept = concept;
    if (concept?.display) {
      line.text = concept.display;
    }
  }

  async save(): Promise<void> {
    this.errorMessage = '';

    const deceasedDateTime = this.buildDeceasedDateTime();
    if (!deceasedDateTime) {
      this.errorMessage = 'Please enter the date and time of death.';
      return;
    }

    this.isSaving = true;

    try {
      const serializedPart1 = await this.serializePart1();
      const serializedPart2 = await this.serializePart2();

      if (serializedPart1.length === 0 && serializedPart2.length === 0) {
        this.errorMessage = 'Enter at least one cause of death before saving.';
        this.isSaving = false;
        return;
      }

      this.removeExistingDerivedConditions();

      const enrichedPart1 = this.createDerivedConditions(
        serializedPart1.map(entry => ({ ...entry })),
        deceasedDateTime
      );
      const enrichedPart2 = this.createDerivedConditions(
        serializedPart2.map(entry => ({ ...entry })),
        deceasedDateTime
      );

      const deathRecord: DeathRecord = {
        id: this.data.existingRecord?.id || `death-record-${Date.now()}`,
        patientId: this.data.patient.id,
        recordedAt: new Date().toISOString(),
        deceasedDateTime: deceasedDateTime,
        part1: enrichedPart1,
        part2: enrichedPart2
      };

      const updatedPatient: Patient = {
        ...this.data.patient,
        deceasedBoolean: true,
        deceasedDateTime: deathRecord.deceasedDateTime
      };

      this.patientService.updatePatient(updatedPatient);
      this.patientService.savePatientDeathRecord(this.data.patient.id, deathRecord);
      this.patientService.selectPatient(updatedPatient);

      this.dialogRef.close({ saved: true, deathRecord, patient: updatedPatient });
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to save the death record.';
    } finally {
      this.isSaving = false;
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  getDialogTitle(): string {
    return this.data.existingRecord ? 'Update death registration' : 'Register death';
  }

  private initializeFromExistingRecord(): void {
    if (!this.data.existingRecord) {
      return;
    }

    const existingDateTime = new Date(this.data.existingRecord.deceasedDateTime);
    this.deceasedDate = existingDateTime;
    this.deceasedTime = existingDateTime;

    const part1LineCodes: Part1LineCode[] = ['a', 'b', 'c', 'd'];
    this.part1Lines = part1LineCodes.map(lineCode => {
      const existingLine = this.data.existingRecord?.part1.find(line => line.line === lineCode);
      return existingLine ? this.mapDiagnosisToLine(existingLine, lineCode) : this.createPart1Line(lineCode);
    });

    this.part2Lines = this.data.existingRecord.part2.length > 0
      ? this.data.existingRecord.part2.map(line => this.mapDiagnosisToLine(line))
      : [this.createPart2Line()];
  }

  private createPart1Line(line: Part1LineCode): DeathDiagnosisFormLine {
    return {
      line,
      sourceType: 'existing-condition',
      selectedConditionId: '',
      selectedConcept: null,
      text: '',
      intervalText: ''
    };
  }

  private createPart2Line(): DeathDiagnosisFormLine {
    return {
      sourceType: 'existing-condition',
      selectedConditionId: '',
      selectedConcept: null,
      text: '',
      intervalText: ''
    };
  }

  private mapDiagnosisToLine(diagnosis: DeathRecordDiagnosis, line?: Part1LineCode): DeathDiagnosisFormLine {
    return {
      line,
      sourceType: diagnosis.sourceType,
      selectedConditionId: diagnosis.sourceConditionId || '',
      selectedConcept: diagnosis.snomedConceptId
        ? { code: diagnosis.snomedConceptId, display: diagnosis.snomedDisplay || diagnosis.text }
        : null,
      text: diagnosis.text || '',
      intervalText: diagnosis.intervalText || ''
    };
  }

  private async serializePart1(): Promise<Array<DeathRecordDiagnosis & { line: Part1LineCode }>> {
    const results: Array<DeathRecordDiagnosis & { line: Part1LineCode }> = [];

    for (const line of this.part1Lines) {
      if (!this.hasMeaningfulContent(line)) {
        continue;
      }

      results.push({
        ...(await this.serializeDiagnosisLine(line)),
        line: line.line!
      });
    }

    return results;
  }

  private async serializePart2(): Promise<DeathRecordDiagnosis[]> {
    const results: DeathRecordDiagnosis[] = [];

    for (const line of this.part2Lines) {
      if (!this.hasMeaningfulContent(line)) {
        continue;
      }

      results.push(await this.serializeDiagnosisLine(line));
    }

    return results;
  }

  private async serializeDiagnosisLine(line: DeathDiagnosisFormLine): Promise<DeathRecordDiagnosis> {
    if (line.sourceType === 'existing-condition') {
      const condition = this.getConditionById(line.selectedConditionId);
      if (!condition) {
        throw new Error('Select an existing condition for each populated line using that option.');
      }

      const snomed = this.getConditionSnomed(condition);
      if (!snomed.code) {
        throw new Error(`The selected condition "${condition.code?.text || 'Unknown'}" does not have a SNOMED CT code. Use the SNOMED search option for that line.`);
      }

      const text = line.text.trim() || condition.code?.text || snomed.display || '';
      const icd10Code = (await this.resolveIcd10Code(snomed.code)) || condition.icd10Code;

      return {
        sourceType: 'existing-condition',
        sourceConditionId: condition.id,
        text,
        intervalText: line.intervalText.trim(),
        snomedConceptId: snomed.code,
        snomedDisplay: snomed.display || text,
        icd10Code
      };
    }

    const concept = line.selectedConcept;
    if (!concept?.code) {
      throw new Error('Select a SNOMED CT concept for each populated line using SNOMED search.');
    }

    const text = line.text.trim() || concept.display || '';
    const icd10Code = await this.resolveIcd10Code(concept.code);

    return {
      sourceType: 'snomed-search',
      text,
      intervalText: line.intervalText.trim(),
      snomedConceptId: concept.code,
      snomedDisplay: concept.display || text,
      icd10Code
    };
  }

  private createDerivedConditions<T extends DeathRecordDiagnosis>(diagnoses: T[], deceasedDateTime: string): T[] {
    diagnoses.forEach(diagnosis => {
      const condition = this.patientService.createConditionFromClinicalEntryConcept(
        this.data.patient.id,
        {
          code: diagnosis.snomedConceptId,
          display: diagnosis.text
        }
      );

      condition.recordedDate = new Date(deceasedDateTime).toISOString();
      condition.onsetDateTime = new Date(deceasedDateTime).toISOString();
      condition.icd10Code = diagnosis.icd10Code;
      condition.snomedConceptId = diagnosis.snomedConceptId;
      condition.category = [
        {
          coding: [
            {
              system: 'http://example.org/fhir/CodeSystem/condition-category',
              code: 'death-certificate',
              display: 'Death certificate diagnosis'
            }
          ],
          text: 'Death certificate diagnosis'
        }
      ];
      condition.note = [
        {
          time: new Date().toISOString(),
          text: 'Derived from cause of death registration.'
        }
      ];

      this.patientService.addPatientConditionAllowDuplicates(this.data.patient.id, condition);
      diagnosis.derivedConditionId = condition.id;
    });

    return diagnoses;
  }

  private removeExistingDerivedConditions(): void {
    if (!this.data.existingRecord) {
      return;
    }

    const previousDiagnoses = [
      ...this.data.existingRecord.part1,
      ...this.data.existingRecord.part2
    ];

    previousDiagnoses.forEach(diagnosis => {
      if (diagnosis.derivedConditionId) {
        this.patientService.deletePatientCondition(this.data.patient.id, diagnosis.derivedConditionId);
      }
    });
  }

  private getConditionById(conditionId?: string): Condition | undefined {
    if (!conditionId) {
      return undefined;
    }

    return this.data.conditions.find(condition => condition.id === conditionId);
  }

  private getConditionSnomed(condition: Condition): { code?: string; display?: string } {
    const coding = condition.code?.coding?.find(item => item.system === 'http://snomed.info/sct') || condition.code?.coding?.[0];

    return {
      code: condition.snomedConceptId || coding?.code,
      display: coding?.display || condition.code?.text
    };
  }

  private async resolveIcd10Code(snomedConceptId?: string): Promise<string | undefined> {
    if (!snomedConceptId) {
      return undefined;
    }

    try {
      const response = await firstValueFrom(this.terminologyService.getIcd10MapTargets(snomedConceptId));
      const matchParam = response?.parameter?.find((param: any) => param.name === 'match');
      const conceptPart = matchParam?.part?.find((part: any) => part.name === 'concept');
      return conceptPart?.valueCoding?.code;
    } catch {
      return undefined;
    }
  }

  private hasMeaningfulContent(line: DeathDiagnosisFormLine): boolean {
    return !!(
      line.selectedConditionId ||
      line.selectedConcept?.code ||
      line.text.trim() ||
      line.intervalText.trim()
    );
  }

  private buildDeceasedDateTime(): string | null {
    if (!this.deceasedDate || !this.deceasedTime) {
      return null;
    }

    const dateTime = new Date(this.deceasedDate);
    dateTime.setHours(this.deceasedTime.getHours(), this.deceasedTime.getMinutes(), 0, 0);
    return dateTime.toISOString();
  }
}
