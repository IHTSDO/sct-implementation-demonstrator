import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FhirObservation, Patient, PatientService } from '../../services/patient.service';
import { BASE_TEETH } from './data/tooth-data';
import { OdontogramTooth, SnomedConceptOption, ToothFindingEntry } from './models/tooth.model';
import { getToothNotations } from './utils/tooth-notation.utils';
import { FDI_TO_SNOMED_STRUCTURE_MAP } from './data/fdi-snomed-structure-map';
import { DENTAL_SURFACE_OPTIONS } from './data/dental-surface-options';
import { DENTAL_FINDING_OPTIONS } from './data/dental-finding-options';

interface QuadrantConfig {
  key: string;
  label: string;
  prefix: string;
  transform: string;
}

interface DentalObservationListItem {
  observationId: string;
  toothId: string;
  toothFdi: string;
  surfaceDisplay: string;
  findingDisplay: string;
  recordedDateTime: string;
}

@Component({
  selector: 'app-dentistry-record',
  templateUrl: './dentistry-record.component.html',
  styleUrls: ['./dentistry-record.component.css'],
  standalone: false
})
export class DentistryRecordComponent implements OnChanges {
  @Input() patient: Patient | null = null;
  private readonly DENTAL_FINDING_CONCEPT_CODE = '278544002';

  pinnedTooth: OdontogramTooth | null = null;
  hoveredTooth: OdontogramTooth | null = null;
  tooltipX = 0;
  tooltipY = 0;
  toothFindingById: Record<string, ToothFindingEntry> = {};
  findingQueryByToothId: Record<string, string> = {};
  savedEntryByToothId: Record<string, boolean> = {};
  dentalObservationList: DentalObservationListItem[] = [];
  readonly surfaceOptions: SnomedConceptOption[] = DENTAL_SURFACE_OPTIONS;
  readonly findingOptions: SnomedConceptOption[] = DENTAL_FINDING_OPTIONS;
  readonly quadrants: QuadrantConfig[] = [
    { key: 'upper-right', label: 'Upper Right', prefix: '1', transform: '' },
    { key: 'upper-left', label: 'Upper Left', prefix: '2', transform: 'scale(-1, 1) translate(-409, 0)' },
    { key: 'lower-right', label: 'Lower Right', prefix: '3', transform: 'scale(1, -1) translate(0, -694)' },
    { key: 'lower-left', label: 'Lower Left', prefix: '4', transform: 'scale(-1, -1) translate(-409, -694)' }
  ];
  readonly teethByQuadrant = this.buildTeethByQuadrant();
  readonly toothIdBySnomedCode = this.buildToothIdBySnomedCodeMap();

