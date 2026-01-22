import { Injectable, isDevMode } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MenuService } from './menu.service';

declare let gtag: Function;

declare global {
  interface Window {
    __GA_MEASUREMENT_ID__?: string;
  }
}

interface RouteMetadata {
  title: string;
  category: string;
  section?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {
  private hasTrackedInitialRoute = false;
  
  // Minimal mapping only for special cases that cannot be generated automatically
  // Most routes are automatically generated from the route itself
  private readonly routeMetadata: { [key: string]: RouteMetadata } = {
    '': { title: 'Home', category: 'Main' },
    'home': { title: 'Home', category: 'Main' }
  };

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private menuService: MenuService,
    private titleService: Title
  ) {
    // Automatically intercept all route changes
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => event as NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        this.hasTrackedInitialRoute = true;
        this.trackPageView(event.urlAfterRedirects);
      });
    
    // Track the initial route if NavigationEnd hasn't fired yet
    // This ensures the first page is also tracked
    setTimeout(() => {
      if (!this.hasTrackedInitialRoute) {
        const currentUrl = this.router.url || window.location.hash || window.location.pathname;
        if (currentUrl) {
          this.hasTrackedInitialRoute = true;
          this.trackPageView(currentUrl);
        }
      }
    }, 100);
  }

  /**
   * Checks if debug override is enabled
   * Allows tracking in dev/localhost when explicitly activated
   * Activated with query param ?ga_debug=1 or localStorage.setItem('ga_debug','1')
   * 
   * IMPORTANT: With hash routing, query params can be in window.location.hash
   * (e.g., /#/maturity?ga_debug=1) or in window.location.search (e.g., /?ga_debug=1#/maturity)
   */
  private isDebugOverrideEnabled(): boolean {
    // Check query param in window.location.search (query params before hash)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ga_debug') === '1') {
      return true;
    }
    
    // Check query param in window.location.hash (query params after hash)
    // Example: /#/maturity?ga_debug=1
    const hash = window.location.hash;
    if (hash && hash.includes('?')) {
      const hashParts = hash.split('?');
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1]);
        if (hashParams.get('ga_debug') === '1') {
          return true;
        }
      }
    }
    
    // Check localStorage (persistent across navigations)
    if (localStorage.getItem('ga_debug') === '1') {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if tracking should be enabled
   * Does not track in development mode (Angular development mode)
   * nor on localhost as an additional fallback
   * EXCEPT when debug override is active
   */
  private shouldTrack(): boolean {
    const debugOverride = this.isDebugOverrideEnabled();
    
    // If override is active, allow tracking even in dev/localhost
    if (debugOverride) {
      // Determine the override source for logging
      let overrideSource = 'localStorage (ga_debug=1)';
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('ga_debug') === '1') {
        overrideSource = 'query parameter ?ga_debug=1 (in URL search)';
      } else {
        const hash = window.location.hash;
        if (hash && hash.includes('?')) {
          const hashParts = hash.split('?');
          if (hashParts.length > 1) {
            const hashParams = new URLSearchParams(hashParts[1]);
            if (hashParams.get('ga_debug') === '1') {
              overrideSource = 'query parameter ?ga_debug=1 (in hash)';
            }
          }
        }
      }
      return true;
    }
    
    // Default behavior: Do not track in Angular development mode
    // This detects when Angular shows "Angular is running in development mode"
    // In production (GitHub Pages), isDevMode() returns false
    if (isDevMode()) {
      return false;
    }
    
    // Additional fallback: Do not track on localhost
    // This covers cases where isDevMode() might not work as expected
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '') {
      return false;
    }
    
    return true;
  }

  /**
   * Checks if gtag is available
   */
  private isGtagAvailable(): boolean {
    return typeof gtag !== 'undefined' && typeof gtag === 'function';
  }

  /**
   * Reads the GA4 Measurement ID injected by index.html (CI replaces the placeholder).
   * If not present/valid, tracking calls become no-ops.
   */
  private getMeasurementId(): string | undefined {
    const id = window.__GA_MEASUREMENT_ID__;
    if (!id) return undefined;
    return /^G-[A-Z0-9]+$/.test(id) ? id : undefined;
  }

  /**
   * Gets metadata for a route
   * First queries MenuService, then automatically generates from the route
   */
  private getRouteMetadata(path: string): RouteMetadata {
    // Remove hash and query parameters if exists (Angular uses useHash: true)
    let cleanPath = path.replace(/^#/, '').replace(/^\//, '');
    // Remove query parameters (everything after ?)
    const queryIndex = cleanPath.indexOf('?');
    if (queryIndex !== -1) {
      cleanPath = cleanPath.substring(0, queryIndex);
    }
    
    // First: Search in MenuService (primary source of truth)
    const demos = this.menuService.getDemos();
    const menuDemo = demos.find(demo => {
      if (demo.type === 'internal' && demo.url) {
        // Compare URLs without the leading slash
        const demoPath = demo.url.replace(/^\//, '');
        return demoPath === cleanPath;
      }
      return false;
    });
    
    if (menuDemo) {
      // Map subtitle to category/section
      const category = this.mapSubtitleToCategory(menuDemo.subtitle);
      return {
        title: menuDemo.name,
        category: category,
        section: menuDemo.subtitle !== category ? menuDemo.subtitle : undefined
      };
    }
    
    // Second: Search in local mapping (only special cases like Home)
    if (this.routeMetadata[cleanPath]) {
      return this.routeMetadata[cleanPath];
    }
    
    // Third: Handle routes with dynamic parameters (e.g., /clinical-record/:patientId)
    if (cleanPath.startsWith('clinical-record/')) {
      return {
        // Avoid tracking patient identifiers in titles/analytics.
        title: 'Clinical Record',
        category: 'Demos',
        section: 'EHR'
      };
    }
    
    // Fourth: Automatically generate title from the route
    return this.generateMetadataFromPath(cleanPath);
  }

  /**
   * Automatically generates metadata from the route
   * Examples:
   * - 'maturity/dashboard' → 'Maturity Dashboard'
   * - 'clinical-record' → 'Clinical Record'
   * - 'snoguess/scoreboard' → 'SnoGuess Scoreboard'
   */
  private generateMetadataFromPath(path: string): RouteMetadata {
    if (!path) {
      return { title: 'Home', category: 'Main' };
    }

    // Split by '/' or '-' and capitalize each word
    const parts = path.split(/[\/\-]/).map(part => {
      // Capitalize first letter of each word
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });

    // Join with spaces
    const title = parts.join(' ');

    // Try to infer category from the route
    const category = this.inferCategoryFromPath(path);

    return {
      title: title,
      category: category
    };
  }

  /**
   * Infers the category from the route
   */
  private inferCategoryFromPath(path: string): string {
    // Patterns to infer categories
    if (path.includes('maturity')) return 'Maturity';
    if (path.includes('report')) return 'Reports';
    if (path.includes('game') || path.includes('quiz') || path.includes('snoguess') || path.includes('phaser') || path.includes('triage')) return 'Games';
    if (path.includes('analytics') || path.includes('chart') || path.includes('sunburst')) return 'Analytics';
    if (path.includes('clinical') || path.includes('patient') || path.includes('encounter') || path.includes('ehr')) return 'Demos';
    if (path.includes('tool') || path.includes('validator') || path.includes('generator') || path.includes('translator') || path.includes('viewer')) return 'Tools';
    
    return 'Demos'; // Default
  }

  /**
   * Maps subtitle from MenuService to category for analytics
   */
  private mapSubtitleToCategory(subtitle: string): string {
    const categoryMap: { [key: string]: string } = {
      'Clinical demo': 'Demos',
      'Learning demo': 'Demos',
      'Analytics demo': 'Analytics',
      'Tool': 'Tools',
      'Game': 'Games'
    };
    
    return categoryMap[subtitle] || subtitle || 'Demos';
  }

  /**
   * Tracks a page view
   */
  trackPageView(url: string): void {
    const metadata = this.getRouteMetadata(url);
    const pageTitle = metadata.title;
    const pageCategory = metadata.category;
    const pageSection = metadata.section;

    // Update HTML title (always, even in development)
    const fullTitle = pageTitle === 'Home' 
      ? 'Implementation Demos' 
      : `${pageTitle} - Implementation Demos`;
    this.titleService.setTitle(fullTitle);

    // Check if we should track (includes debug override)
    const shouldTrack = this.shouldTrack();
    const debugOverride = this.isDebugOverrideEnabled();
    
    // If we should not track (development/localhost without override), only update title and exit
    if (!shouldTrack) {
      return;
    }

    if (!this.isGtagAvailable()) {
      return;
    }

    const fullUrl = window.location.origin + window.location.pathname + (url.startsWith('#') ? url : '#' + url);
    
    // Remove hash and query parameters for page_path (compatible with GitHub Pages hash routing)
    // Query params like ?ga_debug=1 should not be included in page_path
    let pagePath = url.replace(/^#/, '') || '/';
    // Remove query parameters from page_path (everything after ?)
    const queryIndex = pagePath.indexOf('?');
    if (queryIndex !== -1) {
      pagePath = pagePath.substring(0, queryIndex);
    }
    // Normalize dynamic routes to avoid tracking identifiers (e.g., patient IDs).
    // Example: /clinical-record/patient-123 → /clinical-record
    if (pagePath.startsWith('/clinical-record/')) {
      pagePath = '/clinical-record';
    }

    const measurementId = this.getMeasurementId();

    const trackingData: any = {
      // When present, explicitly send to the correct GA4 property.
      // If missing (e.g., forks), GA won't load and gtag won't be available anyway.
      ...(measurementId ? { send_to: measurementId } : {}),
      page_path: pagePath,
      page_title: pageTitle,
      page_location: fullUrl,
      page_category: pageCategory,
      ...(pageSection && { page_section: pageSection })
    };

    // Enable GA4 DebugView when override is active
    // This allows seeing events in real-time in GA4 DebugView even in dev/localhost
    if (debugOverride) {
      trackingData.debug_mode = true;
    }

    // IMPORTANT: Use 'event' with 'page_view' instead of 'config' to avoid GA4 deduplication
    // GA4 silently deduplicates page views when using gtag('config', ...) multiple times,
    // which prevents page views from appearing in Realtime reports for SPAs with hash routing.
    // Using gtag('event', 'page_view', ...) ensures each route change is tracked as a distinct page view.
    // The initial gtag('config', ...) in index.html is sufficient for initialization.
    gtag('event', 'page_view', trackingData);
  }

  /**
   * Tracks a custom event
   */
  trackEvent(eventName: string, eventParams?: { [key: string]: any }): void {
    if (!this.shouldTrack() || !this.isGtagAvailable()) {
      return;
    }

    gtag('event', eventName, eventParams || {});
  }

  /**
   * Tracks a conversion event or important action
   */
  trackConversion(action: string, category: string, label?: string, value?: number): void {
    this.trackEvent(action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }
}
