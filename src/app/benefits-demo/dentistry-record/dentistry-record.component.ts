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
  surfaceCode: string;
  surfaceDisplay: string;
  findingCode: string;
  findingDisplay: string;
  recordedDateTime: string;
}

type SurfaceDirection = 'top' | 'bottom' | 'left' | 'right';

@Component({
  selector: 'app-dentistry-record',
  templateUrl: './dentistry-record.component.html',
  styleUrls: ['./dentistry-record.component.css'],
  standalone: false
})
export class DentistryRecordComponent implements OnChanges {
  @Input() patient: Patient | null = null;

  private readonly DENTAL_FINDING_CONCEPT_CODE = '278544002';
  readonly SURFACE_CODE_MESIAL = '8483002';
  readonly SURFACE_CODE_DISTAL = '90933009';
  readonly SURFACE_CODE_OCCLUSAL = '83473006';
  readonly SURFACE_CODE_LINGUAL = '72203008';
  readonly SURFACE_CODE_VESTIBULAR = '62579006';
  readonly SURFACE_CODE_COMPLETE = '302214001';

  pinnedTooth: OdontogramTooth | null = null;
  hoveredTooth: OdontogramTooth | null = null;
  tooltipX = 0;
  tooltipY = 0;

  toothDraftById: Record<string, ToothFindingEntry> = {};
  findingQueryByToothId: Record<string, string> = {};
  saveFeedbackByToothId: Record<string, boolean> = {};

  dentalObservationList: DentalObservationListItem[] = [];
  savedSurfaceByToothId: Record<string, Record<string, boolean>> = {};

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
    if (!changes['patient']) {
      return;
    }

    const nextPatient = changes['patient'].currentValue as Patient | null;
    const prevPatient = changes['patient'].previousValue as Patient | null;

    if (!nextPatient) {
      this.resetDentalState();
      return;
    }

