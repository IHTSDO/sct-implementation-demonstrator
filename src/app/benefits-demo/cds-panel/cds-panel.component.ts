import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CDSCard,
  CdsService,
  CDSServerExecutionResult,
  HookExecutionContextSnapshot,
  HookExecutionSnapshot,
  StandardCdsHook
} from '../../services/cds.service';
import { PatientService } from '../../services/patient.service';
import type { Patient } from '../../model';

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

export interface ServerCardGroup {
  server: CDSServerExecutionResult['server'];
  cards: CDSCard[];
}

@Component({
  selector: 'app-cds-panel',
  templateUrl: './cds-panel.component.html',
  styleUrls: ['./cds-panel.component.css'],
  standalone: false
})
export class CdsPanelComponent implements OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() autoTrigger: boolean = false;
  @Output() stateChange = new EventEmitter<CdsState>();

  hookSnapshots: Record<StandardCdsHook, HookExecutionSnapshot> = this.createEmptySnapshotMap();

  private hooksSubscription?: Subscription;

  constructor(private cdsService: CdsService, private patientService: PatientService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient']) {
      this.subscribeToHookStore();
    }

    if (!this.patient) {
      this.hookSnapshots = this.createEmptySnapshotMap();
    }

    this.emitStateChange();
  }

  ngOnDestroy(): void {
    this.hooksSubscription?.unsubscribe();
  }

  refreshAll(): void {
    if (!this.patient) {
      return;
    }

    const freshContext: HookExecutionContextSnapshot = {
      patient: this.patient,
      conditions: this.patientService.getPatientConditions(this.patient.id),
      medications: this.patientService.getPatientMedications(this.patient.id),
      allergies: this.patientService.getPatientAllergies(this.patient.id),
      observations: this.patientService.getPatientObservations(this.patient.id)
    };

    this.cdsService.invokePatientView(freshContext).subscribe();
  }

  isCdsLoading(): boolean {
    return this.getAllSnapshots().some((snapshot) => snapshot.isLoading);
  }

  getCdsError(): string | null {
    const messages = Array.from(new Set(this.getAllSnapshots().map((snapshot) => snapshot.errorMessage).filter((message): message is string => !!message)));
    return messages.length > 0 ? messages.join(' ') : null;
  }

  getCdsNoDataMessage(): string | null {
    if (this.hasAnyServerResponse() || this.isCdsLoading()) {
      return null;
    }
    const messages = Array.from(new Set(this.getAllSnapshots().map((snapshot) => snapshot.noDataMessage).filter((message): message is string => !!message)));
    return messages.length > 0 ? messages.join(' ') : null;
  }

  getTotalRecommendationCount(): number {
    return this.getServerCardGroups().reduce((total, group) => total + group.cards.length, 0);
  }

  getServerGroupsWithCards(): ServerCardGroup[] {
    return this.getServerCardGroups().filter((group) => group.cards.length > 0);
  }

  getServerGroupsWithoutCards(): ServerCardGroup[] {
    return this.getServerCardGroups().filter((group) => group.cards.length === 0);
  }

  getErroredServerResults(): CDSServerExecutionResult[] {
    const seen = new Set<string>();
    return this.getAllResults().filter((result) => !!result.error).filter((result) => {
      const key = `${result.server.id || result.server.baseUrl}|${result.error}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  hasAnyServerResponse(): boolean {
    return this.getAllResults().length > 0;
  }

  showGroupedResults(): boolean {
    return this.hasAnyServerResponse() && (this.getServerGroupsWithCards().length > 0 || this.getErroredServerResults().length > 0);
  }

  showNoRecommendations(): boolean {
    return this.hasAnyServerResponse()
      && this.getServerCardGroups().length > 0
      && this.getErroredServerResults().length === 0
      && this.getTotalRecommendationCount() === 0;
  }

  getServerDisplayName(entry: { server: CDSServerExecutionResult['server'] }): string {
    return entry.server.name || entry.server.baseUrl;
  }

  getServerGroupKey(group: ServerCardGroup): string {
    return group.server.id || group.server.baseUrl;
  }

  getLastUpdatedLabel(): string {
    const lastUpdated = this.getAllSnapshots()
      .map((snapshot) => snapshot.lastUpdated)
      .filter((value): value is string => !!value)
      .sort((a, b) => b.localeCompare(a))[0];
    return lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'No run yet';
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
      this.emitStateChange();
    });
  }

  private getAllSnapshots(): HookExecutionSnapshot[] {
    return Object.values(this.hookSnapshots);
  }

  private getAllResults(): CDSServerExecutionResult[] {
    return this.getAllSnapshots().flatMap((snapshot) => snapshot.results);
  }

  private getServerCardGroups(): ServerCardGroup[] {
    const groups = new Map<string, ServerCardGroup>();

    for (const result of this.getAllResults()) {
      if (result.error || !result.response) {
        continue;
      }

      const key = result.server.id || result.server.baseUrl;
      const group = groups.get(key) || { server: result.server, cards: [] };
      const seenSignatures = new Set(group.cards.map((card) => this.getCardSignature(card)));

      for (const card of result.response.cards || []) {
        const signature = this.getCardSignature(card);
        if (!seenSignatures.has(signature)) {
          seenSignatures.add(signature);
          group.cards.push(card);
        }
      }

      groups.set(key, group);
    }

    return Array.from(groups.values());
  }

  private getCardSignature(card: CDSCard): string {
    return [card.indicator, card.summary, card.detail || '', card.source?.label || '', card.source?.url || ''].join('|');
  }

  private emitStateChange(): void {
    const recommendationCount = this.getTotalRecommendationCount();
    this.stateChange.emit({
      isLoading: this.isCdsLoading(),
      hasError: !!this.getCdsError(),
      hasNoData: !!this.getCdsNoDataMessage(),
      hasRecommendations: recommendationCount > 0,
      hasExecuted: this.getAllSnapshots().some((snapshot) => !!snapshot.lastUpdated || snapshot.results.length > 0 || snapshot.isLoading),
      recommendationCount,
      errorMessage: this.getCdsError(),
      noDataMessage: this.getCdsNoDataMessage()
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
