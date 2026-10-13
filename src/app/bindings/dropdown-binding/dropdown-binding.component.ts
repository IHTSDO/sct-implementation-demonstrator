import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { TerminologyService } from '../../services/terminology.service';
import { FormControl } from '@angular/forms';
import { Subject, takeUntil, startWith, map } from 'rxjs';

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
    this.terminologyService.expandBindingAnswerValueSet(this.binding, '', 0, 1500)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.options         = res?.expansion?.contains ?? [];
        this.filteredOptions = [...this.options];
        this.applyInitialValue();

        // decide whether search should be available
        this.showSearch = this.options.length > 5;
        if (!this.showSearch) {
          this.searchCtrl.disable({ emitEvent: false });
        }
      });

    this.searchCtrl.valueChanges
      .pipe(
        startWith(''),
        map(term => (term ?? '').toLowerCase()),
        takeUntil(this.destroy$)
      )
      .subscribe(term => {
        if (this.showSearch) {
          this.filteredOptions = this.options
            .filter(o => o.display.toLowerCase().includes(term));
        }
      });
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
