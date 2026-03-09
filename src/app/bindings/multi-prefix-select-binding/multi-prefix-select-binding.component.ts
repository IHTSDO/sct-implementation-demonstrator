import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatFormFieldAppearance } from '@angular/material/form-field';
import { TerminologyService } from '../../services/terminology.service';

interface SnomedOption {
  code: string;
  display: string;
}

@Component({
  selector: 'app-multi-prefix-select-binding',
  templateUrl: './multi-prefix-select-binding.component.html',
  styleUrls: ['./multi-prefix-select-binding.component.css'],
  standalone: false
})
export class MultiPrefixSelectBindingComponent implements OnInit, OnChanges, OnDestroy {
  @Input() binding!: {
    title?: string;
    type?: string;
    ecl?: string;
    note?: string;
  };
  @Input() expansionCount = 1000;
  @Input() term: SnomedOption | SnomedOption[] | null = null;
  @Input() readonly = false;
  @Input() appearance: MatFormFieldAppearance = 'fill';
  @Output() selectionChange = new EventEmitter<SnomedOption | SnomedOption[] | null>();

  options: SnomedOption[] = [];
  filteredOptions: SnomedOption[] = [];
  selectedOption: SnomedOption | null = null;
  selectedOptions: SnomedOption[] = [];
  searchCtrl = new FormControl('');
  isLoading = false;

  private readonly destroy$ = new Subject<void>();

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit(): void {
    this.loadOptions();
    this.searchCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      this.applyFilter((value || '').toString());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['binding'] && !changes['binding'].firstChange) {
      this.selectedOption = null;
      this.selectedOptions = [];
      this.searchCtrl.setValue('', { emitEvent: false });
      this.loadOptions();
    }

    if (changes['term'] && !changes['term'].firstChange) {
      this.syncSelectionFromTerm();
    }
  }

  get isMultiple(): boolean {
    return this.binding?.type === 'Select (Multiple)';
  }

  get selectedCodeHint(): string {
    if (this.isMultiple || !this.selectedOption?.code) {
      return '';
    }
    return `SNOMED CT: ${this.selectedOption.code}`;
  }

  onSelectionChanged(): void {
    if (this.isMultiple) {
      this.selectionChange.emit(this.selectedOptions);
      return;
    }
    this.selectionChange.emit(this.selectedOption);
  }

  onModelChange(value: SnomedOption | SnomedOption[] | null): void {
    if (this.isMultiple) {
      this.selectedOptions = Array.isArray(value) ? value : [];
    } else {
      this.selectedOption = Array.isArray(value) ? null : value;
    }
    this.onSelectionChanged();
  }

  private loadOptions(): void {
    if (!this.binding?.ecl) {
      this.options = [];
      this.filteredOptions = [];
      return;
    }

    this.isLoading = true;
    this.terminologyService
      .expandValueSetUsingCache(this.binding.ecl, '', 0, this.expansionCount)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const contains = (response?.expansion?.contains || []) as SnomedOption[];
          this.options = this.sortOptions(contains);
          this.syncSelectionFromTerm();
          this.applyFilter(this.searchCtrl.value || '');
          this.isLoading = false;
        },
        error: () => {
          this.options = [];
          this.filteredOptions = [];
          this.isLoading = false;
        }
      });
  }

  private syncSelectionFromTerm(): void {
    if (this.isMultiple) {
      const requested = Array.isArray(this.term) ? this.term : [];
      this.selectedOptions = requested
        .map((item) => this.findOption(item))
        .filter((item): item is SnomedOption => !!item);
      return;
    }

    this.selectedOption = Array.isArray(this.term) ? null : this.findOption(this.term);
  }

  private findOption(option: SnomedOption | null): SnomedOption | null {
    if (!option?.code) {
      return null;
    }

    return this.options.find((candidate) => candidate.code === option.code) ?? option;
  }

  private applyFilter(rawQuery: string): void {
    const query = rawQuery.trim();
    if (!query) {
      this.filteredOptions = [...this.options];
      return;
    }

    const queryTokens = this.tokenize(query);
    this.filteredOptions = this.options.filter((option) =>
      this.matchesMultiPrefix(`${option.display} ${option.code}`, queryTokens)
    );
  }

  private matchesMultiPrefix(text: string, queryTokens: string[]): boolean {
    if (!queryTokens.length) {
      return true;
    }
    const words = this.tokenize(text);
    return queryTokens.every((token) => words.some((word) => word.startsWith(token)));
  }

  private tokenize(value: string): string[] {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private sortOptions(options: SnomedOption[]): SnomedOption[] {
    return [...options].sort((a, b) => {
      const byLength = a.display.length - b.display.length;
      if (byLength !== 0) {
        return byLength;
      }
      return a.display.localeCompare(b.display);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