    if (!prevPatient || prevPatient.id !== nextPatient.id) {
      this.resetDentalState();
      this.refreshDentalObservationList(nextPatient.id);
    }
  }

  getTeethForQuadrant(prefix: string): OdontogramTooth[] {
    return this.teethByQuadrant[prefix] || [];
  }

  pinTooth(tooth: OdontogramTooth): void {
    const previousToothId = this.pinnedTooth?.id;
    if (previousToothId && previousToothId !== tooth.id) {
      this.clearToothDraft(previousToothId);
    }

    this.pinnedTooth = tooth;

    if (!this.toothDraftById[tooth.id]) {
      this.toothDraftById[tooth.id] = {};
    }

    if (this.findingQueryByToothId[tooth.id] === undefined) {
      this.findingQueryByToothId[tooth.id] = '';
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

  hasSavedSurface(toothId: string, surfaceCode: string): boolean {
    return !!this.savedSurfaceByToothId[toothId]?.[surfaceCode];
  }

  hasSurfaceVisual(toothId: string, surfaceCode: string): boolean {
    return this.hasSavedSurface(toothId, surfaceCode) || this.isSurfacePreview(toothId, surfaceCode);
  }

  isSurfacePreview(toothId: string, surfaceCode: string): boolean {
    if (!this.pinnedTooth || this.pinnedTooth.id !== toothId) {
      return false;
    }
    const draft = this.getPinnedToothDraftEntry();
    return !!draft?.surfaceCode && draft.surfaceCode === surfaceCode;
  }

  getSurfaceFill(surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string): string {
    if (surfaceCode === this.SURFACE_CODE_COMPLETE) {
      return 'rgba(223, 123, 0, 0.58)';
    }

    if (surfaceCode === this.SURFACE_CODE_VESTIBULAR) {
      const vestibularLocalDirection = this.getVestibularLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `url(#surface-vestibular-${vestibularLocalDirection})`;
    }

    if (surfaceCode === this.SURFACE_CODE_LINGUAL) {
      const lingualLocalDirection = this.getLingualLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `url(#surface-lingual-${lingualLocalDirection})`;
    }

    if (surfaceCode === this.SURFACE_CODE_OCCLUSAL) {
      return 'url(#surface-occlusal-center)';
    }

    if (surfaceCode === this.SURFACE_CODE_MESIAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return 'url(#surface-left-gradient)';
      }
      if (mesialLocalDirection === 'right') {
        return 'url(#surface-right-gradient)';
      }
      return mesialLocalDirection === 'top' ? 'url(#surface-top-gradient)' : 'url(#surface-bottom-gradient)';
    }

    if (surfaceCode === this.SURFACE_CODE_DISTAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return 'url(#surface-right-gradient)';
      }
      if (mesialLocalDirection === 'right') {
        return 'url(#surface-left-gradient)';
      }
      return mesialLocalDirection === 'top' ? 'url(#surface-bottom-gradient)' : 'url(#surface-top-gradient)';
    }

    return 'rgba(76, 175, 220, 0.5)';
  }

  getSurfaceOverlayClass(surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string): string {
    if (surfaceCode === this.SURFACE_CODE_MESIAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return 'overlay-mesial-left';
      }
      if (mesialLocalDirection === 'right') {
        return 'overlay-mesial-right';
      }
      return mesialLocalDirection === 'top' ? 'overlay-mesial-top' : 'overlay-mesial-bottom';
    }
    if (surfaceCode === this.SURFACE_CODE_DISTAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return 'overlay-distal-right';
      }
      if (mesialLocalDirection === 'right') {
        return 'overlay-distal-left';
      }
      return mesialLocalDirection === 'top' ? 'overlay-distal-bottom' : 'overlay-distal-top';
    }
    if (surfaceCode === this.SURFACE_CODE_VESTIBULAR) {
      const vestibularLocalDirection = this.getVestibularLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `overlay-vestibular-${vestibularLocalDirection}`;
    }
    if (surfaceCode === this.SURFACE_CODE_LINGUAL) {
      const lingualLocalDirection = this.getLingualLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `overlay-lingual-${lingualLocalDirection}`;
    }
    if (surfaceCode === this.SURFACE_CODE_OCCLUSAL) {
      return 'overlay-occlusal';
    }
    if (surfaceCode === this.SURFACE_CODE_COMPLETE) {
      return 'overlay-entire-tooth';
    }
    return '';
  }

  getSurfaceOverlayPath(surfaceCode: string, tooth: OdontogramTooth): string {
    if (surfaceCode === this.SURFACE_CODE_COMPLETE) {
      return tooth.outlinePath;
    }
    return tooth.shadowPath;
  }

  // Mesial/Distal follow the arch progression toward the midline.
  // In this simplified frontal SVG:
  // - Anterior teeth (1-3: incisors/canine): mesial behaves horizontally (left/right).
  // - Posterior teeth (4-8: premolars/molars): mesial behaves vertically (top/bottom).
  getMesialDirectionFromFDI(fdi: string | number): SurfaceDirection {
    const fdiString = String(fdi).trim();
    const quadrant = fdiString.charAt(0);
    const toothNumber = Number.parseInt(fdiString.charAt(1), 10);

    if (Number.isFinite(toothNumber) && toothNumber >= 1 && toothNumber <= 3) {
      return quadrant === '1' || quadrant === '3' ? 'right' : 'left';
    }

    return quadrant === '1' || quadrant === '2' ? 'top' : 'bottom';
  }

  // Lingual/vestibular use the same "piece zone" model:
  // - Posterior teeth (4-8): lingual is inside the mouth (Q1 right), mirrored by quadrant.
  // - Anterior teeth (1-3): lingual is vertical (Q1 down), mirrored by lower arch inversion.
  getLingualDirectionFromFDI(fdi: string | number): SurfaceDirection {
    const fdiString = String(fdi).trim();
    const quadrant = fdiString.charAt(0);
    const toothNumber = Number.parseInt(fdiString.charAt(1), 10);
    const isAnterior = Number.isFinite(toothNumber) && toothNumber >= 1 && toothNumber <= 3;

    if (isAnterior) {
      return quadrant === '1' || quadrant === '2' ? 'bottom' : 'top';
    }

    return quadrant === '1' || quadrant === '3' ? 'right' : 'left';
  }

  getVestibularDirectionFromFDI(fdi: string | number): SurfaceDirection {
    return this.getOppositeDirection(this.getLingualDirectionFromFDI(fdi));
  }

  // SVG teeth are defined in local coordinates and quadrants can be mirrored.
  // Convert mesial screen direction into local direction before choosing the overlay.
  private getMesialLocalDirection(fdi: string | number, quadrantPrefix: string): SurfaceDirection {
    const screenDirection = this.getMesialDirectionFromFDI(fdi);
    return this.toLocalDirection(screenDirection, quadrantPrefix);
  }

  private getLingualLocalDirection(fdi: string | number, quadrantPrefix: string): SurfaceDirection {
    const screenDirection = this.getLingualDirectionFromFDI(fdi);
    return this.toLocalDirection(screenDirection, quadrantPrefix);
  }

  private getVestibularLocalDirection(fdi: string | number, quadrantPrefix: string): SurfaceDirection {
    const screenDirection = this.getVestibularDirectionFromFDI(fdi);
    return this.toLocalDirection(screenDirection, quadrantPrefix);
  }

  private toLocalDirection(screenDirection: SurfaceDirection, quadrantPrefix: string): SurfaceDirection {
    const isMirroredOnX = quadrantPrefix === '2' || quadrantPrefix === '4';
    const isMirroredOnY = quadrantPrefix === '3' || quadrantPrefix === '4';

    if (screenDirection === 'left' || screenDirection === 'right') {
      if (!isMirroredOnX) {
        return screenDirection;
      }
      return screenDirection === 'left' ? 'right' : 'left';
    }

    if (!isMirroredOnY) {
      return screenDirection;
    }
    return screenDirection === 'top' ? 'bottom' : 'top';
  }

  private getOppositeDirection(direction: SurfaceDirection): SurfaceDirection {
    if (direction === 'top') {
      return 'bottom';
    }
    if (direction === 'bottom') {
      return 'top';
    }
    return direction === 'left' ? 'right' : 'left';
  }

  trackByToothId(_: number, tooth: OdontogramTooth): string {
    return tooth.id;
  }

  getPinnedToothDraftEntry(): ToothFindingEntry | null {
    if (!this.pinnedTooth) {
      return null;
    }
    return this.toothDraftById[this.pinnedTooth.id] || null;
  }

  getPinnedSurfaceCode(): string {
    return this.getPinnedToothDraftEntry()?.surfaceCode || '';
  }

  getPinnedFindingCode(): string {
    return this.getPinnedToothDraftEntry()?.findingCode || '';
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

    const current = this.toothDraftById[this.pinnedTooth.id] || {};
    const nextSurfaceCode = surfaceCode || undefined;
    const nextIsEntireSurface = nextSurfaceCode === this.SURFACE_CODE_COMPLETE;
    const currentFinding = this.findingOptions.find((item) => item.code === current.findingCode);
    const isCurrentFindingCompatible = !currentFinding || !!currentFinding.entire === nextIsEntireSurface;

    this.toothDraftById[this.pinnedTooth.id] = {
      ...current,
      surfaceCode: nextSurfaceCode,
      findingCode: isCurrentFindingCompatible ? current.findingCode : undefined
    };

    if (!isCurrentFindingCompatible) {
      this.findingQueryByToothId[this.pinnedTooth.id] = '';
    }

    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  onFindingInputChange(query: string): void {
    if (!this.pinnedTooth) {
      return;
    }

    this.findingQueryByToothId[this.pinnedTooth.id] = query;
    const current = this.toothDraftById[this.pinnedTooth.id] || {};
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: undefined };
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  onFindingSelected(findingCode: string): void {
    if (!this.pinnedTooth) {
      return;
    }

    const option = this.findingOptions.find((item) => item.code === findingCode);
    const current = this.toothDraftById[this.pinnedTooth.id] || {};
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: findingCode || undefined };
    this.findingQueryByToothId[this.pinnedTooth.id] = option ? option.display : '';
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  getFilteredFindingOptions(): SnomedConceptOption[] {
    const isEntireSurface = this.getPinnedSurfaceCode() === this.SURFACE_CODE_COMPLETE;
    const compatibleOptions = this.findingOptions.filter((option) => !!option.entire === isEntireSurface);
    const query = this.getPinnedFindingQuery().trim().toLowerCase();

    if (!query) {
      return this.sortFindingOptionsByDisplayLength(compatibleOptions);
    }

    const queryTokens = this.tokenize(query);
    const filtered = compatibleOptions.filter((option) => this.matchesMultiPrefix(option.display, queryTokens));
    return this.sortFindingOptionsByDisplayLength(filtered);
  }

  canSavePinnedFindingEntry(): boolean {
    const entry = this.getPinnedToothDraftEntry();
    return !!entry?.surfaceCode && !!entry?.findingCode;
  }

  savePinnedFindingEntry(): void {
    if (!this.patient || !this.pinnedTooth || !this.canSavePinnedFindingEntry()) {
      return;
    }

    const entry = this.getPinnedToothDraftEntry();
    if (!entry?.surfaceCode || !entry.findingCode) {
      return;
    }

    const observation = this.buildDentalObservation(this.patient.id, this.pinnedTooth, entry);
    if (!observation) {
      return;
    }

    const added = this.patientService.addPatientObservation(this.patient.id, observation);
    if (!added) {
      return;
    }

    this.saveFeedbackByToothId[this.pinnedTooth.id] = true;
    this.clearToothDraft(this.pinnedTooth.id);
    this.refreshDentalObservationList(this.patient.id);
  }

  isPinnedEntrySaved(): boolean {
    if (!this.pinnedTooth) {
      return false;
    }
    return !!this.saveFeedbackByToothId[this.pinnedTooth.id];
  }

  getDentalObservationList(): DentalObservationListItem[] {
    return this.dentalObservationList;
  }

  getPinnedToothSavedFindings(): DentalObservationListItem[] {
    if (!this.pinnedTooth) {
      return [];
    }
    return this.dentalObservationList.filter((item) => item.toothId === this.pinnedTooth?.id);
  }

  focusObservationTooth(item: DentalObservationListItem): void {
    const tooth = this.findToothById(item.toothId);
    if (!tooth) {
      return;
    }
    this.pinTooth(tooth);
  }

  deleteSavedFinding(item: DentalObservationListItem): void {
    if (!this.patient || !item.observationId) {
      return;
    }

    this.patientService.deletePatientObservation(this.patient.id, item.observationId);
    this.refreshDentalObservationList(this.patient.id);
    if (this.pinnedTooth) {
      this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    }
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
    this.toothDraftById = {};
    this.findingQueryByToothId = {};
    this.saveFeedbackByToothId = {};
    this.dentalObservationList = [];
    this.savedSurfaceByToothId = {};
  }

  private buildDentalObservation(patientId: string, tooth: OdontogramTooth, entry: ToothFindingEntry): FhirObservation | null {
    const toothStructure = tooth.snomedStructure;
    const surface = this.surfaceOptions.find((option) => option.code === entry.surfaceCode);
    const finding = this.findingOptions.find((option) => option.code === entry.findingCode);

    if (!toothStructure || !surface || !finding) {
      return null;
    }

    const now = new Date().toISOString();

    return {
      resourceType: 'Observation',
      id: `observation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  private refreshDentalObservationList(patientId: string): void {
    const observations = this.patientService.getPatientObservations(patientId);
    this.savedSurfaceByToothId = {};

    this.dentalObservationList = observations
      .filter((observation) => this.isDentalFindingObservation(observation))
      .map((observation) => {
        const toothCode = observation.bodySite?.[0]?.coding?.[0]?.code || '';
        const toothId = this.toothIdBySnomedCode[toothCode] || '';
        const tooth = toothId ? this.findToothById(toothId) : null;
        const surfaceCode = observation.bodySite?.[1]?.coding?.[0]?.code || '';
        const findingCode = observation.valueCodeableConcept?.coding?.[0]?.code || '';

        if (toothId && surfaceCode) {
          this.savedSurfaceByToothId[toothId] = this.savedSurfaceByToothId[toothId] || {};
          this.savedSurfaceByToothId[toothId][surfaceCode] = true;
        }

        return {
          observationId: observation.id,
          toothId,
          toothFdi: tooth?.notations.fdi || 'Unknown',
          surfaceCode,
          surfaceDisplay: observation.bodySite?.[1]?.coding?.[0]?.display || observation.bodySite?.[1]?.text || 'Not specified',
          findingCode,
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

  private clearToothDraft(toothId: string): void {
    delete this.toothDraftById[toothId];
    delete this.findingQueryByToothId[toothId];
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

  private sortFindingOptionsByDisplayLength(options: SnomedConceptOption[]): SnomedConceptOption[] {
    return [...options].sort((a, b) => {
      const byLength = a.display.length - b.display.length;
      if (byLength !== 0) {
        return byLength;
      }
      return a.display.localeCompare(b.display);
    });
  }
}
