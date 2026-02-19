import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { BodyStructure, Condition, Patient, PatientService } from '../../services/patient.service';
import { BASE_TEETH } from './data/tooth-data';
import { FindingScope, OdontogramTooth, SnomedConceptOption, ToothFindingEntry } from './models/tooth.model';
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

interface DentalFindingListItem {
  conditionId: string;
  bodyStructureId: string;
  toothId: string;
  toothFdi: string;
  siteCodes: string[];
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

  private readonly DENTAL_CATEGORY_SYSTEM = 'http://example.org/fhir/CodeSystem/condition-category';
  private readonly DENTAL_CATEGORY_CODE = 'dental';
  readonly SURFACE_CODE_MESIAL = '8483002';
  readonly SURFACE_CODE_DISTAL = '90933009';
  readonly SURFACE_CODE_OCCLUSAL = '83473006';
  readonly SURFACE_CODE_LINGUAL = '72203008';
  readonly SURFACE_CODE_VESTIBULAR = '62579006';
  readonly SURFACE_CODE_COMPLETE = '302214001';
  readonly SURFACE_CODE_PERIODONTAL = '8711009';

  pinnedTooth: OdontogramTooth | null = null;
  hoveredTooth: OdontogramTooth | null = null;
  tooltipX = 0;
  tooltipY = 0;

  toothDraftById: Record<string, ToothFindingEntry> = {};
  findingQueryByToothId: Record<string, string> = {};
  saveFeedbackByToothId: Record<string, boolean> = {};

