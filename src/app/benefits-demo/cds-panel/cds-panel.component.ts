import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CdsService,
  CDSServerExecutionResult,
  HookExecutionSnapshot,
  STANDARD_CDS_HOOK_LABELS,
  StandardCdsHook
} from '../../services/cds.service';
import type { AllergyIntolerance, Condition, MedicationStatement, Patient } from '../../model';

export interface CdsState {
  isLoading: boolean;
  hasError: boolean;
  hasNoData: boolean;
  hasRecommendations: boolean;
  hasExecuted: boolean;
  recommendationCount: number;
  errorMessage: string | null;
  noDataMessage: string | null;
}

@Component({
  selector: 'app-cds-panel',
  templateUrl: './cds-panel.component.html',
  styleUrls: ['./cds-panel.component.css'],
  standalone: false
})
export class CdsPanelComponent implements OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() conditions: Condition[] = [];
  @Input() medications: MedicationStatement[] = [];
  @Input() allergies: AllergyIntolerance[] = [];
  @Input() autoTrigger: boolean = false;
  @Input() showHookSelector: boolean = true;
  @Input() stateMode: 'selected' | 'latest' = 'selected';
  @Output() stateChange = new EventEmitter<CdsState>();

  readonly STANDARD_CDS_HOOK_LABELS = STANDARD_CDS_HOOK_LABELS;
  readonly hookOptions: StandardCdsHook[] = ['patient-view', 'order-select', 'order-sign', 'problem-list-item-create', 'allergyintolerance-create'];
  selectedHook: StandardCdsHook = 'patient-view';
  hookSnapshots: Record<StandardCdsHook, HookExecutionSnapshot> = this.createEmptySnapshotMap();

  private hooksSubscription?: Subscription;

  constructor(private cdsService: CdsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) {
      this.subscribeToHookStore();
    }

    if (!this.patient) {
      this.hookSnapshots = this.createEmptySnapshotMap();
      this.emitStateChange();
      return;
    }

    if (this.stateMode === 'latest') {
      this.syncSelectedHookToLatest();
    }

    this.emitStateChange();
  }

  ngOnDestroy(): void {
    this.hooksSubscription?.unsubscribe();
  }

  selectHook(hook: StandardCdsHook): void {
    this.selectedHook = hook;
    this.emitStateChange();
  }

  refreshSelectedHook(): void {
    if (!this.patient) {
      return;
    }

    this.cdsService.rerunHook(this.patient.id, this.getDisplayedHook()).subscribe();
  }

  getDisplayedHook(): StandardCdsHook {
    if (this.stateMode === 'latest') {
      const latestHook = this.getLatestHook();
      return latestHook || this.selectedHook;
    }
    return this.selectedHook;
  }

  getDisplayedHookLabel(): string {
    return STANDARD_CDS_HOOK_LABELS[this.getDisplayedHook()];
  }

  getDisplayedSnapshot(): HookExecutionSnapshot {
    return this.hookSnapshots[this.getDisplayedHook()];
  }

  isCdsLoading(): boolean {
    return this.getDisplayedSnapshot().isLoading;
  }

  getCdsError(): string | null {
    return this.getDisplayedSnapshot().errorMessage;
  }

  getCdsNoDataMessage(): string | null {
    return this.getDisplayedSnapshot().noDataMessage;
  }

  getTotalRecommendationCount(): number {
    return this.getDisplayedSnapshot().results.reduce((total, result) => total + (result.response?.cards?.length || 0), 0);
  }

  getSuccessfulServerResults(): CDSServerExecutionResult[] {
    return this.getDisplayedSnapshot().results.filter((result) => !result.error && !!result.response);
  }

  getServerResultsWithCards(): CDSServerExecutionResult[] {
    return this.getSuccessfulServerResults().filter((result) => (result.response?.cards?.length || 0) > 0);
  }

  getServerResultsWithoutCards(): CDSServerExecutionResult[] {
    return this.getSuccessfulServerResults().filter((result) => (result.response?.cards?.length || 0) === 0);
  }

  getErroredServerResults(): CDSServerExecutionResult[] {
    return this.getDisplayedSnapshot().results.filter((result) => !!result.error);
  }

  hasAnyServerResponse(): boolean {
    return this.getDisplayedSnapshot().results.length > 0;
  }

  showGroupedResults(): boolean {
    return this.hasAnyServerResponse() && (this.getServerResultsWithCards().length > 0 || this.getErroredServerResults().length > 0);
  }

  showNoRecommendations(): boolean {
    return this.hasAnyServerResponse()
      && this.getSuccessfulServerResults().length > 0
      && this.getErroredServerResults().length === 0
      && this.getTotalRecommendationCount() === 0;
  }

  getServerDisplayName(result: CDSServerExecutionResult): string {
    return result.server.name || result.server.baseUrl;
  }

  getServerStatusLabel(result: CDSServerExecutionResult): string {
    return result.mode === 'legacy' ? 'legacy fallback' : result.serviceTitle;
  }

  getHookLastUpdatedLabel(hook: StandardCdsHook): string {
    const snapshot = this.hookSnapshots[hook];
    if (!snapshot.lastUpdated) {
      return 'No run yet';
    }
    return new Date(snapshot.lastUpdated).toLocaleTimeString();
  }

  getCardIcon(indicator: string): string {
    switch (indicator) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }

  getCardIconColor(indicator: string): string {
    switch (indicator) {
      case 'critical':
        return 'warn';
      case 'warning':
        return 'accent';
      case 'info':
      default:
        return 'primary';
    }
  }

  openSourceUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private subscribeToHookStore(): void {
    this.hooksSubscription?.unsubscribe();

    if (!this.patient) {
      return;
    }

    this.hooksSubscription = this.cdsService.watchPatientHooks(this.patient.id).subscribe((snapshots) => {
      this.hookSnapshots = snapshots;
      if (this.stateMode === 'latest') {
        this.syncSelectedHookToLatest();
      }
      this.emitStateChange();
    });
  }

  private syncSelectedHookToLatest(): void {
    const latestHook = this.getLatestHook();
    if (latestHook) {
      this.selectedHook = latestHook;
    }
  }

  private getLatestHook(): StandardCdsHook | null {
    return [...this.hookOptions]
      .sort((a, b) => (this.hookSnapshots[b].lastUpdated || '').localeCompare(this.hookSnapshots[a].lastUpdated || ''))[0] || null;
  }

  private emitStateChange(): void {
    const snapshot = this.getDisplayedSnapshot();
    const recommendationCount = this.getTotalRecommendationCount();
    this.stateChange.emit({
      isLoading: snapshot.isLoading,
      hasError: !!snapshot.errorMessage,
      hasNoData: !!snapshot.noDataMessage,
      hasRecommendations: recommendationCount > 0,
      hasExecuted: !!snapshot.lastUpdated || snapshot.results.length > 0 || snapshot.isLoading,
      recommendationCount,
      errorMessage: snapshot.errorMessage,
      noDataMessage: snapshot.noDataMessage
    });
  }

  private createEmptySnapshotMap(): Record<StandardCdsHook, HookExecutionSnapshot> {
    return {
      'patient-view': this.createEmptySnapshot('patient-view'),
      'order-select': this.createEmptySnapshot('order-select'),
      'order-sign': this.createEmptySnapshot('order-sign'),
      'problem-list-item-create': this.createEmptySnapshot('problem-list-item-create'),
      'allergyintolerance-create': this.createEmptySnapshot('allergyintolerance-create')
    };
  }

  private createEmptySnapshot(hook: StandardCdsHook): HookExecutionSnapshot {
    return {
      hook,
      results: [],
      isLoading: false,
      errorMessage: null,
      noDataMessage: null,
      lastUpdated: null,
      context: null
    };
  }
}
