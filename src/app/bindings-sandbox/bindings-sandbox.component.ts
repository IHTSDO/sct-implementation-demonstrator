import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { FormControl, FormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, concatMap, finalize, from, lastValueFrom, map, merge, switchMap, takeUntil, tap, timer } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import { EclBuilderDialogService } from '../bindings/ecl-builder/ecl-builder-dialog.service';
import { TerminologyService, ValueSetSummary } from '../services/terminology.service';
import { BindingsDataDialogComponent } from './bindings-data-dialog/bindings-data-dialog.component';
import {
  LINKED_SOURCE_PLACEHOLDER,
  LINKED_TARGET_TYPES,
  LinkedConcept,
  LinkedOperator,
  buildLinkedEclTemplate,
  canBeLinkSource,
  createBindingId,
  ensureBindingIds,
  extractFocusConceptIds,
  isLinkedBinding,
  toLinkedConcept,
} from '../bindings/linked-binding/linked-binding.utils';

/** MRCM attribute offered when linking a field to another field's concept. */
interface LinkedAttributeOption extends LinkedConcept {
  rangeConstraint?: string;
  /** Whether concepts in the source field use the attribute; undefined until checked. */
  used?: boolean;
}

/** Top-level hierarchies where checking attribute usage would mean scanning a huge set. */
const BROAD_HIERARCHY_ROOTS = [
  '138875005', '404684003', '71388002', '363787002', '243796009', '105590001',
  '123037004', '373873005', '272379006', '410607006', '362981000', '78621006',
];

@Component({
  selector: 'app-bindings-sandbox',
  templateUrl: './bindings-sandbox.component.html',
  styleUrls: ['./bindings-sandbox.component.css'],
  standalone: false
})
export class BindingsSandboxComponent implements OnInit, OnDestroy {
  formTitle: string = 'My new form';
  titleEditMode = false;

  bindings: any[] = [];
  output: any = {};
  outputStr: string = '{}';
  response: any = {};
  responseStr: string = '{}';
  responseBundle: any = {};
  responseBundleStr: string = '{}';
  fhirQuestionnaire: any = {};
  fhirQuestionnaireStr: string = '{}';

  @ViewChild(FormGroupDirective) formDirective!: FormGroupDirective;

  editorMode: 'create' | 'edit' = 'create';
  editorSheetOpen = false;
  isTabletViewport = false;
  isMobileViewport = false;

  codeBindingObservables: any = {
    title: 'Question code (Observables)',
    type: 'Autocomplete',
    ecl: `<< 363787002 |Observable entity (observable entity)|`,
    value: '',
  };

  codeBindingAll: any = {
    title: 'Question code',
    type: 'Autocomplete',
    ecl: `<< 363787002 |Observable entity (observable entity)| OR << 404684003 |Clinical finding (finding)| OR << 71388002 |Procedure (procedure)| OR << 243796009 |Situation with explicit context (situation)|`,
    value: '',
  };

  codeBinding: any = this.codeBindingAll;

  unitsBinding: any = {
    title: 'Units',
    type: 'Autocomplete',
    ecl: `<< 767524001 |Unit of measure (qualifier value)|`,
    value: '',
  };

  checkboxBinding: any = JSON.parse(JSON.stringify(this.codeBindingAll));

  example1 = {
    title: 'Appendicitis data entry form (example)',
    bindings: [
      {
        id: 'example-diagnosis',
        title: 'Diagnosis (type of appendicitis)',
        type: 'Autocomplete',
        ecl: `<< 74400008 |Appendicitis|`,
        value: '',
        note: 'An autocomplete field to select between all descendants of appendicitis.',
        repeatable: false,
        count: 1
      },
      {
        id: 'example-diagnosis-site',
        title: 'Site (from the diagnosis)',
        type: 'Select (Single)',
        answerSource: 'linked',
        linkedFrom: 'example-diagnosis',
        linkedAttribute: { code: '363698007', display: 'Finding site' },
        linkedOperator: '<<',
        eclTemplate: `<< ({{source}}.363698007 |Finding site|)`,
        ecl: '',
        value: '',
        note: 'Linked to the diagnosis: defaults to its finding site and offers more specific sites.',
        repeatable: false,
        count: 1
      },
      {
        title: 'Clinical note',
        type: 'Text box',
        ecl: `74400008 |Appendicitis|`,
        value: '',
        note: 'A text box for entering free text clinical information.',
        repeatable: false,
        count: 1
      },
      {
        title: 'Appendicitis type',
        type: 'Select (Single)',
        ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
        value: '',
        note: 'A single selection dropdown field for a shorter selection of the type of appendicitis.',
        repeatable: false,
        count: 1
      },
      {
        title: 'Appendicitis type (M)',
        type: 'Select (Multiple)',
        ecl: `<< 196781001 |Acute appendicitis with peritonitis (disorder)|`,
        value: '',
        note: 'A multiple selection dropdown field for a shorter selection of the type of appendicitis.',
        repeatable: false,
        count: 1
      },
      {
        title: 'Appendicectomy type',
        type: 'Options',
        ecl: `<< 174036004 |Emergency appendectomy (procedure)|`,
        value: '',
        note: 'A radio buttons selector for the type of appendicectomy procedure.',
        repeatable: false,
        count: 1
      }
    ]
  };

  newBindingForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(50)]),
    code: new FormControl('', []),
    type: new FormControl('', [Validators.required]),
    answerSource: new FormControl<'ecl' | 'valueset' | 'linked'>('ecl'),
    ecl: new FormControl('', []),
    linkedFrom: new FormControl<string | null>(null),
    linkedAttribute: new FormControl<LinkedConcept | null>(null),
    linkedOperator: new FormControl<LinkedOperator>('<<'),
    eclTemplate: new FormControl('', []),
    valueSetEntry: new FormControl<ValueSetSummary | string | null>(null),
    value: new FormControl('', []),
    unit: new FormControl('', []),
    note: new FormControl('', [Validators.maxLength(500)]),
    repeatable: new FormControl(false, [])
  });

  /** ValueSets from FHIR server (sandbox picker); filtered client-side by title/url. */
  allValueSets: ValueSetSummary[] = [];
  filteredValueSets: ValueSetSummary[] = [];
  valueSetsLoading = false;

  private readonly destroy$ = new Subject<void>();

  /** Concept currently selected in each link-source field, keyed by binding id. */
  sourceValues: Record<string, LinkedConcept | null> = {};

  linkedOperators: { value: LinkedOperator; label: string }[] = [
    { value: '<<', label: 'Value and its descendants' },
    { value: '<', label: 'Descendants only (refinements)' },
    { value: '=', label: 'Only the value' },
  ];
  linkedAttributeOptions: LinkedAttributeOption[] = [];
  linkedAttributesLoading = false;
  /** True when the concept model cannot be read for the source (no focus concept, ValueSet, server error). */
  linkedAttributesFallback = false;
  linkedUsageChecking = false;
  linkedUsageChecked = 0;
  linkedUsageSkipped = false;
  attributeFallbackBinding = {
    title: 'Attribute',
    type: 'Autocomplete',
    ecl: '< 762705008 |Concept model object attribute|',
    note: 'The concept model could not be read for the linked field; search any attribute.',
  };
  private linkedSource$ = new Subject<any>();

  indexInEdit = -1;
  maxSelectCount = 50;
  maxOptionsCount = 10;
  maxMultiPrefixCount = 500;

  controlTypes = [
    'Autocomplete',
    'Select (Single)',
    'Select (Multiple)',
    'Multi-prefix search select',
    'Options',
    'Section header',
    'Text box',
    'Integer',
    'Decimal',
    'Checkbox',
    'Checkbox multiple'
  ].sort((a, b) => a.localeCompare(b));

  constructor(
    private terminologyService: TerminologyService,
    private clipboard: Clipboard,
    private eclBuilderDialog: EclBuilderDialogService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.checkboxBinding.title = this.checkboxBinding.title.replace('Question', 'Checkbox');
    this.updateViewportState();

    const answerSourceCtl = this.newBindingForm.get('answerSource');
    const valueSetCtl = this.newBindingForm.get('valueSetEntry');

    answerSourceCtl?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((src) => {
      if (src !== 'linked') {
        this.resetLinkedControls();
      }
      if (src === 'ecl') {
        valueSetCtl?.setValue(null, { emitEvent: false });
        valueSetCtl?.setErrors(null);
      } else {
        valueSetCtl?.setValue(src === 'valueset' ? valueSetCtl.value : null, { emitEvent: false });
        valueSetCtl?.setErrors(null);
        this.newBindingForm.get('ecl')?.setValue('', { emitEvent: false });
        this.newBindingForm.get('ecl')?.setErrors(null);
        if (src === 'valueset') {
          this.loadValueSetsIfNeeded();
        }
      }
    });

    this.newBindingForm.controls.type.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((type) => {
      if (answerSourceCtl?.value === 'linked' && !this.canUseLinkedSource(type)) {
        answerSourceCtl.setValue('ecl');
      }
    });

    this.newBindingForm.controls.linkedFrom.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      this.newBindingForm.controls.linkedAttribute.setValue(null);
      this.linkedSource$.next(this.bindings.find((b) => b.id === id) ?? null);
    });

    merge(
      this.newBindingForm.controls.linkedAttribute.valueChanges,
      this.newBindingForm.controls.linkedOperator.valueChanges
    ).pipe(takeUntil(this.destroy$)).subscribe(() => this.regenerateEclTemplate());

    this.linkedSource$
      .pipe(
        switchMap((source) => this.loadLinkedAttributes(source)),
        takeUntil(this.destroy$)
      )
      .subscribe();

    valueSetCtl?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((val) => {
      if (answerSourceCtl?.value !== 'valueset') {
        return;
      }
      const q = typeof val === 'string' ? val : (val ? this.displayValueSetLabel(val as ValueSetSummary) : '');
      this.applyValueSetFilter(q);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  needsAnswerExpansionSource(type: string | null | undefined): boolean {
    return !!type && [
      'Autocomplete',
      'Select (Single)',
      'Select (Multiple)',
      'Multi-prefix search select',
      'Options',
    ].includes(type);
  }

  canUseLinkedSource(type: string | null | undefined): boolean {
    return !!type && LINKED_TARGET_TYPES.includes(type);
  }

  isLinked(binding: any): boolean {
    return isLinkedBinding(binding);
  }

  /** Fields that can feed a linked field: single-concept answers, excluding the binding being edited. */
  linkSourceCandidates(): any[] {
    const editingId = this.indexInEdit > -1 ? this.bindings[this.indexInEdit]?.id : null;
    return this.bindings.filter((b) => canBeLinkSource(b) && b.id !== editingId);
  }

  bindingTitleById(id: string | null | undefined): string {
    return this.bindings.find((b) => b.id === id)?.title ?? '';
  }

  compareConcepts(a: LinkedConcept | null, b: LinkedConcept | null): boolean {
    return !!a && !!b ? a.code === b.code : a === b;
  }

  get usedLinkedAttributes(): LinkedAttributeOption[] {
    return this.linkedAttributeOptions.filter((o) => o.used === true);
  }

  get otherLinkedAttributes(): LinkedAttributeOption[] {
    return this.linkedAttributeOptions.filter((o) => o.used !== true);
  }

  get selectedLinkedAttributeRange(): string {
    const code = this.newBindingForm.controls.linkedAttribute.value?.code;
    return this.linkedAttributeOptions.find((o) => o.code === code)?.rangeConstraint ?? '';
  }

  recordSourceValue(binding: any, value: any): void {
    if (!binding?.id) {
      return;
    }
    this.sourceValues = { ...this.sourceValues, [binding.id]: toLinkedConcept(value) };
  }

  private resetLinkedControls(): void {
    const c = this.newBindingForm.controls;
    c.linkedFrom.setValue(null, { emitEvent: false });
    c.linkedAttribute.setValue(null, { emitEvent: false });
    c.linkedOperator.setValue('<<', { emitEvent: false });
    c.eclTemplate.setValue('', { emitEvent: false });
    [c.linkedFrom, c.linkedAttribute, c.eclTemplate].forEach((ctl) => ctl.setErrors(null));
    this.linkedSource$.next(null);
  }

  private regenerateEclTemplate(): void {
    const attribute = this.newBindingForm.controls.linkedAttribute.value;
    const operator = this.newBindingForm.controls.linkedOperator.value ?? '<<';
    if (attribute?.code) {
      this.newBindingForm.controls.eclTemplate.setValue(buildLinkedEclTemplate(operator, attribute));
    }
  }

  /**
   * Loads the MRCM attributes for the source field's focus concepts, then checks one by
   * one (paced, stopping at the first error) which ones its concepts actually use.
   */
  private loadLinkedAttributes(source: any): Observable<unknown> {
    this.linkedAttributeOptions = [];
    this.linkedAttributesFallback = false;
    this.linkedAttributesLoading = false;
    this.linkedUsageChecking = false;
    this.linkedUsageChecked = 0;
    this.linkedUsageSkipped = false;
    if (!source) {
      return EMPTY;
    }
    const focusIds = source.valueSetUrl ? [] : extractFocusConceptIds(source.ecl);
    if (!focusIds.length) {
      this.linkedAttributesFallback = true;
      return EMPTY;
    }

    this.linkedAttributesLoading = true;
    return this.terminologyService.getDomainAttributes(focusIds).pipe(
      tap((items) => {
        this.linkedAttributeOptions = items
          // |Is a| is not a defining attribute a field can be refined on.
          .filter((item: any) => `${item.conceptId}` !== '116680003')
          .map((item: any) => ({
            code: `${item.conceptId}`,
            display: item.pt?.term || (item.fsn?.term || '').replace(/\s*\([^)]*\)$/, '') || `${item.conceptId}`,
            rangeConstraint: item.attributeRange?.[0]?.rangeConstraint,
          }))
          .sort((a: LinkedAttributeOption, b: LinkedAttributeOption) => a.display.localeCompare(b.display));
        this.linkedAttributesFallback = this.linkedAttributeOptions.length === 0;
        this.linkedAttributesLoading = false;
      }),
      catchError(() => {
        this.linkedAttributesFallback = true;
        this.linkedAttributesLoading = false;
        return EMPTY;
      }),
      switchMap(() => {
        if (!this.linkedAttributeOptions.length) {
          return EMPTY;
        }
        if (focusIds.some((id) => BROAD_HIERARCHY_ROOTS.includes(id))) {
          this.linkedUsageSkipped = true;
          return EMPTY;
        }
        this.linkedUsageChecking = true;
        let requests = 0;
        return from(this.linkedAttributeOptions).pipe(
          concatMap((option) =>
            timer(
              this.terminologyService.getCachedAttributeUsage(source.ecl, option.code) !== undefined || requests++ === 0
                ? 0
                : this.terminologyService.requestPacingMs
            ).pipe(
              switchMap(() => this.terminologyService.isAttributeUsed(source.ecl, option.code)),
              tap((used) => {
                option.used = used;
                this.linkedUsageChecked++;
              })
            )
          ),
          // Throttling or any other failure: stop checking, keep what is known.
          catchError(() => EMPTY),
          finalize(() => (this.linkedUsageChecking = false))
        );
      })
    );
  }

  /** Sets errors on the linked-field controls; returns true when any is invalid. */
  private validateLinkedControls(): boolean {
    const { linkedFrom, linkedAttribute, eclTemplate } = this.newBindingForm.controls;
    let invalid = false;
    if (!linkedFrom.value || !this.linkSourceCandidates().some((b) => b.id === linkedFrom.value)) {
      linkedFrom.setErrors({ required: true });
      invalid = true;
    }
    if (!linkedAttribute.value?.code) {
      linkedAttribute.setErrors({ required: true });
      invalid = true;
    }
    if (!(eclTemplate.value || '').includes(LINKED_SOURCE_PLACEHOLDER)) {
      eclTemplate.setErrors({ missingPlaceholder: true });
      invalid = true;
    }
    return invalid;
  }

  deleteBinding(index: number): void {
    const binding = this.bindings[index];
    const dependents = this.bindings.filter((b) => isLinkedBinding(b) && b.linkedFrom === binding?.id);
    if (dependents.length) {
      this.snackBar.open(
        `"${binding.title}" feeds ${dependents.map((d) => `"${d.title}"`).join(', ')}. Relink or remove those fields first.`,
        'Close',
        { duration: 6000 }
      );
      return;
    }
    this.bindings.splice(index, 1);
    this.refreshFhirQuestionnaire();
  }

  private formDefaults() {
    return {
      repeatable: false,
      answerSource: 'ecl' as const,
      valueSetEntry: null,
      linkedOperator: '<<' as LinkedOperator,
    };
  }

  displayValueSetLabel(value: ValueSetSummary | string | null | undefined): string {
    if (value == null || value === '') {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return `${value.title} — ${value.url}`;
  }

  onValueSetFieldActivated(): void {
    this.loadValueSetsIfNeeded();
  }

  private applyValueSetFilter(query: string): void {
    const t = query.trim().toLowerCase();
    if (!t) {
      this.filteredValueSets = [...this.allValueSets];
      return;
    }
    this.filteredValueSets = this.allValueSets.filter(
      (vs) => vs.title.toLowerCase().includes(t) || vs.url.toLowerCase().includes(t)
    );
  }

  /**
   * Re-fetches ValueSets from the configured FHIR terminology base (cache bypass).
   */
  refreshValueSetsList(): void {
    if (!this.terminologyService.getSnowstormFhirBase()) {
      return;
    }
    this.valueSetsLoading = true;
    this.terminologyService.fetchValueSets(undefined, 500, true).subscribe({
      next: (list) => {
        this.allValueSets = list;
        const raw = this.newBindingForm.get('valueSetEntry')?.value;
        const q =
          typeof raw === 'string'
            ? raw
            : raw && typeof raw === 'object'
              ? this.displayValueSetLabel(raw as ValueSetSummary)
              : '';
        this.applyValueSetFilter(q);
        this.valueSetsLoading = false;
      },
      error: () => {
        this.valueSetsLoading = false;
      },
    });
  }

  valueSetRefreshAvailable(): boolean {
    return !!this.terminologyService.getSnowstormFhirBase();
  }

  loadValueSetsIfNeeded(): void {
    if (!this.terminologyService.getSnowstormFhirBase()) {
      return;
    }
    if (this.allValueSets.length > 0) {
      const raw = this.newBindingForm.get('valueSetEntry')?.value;
      const q =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object'
            ? this.displayValueSetLabel(raw as ValueSetSummary)
            : '';
      this.applyValueSetFilter(q);
      return;
    }
    if (this.valueSetsLoading) {
      return;
    }
    this.valueSetsLoading = true;
    this.terminologyService.fetchValueSets().subscribe({
      next: (list) => {
        this.allValueSets = list;
        const raw = this.newBindingForm.get('valueSetEntry')?.value;
        const q =
          typeof raw === 'string'
            ? raw
            : raw && typeof raw === 'object'
              ? this.displayValueSetLabel(raw as ValueSetSummary)
              : '';
        this.applyValueSetFilter(q);
        this.valueSetsLoading = false;
      },
      error: () => {
        this.valueSetsLoading = false;
      },
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  private updateViewportState(): void {
    this.isTabletViewport = window.innerWidth < 1024;
    this.isMobileViewport = window.innerWidth < 768;
    if (!this.isTabletViewport) {
      this.editorSheetOpen = false;
    }
  }

  toggleEditorSheet(): void {
    this.editorSheetOpen = !this.editorSheetOpen;
  }

  startCreateBinding(): void {
    this.indexInEdit = -1;
    this.editorMode = 'create';
    this.formDirective.resetForm(this.formDefaults());
    if (this.isTabletViewport) {
      this.editorSheetOpen = true;
    }
  }

  openDataDialog(): void {
    this.refreshResponse();
    this.refreshFhirQuestionnaire();

    const isMobile = this.isMobileViewport;
    this.dialog.open(BindingsDataDialogComponent, {
      data: {
        formTitle: this.formTitle,
        outputStr: this.outputStr,
        responseStr: this.responseStr,
        responseBundleStr: this.responseBundleStr,
        fhirQuestionnaireStr: this.fhirQuestionnaireStr
      },
      width: isMobile ? '100vw' : '88vw',
      maxWidth: isMobile ? '100vw' : '1400px',
      height: isMobile ? '100vh' : '84vh',
      panelClass: isMobile ? 'bindings-data-dialog-mobile' : 'bindings-data-dialog'
    });
  }

  async addBinding() {
    this.newBindingForm.markAllAsTouched();
    if (this.newBindingForm.invalid) {
      return;
    }

    const { title, code, type, ecl, value, unit, note, repeatable, answerSource, valueSetEntry } =
      this.newBindingForm.controls;
    const binding: any = {
      id: this.indexInEdit > -1 ? (this.bindings[this.indexInEdit]?.id ?? createBindingId()) : createBindingId(),
      title: title.value,
      code: code.value,
      type: type.value,
      value: value.value,
      unit: unit.value,
      note: note.value,
      repeatable: repeatable.value,
      count: 1,
    };

    const pickedVs =
      typeof valueSetEntry.value === 'object' &&
      valueSetEntry.value !== null &&
      'url' in (valueSetEntry.value as object)
        ? (valueSetEntry.value as ValueSetSummary)
        : null;

    const isLinked = answerSource.value === 'linked' && this.canUseLinkedSource(type.value);
    if (isLinked) {
      const { linkedFrom, linkedAttribute, linkedOperator, eclTemplate } = this.newBindingForm.controls;
      binding.answerSource = 'linked';
      binding.ecl = '';
      binding.linkedFrom = linkedFrom.value;
      binding.linkedAttribute = linkedAttribute.value
        ? { code: linkedAttribute.value.code, display: linkedAttribute.value.display }
        : null;
      binding.linkedOperator = linkedOperator.value ?? '<<';
      binding.eclTemplate = (eclTemplate.value || '').trim();
      // Options offered when the source concept has no value for the attribute.
      binding.linkedRange = this.selectedLinkedAttributeRange || undefined;
    } else if (this.needsAnswerExpansionSource(type.value)) {
      if (answerSource.value === 'valueset') {
        binding.ecl = '';
        if (pickedVs?.url) {
          binding.valueSetUrl = pickedVs.url;
          binding.valueSetTitle = pickedVs.title;
        }
      } else {
        binding.ecl = (ecl.value as string) || '';
        delete binding.valueSetUrl;
        delete binding.valueSetTitle;
      }
    } else {
      binding.ecl = ecl.value;
      delete binding.valueSetUrl;
      delete binding.valueSetTitle;
    }

    let errors = false;

    const needsExp = this.needsAnswerExpansionSource(type.value) && !isLinked;
    if (isLinked) {
      errors = this.validateLinkedControls() || errors;
    } else if (needsExp) {
      valueSetEntry.setErrors(null);
      ecl.setErrors(null);
      if (answerSource.value === 'valueset') {
        if (!pickedVs?.url?.trim()) {
          errors = true;
          valueSetEntry.setErrors({ required: true });
        }
      } else if (!(ecl.value || '').toString().trim()) {
        errors = true;
        ecl.setErrors({ required: true });
      }
    } else if (
      binding.type !== 'Section header' &&
      binding.type !== 'Text box' &&
      binding.type !== 'Integer' &&
      binding.type !== 'Decimal'
    ) {
      if (!ecl.value) {
        errors = true;
        ecl.setErrors({ required: true });
      }
    }

    const expansionSpec =
      needsExp && answerSource.value === 'valueset' && pickedVs?.url
        ? { valueSetUrl: pickedVs.url }
        : needsExp && answerSource.value === 'ecl'
          ? { ecl: (ecl.value as string) || '' }
          : null;

    if (!errors && expansionSpec && (expansionSpec.ecl || expansionSpec.valueSetUrl)) {
      let limit = 0;
      const t = binding.type;
      if (typeof t === 'string' && t.includes('Select')) {
        limit = this.maxSelectCount + 1;
      } else if (typeof t === 'string' && (t.includes('Options') || t.includes('Checkbox multiple'))) {
        limit = this.maxOptionsCount + 1;
      } else if (t === 'Multi-prefix search select') {
        limit = this.maxMultiPrefixCount + 1;
      }

      if (limit > 0) {
        const results = await this.getAnswerExpansionPreview(expansionSpec, limit);
        const n = results.expansion?.contains?.length ?? 0;
        if (typeof t === 'string' && t.includes('Select')) {
          if (n > this.maxSelectCount) {
            errors = true;
            if (answerSource.value === 'valueset') {
              valueSetEntry.setErrors({ selectTooManyResults: true });
            } else {
              ecl.setErrors({ selectTooManyResults: true });
            }
          }
        } else if (typeof t === 'string' && (t.includes('Options') || t.includes('Checkbox multiple'))) {
          if (n > this.maxOptionsCount) {
            errors = true;
            if (answerSource.value === 'valueset') {
              valueSetEntry.setErrors({ optionsTooManyResults: true });
            } else {
              ecl.setErrors({ optionsTooManyResults: true });
            }
          }
        } else if (t === 'Multi-prefix search select') {
          if (n > this.maxMultiPrefixCount) {
            errors = true;
            if (answerSource.value === 'valueset') {
              valueSetEntry.setErrors({ multiPrefixTooManyResults: true });
            } else {
              ecl.setErrors({ multiPrefixTooManyResults: true });
            }
          }
        }
      }
    }

    if (!errors && this.indexInEdit > -1 && !canBeLinkSource(binding)) {
      const dependents = this.bindings.filter((b) => isLinkedBinding(b) && b.linkedFrom === binding.id);
      if (dependents.length) {
        errors = true;
        this.snackBar.open(
          `${dependents.map((d) => `"${d.title}"`).join(', ')} depend on this field, so it must stay a single, non-repeating concept answer.`,
          'Close',
          { duration: 6000 }
        );
      }
    }

    if (errors) {
      return;
    }

    if (this.indexInEdit > -1) {
      this.bindings[this.indexInEdit] = binding;
    } else {
      this.bindings.push(binding);
    }

    this.formDirective.resetForm(this.formDefaults());
    this.indexInEdit = -1;
    this.editorMode = 'create';
    if (this.isTabletViewport) {
      this.editorSheetOpen = false;
    }

    setTimeout(() => {
      this.refreshFhirQuestionnaire();
      this.refreshResponse();
    }, 100);
  }

  refreshFhirQuestionnaire() {
    this.fhirQuestionnaire = {
      resourceType: 'Questionnaire',
      title: this.formTitle,
      status: 'draft',
      item: []
    };

    this.bindings.forEach((binding, index) => {
      const item = this.createItemForBinding(binding, index);
      if (item) {
        this.fhirQuestionnaire.item.push(item);
      }
    });

    this.fhirQuestionnaireStr = JSON.stringify(this.fhirQuestionnaire, null, 2);
  }

  createItemForBinding(binding: any, index: number) {
    const baseItem: any = this.initializeBaseItem(binding, index);
    baseItem.extension = [];

    if (['Select (Single)', 'Select (Multiple)', 'Options', 'Autocomplete', 'Multi-prefix search select'].includes(binding.type)) {
      baseItem.extension = this.getExtensionForSelectableTypes();
      if (isLinkedBinding(binding)) {
        this.addLinkedAnswerExpression(baseItem, binding);
      } else {
        baseItem.answerValueSet = this.getAnswerValueSet(binding);
      }
    }

    if (binding.type === 'Autocomplete') {
      baseItem.extension.push(this.getAutocompleteExtension());
    }

    if (binding.type === 'Select (Multiple)' || binding.repeatable) {
      baseItem.repeats = true;
    }

    if (binding.type === 'Decimal' && binding.unit) {
      baseItem.extension.push({
        url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-unit',
        valueCoding: {
          system: binding.unit.system,
          code: binding.unit.code,
          display: binding.unit.display
        }
      });
    }

    return baseItem;
  }

  initializeBaseItem(binding: any, index: number) {
    const item: any = {
      linkId: (index + 1).toString(),
      text: binding.title,
      type: this.getQuestionnaireItemType(binding.type)
    };

    if (binding.code) {
      item.code = [{
        system: 'http://snomed.info/sct',
        code: binding.code.code,
        display: binding.code.display
      }];
    }

    return item;
  }

  getQuestionnaireItemType(type: any) {
    switch (type) {
      case 'Section header':
        return 'display';
      case 'Select (Single)':
      case 'Select (Multiple)':
      case 'Options':
      case 'Checkbox multiple':
      case 'Autocomplete':
      case 'Multi-prefix search select':
        return 'choice';
      case 'Text box':
        return 'text';
      case 'Integer':
        return 'integer';
      case 'Decimal':
        return 'decimal';
      default:
        console.warn(`Unhandled binding type: ${type}`);
        return null;
    }
  }

  getExtensionForSelectableTypes() {
    return [{
      url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-preferredTerminologyServer',
      valueUrl: 'https://snomedbrowser.org/fhir'
    }];
  }

  getAutocompleteExtension() {
    return {
      url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
      valueCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/questionnaire-item-control',
          code: 'autocomplete',
          display: 'Auto-complete'
        }]
      }
    };
  }

  /**
   * SDC answerExpression (x-fhir-query) that expands the linked ECL with the source
   * item's answer embedded, plus enableWhen so the item opens once the source is answered.
   */
  addLinkedAnswerExpression(item: any, binding: any): void {
    const sourceIndex = this.bindings.findIndex((b) => b.id === binding.linkedFrom);
    if (sourceIndex < 0) {
      return;
    }
    const sourceLinkId = (sourceIndex + 1).toString();
    const sourceCode = `{{%resource.repeat(item).where(linkId='${sourceLinkId}').answer.value.code}}`;
    const ecl = this.terminologyService
      .stripEclTermAnnotations(binding.eclTemplate)
      .split(LINKED_SOURCE_PLACEHOLDER)
      .map((part: string) => encodeURIComponent(part))
      .join(sourceCode);
    item.extension.push({
      url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-answerExpression',
      valueExpression: {
        language: 'application/x-fhir-query',
        expression: `ValueSet/$expand?url=http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${ecl}`,
      },
    });
    item.enableWhen = [{ question: sourceLinkId, operator: 'exists', answerBoolean: true }];
  }

  getAnswerValueSet(binding: any) {
    const vs = binding?.valueSetUrl?.trim();
    if (vs) {
      return vs;
    }
    return `http://snomed.info/sct/900000000000207008?fhir_vs=ecl%2F${encodeURIComponent(binding.ecl)}`;
  }

  async getAnswerExpansionPreview(
    spec: { ecl?: string; valueSetUrl?: string },
    maxCount: number
  ): Promise<any> {
    const response = await lastValueFrom(
      this.terminologyService.expandBindingAnswerValueSet(spec, '', 0, maxCount).pipe(map((res: any) => res))
    );
    return response;
  }

  edit(i: number) {
    this.indexInEdit = i;
    this.editorMode = 'edit';
    const binding = this.bindings[i];
    const vsPick: ValueSetSummary | null = binding.valueSetUrl
      ? { url: binding.valueSetUrl, title: binding.valueSetTitle || binding.valueSetUrl }
      : null;
    const linked = isLinkedBinding(binding);
    this.newBindingForm.setValue({
      title: binding.title,
      code: binding.code ? binding.code : '',
      type: binding.type,
      answerSource: linked ? 'linked' : binding.valueSetUrl ? 'valueset' : 'ecl',
      ecl: binding.valueSetUrl || linked ? '' : binding.ecl,
      linkedFrom: linked ? binding.linkedFrom : null,
      linkedAttribute: linked ? binding.linkedAttribute : null,
      linkedOperator: linked ? (binding.linkedOperator ?? '<<') : '<<',
      eclTemplate: linked ? binding.eclTemplate : '',
      valueSetEntry: vsPick,
      value: binding.value,
      unit: binding.unit ? binding.unit : null,
      note: binding.note,
      repeatable: binding.repeatable,
    }, { emitEvent: false });
    this.linkedSource$.next(linked ? this.bindings.find((b) => b.id === binding.linkedFrom) ?? null : null);

    if (vsPick) {
      this.loadValueSetsIfNeeded();
    }

    if (this.isTabletViewport) {
      this.editorSheetOpen = true;
    }
  }

  onDrop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.bindings, event.previousIndex, event.currentIndex);
  }

  getErrors(controlName: string) {
    const control = this.newBindingForm.get(controlName);
    if (control) {
      return control.errors;
    }
    return null;
  }

  getErrorMessage(controlName: string) {
    const errors = this.getErrors(controlName);
    if (!errors) {
      return null;
    }
    if (errors['required']) {
      if (controlName === 'valueSetEntry') {
        return 'Select a ValueSet from the server';
      }
      if (controlName === 'linkedFrom') {
        return 'Select the field to link to';
      }
      if (controlName === 'linkedAttribute') {
        return 'Select an attribute';
      }
      return 'This field is required';
    }
    if (errors['missingPlaceholder']) {
      return `The template must contain ${LINKED_SOURCE_PLACEHOLDER}`;
    }
    if (errors['maxlength']) {
      return `This field must be less than ${errors['maxlength'].requiredLength} characters`;
    }
    if (errors['selectTooManyResults']) {
      return `Too many results (Max = ${this.maxSelectCount})`;
    }
    if (errors['optionsTooManyResults']) {
      return `Too many results (Max = ${this.maxOptionsCount})`;
    }
    if (errors['multiPrefixTooManyResults']) {
      return `Too many results (Max = ${this.maxMultiPrefixCount})`;
    }
    return null;
  }

  refreshResponse() {
    this.response = {};
    for (const binding of this.bindings) {
      this.response[binding.title] = {};
      if (binding.code) {
        this.response[binding.title].code = binding.code;
      }
      if (binding.unit) {
        this.response[binding.title].unit = binding.unit;
      }
    }
    for (const [key] of Object.entries(this.output)) {
      if (this.output[key].code) {
        this.response[key].code = this.output[key].code;
      }
      if (this.output[key].value) {
        this.response[key].value = this.output[key].value;
      }
    }
    this.responseStr = JSON.stringify(this.response, null, 2);
    this.refreshResponseBundle();
  }

  refreshResponseBundle() {
    this.responseBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: []
    };

    for (const [, valuet] of Object.entries(this.response)) {
      const value = valuet as any;
      const code = value.code ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: value.code.code,
          display: value.code.display
        }]
      } : undefined;
      const valueCodeableConcept = value.value?.code ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: value.value.code,
          display: value.value.display
        }]
      } : undefined;
      const unit = value.unit ? {
        coding: [{
          system: 'http://snomed.info/sct',
          code: value.unit.code,
          display: value.unit.display
        }]
      } : undefined;

      const observation: any = {
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey'
          }]
        }],
        subject: {
          reference: 'Patient/123'
        },
      };

      if (code) {
        observation.code = code;
      } else {
        observation.code = {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '363788007',
            display: 'Clinical history/examination observable (observable entity)'
          }]
        };
      }

      if (valueCodeableConcept) {
        observation.valueCodeableConcept = valueCodeableConcept;
      }
      if (value.value && typeof value.value === 'string') {
        observation.valueString = value.value;
      }
      if (unit) {
        observation.valueQuantity = {
          value: value.value,
          unit: unit.coding[0].display,
          system: unit.coding[0].system,
          code: unit.coding[0].code
        };
      }

      if (observation.valueCodeableConcept || observation.valueString || observation.valueQuantity) {
        this.responseBundle.entry.push(observation);
      }
    }

    this.responseBundleStr = JSON.stringify(this.responseBundle, null, 2);
  }

  optionSelected(title: string, code: string, event: any) {
    this.output[title] = {
      code,
      value: event
    };

    if (!code) {
      delete this.output[title].code;
    }

    this.outputStr = JSON.stringify(this.output, null, 2);
    this.refreshResponse();
  }

  addRepetition(binding: any) {
    binding.count++;
  }

  removeRepetition(binding: any) {
    binding.count--;
  }

  loadExample1() {
    this.formTitle = this.example1.title;
    this.bindings = this.example1.bindings;
    ensureBindingIds(this.bindings);
    this.refreshFhirQuestionnaire();
    this.clearOutput();
    this.refreshResponse();
  }

  cancelEdit() {
    this.formDirective.resetForm(this.formDefaults());
    this.indexInEdit = -1;
    this.editorMode = 'create';
    if (this.isTabletViewport) {
      this.editorSheetOpen = false;
    }
  }

  clear() {
    this.bindings = [];
    this.clearOutput();
    this.formDirective.resetForm(this.formDefaults());
    this.formTitle = 'My new form';
    this.indexInEdit = -1;
    this.editorMode = 'create';
  }

  clearOutput() {
    this.output = {};
    this.outputStr = '{}';
    this.sourceValues = {};
    const savedBindings = JSON.parse(JSON.stringify(this.bindings));
    this.bindings = [];
    this.bindings = savedBindings;
  }

  saveForm() {
    this.bindings.forEach((binding: any) => {
      binding.count = 1;
    });
    const blob = new Blob([JSON.stringify({ title: this.formTitle, bindings: this.bindings }, null, 2)], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${this.formTitle}.json`);
  }

  saveOutput(text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${this.formTitle}-data.json`);
  }

  saveFhirQuestionnaire(text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${this.formTitle}-fhir-questionnaire.json`);
  }

  saveBundleOutput(text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${this.formTitle}-fhir-bundle.json`);
  }

  copyOutputToClipboard(text: string) {
    this.clipboard.copy(text);
  }

  uploadFile(event: any) {
    if (event.target.files.length !== 1) {
      console.error('No file selected');
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const uploadedVersion = JSON.parse(reader.result.toString());
          if (Array.isArray(uploadedVersion)) {
            this.bindings = uploadedVersion;
            this.formTitle = 'My new form';
          } else {
            this.bindings = [];
            this.bindings = uploadedVersion.bindings;
            this.bindings.forEach((binding: any) => {
              binding.count = 1;
            });
            this.formTitle = uploadedVersion.title;
          }

          ensureBindingIds(this.bindings);
          this.bindings.forEach((binding: any) => {
            if (!binding.repeatable) {
              binding.repeatable = false;
            }
            if (!binding.count) {
              binding.count = 1;
            }
          });

          this.clearOutput();
          this.refreshResponse();
          this.refreshFhirQuestionnaire();
        }
      };
      reader.readAsText(event.target.files[0]);
    }
  }

  openEclBuilder(ecl: any, controlName: string) {
    this.eclBuilderDialog.open(ecl ?? '').subscribe(result => {
      if (result !== null) {
        const control = this.newBindingForm.get(controlName);
        if (control) {
          control.setValue(result);
        }
      }
    });
  }

  toggleCodeBinding() {
    this.codeBinding = this.codeBinding === this.codeBindingAll ? this.codeBindingObservables : this.codeBindingAll;
  }

  toggleCheckboxBinding() {
    this.checkboxBinding = this.checkboxBinding.ecl === this.codeBindingAll.ecl
      ? JSON.parse(JSON.stringify(this.codeBindingObservables))
      : JSON.parse(JSON.stringify(this.codeBindingAll));
    this.checkboxBinding.title = this.checkboxBinding.title.replace('Question', 'Checkbox');
  }
}
