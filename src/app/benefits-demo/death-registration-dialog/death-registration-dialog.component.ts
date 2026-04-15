import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import { PatientService } from '../../services/patient.service';
import type { Condition, DeathRecord, DeathRecordDiagnosis, Patient } from '../../model';

type Part1LineCode = 'a' | 'b' | 'c' | 'd';

interface DeathDiagnosisFormLine {
  line?: Part1LineCode;
  sourceType: 'existing-condition' | 'snomed-search';
  selectedConditionId?: string;
  selectedConcept?: { code?: string; display?: string } | null;
  previewIcd10Code?: string;
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
  private readonly VRDR_DOCUMENT_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-death-certificate-document';
  private readonly VRDR_COMPOSITION_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-death-certificate';
  private readonly VRDR_DEATH_CERTIFICATION_PROCEDURE_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-death-certification';
  private readonly VRDR_CAUSE_OF_DEATH_PART1_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-cause-of-death-part1';
  private readonly VRDR_CAUSE_OF_DEATH_PART2_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-cause-of-death-part2';
  private readonly VRDR_DECEDENT_PROFILE =
    'http://hl7.org/fhir/us/vrdr/StructureDefinition/vrdr-decedent';
  private readonly UI_SOURCE_TYPE_EXTENSION = 'http://example.org/fhir/StructureDefinition/death-certificate-source-type';
  private readonly UI_SOURCE_CONDITION_EXTENSION = 'http://example.org/fhir/StructureDefinition/death-certificate-source-condition-id';
  private readonly UI_DERIVED_CONDITION_EXTENSION = 'http://example.org/fhir/StructureDefinition/death-certificate-derived-condition-id';

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
    const now = new Date();
    this.deceasedDate = now;
    this.deceasedTime = now;
    this.initializeFromExistingRecord();
  }

  close(): void {
    this.dialogRef.close(false);
  }

  deleteDeathRecord(): void {
    const existingRecord = this.data.existingRecord;
    if (!existingRecord) {
      return;
    }

    const confirmed = confirm('Delete the death certification record and mark this patient as not deceased?');
    if (!confirmed) {
      return;
    }

    this.patientService.deletePatientDeathRecord(this.data.patient.id);

    const revivedPatient: Patient = {
      ...this.data.patient,
      deceasedBoolean: false,
      deceasedDateTime: undefined
    };

    this.patientService.updatePatient(revivedPatient);
    this.patientService.selectPatient(revivedPatient);
    this.dialogRef.close({ deleted: true, patient: revivedPatient });
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

  resetPart1Line(index: number): void {
    const lineCode = this.part1Lines[index]?.line;
    if (!lineCode) {
      return;
    }

    this.part1Lines[index] = this.createPart1Line(lineCode);
    this.part1Lines = [...this.part1Lines];
  }

  resetPart2Line(index: number): void {
    this.part2Lines[index] = this.createPart2Line();
    this.part2Lines = [...this.part2Lines];
  }

  onExistingConditionSelected(line: DeathDiagnosisFormLine): void {
    const condition = this.getConditionById(line.selectedConditionId);
    if (!condition) {
      line.previewIcd10Code = '';
      return;
    }

    const snomed = this.getConditionSnomed(condition);
    line.text = condition.code?.text || snomed.display || '';
    line.selectedConcept = snomed.code ? { code: snomed.code, display: snomed.display || line.text } : null;
    line.previewIcd10Code = this.patientService.getConditionIcd10Code(condition) || '';

    if (!line.previewIcd10Code && snomed.code) {
      this.populatePreviewIcd10(line, snomed.code);
    }
  }

  onConceptSelected(line: DeathDiagnosisFormLine, concept: any): void {
    line.selectedConcept = concept;
    if (concept?.display) {
      line.text = concept.display;
    }
    line.previewIcd10Code = '';

    if (concept?.code) {
      this.populatePreviewIcd10(line, concept.code);
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

      const enrichedPart1 = await this.createDerivedConditions(
        serializedPart1.map(entry => ({ ...entry })),
        deceasedDateTime
      );
      const enrichedPart2 = await this.createDerivedConditions(
        serializedPart2.map(entry => ({ ...entry })),
        deceasedDateTime
      );

      const deathRecord = this.buildDeathCertificateBundle(enrichedPart1, enrichedPart2, deceasedDateTime);

      const updatedPatient: Patient = {
        ...this.data.patient,
        deceasedBoolean: true,
        deceasedDateTime: deceasedDateTime
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
    return this.data.existingRecord ? 'Update death registration' : 'Death registration';
  }

  getSourceFieldLabel(line: DeathDiagnosisFormLine): string {
    const baseLabel = line.sourceType === 'existing-condition' ? 'Existing condition' : 'SNOMED condition';
    return line.previewIcd10Code ? `${baseLabel} - ICD-10 ${line.previewIcd10Code}` : baseLabel;
  }

  getAutocompleteBinding(line: DeathDiagnosisFormLine): { ecl: string; title: string; placeholder: string } {
    return {
      ...this.conditionBinding,
      title: this.getSourceFieldLabel(line)
    };
  }

  private initializeFromExistingRecord(): void {
    if (!this.data.existingRecord) {
      return;
    }

    const existingDateTime = this.getBundleDeceasedDateTime(this.data.existingRecord);
    if (!existingDateTime) {
      return;
    }

    this.deceasedDate = existingDateTime;
    this.deceasedTime = existingDateTime;

    const part1LineCodes: Part1LineCode[] = ['a', 'b', 'c', 'd'];
    const part1Diagnoses = this.getBundleDiagnoses(this.data.existingRecord, 'part1');
    const part2Diagnoses = this.getBundleDiagnoses(this.data.existingRecord, 'part2');

    this.part1Lines = part1LineCodes.map(lineCode => {
      const existingLine = part1Diagnoses.find(line => line.line === lineCode);
      return existingLine ? this.mapDiagnosisToLine(existingLine, lineCode) : this.createPart1Line(lineCode);
    });

    this.part2Lines = part2Diagnoses.length > 0
      ? part2Diagnoses.map(line => this.mapDiagnosisToLine(line))
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
      selectedConditionId: this.resolveConditionId(diagnosis),
      selectedConcept: diagnosis.snomedConceptId
        ? { code: diagnosis.snomedConceptId, display: diagnosis.snomedDisplay || diagnosis.text }
        : null,
      previewIcd10Code: diagnosis.icd10Code || '',
      text: diagnosis.text || '',
      intervalText: diagnosis.intervalText || ''
    };
  }

  private resolveConditionId(diagnosis: DeathRecordDiagnosis): string {
    if (diagnosis.sourceConditionId && this.data.conditions.some(c => c.id === diagnosis.sourceConditionId)) {
      return diagnosis.sourceConditionId;
    }
    if (diagnosis.snomedConceptId) {
      const match = this.data.conditions.find(c => {
        const coding = this.patientService.getConditionSnomedCoding(c);
        return coding?.code === diagnosis.snomedConceptId;
      });
      if (match) {
        return match.id;
      }
    }
    return diagnosis.sourceConditionId || '';
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
      if (!this.hasPart2MeaningfulContent(line)) {
        continue;
      }

      const diagnosis = await this.serializeDiagnosisLine(line);
      results.push({
        ...diagnosis,
        intervalText: ''
      });
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
      const icd10Code = (await this.resolveIcd10Code(snomed.code)) || this.patientService.getConditionIcd10Code(condition) || undefined;

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

  private async createDerivedConditions<T extends DeathRecordDiagnosis>(diagnoses: T[], deceasedDateTime: string): Promise<T[]> {
    for (const diagnosis of diagnoses) {
      if (diagnosis.sourceType !== 'snomed-search') {
        diagnosis.derivedConditionId = undefined;
        continue;
      }

      const condition = this.patientService.createConditionFromClinicalEntryConcept(
        this.data.patient.id,
        {
          code: diagnosis.snomedConceptId,
          display: diagnosis.text
        }
      );

      condition.recordedDate = new Date(deceasedDateTime).toISOString();
      condition.onsetDateTime = new Date(deceasedDateTime).toISOString();
      if (diagnosis.snomedConceptId) {
        this.patientService.setConditionSnomedCoding(condition, {
          code: diagnosis.snomedConceptId,
          display: diagnosis.snomedDisplay || diagnosis.text
        });
      }
      if (diagnosis.icd10Code) {
        this.patientService.setConditionIcd10Coding(condition, { code: diagnosis.icd10Code });
      }
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

      const savedCondition = await this.patientService.addPatientConditionAllowDuplicatesEnriched(this.data.patient.id, condition);
      diagnosis.sourceType = 'existing-condition';
      diagnosis.sourceConditionId = savedCondition.id;
      diagnosis.derivedConditionId = undefined;
    }

    return diagnoses;
  }

  private getConditionById(conditionId?: string): Condition | undefined {
    if (!conditionId) {
      return undefined;
    }

    return this.data.conditions.find(condition => condition.id === conditionId);
  }

  getConditionDisplayText(condition: Condition): string {
    if (condition.code?.text) {
      return condition.code.text;
    }
    const snomed = this.patientService.getConditionSnomedCoding(condition);
    if (snomed?.display) {
      return snomed.display;
    }
    return condition.code?.coding?.find(c => c.display)?.display || condition.id || '';
  }

  private getConditionSnomed(condition: Condition): { code?: string; display?: string } {
    const coding = this.patientService.getConditionSnomedCoding(condition) || condition.code?.coding?.[0];

    return {
      code: coding?.code,
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

  private populatePreviewIcd10(line: DeathDiagnosisFormLine, snomedConceptId: string): void {
    this.resolveIcd10Code(snomedConceptId).then(code => {
      line.previewIcd10Code = code || '';
    });
  }

  private buildDeathCertificateBundle(
    part1: Array<DeathRecordDiagnosis & { line: Part1LineCode }>,
    part2: DeathRecordDiagnosis[],
    deceasedDateTime: string
  ): DeathRecord {
    const bundleId = this.data.existingRecord?.id || `death-certificate-bundle-${Date.now()}`;
    const bundleIdentifier = this.data.existingRecord?.identifier?.value || `${new Date(deceasedDateTime).getFullYear()}UY${this.data.patient.id.slice(-6).padStart(6, '0')}`;
    const compositionId = `death-certificate-composition-${this.data.patient.id}`;
    const practitionerId = `death-certifier-${this.data.patient.id}`;
    const procedureId = `death-certification-procedure-${this.data.patient.id}`;
    const patientResource = this.buildDecedentResource();
    const practitionerResource = this.buildCertifierResource(practitionerId);
    const procedureResource = this.buildDeathCertificationProcedure(procedureId, practitionerId, deceasedDateTime);
    const part1Observations = part1.map(item => this.buildCauseOfDeathPart1Observation(item, practitionerId, deceasedDateTime));
    const part2Observations = part2.map(item => this.buildCauseOfDeathPart2Observation(item, practitionerId, deceasedDateTime));
    const compositionResource = this.buildCompositionResource(
      compositionId,
      practitionerId,
      procedureId,
      deceasedDateTime,
      part1Observations,
      part2Observations
    );

    const entries = [
      { fullUrl: `urn:uuid:${compositionId}`, resource: compositionResource },
      { fullUrl: `Patient/${this.data.patient.id}`, resource: patientResource },
      { fullUrl: `urn:uuid:${practitionerId}`, resource: practitionerResource },
      { fullUrl: `urn:uuid:${procedureId}`, resource: procedureResource },
      ...part1Observations.map(resource => ({ fullUrl: `urn:uuid:${resource.id}`, resource })),
      ...part2Observations.map(resource => ({ fullUrl: `urn:uuid:${resource.id}`, resource }))
    ];

    return {
      resourceType: 'Bundle',
      id: bundleId,
      authored: new Date().toISOString(),
      meta: {
        profile: [this.VRDR_DOCUMENT_PROFILE]
      },
      identifier: {
        system: 'http://example.org/fhir/identifiers/death-certificate-document',
        value: bundleIdentifier
      },
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: entries
    };
  }

  private buildDecedentResource(): any {
    return {
      ...this.data.patient,
      meta: {
        profile: [this.VRDR_DECEDENT_PROFILE]
      }
    };
  }

  private buildCertifierResource(practitionerId: string): any {
    return {
      resourceType: 'Practitioner',
      id: practitionerId,
      name: [
        {
          text: 'Unknown certifier'
        }
      ]
    };
  }

  private buildDeathCertificationProcedure(procedureId: string, practitionerId: string, deceasedDateTime: string): any {
    return {
      resourceType: 'Procedure',
      id: procedureId,
      meta: {
        profile: [this.VRDR_DEATH_CERTIFICATION_PROCEDURE_PROFILE]
      },
      status: 'completed',
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '308646001',
            display: 'Death certification'
          }
        ],
        text: 'Death certification'
      },
      subject: {
        reference: `Patient/${this.data.patient.id}`
      },
      performedDateTime: deceasedDateTime,
      performer: [
        {
          actor: {
            reference: `urn:uuid:${practitionerId}`
          }
        }
      ]
    };
  }

  private buildCompositionResource(
    compositionId: string,
    practitionerId: string,
    procedureId: string,
    deceasedDateTime: string,
    part1Observations: any[],
    part2Observations: any[]
  ): any {
    return {
      resourceType: 'Composition',
      id: compositionId,
      meta: {
        profile: [this.VRDR_COMPOSITION_PROFILE]
      },
      status: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '64297-5',
            display: 'Death certificate'
          }
        ],
        text: 'Death certificate'
      },
      subject: {
        reference: `Patient/${this.data.patient.id}`
      },
      date: deceasedDateTime,
      author: [
        {
          reference: `urn:uuid:${practitionerId}`
        }
      ],
      title: 'Death Certificate Document',
      attester: [
        {
          mode: 'legal',
          time: deceasedDateTime,
          party: {
            reference: `urn:uuid:${practitionerId}`
          }
        }
      ],
      event: [
        {
          detail: [
            {
              reference: `urn:uuid:${procedureId}`
            }
          ]
        }
      ],
      section: [
        {
          title: 'Cause of Death Part I',
          entry: part1Observations.map(observation => ({ reference: `urn:uuid:${observation.id}` }))
        },
        {
          title: 'Other Significant Conditions',
          entry: part2Observations.map(observation => ({ reference: `urn:uuid:${observation.id}` }))
        }
      ]
    };
  }

  private buildCauseOfDeathPart1Observation(
    diagnosis: DeathRecordDiagnosis & { line: Part1LineCode },
    practitionerId: string,
    deceasedDateTime: string
  ): any {
    const observationId = `cause-of-death-part1-${diagnosis.line}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      resourceType: 'Observation',
      id: observationId,
      meta: {
        profile: [this.VRDR_CAUSE_OF_DEATH_PART1_PROFILE]
      },
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '69453-9',
            display: 'Cause of death [US Standard Certificate of Death]'
          }
        ]
      },
      subject: {
        reference: `Patient/${this.data.patient.id}`
      },
      performer: [
        {
          reference: `urn:uuid:${practitionerId}`
        }
      ],
      effectiveDateTime: deceasedDateTime,
      valueCodeableConcept: {
        coding: this.buildDiagnosisCodings(diagnosis),
        text: diagnosis.text
      },
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://hl7.org/fhir/us/vrdr/CodeSystem/vrdr-component-cs',
                code: 'lineNumber',
                display: 'line number'
              }
            ]
          },
          valueInteger: this.part1LineToInteger(diagnosis.line)
        },
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '69440-6',
                display: 'Disease onset to death interval'
              }
            ]
          },
          valueString: diagnosis.intervalText || ''
        }
      ],
      extension: this.buildDiagnosisExtensions(diagnosis)
    };
  }

  private buildCauseOfDeathPart2Observation(
    diagnosis: DeathRecordDiagnosis,
    practitionerId: string,
    deceasedDateTime: string
  ): any {
    const observationId = `cause-of-death-part2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      resourceType: 'Observation',
      id: observationId,
      meta: {
        profile: [this.VRDR_CAUSE_OF_DEATH_PART2_PROFILE]
      },
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '69441-4',
            display: 'Other significant causes or conditions of death'
          }
        ]
      },
      subject: {
        reference: `Patient/${this.data.patient.id}`
      },
      performer: [
        {
          reference: `urn:uuid:${practitionerId}`
        }
      ],
      effectiveDateTime: deceasedDateTime,
      valueCodeableConcept: {
        coding: this.buildDiagnosisCodings(diagnosis),
        text: diagnosis.text
      },
      component: diagnosis.intervalText ? [
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '69440-6',
                display: 'Disease onset to death interval'
              }
            ]
          },
          valueString: diagnosis.intervalText
        }
      ] : undefined,
      extension: this.buildDiagnosisExtensions(diagnosis)
    };
  }

  private buildDiagnosisCodings(diagnosis: DeathRecordDiagnosis): any[] {
    const codings: any[] = [];
    if (diagnosis.snomedConceptId) {
      codings.push({
        system: 'http://snomed.info/sct',
        code: diagnosis.snomedConceptId,
        display: diagnosis.snomedDisplay || diagnosis.text
      });
    }
    if (diagnosis.icd10Code) {
      codings.push({
        system: 'http://hl7.org/fhir/sid/icd-10',
        code: diagnosis.icd10Code
      });
    }
    return codings;
  }

  private buildDiagnosisExtensions(diagnosis: DeathRecordDiagnosis): any[] {
    const extensions: any[] = [
      {
        url: this.UI_SOURCE_TYPE_EXTENSION,
        valueString: diagnosis.sourceType
      }
    ];

    if (diagnosis.sourceConditionId) {
      extensions.push({
        url: this.UI_SOURCE_CONDITION_EXTENSION,
        valueString: diagnosis.sourceConditionId
      });
    }

    if (diagnosis.derivedConditionId) {
      extensions.push({
        url: this.UI_DERIVED_CONDITION_EXTENSION,
        valueString: diagnosis.derivedConditionId
      });
    }

    return extensions;
  }

  private getBundleDeceasedDateTime(bundle: DeathRecord): Date | null {
    const composition = bundle.entry.find(entry => entry.resource?.resourceType === 'Composition')?.resource;
    const procedure = bundle.entry.find(entry => entry.resource?.resourceType === 'Procedure')?.resource;
    const candidate = composition?.date || composition?.attester?.[0]?.time || procedure?.performedDateTime || bundle.timestamp;
    return candidate ? new Date(candidate) : null;
  }

  private getBundleDiagnoses(bundle: DeathRecord, section: 'part1' | 'part2'): Array<DeathRecordDiagnosis & { line?: Part1LineCode }> {
    const targetProfile = section === 'part1' ? this.VRDR_CAUSE_OF_DEATH_PART1_PROFILE : this.VRDR_CAUSE_OF_DEATH_PART2_PROFILE;
    return bundle.entry
      .map(entry => entry.resource)
      .filter(resource => resource?.resourceType === 'Observation' && resource?.meta?.profile?.includes(targetProfile))
      .map(resource => this.mapObservationToDiagnosis(resource, section));
  }

  private mapObservationToDiagnosis(resource: any, section: 'part1' | 'part2'): DeathRecordDiagnosis & { line?: Part1LineCode } {
    const valueCoding = resource?.valueCodeableConcept?.coding || [];
    const snomedCoding = valueCoding.find((coding: any) => coding.system === 'http://snomed.info/sct');
    const icd10Coding = valueCoding.find((coding: any) => coding.system === 'http://hl7.org/fhir/sid/icd-10');
    const intervalComponent = resource?.component?.find((component: any) =>
      component?.code?.coding?.some((coding: any) => coding.code === '69440-6')
    );
    const lineComponent = resource?.component?.find((component: any) =>
      component?.code?.coding?.some((coding: any) => coding.code === 'lineNumber')
    );

    return {
      sourceType: this.getExtensionString(resource, this.UI_SOURCE_TYPE_EXTENSION) === 'snomed-search' ? 'snomed-search' : 'existing-condition',
      sourceConditionId: this.getExtensionString(resource, this.UI_SOURCE_CONDITION_EXTENSION) || undefined,
      derivedConditionId: this.getExtensionString(resource, this.UI_DERIVED_CONDITION_EXTENSION) || undefined,
      text: resource?.valueCodeableConcept?.text || snomedCoding?.display || '',
      intervalText: intervalComponent?.valueString || '',
      snomedConceptId: snomedCoding?.code,
      snomedDisplay: snomedCoding?.display || resource?.valueCodeableConcept?.text,
      icd10Code: icd10Coding?.code,
      line: section === 'part1' ? this.integerToPart1Line(lineComponent?.valueInteger) : undefined
    };
  }

  private getExtensionString(resource: any, url: string): string {
    return resource?.extension?.find((extension: any) => extension.url === url)?.valueString || '';
  }

  private part1LineToInteger(line: Part1LineCode): number {
    return { a: 1, b: 2, c: 3, d: 4 }[line];
  }

  private integerToPart1Line(value?: number): Part1LineCode | undefined {
    return ({ 1: 'a', 2: 'b', 3: 'c', 4: 'd' } as Record<number, Part1LineCode | undefined>)[value || 0];
  }

  private hasMeaningfulContent(line: DeathDiagnosisFormLine): boolean {
    return !!(
      line.selectedConditionId ||
      line.selectedConcept?.code ||
      line.intervalText.trim()
    );
  }

  private hasPart2MeaningfulContent(line: DeathDiagnosisFormLine): boolean {
    return !!(
      line.selectedConditionId ||
      line.selectedConcept?.code
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
