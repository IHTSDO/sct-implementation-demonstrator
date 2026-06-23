import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { GoogleAnalyticsService } from '../services/google-analytics.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    standalone: false
})
export class HomeComponent implements OnInit {
  allDemos: any[] = [];
  filteredDemos: any[] = [];
  uniqueSubtypes: string[] = [];
  subtypeCounts: Record<string, number> = {};
  selectedSubtype: string | null = null;
  searchText: string = '';
  embeddedMode: boolean = false;


  readonly sectionColors: Record<string, string> = {
    highlighted:    '#1565c0',
    recentlyAdded:  '#2e7d32',
    clinicalDemo:   '#c62828',
    learningDemo:   '#6a1b9a',
    tool:           '#006064',
    analyticsDemo:  '#e65100',
    game:           '#ad1457'
  };

  readonly sectionIcons: Record<string, string> = {
    highlighted:    'star',
    recentlyAdded:  'new_releases',
    clinicalDemo:   'medical_services',
    learningDemo:   'school',
    tool:           'build',
    analyticsDemo:  'analytics',
    game:           'sports_esports'
  };

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    private menuService: MenuService,
    private gaService: GoogleAnalyticsService
  ) { }

  ngOnInit(): void {
    this.allDemos = this.menuService.getDemos();
    this.filteredDemos = [...this.allDemos];

    this.route.queryParams.subscribe(params => {
      this.embeddedMode = params['embedded'] === 'true';
    });

    const subtypesSet = new Set<string>();
    this.subtypeCounts = {};
    this.allDemos.forEach(demo => {
      if (demo.subtitle) {
        subtypesSet.add(demo.subtitle);
        this.subtypeCounts[demo.subtitle] = (this.subtypeCounts[demo.subtitle] || 0) + 1;
      }
    });
    this.uniqueSubtypes = Array.from(subtypesSet).sort((a, b) => {
      const diff = (this.subtypeCounts[b] || 0) - (this.subtypeCounts[a] || 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }

  get highlightedDemos(): any[] {
    return this.allDemos.filter(d => d.highlighted);
  }

  get newDemos(): any[] {
    return this.allDemos
      .filter(d => this.isNew(d))
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }

  get demosByCategory(): { subtitle: string; demos: any[] }[] {
    return this.uniqueSubtypes.map(sub => ({
      subtitle: sub,
      demos: this.allDemos.filter(d => d.subtitle === sub)
    }));
  }

  get filteredDemosByCategory(): { subtitle: string; demos: any[] }[] {
    return this.uniqueSubtypes
      .map(sub => ({
        subtitle: sub,
        demos: this.filteredDemos.filter(d => d.subtitle === sub)
      }))
      .filter(g => g.demos.length > 0);
  }

  isNew(demo: any): boolean {
    if (!demo.addedAt) return false;
    const diffDays = (Date.now() - new Date(demo.addedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  }

  getSectionColor(type: string): string {
    return this.sectionColors[type] || '#555555';
  }

  getSectionIcon(type: string): string {
    return this.sectionIcons[type] || 'folder';
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredDemos = this.allDemos.filter(demo => {
      if (this.selectedSubtype && demo.subtitle !== this.selectedSubtype) return false;
      if (this.searchText.trim()) {
        const q = this.searchText.toLowerCase();
        return demo.name.toLowerCase().includes(q)
          || demo.description.toLowerCase().includes(q)
          || demo.subtitle?.toLowerCase().includes(q);
      }
      return true;
    });
  }

  getFilteredCount(): number {
    return this.filteredDemos.length;
  }

  onSubtypeClick(subtype: string): void {
    this.selectedSubtype = this.selectedSubtype === subtype ? null : subtype;
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return this.searchText.trim().length > 0 || this.selectedSubtype !== null;
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedSubtype = null;
    this.applyFilters();
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      if (!this.embeddedMode) {
        let queryParams = demo.queryParams;
        const currentParams = this.route.snapshot.queryParams;
        queryParams = queryParams ? { ...currentParams, ...queryParams } : currentParams;
        this.router.navigate([demo.url], { queryParams });
      } else {
        this.openInNewTab('https://ihtsdo.github.io/sct-implementation-demonstrator/#' + demo.url, demo.name);
      }
    } else {
      this.openInNewTab(demo.url, demo.name || 'External Link');
    }
  }

  openInNewTab(url: string, linkText?: string) {
    this.gaService.trackEvent('click', {
      event_category: 'External Link',
      event_label: linkText || url,
      link_url: url,
      link_text: linkText || url
    });
    window.open(url, '_blank');
  }

  trackExternalLinkClick(url: string, linkText: string, event?: Event) {
    if (event) event.preventDefault();
    this.gaService.trackEvent('click', {
      event_category: 'External Link',
      event_label: linkText,
      link_url: url,
      link_text: linkText
    });
    window.open(url, '_blank');
  }
}
