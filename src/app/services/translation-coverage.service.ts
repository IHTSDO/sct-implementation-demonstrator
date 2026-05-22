import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, filter, map, of, shareReplay, take, tap } from 'rxjs';
import { TranslationCoverageDialogComponent, TranslationCoverageDialogData } from '../translation-coverage/translation-coverage-dialog.component';

export const ROUTE_SCOPE_ALIASES: Record<string, string> = {
  'ehr-lab': 'benefits-demo',
  'clinical-record': 'benefits-demo',
  'create-patient': 'benefits-demo',
  'encounter-record': 'benefits-demo',
  'interoperability': 'benefits-demo',
  'descriptive-analytics': 'descriptive-statistics',
  'sunburst-chart': 'descriptive-statistics',
  'd3-sunburst-chart': 'descriptive-statistics',
};

@Injectable({ providedIn: 'root' })
export class TranslationCoverageService {
  private readonly checkedAssets = new Map<string, Observable<boolean>>();
  private readonly notifiedRouteLanguages = new Set<string>();
  private started = false;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly translocoService: TranslocoService
  ) {}

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => this.checkCurrentRoute());

    this.checkCurrentRoute();
  }

  checkCurrentRoute(): void {
    const lang = this.translocoService.getActiveLang();
    if (lang === 'en') {
      return;
    }

    const routeSegment = this.getPrimaryRouteSegment(this.router.url);
    const scope = this.resolveScope(routeSegment);
    const noticeKey = `${routeSegment}:${lang}`;
    if (this.notifiedRouteLanguages.has(noticeKey)) {
      return;
    }

    this.hasTranslationAssets(scope, lang).subscribe((hasCoverage) => {
      if (hasCoverage || this.notifiedRouteLanguages.has(noticeKey)) {
        return;
      }

      this.notifiedRouteLanguages.add(noticeKey);
      this.showCoverageNotice(routeSegment, scope, lang);
    });
  }

  resolveScope(routeSegment: string): string {
    return ROUTE_SCOPE_ALIASES[routeSegment] ?? routeSegment;
  }

  getPrimaryRouteSegment(url: string): string {
    const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '');
    return path.split('/')[0] || 'home';
  }

  hasTranslationAssets(scope: string, lang: string): Observable<boolean> {
    const cacheKey = `${scope}:${lang}`;
    const cached = this.checkedAssets.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request = this.http.get(`assets/i18n/${scope}/${scope}-${lang}.json`, { responseType: 'text' }).pipe(
      map(() => true),
      catchError(() => of(false)),
      shareReplay(1)
    );
    this.checkedAssets.set(cacheKey, request);
    return request;
  }

  private showCoverageNotice(routeSegment: string, scope: string, lang: string): void {
    this.translocoService.load(lang).pipe(
      take(1),
      catchError(() => of({})),
      tap(() => {
        const snackBarRef = this.snackBar.open(
          this.translate('translationCoverage.snackbar.message'),
          this.translate('translationCoverage.snackbar.action'),
          { duration: 8000 }
        );

        snackBarRef.onAction().pipe(take(1)).subscribe(() => {
          const data: TranslationCoverageDialogData = {
            lang,
            routeSegment,
            scope,
          };
          this.dialog.open(TranslationCoverageDialogComponent, {
            width: '560px',
            data,
          });
        });
      })
    ).subscribe();
  }

  private translate(key: string): string {
    const translated = this.translocoService.translate(key);
    return translated === key ? this.englishFallback(key) : translated;
  }

  private englishFallback(key: string): string {
    const fallbacks: Record<string, string> = {
      'translationCoverage.snackbar.message': 'This module is currently available in English only.',
      'translationCoverage.snackbar.action': 'Details',
    };
    return fallbacks[key] ?? key;
  }
}