  constructor(private patientService: PatientService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) {
      const nextPatient = changes['patient'].currentValue as Patient | null;
      const prevPatient = changes['patient'].previousValue as Patient | null;

      if (!nextPatient) {
        this.resetDentalState();
        return;
      }

      if (!prevPatient || prevPatient.id !== nextPatient.id) {
        this.resetDentalState();
        this.loadSavedDentalObservations(nextPatient.id);
      }
    }
  }

  getTeethForQuadrant(prefix: string): OdontogramTooth[] {
    return this.teethByQuadrant[prefix] || [];
  }

  pinTooth(tooth: OdontogramTooth): void {
    this.pinnedTooth = tooth;
    if (!this.toothFindingById[tooth.id]) {
      this.toothFindingById[tooth.id] = {};
    }
    if (this.findingQueryByToothId[tooth.id] === undefined) {
      const code = this.toothFindingById[tooth.id]?.findingCode;
      const option = this.findingOptions.find((item) => item.code === code);
      this.findingQueryByToothId[tooth.id] = option ? option.display : '';
    }
  }

  onToothMouseEnter(tooth: OdontogramTooth, event: MouseEvent): void {
    this.hoveredTooth = tooth;
    this.updateTooltipPosition(event);
  }

  onToothMouseMove(event: MouseEvent): void {
    if (!this.hoveredTooth) {
      return;
    }
    this.updateTooltipPosition(event);
  }

  onToothMouseLeave(): void {
    this.hoveredTooth = null;
  }

  isSelected(toothId: string): boolean {
    return this.pinnedTooth?.id === toothId;
  }

  getLinePaths(tooth: OdontogramTooth): string[] {
    return Array.isArray(tooth.lineHighlightPath) ? tooth.lineHighlightPath : [tooth.lineHighlightPath];
  }

  trackByToothId(_: number, tooth: OdontogramTooth): string {
    return tooth.id;
  }

  getPinnedToothFindingEntry(): ToothFindingEntry | null {
    if (!this.pinnedTooth) {
      return null;
    }
    return this.toothFindingById[this.pinnedTooth.id] || null;
  }

  getPinnedSurfaceCode(): string {
    return this.getPinnedToothFindingEntry()?.surfaceCode || '';
  }

  getPinnedFindingCode(): string {
    return this.getPinnedToothFindingEntry()?.findingCode || '';
  }

  getPinnedFindingQuery(): string {
    if (!this.pinnedTooth) {
      return '';
    }
    return this.findingQueryByToothId[this.pinnedTooth.id] || '';
  }

  onSurfaceChange(surfaceCode: string): void {
    if (!this.pinnedTooth) {
      return;
    }
    const current = this.toothFindingById[this.pinnedTooth.id] || {};
    this.toothFindingById[this.pinnedTooth.id] = { ...current, surfaceCode: surfaceCode || undefined };
    this.savedEntryByToothId[this.pinnedTooth.id] = false;
  }

  onFindingInputChange(query: string): void {
    if (!this.pinnedTooth) {
      return;
    }
    this.findingQueryByToothId[this.pinnedTooth.id] = query;
    const current = this.toothFindingById[this.pinnedTooth.id] || {};
    this.toothFindingById[this.pinnedTooth.id] = { ...current, findingCode: undefined };
    this.savedEntryByToothId[this.pinnedTooth.id] = false;
  }

  onFindingSelected(findingCode: string): void {
    if (!this.pinnedTooth) {
      return;
    }
    const option = this.findingOptions.find((item) => item.code === findingCode);
    const current = this.toothFindingById[this.pinnedTooth.id] || {};
    this.toothFindingById[this.pinnedTooth.id] = { ...current, findingCode: findingCode || undefined };
    this.findingQueryByToothId[this.pinnedTooth.id] = option ? option.display : '';
    this.savedEntryByToothId[this.pinnedTooth.id] = false;
  }

  getFilteredFindingOptions(): SnomedConceptOption[] {
    const query = this.getPinnedFindingQuery().trim().toLowerCase();
    if (!query) {
      return this.findingOptions;
    }
    const queryTokens = this.tokenize(query);
    return this.findingOptions.filter((option) => this.matchesMultiPrefix(option.display, queryTokens));
  }

  canSavePinnedFindingEntry(): boolean {
    const entry = this.getPinnedToothFindingEntry();
    return !!entry?.surfaceCode && !!entry?.findingCode;
  }

  savePinnedFindingEntry(): void {
    if (!this.patient || !this.pinnedTooth || !this.canSavePinnedFindingEntry()) {
      return;
    }

    const entry = this.getPinnedToothFindingEntry();
    if (!entry?.surfaceCode || !entry.findingCode) {
      return;
    }

    const observation = this.buildDentalObservation(this.patient.id, this.pinnedTooth, entry);
    if (!observation) {
      return;
    }

    if (entry.observationId) {
      this.patientService.updatePatientObservation(this.patient.id, entry.observationId, observation);
    } else {
      const added = this.patientService.addPatientObservation(this.patient.id, observation);
      if (!added) {
        const existingObservation = this.findExistingDentalObservation(this.patient.id, this.pinnedTooth.id, entry.surfaceCode, entry.findingCode);
        if (existingObservation) {
          entry.observationId = existingObservation.id;
          this.savedEntryByToothId[this.pinnedTooth.id] = true;
        }
        return;
      }
      entry.observationId = observation.id;
    }

    this.savedEntryByToothId[this.pinnedTooth.id] = true;
    this.refreshDentalObservationList(this.patient.id);
  }

  isPinnedEntrySaved(): boolean {
    if (!this.pinnedTooth) {
      return false;
    }
    return !!this.savedEntryByToothId[this.pinnedTooth.id];
  }

  getDentalObservationList(): DentalObservationListItem[] {
    return this.dentalObservationList;
  }

  focusObservationTooth(item: DentalObservationListItem): void {
    const tooth = this.findToothById(item.toothId);
    if (!tooth) {
      return;
    }
    this.pinTooth(tooth);
  }

  private buildTeethByQuadrant(): Record<string, OdontogramTooth[]> {
    return this.quadrants.reduce((acc, quadrant) => {
      acc[quadrant.prefix] = BASE_TEETH.map((tooth) => {
        const fdi = `${quadrant.prefix}${tooth.name}`;
        const id = `teeth-${fdi}`;

        return {
          ...tooth,
          id,
          notations: getToothNotations(id),
          snomedStructure: FDI_TO_SNOMED_STRUCTURE_MAP[fdi]
        };
      });
      return acc;
    }, {} as Record<string, OdontogramTooth[]>);
  }

  private buildToothIdBySnomedCodeMap(): Record<string, string> {
    const map: Record<string, string> = {};
    Object.values(this.teethByQuadrant).forEach((teeth) => {
      teeth.forEach((tooth) => {
        const code = tooth.snomedStructure?.code;
        if (code) {
          map[code] = tooth.id;
        }
      });
    });
    return map;
  }

  private resetDentalState(): void {
    this.pinnedTooth = null;
    this.hoveredTooth = null;
    this.toothFindingById = {};
    this.findingQueryByToothId = {};
    this.savedEntryByToothId = {};
    this.dentalObservationList = [];
  }

  private loadSavedDentalObservations(patientId: string): void {
    const observations = this.patientService.getPatientObservations(patientId);
    const latestObservationByToothId: Record<string, { observation: FhirObservation; timestamp: number }> = {};

    observations
      .filter((observation) => this.isDentalFindingObservation(observation))
      .forEach((observation) => {
        const toothCode = observation.bodySite?.[0]?.coding?.[0]?.code;
        const toothId = toothCode ? this.toothIdBySnomedCode[toothCode] : undefined;
        if (!toothId) {
          return;
        }
        const timestamp = this.getObservationTimestamp(observation);
        const current = latestObservationByToothId[toothId];
        if (!current || timestamp >= current.timestamp) {
          latestObservationByToothId[toothId] = { observation, timestamp };
        }
      });

    Object.entries(latestObservationByToothId).forEach(([toothId, data]) => {
      const observation = data.observation;
      const surfaceCode = observation.bodySite?.[1]?.coding?.[0]?.code;
      const findingCode = observation.valueCodeableConcept?.coding?.[0]?.code;
      if (!surfaceCode || !findingCode) {
        return;
      }

      this.toothFindingById[toothId] = {
        surfaceCode,
        findingCode,
        observationId: observation.id
      };

      const findingOption = this.findingOptions.find((option) => option.code === findingCode);
      this.findingQueryByToothId[toothId] = findingOption?.display || observation.valueCodeableConcept?.text || '';
      this.savedEntryByToothId[toothId] = true;
    });

    this.refreshDentalObservationList(patientId);
  }

  private buildDentalObservation(patientId: string, tooth: OdontogramTooth, entry: ToothFindingEntry): FhirObservation | null {
    const toothStructure = tooth.snomedStructure;
    const surface = this.surfaceOptions.find((option) => option.code === entry.surfaceCode);
    const finding = this.findingOptions.find((option) => option.code === entry.findingCode);

    if (!toothStructure || !surface || !finding) {
      return null;
    }

    const now = new Date().toISOString();
    const observationId = entry.observationId || `observation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
      resourceType: 'Observation',
      id: observationId,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'exam',
              display: 'Exam'
            }
          ],
          text: 'Dental'
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: this.DENTAL_FINDING_CONCEPT_CODE,
            display: 'Tooth finding'
          }
        ],
        text: 'Tooth finding'
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      effectiveDateTime: now,
      issued: now,
      bodySite: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: toothStructure.code,
              display: toothStructure.display
            }
          ],
          text: toothStructure.display
        },
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: surface.code,
              display: surface.display
            }
          ],
          text: surface.display
        }
      ],
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: finding.code,
            display: finding.display
          }
        ],
        text: finding.display
      },
      note: [
        {
          text: `Dental finding recorded for FDI tooth ${tooth.notations.fdi}.`
        }
      ]
    };
  }

  private findExistingDentalObservation(patientId: string, toothId: string, surfaceCode: string, findingCode: string): FhirObservation | null {
    const tooth = this.findToothById(toothId);
    if (!tooth?.snomedStructure?.code) {
      return null;
    }

    const observations = this.patientService.getPatientObservations(patientId);
    return observations.find((observation) =>
      this.isDentalFindingObservation(observation)
      && observation.bodySite?.[0]?.coding?.[0]?.code === tooth.snomedStructure?.code
      && observation.bodySite?.[1]?.coding?.[0]?.code === surfaceCode
      && observation.valueCodeableConcept?.coding?.[0]?.code === findingCode
    ) || null;
  }

  private findToothById(toothId: string): OdontogramTooth | null {
    for (const teeth of Object.values(this.teethByQuadrant)) {
      const match = teeth.find((tooth) => tooth.id === toothId);
      if (match) {
        return match;
      }
    }
    return null;
  }

  private isDentalFindingObservation(observation: FhirObservation): boolean {
    return observation.code?.coding?.some((coding) =>
      coding.system === 'http://snomed.info/sct' && coding.code === this.DENTAL_FINDING_CONCEPT_CODE
    ) || false;
  }

  private getObservationTimestamp(observation: FhirObservation): number {
    const rawDate = observation.effectiveDateTime || observation.issued;
    if (!rawDate) {
      return 0;
    }
    const timestamp = new Date(rawDate).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private refreshDentalObservationList(patientId: string): void {
    const observations = this.patientService.getPatientObservations(patientId);

    this.dentalObservationList = observations
      .filter((observation) => this.isDentalFindingObservation(observation))
      .map((observation) => {
        const toothCode = observation.bodySite?.[0]?.coding?.[0]?.code || '';
        const toothId = this.toothIdBySnomedCode[toothCode];
        const tooth = toothId ? this.findToothById(toothId) : null;
        return {
          observationId: observation.id,
          toothId: toothId || '',
          toothFdi: tooth?.notations.fdi || 'Unknown',
          surfaceDisplay: observation.bodySite?.[1]?.coding?.[0]?.display || observation.bodySite?.[1]?.text || 'Not specified',
          findingDisplay: observation.valueCodeableConcept?.coding?.[0]?.display || observation.valueCodeableConcept?.text || 'Not specified',
          recordedDateTime: observation.effectiveDateTime || observation.issued || ''
        };
      })
      .sort((a, b) => {
        const aTime = a.recordedDateTime ? new Date(a.recordedDateTime).getTime() : 0;
        const bTime = b.recordedDateTime ? new Date(b.recordedDateTime).getTime() : 0;
        return bTime - aTime;
      });
  }

  private updateTooltipPosition(event: MouseEvent): void {
    const offset = 16;
    this.tooltipX = event.clientX + offset;
    this.tooltipY = event.clientY - offset;
  }

  private matchesMultiPrefix(text: string, queryTokens: string[]): boolean {
    if (queryTokens.length === 0) {
      return true;
    }
    const words = this.tokenize(text);
    return queryTokens.every((token) => words.some((word) => word.startsWith(token)));
  }

  private tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }
}
