import { Injectable, isDevMode } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MenuService } from './menu.service';

declare let gtag: Function;

interface RouteMetadata {
  title: string;
  category: string;
  section?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAnalyticsService {
  private readonly GA_TRACKING_ID = 'G-7SK998GPMX';
  private hasTrackedInitialRoute = false;
  
  // Mapeo mínimo solo para casos especiales que no se pueden generar automáticamente
  // La mayoría de rutas se generan automáticamente desde la ruta misma
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
    // Interceptar todos los cambios de ruta automáticamente
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => event as NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        this.hasTrackedInitialRoute = true;
        this.trackPageView(event.urlAfterRedirects);
      });
    
    // Trackear la ruta inicial si el NavigationEnd no se ha disparado aún
    // Esto asegura que la primera página también se trackee
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
   * Verifica si el tracking debe estar habilitado
   * No trackea en modo desarrollo (Angular development mode)
   * ni en localhost como fallback adicional
   */
  private shouldTrack(): boolean {
    // No trackear en modo desarrollo de Angular
    // Esto detecta cuando Angular muestra "Angular is running in development mode"
    // En producción (GitHub Pages), isDevMode() retorna false
    if (isDevMode()) {
      return false;
    }
    
    // Fallback adicional: No trackear en localhost
    // Esto cubre casos donde isDevMode() podría no funcionar como esperado
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '') {
      return false;
    }
    
    // Opcional: No trackear en modo embedded
    // Puedes descomentar esto si quieres excluir el modo embedded
    // const urlParams = new URLSearchParams(window.location.search);
    // if (urlParams.get('embedded') === 'true') {
    //   return false;
    // }
    
    return true;
  }

  /**
   * Verifica si gtag está disponible
   */
  private isGtagAvailable(): boolean {
    return typeof gtag !== 'undefined' && typeof gtag === 'function';
  }

  /**
   * Obtiene metadata de una ruta
   * Primero consulta MenuService, luego genera automáticamente desde la ruta
   */
  private getRouteMetadata(path: string): RouteMetadata {
    // Remover hash si existe (Angular usa useHash: true)
    const cleanPath = path.replace(/^#/, '').replace(/^\//, '');
    
    // Primero: Buscar en MenuService (fuente de verdad principal)
    const demos = this.menuService.getDemos();
    const menuDemo = demos.find(demo => {
      if (demo.type === 'internal' && demo.url) {
        // Comparar URLs sin el slash inicial
        const demoPath = demo.url.replace(/^\//, '');
        return demoPath === cleanPath;
      }
      return false;
    });
    
    if (menuDemo) {
      // Mapear subtitle a category/section
      const category = this.mapSubtitleToCategory(menuDemo.subtitle);
      return {
        title: menuDemo.name,
        category: category,
        section: menuDemo.subtitle !== category ? menuDemo.subtitle : undefined
      };
    }
    
    // Segundo: Buscar en mapeo local (solo casos especiales como Home)
    if (this.routeMetadata[cleanPath]) {
      return this.routeMetadata[cleanPath];
    }
    
    // Tercero: Manejar rutas con parámetros dinámicos (ej: /clinical-record/:patientId)
    if (cleanPath.startsWith('clinical-record/')) {
      const patientId = cleanPath.split('/')[1];
      return {
        title: `Clinical Record - Patient ${patientId}`,
        category: 'Demos',
        section: 'EHR'
      };
    }
    
    // Cuarto: Generar título automáticamente desde la ruta
    return this.generateMetadataFromPath(cleanPath);
  }

  /**
   * Genera metadata automáticamente desde la ruta
   * Ejemplos:
   * - 'maturity/dashboard' → 'Maturity Dashboard'
   * - 'clinical-record' → 'Clinical Record'
   * - 'snoguess/scoreboard' → 'SnoGuess Scoreboard'
   */
  private generateMetadataFromPath(path: string): RouteMetadata {
    if (!path) {
      return { title: 'Home', category: 'Main' };
    }

    // Dividir por '/' o '-' y capitalizar cada palabra
    const parts = path.split(/[\/\-]/).map(part => {
      // Capitalizar primera letra de cada palabra
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });

    // Unir con espacios
    const title = parts.join(' ');

    // Intentar inferir categoría desde la ruta
    const category = this.inferCategoryFromPath(path);

    return {
      title: title,
      category: category
    };
  }

  /**
   * Infiere la categoría desde la ruta
   */
  private inferCategoryFromPath(path: string): string {
    // Patrones para inferir categorías
    if (path.includes('maturity')) return 'Maturity';
    if (path.includes('report')) return 'Reports';
    if (path.includes('game') || path.includes('quiz') || path.includes('snoguess') || path.includes('phaser') || path.includes('triage')) return 'Games';
    if (path.includes('analytics') || path.includes('chart') || path.includes('sunburst')) return 'Analytics';
    if (path.includes('clinical') || path.includes('patient') || path.includes('encounter') || path.includes('ehr')) return 'Demos';
    if (path.includes('tool') || path.includes('validator') || path.includes('generator') || path.includes('translator') || path.includes('viewer')) return 'Tools';
    
    return 'Demos'; // Default
  }

  /**
   * Mapea subtitle de MenuService a category para analytics
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
   * Trackea una vista de página
   */
  trackPageView(url: string): void {
    const metadata = this.getRouteMetadata(url);
    const pageTitle = metadata.title;
    const pageCategory = metadata.category;
    const pageSection = metadata.section;

    // Actualizar título HTML (siempre, incluso en desarrollo)
    const fullTitle = pageTitle === 'Home' 
      ? 'Implementation Demos' 
      : `${pageTitle} - Implementation Demos`;
    this.titleService.setTitle(fullTitle);

    // Si no debemos trackear (desarrollo/localhost), solo actualizar título y salir
    if (!this.shouldTrack()) {
      console.log('[GA] Tracking disabled - Development mode or localhost');
      console.log('[GA] Title updated to:', fullTitle);
      return;
    }

    if (!this.isGtagAvailable()) {
      console.warn('[GA] gtag function not available');
      return;
    }

    const fullUrl = window.location.origin + window.location.pathname + (url.startsWith('#') ? url : '#' + url);
    
    // Remover hash para page_path
    const pagePath = url.replace(/^#/, '') || '/';

    const trackingData = {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: fullUrl,
      page_category: pageCategory,
      ...(pageSection && { page_section: pageSection })
    };

    // Enviar evento de página a Google Analytics
    gtag('config', this.GA_TRACKING_ID, trackingData);
    console.log('[GA] Page view tracked:', trackingData);
  }

  /**
   * Trackea un evento personalizado
   */
  trackEvent(eventName: string, eventParams?: { [key: string]: any }): void {
    if (!this.shouldTrack() || !this.isGtagAvailable()) {
      return;
    }

    gtag('event', eventName, eventParams || {});
  }

  /**
   * Trackea un evento de conversión o acción importante
   */
  trackConversion(action: string, category: string, label?: string, value?: number): void {
    this.trackEvent(action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }
}
