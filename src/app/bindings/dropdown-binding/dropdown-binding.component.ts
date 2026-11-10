import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';
import { FormControl } from '@angular/forms';
import { Subject, takeUntil, startWith, map, switchMap } from 'rxjs';

@Component({
  selector: 'app-dropdown-binding',
  templateUrl: './dropdown-binding.component.html',
  styleUrls: ['./dropdown-binding.component.css'],
  standalone: false
})
export class DropdownBindingComponent implements OnInit, OnDestroy {
  @Input()  binding!: any;
  /** Concept preselected once the options load (matched by code). */
  @Input()  initialValue: { code: string } | null = null;
  @Output() selectionChange = new EventEmitter<any[]>();

  private options: any[] = [];
  filteredOptions: any[] = [];
  selectedOptions: any = [];
  searchCtrl = new FormControl('');
  showSearch = false;

  private destroy$ = new Subject<void>();

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit(): void {
    // Re-expand when the edition or language changes so displays follow the selection.
    let firstLoad = true;
    this.terminologyService.editionAndLanguageNow$()
      .pipe(
        switchMap(() => this.terminologyService.expandBindingAnswerValueSet(this.binding, '', 0, 1500)),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        this.options = res?.expansion?.contains ?? [];
        if (firstLoad) {
          this.applyInitialValue();
          firstLoad = false;
        } else {
          this.remapSelection();
        }
        this.applyFilter((this.searchCtrl.value ?? '').toLowerCase());

        // decide whether search should be available
        this.showSearch = this.options.length > 5;
        if (this.showSearch) {
          this.searchCtrl.enable({ emitEvent: false });
        } else {
          this.searchCtrl.disable({ emitEvent: false });
        }
      });

    this.searchCtrl.valueChanges
      .pipe(
        startWith(''),
        map(term => (term ?? '').toLowerCase()),
        takeUntil(this.destroy$)
      )
      .subscribe(term => this.applyFilter(term));
  }

  private applyFilter(term: string): void {
    this.filteredOptions = this.showSearch && term
      ? this.options.filter(o => `${o.display ?? ''}`.toLowerCase().includes(term))
      : [...this.options];
  }

  /** Point the current selection at the reloaded option objects (same codes, new displays). */
  private remapSelection(): void {
    const byCode = (o: any) => this.options.find(opt => `${opt.code}` === `${o?.code}`) ?? o;
    if (Array.isArray(this.selectedOptions)) {
      this.selectedOptions = this.selectedOptions.map(byCode);
    } else if (this.selectedOptions) {
      this.selectedOptions = byCode(this.selectedOptions);
    }
  }

  private applyInitialValue(): void {
    const match = this.initialValue?.code
      ? this.options.find(o => `${o.code}` === `${this.initialValue?.code}`)
      : undefined;
    if (match) {
      this.selectedOptions = this.binding.type === 'Select (Multiple)' ? [match] : match;
    }
  }

  /** emit selected values to parent */
  notify() { this.selectionChange.emit(this.selectedOptions); }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
