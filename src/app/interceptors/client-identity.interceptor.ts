import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Adds a stable client-identity header to requests aimed at the WAF-protected
 * SNOMED terminology server. The server's bot-protection rules block requests
 * that don't carry a recognised identifier; a targeted exception is keyed off
 * this header (rate limiting still applies).
 *
 * Note: this value ships in the browser bundle and is visible in DevTools, so it
 * is an identifier for monitoring/targeting, not a secret. It is only attached to
 * requests bound for the protected host, never to other FHIR servers the user may
 * configure (which could reject the unexpected header in CORS preflight).
 */
@Injectable()
export class ClientIdentityInterceptor implements HttpInterceptor {
  private static readonly HEADER_NAME = 'X-IST-CLIENT';
  private static readonly HEADER_VALUE = 'sct-implementation-demonstrator';

  // Hostnames whose requests should carry the client-identity header.
  private static readonly PROTECTED_HOSTS = ['snomedbrowser.org'];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isProtectedHost(req.url)) {
      return next.handle(req);
    }

    const identified = req.clone({
      setHeaders: {
        [ClientIdentityInterceptor.HEADER_NAME]: ClientIdentityInterceptor.HEADER_VALUE,
      },
    });
    return next.handle(identified);
  }

  private isProtectedHost(url: string): boolean {
    let host: string;
    try {
      host = new URL(url, window.location.origin).hostname;
    } catch {
      return false;
    }
    return ClientIdentityInterceptor.PROTECTED_HOSTS.some(
      (protectedHost) => host === protectedHost || host.endsWith(`.${protectedHost}`)
    );
  }
}
