import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EclBuilderService } from './ecl-builder.service';
import { EclExpressionConstraint } from './ecl-builder.models';

@Component({
  selector: 'app-ecl-builder',
  templateUrl: './ecl-builder.component.html',
  styleUrls: ['./ecl-builder.component.css'],
  standalone: false
})
export class EclBuilderComponent implements OnInit, OnChanges, OnDestroy {
  @Input() eclString = '';
  @Output() eclStringChange = new EventEmitter<string>();
  @Output() validityChange = new EventEmitter<boolean>();

  model: EclExpressionConstraint | null = null;
  generatedEcl = '';
  loading = false;
  loadingMessage = 'Loading ECL model';
  errorMessage = '';
  unsupportedMessage = '';

  private readonly renderRequests = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private lastEmittedModelSnapshot = '';
  private lastLoadedEclString = '';
  private suppressNextInputSync = false;

  constructor(private eclBuilderService: EclBuilderService) {}

  ngOnInit(): void {
    this.renderRequests
      .pipe(
        debounceTime(150),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((snapshot) => {
          if (!this.model || snapshot !== JSON.stringify(this.model)) {
            return of(null);
          }
          return this.eclBuilderService.modelToString(this.model).pipe(
            catchError(() => {
              this.errorMessage = 'Unable to generate ECL from the current model.';
              this.updateValidity(false);
              return of('');
            })
          );
        })
      )
      .subscribe((generated) => {
        if (generated === null) {
          return;
        }

        this.generatedEcl = generated || '';
        this.suppressNextInputSync = true;
        this.eclStringChange.emit(this.generatedEcl);
        this.updateValidity(this.isRenderable());
      });

    this.loadModel();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eclString'] && !changes['eclString'].firstChange) {
      const nextValue = changes['eclString'].currentValue ?? '';

      if (this.suppressNextInputSync && nextValue === this.generatedEcl) {
        this.suppressNextInputSync = false;
        this.lastLoadedEclString = nextValue;
        return;
      }

      if (nextValue === this.lastLoadedEclString) {
        return;
      }

      this.loadModel();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onModelChanged(): void {
    if (!this.model) {
      return;
    }

    this.errorMessage = '';
    this.unsupportedMessage = '';
    const unsupported = this.eclBuilderService.collectUnsupportedFeatures(this.model);
    if (unsupported.length) {
      this.unsupportedMessage = `Unsupported in this Angular MVP: ${unsupported.join(', ')}.`;
      this.updateValidity(false);
      return;
    }

    if (!this.isRenderable()) {
      this.updateValidity(false);
      return;
    }

    const snapshot = JSON.stringify(this.model);
    if (snapshot === this.lastEmittedModelSnapshot) {
      return;
    }

    this.lastEmittedModelSnapshot = snapshot;
    this.renderRequests.next(snapshot);
  }

  canAddRefinement(): boolean {
    const focus = this.model?.subexpressionConstraint ?? this.model;
    return !!(this.model && !this.hasCompoundConstraints() && focus && !this.model.eclRefinement && (focus.conceptId || focus.wildcard));
  }

  addRefinement(): void {
    if (!this.model) {
      return;
    }

    this.eclBuilderService.addRefinement(this.model);
    this.onModelChanged();
  }

  canAddCompoundConstraint(): boolean {
    const focus = this.model?.subexpressionConstraint ?? this.model;
    return !!(focus && (focus.conceptId || focus.wildcard));
  }

  canAddCompoundFromConstraint(constraint: EclExpressionConstraint | null | undefined): boolean {
    return !!constraint && this.eclBuilderService.hasResolvedConcept(constraint);
  }

  addCompoundConstraint(type: 'conjunction' | 'disjunction'): void {
    if (!this.model) {
      return;
    }

    if (this.model.eclRefinement) {
      delete this.model.eclRefinement;
      delete this.model.subexpressionConstraint;
    }

    this.eclBuilderService.addCompoundConstraint(this.model, type);
    this.onModelChanged();
  }

  removeCompoundConstraint(type: 'conjunction' | 'disjunction', index: number): void {
    if (!this.model) {
      return;
    }

    this.eclBuilderService.removeCompoundConstraint(this.model, type, index);
    this.onModelChanged();
  }

  get conjunctionConstraints(): EclExpressionConstraint[] {
    return this.model?.conjunctionExpressionConstraints ?? [];
  }

  get disjunctionConstraints(): EclExpressionConstraint[] {
    return this.model?.disjunctionExpressionConstraints ?? [];
  }

  trackConstraint(_: number, item: EclExpressionConstraint): string {
    return item.uiId ?? `${_}`;
  }

  hasCompoundConstraints(): boolean {
    return this.conjunctionConstraints.length > 0 || this.disjunctionConstraints.length > 0;
  }

  shouldShowRefinementSection(): boolean {
    return !!(this.model?.eclRefinement && !this.hasCompoundConstraints());
  }

  isLastCompoundConstraint(type: 'conjunction' | 'disjunction', index: number): boolean {
    if (type === 'disjunction') {
      return index === this.disjunctionConstraints.length - 1;
    }

    return this.disjunctionConstraints.length === 0 && index === this.conjunctionConstraints.length - 1;
  }

  private loadModel(): void {
    this.loading = true;
    this.loadingMessage = 'Loading ECL model';
    this.errorMessage = '';
    this.unsupportedMessage = '';
    this.lastLoadedEclString = this.eclString ?? '';

    this.eclBuilderService.stringToModel(this.eclString).subscribe({
      next: (model) => {
        this.model = model;
        this.loading = false;

        const unsupported = this.eclBuilderService.collectUnsupportedFeatures(model);
        if (unsupported.length) {
          this.unsupportedMessage = `Unsupported in this Angular MVP: ${unsupported.join(', ')}.`;
          this.generatedEcl = this.eclString || '';
          this.updateValidity(false);
          return;
        }

        this.lastEmittedModelSnapshot = '';
        this.onModelChanged();
      },
      error: () => {
        this.loading = false;
        this.model = null;
        this.errorMessage = 'Unable to parse the incoming ECL string.';
        this.updateValidity(false);
      }
    });
  }

  private isRenderable(): boolean {
    if (!this.model) {
      return false;
    }

    const compoundConstraints = [
      ...this.conjunctionConstraints,
      ...this.disjunctionConstraints
    ];

    if (compoundConstraints.length > 0) {
      const compoundsAreValid = compoundConstraints.every((constraint) => this.eclBuilderService.hasResolvedConcept(constraint));
      if (!compoundsAreValid) {
        return false;
      }
    } else {
      const focus = this.model.subexpressionConstraint ?? this.model;
      if (!this.eclBuilderService.hasResolvedConcept(focus)) {
        return false;
      }
    }

    if (compoundConstraints.length > 0 && this.model.eclRefinement) {
      return false;
    }

    const attributes = this.model.eclRefinement?.subRefinement?.eclAttributeSet;
    if (!attributes) {
      return true;
    }

    const allAttributes = [
      attributes.subAttributeSet,
      ...(attributes.conjunctionAttributeSet ?? [])
    ];

    return allAttributes.every((item) => {
      const attribute = item.attribute;
      return !!(
        this.eclBuilderService.hasResolvedConcept(attribute.attributeName) &&
        this.eclBuilderService.hasResolvedConcept(attribute.value) &&
        attribute.expressionComparisonOperator
      );
    });
  }

  private updateValidity(isValid: boolean): void {
    this.validityChange.emit(isValid);
  }
}
