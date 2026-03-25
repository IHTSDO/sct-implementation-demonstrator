import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, from, retry, switchMap, throwError, timer } from 'rxjs';
import { FhirService } from '../services/fhir.service';

@Injectable()
export class FhirRateLimitInterceptor implements HttpInterceptor {
  private readonly minIntervalMs = 1000;
  private readonly defaultRetryAfterMs = 3000;
  private readonly maxRetries = 6;
  private queue: Promise<void> = Promise.resolve();
  private nextAvailableAt = 0;

  constructor(private fhirService: FhirService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isFhirRequest(req.url)) {
      return next.handle(req);
    }

    return defer(() => from(this.reserveSlot())).pipe(
      switchMap(() => next.handle(req).pipe(
        retry({
          count: this.maxRetries,
          delay: (error, retryCount) => {
            if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
              return throwError(() => error);
            }

            const retryAfterMs = this.getRetryAfterMs(error);
            const backoffMs = Math.max(this.minIntervalMs * Math.pow(2, retryCount + 1), retryAfterMs);
            this.nextAvailableAt = Math.max(this.nextAvailableAt, Date.now() + backoffMs);
            return timer(backoffMs);
          }
        })
      ))
    );
  }

  private isFhirRequest(url: string): boolean {
    const normalizedBaseUrl = this.fhirService.getBaseUrl().replace(/\/$/, '');
    return url.startsWith(normalizedBaseUrl);
  }

  private reserveSlot(): Promise<void> {
    const job = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAvailableAt - now);

      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      this.nextAvailableAt = Date.now() + this.minIntervalMs;
    };

    const scheduled = this.queue.then(job, job);
    this.queue = scheduled.catch(() => undefined);
    return scheduled;
  }

  private getRetryAfterMs(error: HttpErrorResponse): number {
    const retryAfterHeader = error.headers?.get('Retry-After');
    if (!retryAfterHeader) {
      return this.defaultRetryAfterMs;
    }

    const retryAfterSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(retryAfterSeconds)) {
      return retryAfterSeconds * 1000;
    }

    const retryAfterDate = new Date(retryAfterHeader).getTime();
    if (Number.isNaN(retryAfterDate)) {
      return this.defaultRetryAfterMs;
    }

    return Math.max(this.defaultRetryAfterMs, retryAfterDate - Date.now());
  }
}
