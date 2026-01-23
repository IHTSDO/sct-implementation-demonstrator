import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { GoogleAnalyticsService } from '../services/google-analytics.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    standalone: false
})
export class HomeComponent implements OnInit{
  allDemos: any[] = [];
  filteredDemos: any[] = [];
  demoTypes: Record<string, number> = {};
  uniqueSubtypes: string[] = [];
  subtypeCounts: Record<string, number> = {};
  selectedSubtype: string | null = null;
  searchText: string = '';
  embeddedMode: boolean = false;

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
      if (params['embedded'] === 'true') {
        this.embeddedMode = true;
      } else {
        this.embeddedMode = false;
      }
    });
    
    // Generate a list of all demo.type in demos with counts
    this.demoTypes = this.allDemos.reduce((acc: any, demo: any) => {
      if (!acc[demo.type]) {
        acc[demo.type] = 0;
      }
      acc[demo.type]++;
      return acc;
    }, {});
    
    // Extract unique subtypes from subtitles and count them
    const subtypesSet = new Set<string>();
    this.subtypeCounts = {};
    this.allDemos.forEach(demo => {
      if (demo.subtitle) {
        subtypesSet.add(demo.subtitle);
        if (!this.subtypeCounts[demo.subtitle]) {
          this.subtypeCounts[demo.subtitle] = 0;
        }
        this.subtypeCounts[demo.subtitle]++;
      }
    });
    // Sort by count (descending), then alphabetically if counts are equal
    this.uniqueSubtypes = Array.from(subtypesSet).sort((a, b) => {
      const countA = this.subtypeCounts[a] || 0;
      const countB = this.subtypeCounts[b] || 0;
      if (countB !== countA) {
        return countB - countA; // Descending order by count
      }
      return a.localeCompare(b); // Alphabetical if counts are equal
    });
  }

  onSubtypeClick(subtype: string): void {
    if (this.selectedSubtype === subtype) {
      // Deselect if clicking the same badge
      this.selectedSubtype = null;
    } else {
      this.selectedSubtype = subtype;
    }
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredDemos = this.allDemos.filter(demo => {
      // Filter by subtype badge
      if (this.selectedSubtype && demo.subtitle !== this.selectedSubtype) {
        return false;
      }
      
      // Filter by search text
      if (this.searchText.trim()) {
        const searchLower = this.searchText.toLowerCase();
        const matchesName = demo.name.toLowerCase().includes(searchLower);
        const matchesDescription = demo.description.toLowerCase().includes(searchLower);
        const matchesSubtitle = demo.subtitle?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription && !matchesSubtitle) {
          return false;
        }
      }
      
      return true;
    });
  }

  getFilteredCount(): number {
    return this.filteredDemos.length;
  }

  getSubtypeCount(subtype: string): number {
    return this.subtypeCounts[subtype] || 0;
  }

  hasActiveFilters(): boolean {
    return this.selectedSubtype !== null || this.searchText.trim().length > 0;
  }

  clearFilters(): void {
    this.selectedSubtype = null;
    this.searchText = '';
    this.applyFilters();
  }

  navigate(demo: any) {
    if (demo.type === 'internal') {
      if (!this.embeddedMode) {
        let queryParams = demo.queryParams;
        let currentParams = this.route.snapshot.queryParams;
        if (queryParams) {
          queryParams = { ...currentParams, ...queryParams };
        } else {
          queryParams = currentParams;
        }
        this.router.navigate([demo.url], { queryParams: queryParams });
      } else {
        this.openInNewTab('https://ihtsdo.github.io/sct-implementation-demonstrator/#' + demo.url, demo.name || 'External Demo');
      }
    } else {
      this.openInNewTab(demo.url, demo.name || 'External Link');
    }
  }

  openInNewTab(url: string, linkText?: string) {
    // Track external link click
    this.gaService.trackEvent('click', {
      event_category: 'External Link',
      event_label: linkText || url,
      link_url: url,
      link_text: linkText || url
    });
    
    window.open(url, '_blank');
  }

  trackExternalLinkClick(url: string, linkText: string, event?: Event) {
    if (event) {
      event.preventDefault();
    }
    
    // Track external link click
    this.gaService.trackEvent('click', {
      event_category: 'External Link',
      event_label: linkText,
      link_url: url,
      link_text: linkText
    });
    
    window.open(url, '_blank');
  }

}