  dentalFindingList: DentalFindingListItem[] = [];
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
      this.refreshDentalFindingList(nextPatient.id);
    }
  }

  getTeethForQuadrant(prefix: string): OdontogramTooth[] {
    return this.teethByQuadrant[prefix] || [];
  }

  getSurfaceOnlyOptions(): SnomedConceptOption[] {
    return this.surfaceOptions.filter((option) => option.scope === 'surface');
  }

  pinTooth(tooth: OdontogramTooth): void {
    const previousToothId = this.pinnedTooth?.id;
    if (previousToothId && previousToothId !== tooth.id) {
      this.clearToothDraft(previousToothId);
    }

    this.pinnedTooth = tooth;

    if (!this.toothDraftById[tooth.id]) {
      this.toothDraftById[tooth.id] = { siteCodes: [] };
    }

    if (this.findingQueryByToothId[tooth.id] === undefined) {
      this.findingQueryByToothId[tooth.id] = '';
    }

    this.saveFeedbackByToothId[tooth.id] = false;
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
    const siteCodes = draft?.siteCodes || [];
    return siteCodes.includes(surfaceCode);
  }

  isPinnedSiteSelected(siteCode: string): boolean {
    return this.getPinnedSiteCodes().includes(siteCode);
  }

  getPinnedSiteCodes(): string[] {
    return this.getPinnedToothDraftEntry()?.siteCodes || [];
  }

  onExclusiveSiteToggle(siteCode: string, checked: boolean): void {
    if (!this.pinnedTooth) {
      return;
    }

    if (!checked) {
      this.onSiteSelectionChanged(this.getPinnedSiteCodes().filter((code) => code !== siteCode));
      return;
    }

    this.onSiteSelectionChanged([siteCode]);
  }

  onSurfaceSiteToggle(siteCode: string, checked: boolean): void {
    if (!this.pinnedTooth) {
      return;
    }

    const next = new Set(this.getPinnedSiteCodes());
    next.delete(this.SURFACE_CODE_COMPLETE);
    next.delete(this.SURFACE_CODE_PERIODONTAL);

    if (checked) {
      next.add(siteCode);
    } else {
      next.delete(siteCode);
    }

    this.onSiteSelectionChanged(this.getOrderedSiteCodes([...next]));
  }

  getSurfaceFill(surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string): string {
    if (surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return 'none';
    }

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
    if (surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return 'overlay-periodontal-ring';
    }

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
    if (surfaceCode === this.SURFACE_CODE_COMPLETE || surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return tooth.outlinePath;
    }
    return tooth.shadowPath;
  }

  getSurfaceStroke(surfaceCode: string): string | null {
    if (surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return 'rgba(244, 127, 36, 0.85)';
    }
    return null;
  }

  getSurfaceStrokeWidth(surfaceCode: string): string | null {
    if (surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return '3';
    }
    return null;
  }

  getMesialDirectionFromFDI(fdi: string | number): SurfaceDirection {
    const fdiString = String(fdi).trim();
    const quadrant = fdiString.charAt(0);
    const toothNumber = Number.parseInt(fdiString.charAt(1), 10);

    if (Number.isFinite(toothNumber) && toothNumber >= 1 && toothNumber <= 3) {
      return quadrant === '1' || quadrant === '3' ? 'right' : 'left';
    }

    return quadrant === '1' || quadrant === '2' ? 'top' : 'bottom';
  }

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

  trackByToothId(_: number, tooth: OdontogramTooth): string {
    return tooth.id;
  }

  getPinnedToothDraftEntry(): ToothFindingEntry | null {
    if (!this.pinnedTooth) {
      return null;
    }
    return this.toothDraftById[this.pinnedTooth.id] || null;
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

  onFindingInputChange(query: string): void {
    if (!this.pinnedTooth) {
      return;
    }

    this.findingQueryByToothId[this.pinnedTooth.id] = query;
    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [] };
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: undefined };
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  onFindingSelected(findingCode: string): void {
    if (!this.pinnedTooth) {
      return;
    }

    const option = this.findingOptions.find((item) => item.code === findingCode);
    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [] };
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: findingCode || undefined };
    this.findingQueryByToothId[this.pinnedTooth.id] = option ? option.display : '';
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  getFilteredFindingOptions(): SnomedConceptOption[] {
    const desiredScope = this.getFindingScopeForSiteCodes(this.getPinnedSiteCodes());
    if (!desiredScope) {
      return [];
    }

    const compatibleOptions = this.findingOptions.filter((option) => option.scope === desiredScope);
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
    return !!entry?.siteCodes?.length && !!entry?.findingCode;
  }

  savePinnedFindingEntry(): void {
    if (!this.patient || !this.pinnedTooth || !this.canSavePinnedFindingEntry()) {
      return;
    }

    const entry = this.getPinnedToothDraftEntry();
    if (!entry?.siteCodes?.length || !entry.findingCode) {
      return;
    }

    const resources = this.buildDentalConditionAndBodyStructure(this.patient.id, this.pinnedTooth, entry.siteCodes, entry.findingCode);
    if (!resources) {
      return;
    }

    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    this.patientService.addPatientBodyStructure(this.patient.id, resources.bodyStructure);
    this.patientService.addPatientConditionAllowDuplicates(this.patient.id, resources.condition);

    this.saveFeedbackByToothId[this.pinnedTooth.id] = true;
    this.clearToothDraft(this.pinnedTooth.id);
    this.refreshDentalFindingList(this.patient.id);
  }

  isPinnedEntrySaved(): boolean {
    if (!this.pinnedTooth) {
      return false;
    }
    return !!this.saveFeedbackByToothId[this.pinnedTooth.id];
  }

  getDentalObservationList(): DentalFindingListItem[] {
    return this.dentalFindingList;
  }

  getPinnedToothSavedFindings(): DentalFindingListItem[] {
    if (!this.pinnedTooth) {
      return [];
    }
    return this.dentalFindingList.filter((item) => item.toothId === this.pinnedTooth?.id);
  }

  focusObservationTooth(item: DentalFindingListItem): void {
    const tooth = this.findToothById(item.toothId);
    if (!tooth) {
      return;
    }
    this.pinTooth(tooth);
  }

  deleteSavedFinding(item: DentalFindingListItem): void {
    if (!this.patient) {
      return;
    }

    this.patientService.deletePatientCondition(this.patient.id, item.conditionId);
    this.patientService.deletePatientBodyStructure(this.patient.id, item.bodyStructureId);
    this.refreshDentalFindingList(this.patient.id);
    if (this.pinnedTooth) {
      this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    }
  }

  private onSiteSelectionChanged(nextSiteCodes: string[]): void {
    if (!this.pinnedTooth) {
      return;
    }

    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [] };
    const currentFinding = this.findingOptions.find((item) => item.code === current.findingCode);
    const desiredScope = this.getFindingScopeForSiteCodes(nextSiteCodes);
    const isCurrentFindingCompatible = !currentFinding || (desiredScope ? currentFinding.scope === desiredScope : false);

    this.toothDraftById[this.pinnedTooth.id] = {
      ...current,
      siteCodes: nextSiteCodes,
      findingCode: isCurrentFindingCompatible ? current.findingCode : undefined
    };

    if (!isCurrentFindingCompatible) {
      this.findingQueryByToothId[this.pinnedTooth.id] = '';
    }

    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  private getOrderedSiteCodes(siteCodes: string[]): string[] {
    const optionOrder = new Map(this.surfaceOptions.map((option, index) => [option.code, index]));
    return [...siteCodes].sort((a, b) => (optionOrder.get(a) ?? 999) - (optionOrder.get(b) ?? 999));
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
    this.dentalFindingList = [];
    this.savedSurfaceByToothId = {};
  }

  private buildDentalConditionAndBodyStructure(
    patientId: string,
    tooth: OdontogramTooth,
    siteCodes: string[],
    findingCode: string
  ): { condition: Condition; bodyStructure: BodyStructure } | null {
    const toothStructure = tooth.snomedStructure;
    const finding = this.findingOptions.find((option) => option.code === findingCode);
    if (!toothStructure || !finding) {
      return null;
    }

    const selectedSites = siteCodes
      .map((siteCode) => this.surfaceOptions.find((option) => option.code === siteCode))
      .filter((option): option is SnomedConceptOption => !!option);

    if (!selectedSites.length) {
      return null;
    }

    const now = new Date().toISOString();
    const bodyStructureId = `body-structure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conditionId = `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const bodyStructure: BodyStructure = {
      resourceType: 'BodyStructure',
      id: bodyStructureId,
      patient: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      includedStructure: [
        {
          structure: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: toothStructure.code,
                display: toothStructure.display
              }
            ],
            text: toothStructure.display
          }
        },
        ...selectedSites.map((site) => ({
          structure: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: site.code,
                display: site.display
              }
            ],
            text: site.display
          }
        }))
      ],
      note: [
        {
          text: `Dental body structure for FDI tooth ${tooth.notations.fdi}.`,
          time: now
        }
      ]
    };

    const condition: Condition = {
      resourceType: 'Condition',
      id: conditionId,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }
        ],
        text: 'Active'
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed'
          }
        ],
        text: 'Confirmed'
      },
      category: [
        {
          coding: [
            {
              system: this.DENTAL_CATEGORY_SYSTEM,
              code: this.DENTAL_CATEGORY_CODE,
              display: 'Dental finding'
            }
          ],
          text: 'Dental finding'
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: finding.code,
            display: finding.display
          }
        ],
        text: finding.display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      bodyStructure: {
        reference: `BodyStructure/${bodyStructureId}`,
        display: toothStructure.display
      },
      recordedDate: now,
      note: [
        {
          text: `Dental finding recorded for FDI tooth ${tooth.notations.fdi} at ${selectedSites.map((site) => site.display).join(', ')}.`,
          time: now
        }
      ]
    };

    return { condition, bodyStructure };
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

  private isDentalCondition(condition: Condition): boolean {
    return condition.category?.some((category) =>
      category.coding?.some((coding) => coding.system === this.DENTAL_CATEGORY_SYSTEM && coding.code === this.DENTAL_CATEGORY_CODE)
      || category.text === 'Dental finding'
    ) || false;
  }

  private refreshDentalFindingList(patientId: string): void {
    const conditions = this.patientService.getPatientConditions(patientId);
    const bodyStructures = this.patientService.getPatientBodyStructures(patientId);
    const bodyStructureById = bodyStructures.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as Record<string, BodyStructure>);

    this.savedSurfaceByToothId = {};

    this.dentalFindingList = conditions
      .filter((condition) => this.isDentalCondition(condition))
      .map((condition) => {
        const bodyStructureRef = condition.bodyStructure?.reference || '';
        const bodyStructureId = bodyStructureRef.startsWith('BodyStructure/')
          ? bodyStructureRef.replace('BodyStructure/', '')
          : bodyStructureRef;

        const bodyStructure = bodyStructureById[bodyStructureId];
        const structureCodes = (bodyStructure?.includedStructure || [])
          .map((item) => item.structure?.coding?.[0]?.code || '')
          .filter(Boolean);

        const toothCode = structureCodes.find((code) => !!this.toothIdBySnomedCode[code]) || '';
        const toothId = this.toothIdBySnomedCode[toothCode] || '';
        const tooth = toothId ? this.findToothById(toothId) : null;

        const siteCodes = structureCodes.filter((code) => this.surfaceOptions.some((option) => option.code === code));
        siteCodes.forEach((siteCode) => {
          if (!toothId) {
            return;
          }
          this.savedSurfaceByToothId[toothId] = this.savedSurfaceByToothId[toothId] || {};
          this.savedSurfaceByToothId[toothId][siteCode] = true;
        });

        const siteDisplays = siteCodes
          .map((siteCode) => this.surfaceOptions.find((option) => option.code === siteCode)?.display || siteCode)
          .filter(Boolean);

        const findingCode = condition.code?.coding?.[0]?.code || '';
        const findingDisplay = condition.code?.coding?.[0]?.display || condition.code?.text || 'Not specified';

        return {
          conditionId: condition.id,
          bodyStructureId,
          toothId,
          toothFdi: tooth?.notations.fdi || 'Unknown',
          siteCodes,
          surfaceCode: siteCodes.join(', '),
          surfaceDisplay: siteDisplays.join(' + ') || 'Not specified',
          findingCode,
          findingDisplay,
          recordedDateTime: condition.recordedDate || ''
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

  private getFindingScopeForSiteCodes(siteCodes: string[]): FindingScope | null {
    if (!siteCodes.length) {
      return null;
    }

    if (siteCodes.includes(this.SURFACE_CODE_COMPLETE)) {
      return 'tooth';
    }

    if (siteCodes.includes(this.SURFACE_CODE_PERIODONTAL)) {
      return 'periodontalSite';
    }

    return 'surface';
  }
}
