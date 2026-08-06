import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CDSCard, cdsCardSignature } from './cds.service';
import { StorageService } from './storage.service';

// Persists which CDS alerts a clinician has acknowledged ("dismissed"), keyed by patient
// and by card signature, so acknowledged alerts stop toasting and stop counting. Survives
// reloads via localStorage; the same card identity (cdsCardSignature) is used everywhere
// so an acknowledgement matches the exact alert. If the underlying data changes enough to
// change the alert text, the signature changes and the alert resurfaces as a new one.
@Injectable({
  providedIn: 'root'
})
export class AcknowledgedAlertsService {
  private static readonly STORAGE_KEY = 'cdsAcknowledgedAlerts';
  private readonly stateSubject = new BehaviorSubject<Record<string, string[]>>({});

  constructor(private storageService: StorageService) {
    this.initialize();
  }

  watchAcknowledged(patientId: string): Observable<Set<string>> {
    return this.stateSubject.pipe(map((state) => new Set(state[patientId] || [])));
  }

  getAcknowledged(patientId: string): Set<string> {
    return new Set(this.stateSubject.value[patientId] || []);
  }

  isAcknowledged(patientId: string, card: CDSCard): boolean {
    return this.getAcknowledged(patientId).has(cdsCardSignature(card));
  }

  acknowledge(patientId: string, card: CDSCard): void {
    const signature = cdsCardSignature(card);
    const current = this.stateSubject.value[patientId] || [];
    if (current.includes(signature)) {
      return;
    }
    this.persist({
      ...this.stateSubject.value,
      [patientId]: [...current, signature]
    });
  }

  restore(patientId: string, card: CDSCard): void {
    const signature = cdsCardSignature(card);
    const current = this.stateSubject.value[patientId] || [];
    if (!current.includes(signature)) {
      return;
    }
    this.persist({
      ...this.stateSubject.value,
      [patientId]: current.filter((entry) => entry !== signature)
    });
  }

  private persist(state: Record<string, string[]>): void {
    this.stateSubject.next(state);
    if (this.storageService.isLocalStorageSupported()) {
      this.storageService.saveItem(AcknowledgedAlertsService.STORAGE_KEY, JSON.stringify(state));
    }
  }

  private initialize(): void {
    if (!this.storageService.isLocalStorageSupported()) {
      return;
    }
    const raw = this.storageService.getItem(AcknowledgedAlertsService.STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.stateSubject.next(parsed as Record<string, string[]>);
      }
    } catch {
      // Ignore malformed storage; start with an empty acknowledgement set.
    }
  }
}
