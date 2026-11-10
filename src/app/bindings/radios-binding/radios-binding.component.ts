import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';

@Component({
    selector: 'app-radios-binding',
    templateUrl: './radios-binding.component.html',
    styleUrls: ['./radios-binding.component.css'],
    standalone: false
})
export class RadiosBindingComponent implements OnInit, OnDestroy {
  @Input() binding: any;
  /** Concept preselected when the options render (matched by code). */
  @Input() initialValue: { code: string } | null = null;
  @Output() selectionChange = new EventEmitter<any>();

  options: any[] | undefined;
  selectedCode: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(private terminologyService: TerminologyService) { }

  ngOnInit(): void {
    this.selectedCode = this.initialValue?.code ?? null;
    // Re-expand when the edition or language changes so displays follow the selection.
    this.terminologyService.editionAndLanguageNow$()
      .pipe(
        switchMap(() => this.terminologyService.expandBindingAnswerValueSet(this.binding, '', 0, 1500)),
        takeUntil(this.destroy$)
      )
      .subscribe(response => this.options = response?.expansion?.contains ?? []);
  }

  optionSelected(value: any) {
    this.selectedCode = value?.code ?? null;
    this.selectionChange.emit(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
