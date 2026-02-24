import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { BodyStructure, Condition, Patient, PatientService, Procedure } from '../../services/patient.service';
import { MatDialog } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BASE_TEETH } from './data/tooth-data';
import { FindingScope, OdontogramTooth, SnomedConceptOption, ToothFindingEntry } from './models/tooth.model';
import { getToothNotations } from './utils/tooth-notation.utils';
import { FDI_TO_SNOMED_STRUCTURE_MAP } from './data/fdi-snomed-structure-map';
import { DENTAL_SURFACE_OPTIONS } from './data/dental-surface-options';
import { DENTAL_FINDING_OPTIONS } from './data/dental-finding-options';
import { DENTAL_PROCEDURE_OPTIONS } from './data/dental-procedure-options';
import { DentalFindingListItem } from './models/dental-finding-list-item.model';
import { DentistryFhirDialogComponent, DentistryFhirDialogData } from './dentistry-fhir-dialog/dentistry-fhir-dialog.component';

interface QuadrantConfig {
  key: string;
  label: string;
  prefix: string;
  transform: string;
}

type SurfaceDirection = 'top' | 'bottom' | 'left' | 'right';
type OdontogramViewMode = 'anatomic' | 'rootSurface';
type SurfaceVisualType = 'finding' | 'procedure-planned' | 'procedure-completed';

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
  private readonly DENTAL_PROCEDURE_CATEGORY_CODE = 'dental-procedure';
  readonly SURFACE_CODE_MESIAL = '8483002';
  readonly SURFACE_CODE_DISTAL = '90933009';
  readonly SURFACE_CODE_OCCLUSAL = '83473006';
  readonly SURFACE_CODE_LINGUAL = '72203008';
  readonly SURFACE_CODE_VESTIBULAR = '62579006';
  readonly SURFACE_CODE_COMPLETE = '302214001';
  readonly SURFACE_CODE_PERIODONTAL = '8711009';
  private readonly TOOTH_ABSENT_FINDING_CODE = '234948008';
  private readonly FINDING_SITE_ATTRIBUTE_CODE = '363698007';
  private readonly FINDING_SITE_ATTRIBUTE_DISPLAY = 'Finding site (attribute)';
  private readonly PROCEDURE_SITE_ATTRIBUTE_CODE = '405813007';
  private readonly PROCEDURE_SITE_ATTRIBUTE_DISPLAY = 'Procedure site - Direct (attribute)';

  pinnedTooth: OdontogramTooth | null = null;
  hoveredTooth: OdontogramTooth | null = null;
  tooltipX = 0;
  tooltipY = 0;

  toothDraftById: Record<string, ToothFindingEntry> = {};
  findingQueryByToothId: Record<string, string> = {};
  saveFeedbackByToothId: Record<string, boolean> = {};

  dentalFindingList: DentalFindingListItem[] = [];
  savedSurfaceByToothId: Record<string, Record<string, SurfaceVisualType>> = {};
  private absentToothIds = new Set<string>();

  readonly surfaceOptions: SnomedConceptOption[] = DENTAL_SURFACE_OPTIONS;
  readonly findingOptions: SnomedConceptOption[] = DENTAL_FINDING_OPTIONS;
  readonly procedureOptions: SnomedConceptOption[] = DENTAL_PROCEDURE_OPTIONS;
  readonly quadrants: QuadrantConfig[] = [
    { key: 'upper-right', label: 'Upper Right', prefix: '1', transform: '' },
    { key: 'upper-left', label: 'Upper Left', prefix: '2', transform: 'scale(-1, 1) translate(-409, 0)' },
    { key: 'lower-right', label: 'Lower Right', prefix: '4', transform: 'scale(1, -1) translate(0, -694)' },
    { key: 'lower-left', label: 'Lower Left', prefix: '3', transform: 'scale(-1, -1) translate(-409, -694)' }
  ];
  readonly teethByQuadrant = this.buildTeethByQuadrant();
  readonly toothIdBySnomedCode = this.buildToothIdBySnomedCodeMap();
  viewMode: OdontogramViewMode = 'anatomic';
  selectedSideTabIndex = 1;
  readonly getTeethForQuadrantFn = (prefix: string) => this.getTeethForQuadrant(prefix);
  readonly trackByToothIdFn = (_: number, tooth: OdontogramTooth) => this.trackByToothId(_, tooth);
  readonly isSelectedFn = (toothId: string) => this.isSelected(toothId);
  readonly getLinePathsFn = (tooth: OdontogramTooth) => this.getLinePaths(tooth);
  readonly hasSurfaceVisualFn = (toothId: string, surfaceCode: string) => this.hasSurfaceVisual(toothId, surfaceCode);
  readonly getSurfaceVisualTypeFn = (toothId: string, surfaceCode: string) => this.getSurfaceVisualType(toothId, surfaceCode);
  readonly isToothAbsentFn = (toothId: string) => this.isToothAbsent(toothId);
  readonly getSurfaceOverlayClassFn = (surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string) =>
    this.getSurfaceOverlayClass(surfaceCode, tooth, quadrantPrefix);
  readonly isSurfacePreviewFn = (toothId: string, surfaceCode: string) => this.isSurfacePreview(toothId, surfaceCode);
  readonly getSurfaceOverlayPathFn = (surfaceCode: string, tooth: OdontogramTooth) => this.getSurfaceOverlayPath(surfaceCode, tooth);
  readonly getSurfaceFillFn = (surfaceCode: string, tooth: OdontogramTooth, quadrantPrefix: string) =>
    this.getSurfaceFill(surfaceCode, tooth, quadrantPrefix);
  readonly getSurfaceStrokeFn = (surfaceCode: string) => this.getSurfaceStroke(surfaceCode);
  readonly getSurfaceStrokeWidthFn = (surfaceCode: string) => this.getSurfaceStrokeWidth(surfaceCode);
  readonly getToothTooltipLinesFn = (toothId: string) => this.getToothTooltipLines(toothId);

  constructor(
    private patientService: PatientService,
    private dialog: MatDialog,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar
  ) {}

  setViewMode(mode: OdontogramViewMode): void {
    this.viewMode = mode;
  }

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
    this.selectedSideTabIndex = 0;

    if (!this.toothDraftById[tooth.id]) {
      this.toothDraftById[tooth.id] = { siteCodes: [], entryType: 'finding' };
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
    return !!this.getSavedSurfaceVisualType(toothId, surfaceCode);
  }

  hasSurfaceVisual(toothId: string, surfaceCode: string): boolean {
    if (this.isToothAbsent(toothId)) {
      return false;
    }
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

  getSurfaceVisualType(toothId: string, surfaceCode: string): SurfaceVisualType | null {
    if (this.isToothAbsent(toothId)) {
      return null;
    }
    if (this.isSurfacePreview(toothId, surfaceCode)) {
      return this.getPinnedEntryType() === 'procedure' ? 'procedure-planned' : 'finding';
    }
    return this.getSavedSurfaceVisualType(toothId, surfaceCode);
  }

  isToothAbsent(toothId: string): boolean {
    return this.absentToothIds.has(toothId);
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
      return 'rgba(255, 0, 0, 0.8)';
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
    const visualType = this.getSurfaceVisualType(tooth.id, surfaceCode);
    const visualTypeClass = visualType === 'procedure-planned'
      ? 'surface-procedure'
      : visualType === 'procedure-completed'
        ? 'surface-procedure-completed'
        : '';

    if (surfaceCode === this.SURFACE_CODE_PERIODONTAL) {
      return `overlay-periodontal-ring ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_MESIAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return `overlay-mesial-left ${visualTypeClass}`.trim();
      }
      if (mesialLocalDirection === 'right') {
        return `overlay-mesial-right ${visualTypeClass}`.trim();
      }
      return `${mesialLocalDirection === 'top' ? 'overlay-mesial-top' : 'overlay-mesial-bottom'} ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_DISTAL) {
      const mesialLocalDirection = this.getMesialLocalDirection(tooth.notations.fdi, quadrantPrefix);
      if (mesialLocalDirection === 'left') {
        return `overlay-distal-right ${visualTypeClass}`.trim();
      }
      if (mesialLocalDirection === 'right') {
        return `overlay-distal-left ${visualTypeClass}`.trim();
      }
      return `${mesialLocalDirection === 'top' ? 'overlay-distal-bottom' : 'overlay-distal-top'} ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_VESTIBULAR) {
      const vestibularLocalDirection = this.getVestibularLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `overlay-vestibular-${vestibularLocalDirection} ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_LINGUAL) {
      const lingualLocalDirection = this.getLingualLocalDirection(tooth.notations.fdi, quadrantPrefix);
      return `overlay-lingual-${lingualLocalDirection} ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_OCCLUSAL) {
      return `overlay-occlusal ${visualTypeClass}`.trim();
    }

    if (surfaceCode === this.SURFACE_CODE_COMPLETE) {
      return `overlay-entire-tooth ${visualTypeClass}`.trim();
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
      return 'rgba(255, 0, 0, 0.95)';
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

  getPinnedEntryType(): 'finding' | 'procedure' {
    return this.getPinnedToothDraftEntry()?.entryType || 'finding';
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
    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [], entryType: 'finding' };
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: undefined };
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  onFindingSelected(findingCode: string): void {
    if (!this.pinnedTooth) {
      return;
    }

    const option = this.getActiveConceptOptions().find((item) => item.code === findingCode);
    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [], entryType: 'finding' };
    this.toothDraftById[this.pinnedTooth.id] = { ...current, findingCode: findingCode || undefined };
    this.findingQueryByToothId[this.pinnedTooth.id] = option ? option.display : '';
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  onEntryTypeChange(entryType: 'finding' | 'procedure'): void {
    if (!this.pinnedTooth) {
      return;
    }

    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [], entryType: 'finding' };
    this.toothDraftById[this.pinnedTooth.id] = {
      ...current,
      entryType,
      findingCode: undefined
    };
    this.findingQueryByToothId[this.pinnedTooth.id] = '';
    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
  }

  getFilteredFindingOptions(): SnomedConceptOption[] {
    const desiredScope = this.getFindingScopeForSiteCodes(this.getPinnedSiteCodes());
    if (!desiredScope) {
      return [];
    }

    const compatibleOptions = this.getActiveConceptOptions().filter((option) => option.scope === desiredScope);
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

  getSaveDisabledReason(): string {
    return '';
  }

  savePinnedFindingEntry(): void {
    if (!this.patient || !this.pinnedTooth || !this.canSavePinnedFindingEntry()) {
      return;
    }

    const entry = this.getPinnedToothDraftEntry();
    if (!entry?.siteCodes?.length || !entry.findingCode) {
      return;
    }

    this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    if (this.getPinnedEntryType() === 'procedure') {
      const resources = this.buildDentalProcedureAndBodyStructure(this.patient.id, this.pinnedTooth, entry.siteCodes, entry.findingCode);
      if (!resources) {
        return;
      }
      this.patientService.addPatientBodyStructure(this.patient.id, resources.bodyStructure);
      this.patientService.addPatientProcedure(this.patient.id, resources.procedure);
    } else {
      const resources = this.buildDentalConditionAndBodyStructure(this.patient.id, this.pinnedTooth, entry.siteCodes, entry.findingCode);
      if (!resources) {
        return;
      }
      this.patientService.addPatientBodyStructure(this.patient.id, resources.bodyStructure);
      this.patientService.addPatientConditionAllowDuplicates(this.patient.id, resources.condition);
    }

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

    if (item.entryType === 'procedure' && item.procedureId) {
      this.patientService.deletePatientProcedure(this.patient.id, item.procedureId);
    }
    if (item.entryType === 'finding' && item.conditionId) {
      this.patientService.deletePatientCondition(this.patient.id, item.conditionId);
    }
    if (item.bodyStructureId) {
      this.patientService.deletePatientBodyStructure(this.patient.id, item.bodyStructureId);
    }
    this.refreshDentalFindingList(this.patient.id);
    if (this.pinnedTooth) {
      this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    }
  }

  copyPostcoordinatedExpression(item: DentalFindingListItem): void {
    const expression = this.buildPostcoordinatedExpression(item);
    if (!expression) {
      this.snackBar.open('Could not generate postcoordinated expression for this record.', 'Close', { duration: 2600 });
      return;
    }

    const wasCopied = this.clipboard.copy(expression);
    this.snackBar.open(
      wasCopied ? 'Postcoordinated expression copied to clipboard.' : 'Unable to copy expression to clipboard.',
      'Close',
      { duration: 2400 }
    );
  }

  resolveSavedFinding(item: DentalFindingListItem): void {
    if (!this.patient) {
      return;
    }

    const nextIsResolved = !item.isResolved;
    if (item.entryType === 'procedure' && item.procedureId) {
      const procedures = this.patientService.getPatientProcedures(this.patient.id);
      const procedure = procedures.find((entry) => entry.id === item.procedureId);
      if (!procedure) {
        return;
      }

      const updatedProcedure: Procedure = {
        ...procedure,
        status: nextIsResolved ? 'completed' : 'preparation'
      };
      this.patientService.updatePatientProcedure(this.patient.id, procedure.id, updatedProcedure);
    } else if (item.entryType === 'finding' && item.conditionId) {
      const conditions = this.patientService.getPatientConditions(this.patient.id);
      const condition = conditions.find((entry) => entry.id === item.conditionId);
      if (!condition) {
        return;
      }

      const now = new Date().toISOString();
      const updatedCondition: Condition = {
        ...condition,
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: nextIsResolved ? 'resolved' : 'active',
              display: nextIsResolved ? 'Resolved' : 'Active'
            }
          ],
          text: nextIsResolved ? 'Resolved' : 'Active'
        },
        abatementDateTime: nextIsResolved ? (condition.abatementDateTime || now) : undefined
      };
      this.patientService.updatePatientCondition(this.patient.id, condition.id, updatedCondition);
    }
    this.refreshDentalFindingList(this.patient.id);

    if (this.pinnedTooth) {
      this.saveFeedbackByToothId[this.pinnedTooth.id] = false;
    }
  }

  openDentalFhirDialog(): void {
    if (!this.patient) {
      return;
    }

    const data: DentistryFhirDialogData = {
      title: 'Dental HL7 FHIR Resources',
      links: [
        { label: 'Condition', href: 'https://hl7.org/fhir/condition.html' },
        { label: 'BodyStructure', href: 'https://hl7.org/fhir/bodystructure.html' }
      ],
      jsonString: JSON.stringify(this.buildDentalFhirBundle(this.patient.id), null, 2),
      fileName: `dental-fhir-${this.patient.id}.json`
    };

    this.dialog.open(DentistryFhirDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      data
    });
  }

  private onSiteSelectionChanged(nextSiteCodes: string[]): void {
    if (!this.pinnedTooth) {
      return;
    }

    const current = this.toothDraftById[this.pinnedTooth.id] || { siteCodes: [], entryType: 'finding' };
    const currentFinding = this.getActiveConceptOptions().find((item) => item.code === current.findingCode);
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
    this.selectedSideTabIndex = 1;
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

  private buildDentalProcedureAndBodyStructure(
    patientId: string,
    tooth: OdontogramTooth,
    siteCodes: string[],
    procedureCode: string
  ): { procedure: Procedure; bodyStructure: BodyStructure } | null {
    const toothStructure = tooth.snomedStructure;
    const procedureOption = this.procedureOptions.find((option) => option.code === procedureCode);
    if (!toothStructure || !procedureOption) {
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
    const procedureId = `procedure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

    const procedure: Procedure = {
      resourceType: 'Procedure',
      id: procedureId,
      status: 'preparation',
      category: {
        coding: [
          {
            system: this.DENTAL_CATEGORY_SYSTEM,
            code: this.DENTAL_PROCEDURE_CATEGORY_CODE,
            display: 'Dental procedure'
          }
        ],
        text: 'Dental procedure'
      },
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: procedureOption.code,
            display: procedureOption.display
          }
        ],
        text: procedureOption.display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: `Patient ${patientId}`
      },
      performedDateTime: now,
      reasonReference: [
        {
          reference: `BodyStructure/${bodyStructureId}`,
          display: toothStructure.display
        }
      ],
      note: [
        {
          text: `Dental procedure recorded for FDI tooth ${tooth.notations.fdi} at ${selectedSites.map((site) => site.display).join(', ')}.`,
          time: now
        }
      ]
    };

    return { procedure, bodyStructure };
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

  private isDentalProcedure(procedure: Procedure): boolean {
    return procedure.category?.coding?.some(
      (coding) => coding.system === this.DENTAL_CATEGORY_SYSTEM && coding.code === this.DENTAL_PROCEDURE_CATEGORY_CODE
    ) || procedure.category?.text === 'Dental procedure' || false;
  }

  private getBodyStructureIdFromReference(reference: string | undefined): string {
    if (!reference) {
      return '';
    }
    return reference.startsWith('BodyStructure/') ? reference.replace('BodyStructure/', '') : reference;
  }

  private refreshDentalFindingList(patientId: string): void {
    const conditions = this.patientService.getPatientConditions(patientId);
    const procedures = this.patientService.getPatientProcedures(patientId);
    const bodyStructures = this.patientService.getPatientBodyStructures(patientId);
    const bodyStructureById = bodyStructures.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as Record<string, BodyStructure>);

    this.savedSurfaceByToothId = {};
    this.absentToothIds = new Set<string>();

    const conditionItems = conditions
      .filter((condition) => this.isDentalCondition(condition))
      .map((condition): DentalFindingListItem => {
        const bodyStructureId = this.getBodyStructureIdFromReference(condition.bodyStructure?.reference);

        const bodyStructure = bodyStructureById[bodyStructureId];
        const structureCodes = (bodyStructure?.includedStructure || [])
          .map((item) => item.structure?.coding?.[0]?.code || '')
          .filter(Boolean);

        const toothCode = structureCodes.find((code) => !!this.toothIdBySnomedCode[code]) || '';
        const toothId = this.toothIdBySnomedCode[toothCode] || '';
        const tooth = toothId ? this.findToothById(toothId) : null;

        const siteCodes = structureCodes.filter((code) => this.surfaceOptions.some((option) => option.code === code));
        const clinicalStatusCode = this.getConditionClinicalStatusCode(condition);
        const clinicalStatusDisplay = this.getConditionClinicalStatusDisplay(condition, clinicalStatusCode);
        const isResolved = clinicalStatusCode === 'resolved';
        const findingCode = condition.code?.coding?.[0]?.code || '';
        const isToothAbsentFinding = findingCode === this.TOOTH_ABSENT_FINDING_CODE;

        if (!isResolved && toothId && isToothAbsentFinding) {
          this.absentToothIds.add(toothId);
        }

        if (!isResolved && !isToothAbsentFinding) {
          siteCodes.forEach((siteCode) => {
            if (!toothId) {
              return;
            }
            this.savedSurfaceByToothId[toothId] = this.savedSurfaceByToothId[toothId] || {};
            this.savedSurfaceByToothId[toothId][siteCode] = 'finding';
          });
        }

        const siteDisplays = siteCodes
          .map((siteCode) => this.surfaceOptions.find((option) => option.code === siteCode)?.display || siteCode)
          .filter(Boolean);

        const findingDisplay = condition.code?.coding?.[0]?.display || condition.code?.text || 'Not specified';

        return {
          entryType: 'finding',
          conditionId: condition.id,
          bodyStructureId,
          toothId,
          toothFdi: tooth?.notations.fdi || 'Unknown',
          siteCodes,
          surfaceCode: siteCodes.join(', '),
          surfaceDisplay: siteDisplays.join(' + ') || 'Not specified',
          findingCode,
          findingDisplay,
          clinicalStatusCode,
          clinicalStatusDisplay,
          isResolved,
          recordedDateTime: condition.recordedDate || ''
        };
      });

    const procedureItems = procedures
      .filter((procedure) => this.isDentalProcedure(procedure))
      .map((procedure): DentalFindingListItem => {
        const bodyStructureRef = procedure.reasonReference?.find((ref) => (ref.reference || '').includes('BodyStructure/'))?.reference || '';
        const bodyStructureId = this.getBodyStructureIdFromReference(bodyStructureRef);
        const bodyStructure = bodyStructureById[bodyStructureId];
        const structureCodes = (bodyStructure?.includedStructure || [])
          .map((item) => item.structure?.coding?.[0]?.code || '')
          .filter(Boolean);

        const toothCode = structureCodes.find((code) => !!this.toothIdBySnomedCode[code]) || '';
        const toothId = this.toothIdBySnomedCode[toothCode] || '';
        const tooth = toothId ? this.findToothById(toothId) : null;

        const siteCodes = structureCodes.filter((code) => this.surfaceOptions.some((option) => option.code === code));
        const isResolved = procedure.status === 'completed';
        siteCodes.forEach((siteCode) => {
          if (!toothId) {
            return;
          }
          this.savedSurfaceByToothId[toothId] = this.savedSurfaceByToothId[toothId] || {};
          this.savedSurfaceByToothId[toothId][siteCode] = isResolved ? 'procedure-completed' : 'procedure-planned';
        });

        const siteDisplays = siteCodes
          .map((siteCode) => this.surfaceOptions.find((option) => option.code === siteCode)?.display || siteCode)
          .filter(Boolean);

        const procedureCode = procedure.code?.coding?.[0]?.code || '';
        const procedureDisplay = procedure.code?.coding?.[0]?.display || procedure.code?.text || 'Not specified';

        return {
          entryType: 'procedure',
          procedureId: procedure.id,
          bodyStructureId,
          toothId,
          toothFdi: tooth?.notations.fdi || 'Unknown',
          siteCodes,
          surfaceCode: siteCodes.join(', '),
          surfaceDisplay: siteDisplays.join(' + ') || 'Not specified',
          findingCode: procedureCode,
          findingDisplay: procedureDisplay,
          clinicalStatusCode: isResolved ? 'completed' : 'planned',
          clinicalStatusDisplay: isResolved ? 'Completed' : 'Planned',
          isResolved,
          recordedDateTime: procedure.performedDateTime || ''
        };
      });

    this.dentalFindingList = [...conditionItems, ...procedureItems]
      .sort((a, b) => {
        const aFdi = Number.parseInt(a.toothFdi, 10);
        const bFdi = Number.parseInt(b.toothFdi, 10);
        const aHasFdi = Number.isFinite(aFdi);
        const bHasFdi = Number.isFinite(bFdi);

        if (aHasFdi && bHasFdi && aFdi !== bFdi) {
          return aFdi - bFdi;
        }
        if (aHasFdi && !bHasFdi) {
          return -1;
        }
        if (!aHasFdi && bHasFdi) {
          return 1;
        }

        const aTime = a.recordedDateTime ? new Date(a.recordedDateTime).getTime() : 0;
        const bTime = b.recordedDateTime ? new Date(b.recordedDateTime).getTime() : 0;
        return bTime - aTime;
      });
  }

  private buildPostcoordinatedExpression(item: DentalFindingListItem): string {
    const conceptCode = (item.findingCode || '').trim();
    const conceptDisplay = (item.findingDisplay || '').trim();
    if (!conceptCode || !conceptDisplay) {
      return '';
    }

    const tooth = this.findToothById(item.toothId);
    const toothCode = tooth?.snomedStructure?.code || '';
    const toothDisplay = tooth?.snomedStructure?.display || '';
    if (!toothCode || !toothDisplay) {
      return '';
    }

    const attributeCode = item.entryType === 'finding'
      ? this.FINDING_SITE_ATTRIBUTE_CODE
      : this.PROCEDURE_SITE_ATTRIBUTE_CODE;
    const attributeDisplay = item.entryType === 'finding'
      ? this.FINDING_SITE_ATTRIBUTE_DISPLAY
      : this.PROCEDURE_SITE_ATTRIBUTE_DISPLAY;

    const siteLines = item.siteCodes
      .map((siteCode) => {
        const site = this.surfaceOptions.find((option) => option.code === siteCode);
        if (!site) {
          return '';
        }
        return `${attributeCode} |${attributeDisplay}| = ${site.code} |${site.display}|`;
      })
      .filter((line) => !!line);

    const attributeLines = [
      `${attributeCode} |${attributeDisplay}| = ${toothCode} |${toothDisplay}|`,
      ...siteLines
    ];

    return `=== ${conceptCode} |${conceptDisplay}| :\n${attributeLines.join(',\n')}`;
  }

  private buildDentalFhirBundle(patientId: string): any {
    const conditions = this.patientService.getPatientConditions(patientId).filter((condition) => this.isDentalCondition(condition));
    const procedures = this.patientService.getPatientProcedures(patientId).filter((procedure) => this.isDentalProcedure(procedure));
    const bodyStructures = this.patientService.getPatientBodyStructures(patientId);
    const referencedBodyStructureIds = new Set(
      [
        ...conditions.map((condition) => condition.bodyStructure?.reference || ''),
        ...procedures.map(
          (procedure) => procedure.reasonReference?.find((ref) => (ref.reference || '').includes('BodyStructure/'))?.reference || ''
        )
      ]
        .filter(Boolean)
        .map((reference) => reference.replace('BodyStructure/', ''))
    );

    const linkedBodyStructures = bodyStructures.filter((resource) => referencedBodyStructureIds.has(resource.id));
    const resources = [...conditions, ...procedures, ...linkedBodyStructures];

    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: resources.length,
      entry: resources.map((resource) => ({
        resource
      }))
    };
  }

  private updateTooltipPosition(event: MouseEvent): void {
    const offset = 16;
    this.tooltipX = event.clientX + offset;
    this.tooltipY = event.clientY - offset;
  }

  private getToothTooltipLines(toothId: string): string[] {
    const items = this.dentalFindingList.filter((item) => item.toothId === toothId);
    if (!items.length) {
      return [];
    }

    const findingLabels = this.toUniqueCompactLabels(
      items
        .filter((item) => item.entryType === 'finding' && !item.isResolved)
        .map((item) => item.findingDisplay)
    );
    const procedureLabels = this.toUniqueCompactLabels(
      items
        .filter((item) => item.entryType === 'procedure')
        .map((item) => `${this.toTooltipProcedureName(item.findingDisplay)} (${item.isResolved ? 'completed' : 'planned'})`)
    );

    const lines: string[] = [];
    if (findingLabels.length) {
      lines.push(this.compactTooltipList(findingLabels, 2));
    }
    if (procedureLabels.length) {
      lines.push(this.compactTooltipList(procedureLabels, 2));
    }
    return lines;
  }

  private toUniqueCompactLabels(values: string[]): string[] {
    const cleaned = values
      .map((value) => (value || '').trim())
      .filter((value) => !!value);
    return Array.from(new Set(cleaned));
  }

  private toTooltipProcedureName(display: string): string {
    return (display || '').replace(/\s*\(procedure\)\s*$/i, '').trim();
  }

  private compactTooltipList(values: string[], maxItems: number): string {
    if (values.length <= maxItems) {
      return values.join(', ');
    }
    return `${values.slice(0, maxItems).join(', ')} +${values.length - maxItems}`;
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

  private getSavedSurfaceVisualType(toothId: string, surfaceCode: string): SurfaceVisualType | null {
    return this.savedSurfaceByToothId[toothId]?.[surfaceCode] || null;
  }

  private getActiveConceptOptions(): SnomedConceptOption[] {
    return this.getPinnedEntryType() === 'procedure' ? this.procedureOptions : this.findingOptions;
  }

  private getConditionClinicalStatusCode(condition: Condition): string {
    const codingCode = condition.clinicalStatus?.coding?.[0]?.code?.trim().toLowerCase();
    if (codingCode) {
      return codingCode;
    }
    const textCode = condition.clinicalStatus?.text?.trim().toLowerCase();
    return textCode || 'active';
  }

  private getConditionClinicalStatusDisplay(condition: Condition, code: string): string {
    const codingDisplay = condition.clinicalStatus?.coding?.[0]?.display?.trim();
    if (codingDisplay) {
      return codingDisplay;
    }
    const textDisplay = condition.clinicalStatus?.text?.trim();
    if (textDisplay) {
      return textDisplay;
    }
    if (code === 'resolved') {
      return 'Resolved';
    }
    return 'Active';
  }
}
