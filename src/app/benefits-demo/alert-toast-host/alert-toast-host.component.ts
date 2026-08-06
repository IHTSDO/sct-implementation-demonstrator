import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AlertToast, AlertToastService, AlertToastSeverity } from '../../services/alert-toast.service';

@Component({
  selector: 'app-alert-toast-host',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  animations: [
    trigger('dropIn', [
      transition(':enter', [
        style({ transform: 'translateY(-140%)', opacity: 0 }),
        animate('420ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('220ms ease-in', style({ transform: 'translateY(-30%)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <div class="toast-stack">
      @for (toast of alertToastService.toasts$ | async; track toast.id) {
        <div
          class="toast toast--{{ toast.severity }}"
          [@dropIn]
          [attr.role]="toast.severity === 'critical' ? 'alert' : 'status'"
          [attr.aria-live]="toast.severity === 'critical' ? 'assertive' : 'polite'">
          <div class="toast__icon">
            <mat-icon>{{ iconFor(toast.severity) }}</mat-icon>
          </div>
          <div class="toast__body">
            <div class="toast__meta">
              <span class="toast__badge">{{ labelFor(toast.severity) }}</span>
              @if (toast.source) {
                <span class="toast__source">{{ toast.source }}</span>
              }
            </div>
            <div class="toast__title">{{ toast.title }}</div>
            @if (toast.detail) {
              <div class="toast__detail">{{ toast.detail }}</div>
            }
          </div>
          <button class="toast__close" type="button" aria-label="Dismiss" (click)="dismiss(toast.id)">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1200;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(560px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }

    /* Semantic severity colors: red conveys a hard contraindication, amber a caution. */
    .toast--critical {
      border: 1px solid #e5534b;
      padding: 18px;
    }

    .toast--warning {
      border: 1px solid #e0a24a;
      padding: 12px 14px;
    }

    .toast__icon {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
    }

    .toast--critical .toast__icon {
      width: 40px;
      height: 40px;
      background: #fdecea;
      color: #b3261e;
    }

    .toast--warning .toast__icon {
      width: 30px;
      height: 30px;
      background: #fff4e0;
      color: #8a5a00;
    }

    .toast--critical .toast__icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .toast--warning .toast__icon mat-icon {
      font-size: 19px;
      width: 19px;
      height: 19px;
    }

    .toast__body {
      flex: 1;
      min-width: 0;
    }

    .toast__meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .toast__badge {
      font-size: 12px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .toast--critical .toast__badge {
      color: #b3261e;
      background: #fdecea;
    }

    .toast--warning .toast__badge {
      color: #8a5a00;
      background: #fff4e0;
    }

    .toast__source {
      font-size: 12px;
      color: #8a8f98;
    }

    .toast__title {
      font-weight: 500;
      color: #1f2430;
      line-height: 1.4;
    }

    .toast--critical .toast__title {
      font-size: 18px;
    }

    .toast--warning .toast__title {
      font-size: 15px;
    }

    .toast__detail {
      color: #5f6b7a;
      line-height: 1.5;
      margin-top: 2px;
    }

    .toast--critical .toast__detail {
      font-size: 14px;
    }

    .toast--warning .toast__detail {
      font-size: 13px;
    }

    .toast__close {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #8a8f98;
      cursor: pointer;
    }

    .toast__close:hover {
      background: rgba(15, 23, 42, 0.06);
      color: #1f2430;
    }

    .toast__close mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    @media (prefers-reduced-motion: reduce) {
      .toast {
        transition: none !important;
      }
    }
  `]
})
export class AlertToastHostComponent {
  constructor(public alertToastService: AlertToastService) {}

  iconFor(severity: AlertToastSeverity): string {
    return severity === 'critical' ? 'error' : 'warning';
  }

  labelFor(severity: AlertToastSeverity): string {
    return severity === 'critical' ? 'Critical' : 'Warning';
  }

  dismiss(id: number): void {
    this.alertToastService.dismiss(id);
  }
}
