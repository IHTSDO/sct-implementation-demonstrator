import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable, Subject, catchError, map, of, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import {
  LinkedConcept,
  linkedOperatorIncludesSelf,
  resolveLinkedEcl,
} from './linked-binding.utils';

interface LinkedState {
  status: 'waiting' | 'loading' | 'empty' | 'ready';
  binding?: any;
  renderType?: string;
  defaultValue?: LinkedConcept | null;
  /** True when the options are the attribute's MRCM range because the source concept has no value. */
  fromRange?: boolean;
  /** Changes on every resolution so the inner control is recreated with a fresh selection. */
  key: number;
}

/**
 * Renders a binding whose answer options derive from the concept selected in another
 * field: the options are the resolved `eclTemplate`, and the default value is the
 * source concept's attribute value when there is exactly one. When the source concept
 * has no value for the attribute, the options widen to the attribute's MRCM range.
 */
@Component({
  selector: 'app-linked-binding',
  templateUrl: './linked-binding.component.html',
  styleUrls: ['./linked-binding.component.css'],
  standalone: false
})
export class LinkedBindingComponent implements OnInit, OnChanges, OnDestroy {
  @Input() binding: any;
  @Input() sourceConcept: LinkedConcept | null = null;
  @Input() sourceTitle = '';
  @Input() editionUri?: string;
  @Input() maxOptionsCount = 10;
  @Output() selectionChange = new EventEmitter<any>();

  state: LinkedState = { status: 'waiting', key: 0 };

  private resolve$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private lastSourceCode = '';
  private nextKey = 1;

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit(): void {
    this.resolve$
      .pipe(
        switchMap((code) => this.resolveState(code)),
        takeUntil(this.destroy$)
      )
      .subscribe((state) => {
        this.state = state;
        if (state.status === 'ready' && state.defaultValue) {
          this.selectionChange.emit(
            state.renderType === 'Select (Multiple)' ? [state.defaultValue] : state.defaultValue
          );
        }
      });
    this.refresh(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceConcept'] && !changes['sourceConcept'].firstChange) {
      this.refresh(false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get attributeLabel(): string {
    return this.binding?.linkedAttribute?.display || 'attribute';
  }

  onSelection(value: any): void {
    // The range autocomplete picks one concept; keep the multiple-select answer shape.
    if (this.state.fromRange && this.binding?.type === 'Select (Multiple)') {
      this.selectionChange.emit(value ? [value] : []);
      return;
    }
    this.selectionChange.emit(value);
  }

  private refresh(initial: boolean): void {
    const code = this.sourceConcept?.code || '';
    if (!initial && code === this.lastSourceCode) {
      return;
    }
    const hadSource = !!this.lastSourceCode;
    this.lastSourceCode = code;
    if (hadSource) {
      // The previous answer referred to another source concept; drop it.
      this.selectionChange.emit(null);
    }
    this.resolve$.next(code);
  }

  private resolveState(code: string): Observable<LinkedState> {
    if (!code) {
      return of({ status: 'waiting', key: this.nextKey++ } as LinkedState);
    }
    const attributeId = this.binding?.linkedAttribute?.code;
    const loading: LinkedState = { status: 'loading', key: this.state.key };
    this.state = loading;

    return this.terminologyService.getAttributeValues(code, attributeId).pipe(
      switchMap((values) => {
        if (!values.length) {
          return this.resolveRangeState(code);
        }
        const ecl = resolveLinkedEcl(this.binding.eclTemplate, code);
        const resolvedBinding = { ...this.binding, ecl };
        const defaultValue =
          values.length === 1 && linkedOperatorIncludesSelf(this.binding.linkedOperator) ? values[0] : null;
        return this.getRenderType(resolvedBinding).pipe(
          map((renderType) => ({
            status: 'ready',
            binding: resolvedBinding,
            renderType,
            defaultValue,
            key: this.nextKey++,
          } as LinkedState))
        );
      })
    );
  }

  /**
   * Options for a source concept without the attribute: any value in the attribute's
   * range, as the ECL builder offers. Uses the range stored with the binding, or reads
   * it from the MRCM domain of the source concept for bindings saved without one.
   */
  private resolveRangeState(code: string): Observable<LinkedState> {
    return this.getAttributeRange(code).pipe(
      map((range) => {
        if (!range) {
          return { status: 'empty', key: this.nextKey++ } as LinkedState;
        }
        const resolvedBinding = {
          ...this.binding,
          ecl: range,
          note: `${this.sourceConcept?.display || 'The linked concept'} has no ${this.attributeLabel}: search any value allowed by the concept model.`,
        };
        return {
          status: 'ready',
          binding: resolvedBinding,
          // A range is usually too large for radios or a dropdown.
          renderType: 'Autocomplete',
          defaultValue: null,
          fromRange: true,
          key: this.nextKey++,
        } as LinkedState;
      })
    );
  }

  private getAttributeRange(code: string): Observable<string> {
    const stored = `${this.binding?.linkedRange || ''}`.trim();
    if (stored) {
      return of(stored);
    }
    const attributeId = this.binding?.linkedAttribute?.code;
    return this.terminologyService.getDomainAttributes([code]).pipe(
      map((items) => {
        const attribute = items.find((item: any) => `${item?.conceptId}` === `${attributeId}`);
        return `${attribute?.attributeRange?.[0]?.rangeConstraint || ''}`.trim();
      }),
      catchError(() => of(''))
    );
  }

  /**
   * Radio lists cannot grow with the source concept: when the resolved options exceed
   * the Options limit, fall back to an autocomplete.
   */
  private getRenderType(resolvedBinding: any): Observable<string> {
    if (resolvedBinding.type !== 'Options') {
      return of(resolvedBinding.type);
    }
    return this.terminologyService
      .expandBindingAnswerValueSet(resolvedBinding, '', 0, this.maxOptionsCount + 1)
      .pipe(
        map((res: any) => {
          const total = res?.expansion?.total ?? res?.expansion?.contains?.length ?? 0;
          return total > this.maxOptionsCount ? 'Autocomplete' : 'Options';
        })
      );
  }
}
