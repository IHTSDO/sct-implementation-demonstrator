import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CDSCard, cdsCardSignature } from './cds.service';

export type AlertToastSeverity = 'critical' | 'warning';

export interface AlertToast {
  id: number;
  severity: AlertToastSeverity;
  title: string;
  detail?: string;
  source?: string;
  signature: string;
}

// Auto-dismiss timing per severity. Critical toasts do not auto-dismiss (0) so a
// serious alert stays until the clinician acknowledges it; warnings clear on their own.
const AUTO_DISMISS_MS: Record<AlertToastSeverity, number> = {
  critical: 0,
  warning: 6000
};

@Injectable({
  providedIn: 'root'
})
export class AlertToastService {
  private readonly toastsSubject = new BehaviorSubject<AlertToast[]>([]);
  readonly toasts$: Observable<AlertToast[]> = this.toastsSubject.asObservable();

  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  // Maps a CDS card to a toast. Returns null (no toast) for info-level cards — they are
  // surfaced silently through the CDS panel and header count only.
  show(card: CDSCard): void {
    const severity = this.toSeverity(card.indicator);
    if (!severity) {
      return;
    }

    const signature = cdsCardSignature(card);
    // Don't stack a duplicate toast for a card that is already showing one.
    if (this.toastsSubject.value.some((existing) => existing.signature === signature)) {
      return;
    }

    const toast: AlertToast = {
      id: ++this.nextId,
      severity,
      title: card.summary,
      detail: card.detail,
      source: card.source?.label,
      signature
    };

    this.toastsSubject.next([...this.toastsSubject.value, toast]);

    const timeout = AUTO_DISMISS_MS[severity];
    if (timeout > 0) {
      this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), timeout));
    }
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => toast.id !== id));
  }

  // Dismiss toasts whose underlying card is no longer present (flow cancelled, resource
  // deleted, or the hook stopped returning it).
  dismissBySignatures(signatures: string[]): void {
    if (signatures.length === 0) {
      return;
    }
    const remove = new Set(signatures);
    this.toastsSubject.value
      .filter((toast) => remove.has(toast.signature))
      .forEach((toast) => {
        const timer = this.timers.get(toast.id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(toast.id);
        }
      });
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => !remove.has(toast.signature)));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toastsSubject.next([]);
  }

  private toSeverity(indicator: CDSCard['indicator']): AlertToastSeverity | null {
    if (indicator === 'critical') {
      return 'critical';
    }
    if (indicator === 'warning') {
      return 'warning';
    }
    return null;
  }
}
