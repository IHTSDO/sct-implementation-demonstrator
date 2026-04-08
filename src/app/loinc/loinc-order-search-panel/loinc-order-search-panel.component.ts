import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, filter, forkJoin, Subject, switchMap, takeUntil } from 'rxjs';
import { TerminologyService } from 'src/app/services/terminology.service';
import type { ServiceRequest } from 'src/app/model';
import { LoincGrouperCacheService } from '../loinc-grouper-cache.service';

type SearchResultItem = {
  code: string;
  display: string;
  isGrouper?: boolean;
  level?: number;
  isExpanded?: boolean;
  isLoadingChildren?: boolean;
  children?: SearchResultItem[];
};

@Component({
  selector: 'app-loinc-order-search-panel',
  templateUrl: './loinc-order-search-panel.component.html',
  styleUrl: './loinc-order-search-panel.component.css',
  standalone: false
})
export class LoincOrderSearchPanelComponent implements OnInit, OnDestroy {
  @Input() patient: any = null;
  @Output() serviceRequestCreated = new EventEmitter<ServiceRequest>();

  readonly loincTerminologyServer = 'https://browser.loincsnomed.org/fhir';
  readonly loincEditionUri = 'http://snomed.info/sct/11010000107';
  readonly loincAlternateIdentifierScheme = '30051010000102';
  readonly loincOrderablesRefset = '^ 635111010000100';
  readonly fallbackEditionVersion = 'http://snomed.info/sct/11010000107/version/20250321';
  readonly uuidNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();

  searchResults: SearchResultItem[] = [];
  visibleSearchResults: SearchResultItem[] = [];
  totalResults = 0;
  searching = false;
  extending = false;
  offset = 0;
  limit = 50;
  resultsEcl = '';
  initializing = true;
  activeEditionVersion = this.fallbackEditionVersion;
  initializationMessage = 'Selecting the latest LOINC Ontology edition...';

  filterOptions: any[] = [];
  filters: any[] = [];
  skeletonLoaders = Array(10);

  constructor(
    private terminologyService: TerminologyService,
    private loincGrouperCacheService: LoincGrouperCacheService
  ) {}

  ngOnInit() {
    this.searchControl.disable();
    this.terminologyService.getLatestCodeSystemVersionFromServer(
      this.loincTerminologyServer,
      this.loincEditionUri,
      this.fallbackEditionVersion
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (version) => {
        this.activeEditionVersion = version || this.fallbackEditionVersion;
        this.initializationMessage = 'Loading LOINC groupers...';
        this.preloadGroupers();
      },
      error: () => {
        this.activeEditionVersion = this.fallbackEditionVersion;
        this.initializationMessage = 'Loading LOINC groupers...';
        this.preloadGroupers();
      }
    });

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        filter((term): term is string => !!term && term.length >= 3),
        switchMap((term: string) => this.executeSearch(term)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ({ mainResult, propertyResult, componentResult, scaleResult, siteResult, inheresResult, techniqueResult }) => {
          this.searchResults = this.markGroupers(mainResult?.expansion?.contains || []);
          this.rebuildVisibleSearchResults();
          this.totalResults = mainResult?.expansion?.total || 0;
          this.filterOptions = [
            this.buildFilterOption('Property', propertyResult, '370130000 |Property (attribute)| = '),
            this.buildFilterOption('Component', componentResult, '246093002 |Component (attribute)| = '),
            this.buildFilterOption('Scale', scaleResult, '370132008 |Scale type (attribute)| = '),
            this.buildFilterOption('Site', siteResult, '704327008 |Direct site (attribute)| = '),
            this.buildFilterOption('Inheres in', inheresResult, '704319004 |Inheres in (attribute)| = '),
            this.buildFilterOption('Technique', techniqueResult, '246501002 |Technique (attribute)| = ')
          ];
          this.searching = false;
        },
        error: () => {
          this.searching = false;
        }
      });
  }

  private executeSearch(term: string) {
    this.searching = true;
    this.searchResults = [];
    this.filterOptions = [];
    this.totalResults = 0;
    this.offset = 0;
    this.limit = 50;

    const refinements = this.buildRefinementsClause();
    const ecl = `(${this.loincOrderablesRefset}${refinements}) {{ D term = "${term}" }}`;
    this.resultsEcl = ecl;

    return forkJoin({
      mainResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, ecl, '', 0, this.limit),
      propertyResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).370130000 |Property (attribute)|`, '', 0, 50),
      componentResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).246093002 |Component (attribute)|`, '', 0, 50),
      scaleResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).370132008 |Scale type (attribute)|`, '', 0, 50),
      siteResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).704327008 |Direct site (attribute)|`, '', 0, 50),
      inheresResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).704319004 |Inheres in (attribute)|`, '', 0, 50),
      techniqueResult: this.terminologyService.expandValueSetFromServer(this.loincTerminologyServer, this.activeEditionVersion, `(${ecl}).246501002 |Technique (attribute)|`, '', 0, 50)
    });
  }

  private buildFilterOption(title: string, result: any, refinement: string) {
    const options = [...(result?.expansion?.contains || [])].sort((a: any, b: any) => a.display.localeCompare(b.display));
    return {
      title,
      refinement,
      options: options.slice(0, 5),
      otherOptions: options.slice(5)
    };
  }

  private buildRefinementsClause(): string {
    if (!this.filters.length) {
      return '';
    }

    const clauses = this.filters.map((filter) => `${filter.refinement}${filter.selected.code}`);
    return `: ${clauses.join(', ')}`;
  }

  loadNextPage() {
    this.offset = this.searchResults.length;
    this.extending = true;
    this.terminologyService.expandValueSetFromServer(
      this.loincTerminologyServer,
      this.activeEditionVersion,
      this.resultsEcl,
      '',
      this.offset,
      this.limit
    ).subscribe({
      next: (result) => {
        const newResults = this.markGroupers(result?.expansion?.contains || []);
        this.searchResults = [...this.searchResults, ...newResults];
        this.rebuildVisibleSearchResults();
        this.extending = false;
      },
      error: () => {
        this.extending = false;
      }
    });
  }

  addFilter(filter: any, option: any) {
    const existingFilter = this.filters.find((current) => current.title === filter.title);
    if (existingFilter) {
      existingFilter.selected = option;
    } else {
      this.filters.push({ title: filter.title, selected: option, refinement: filter.refinement });
    }
    this.searchControl.setValue(this.searchControl.value);
  }

  removeFilter(filter: any) {
    const index = this.filters.findIndex((current) => current.title === filter.title);
    if (index >= 0) {
      this.filters.splice(index, 1);
      this.searchControl.setValue(this.searchControl.value);
    }
  }

  addToOrder(item: any) {
    const specimenEcl = `${item.code}.(704327008 |Direct site (attribute)| OR 704319004 |Inheres in (attribute)|)`;
    forkJoin({
      specimenResult: this.terminologyService.expandValueSetFromServer(
        this.loincTerminologyServer,
        this.activeEditionVersion,
        specimenEcl,
        '',
        0,
        1
      ),
      alternateIdentifiers: this.terminologyService.getAlternateIdentifiers(item.code, this.loincTerminologyServer)
    }).subscribe({
      next: ({ specimenResult, alternateIdentifiers }) => {
        const specimen = specimenResult?.expansion?.contains?.[0];
        const loincCode = this.getAlternateIdentifierByScheme(alternateIdentifiers, this.loincAlternateIdentifierScheme);
        this.serviceRequestCreated.emit(this.buildServiceRequest(item, specimen, loincCode));
      }
    });
  }

  getAlternateIdentifierByScheme(alternateIdentifiers: any[], identifierSchemeConceptId: string): string | null {
    const matchingIdentifier = alternateIdentifiers.find(
      (identifier: any) => identifier.identifierScheme?.conceptId === identifierSchemeConceptId
    );

    return matchingIdentifier ? matchingIdentifier.alternateIdentifier : null;
  }

  private buildServiceRequest(item: any, specimen?: any, loincCode?: string | null): ServiceRequest {
    const coding: Array<{ system?: string; version?: string; code?: string; display?: string }> = [
      {
        system: 'http://snomed.info/sct',
        version: this.activeEditionVersion,
        code: item.code,
        display: item.display
      }
    ];

    if (loincCode) {
      coding.push({
        system: 'http://loinc.org',
        code: loincCode,
        display: item.display
      });
    }

    const patientId = this.patient?.id || 'example-patient';
    const patientName = this.getPatientDisplayName();
    const today = this.getCurrentDate();

    return {
      resourceType: 'ServiceRequest',
      id: `service-request-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: 'draft',
      intent: 'order',
      code: {
        coding,
        text: item.display
      },
      subject: {
        reference: `Patient/${patientId}`,
        display: patientName
      },
      authoredOn: today,
      occurrenceDateTime: today,
      specimen: specimen ? [{
        reference: `urn:uuid:specimen-${specimen.code}`,
        display: specimen.display,
        identifier: {
          system: 'http://snomed.info/sct',
          value: specimen.code
        }
      }] : undefined
    };
  }

  private getPatientDisplayName(): string {
    const name = this.patient?.name?.[0];
    if (name?.text) {
      return name.text;
    }
    const parts = [...(name?.given || []), name?.family].filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    return 'Jane Doe';
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  getActiveEditionReleaseLabel(): string {
    const releaseDate = this.activeEditionVersion.split('/version/')[1];
    return releaseDate || 'unversioned edition';
  }

  getActiveEditionTooltip(): string {
    return `Using LOINC Ontology Edition ${this.getActiveEditionReleaseLabel()}`;
  }

  isGrouper(item: SearchResultItem): boolean {
    return !!item.isGrouper;
  }

  canExpandGrouper(item: SearchResultItem): boolean {
    return this.isGrouper(item);
  }

  toggleGrouper(item: SearchResultItem, event: Event): void {
    event.stopPropagation();

    if (!this.canExpandGrouper(item)) {
      return;
    }

    if (item.children) {
      item.isExpanded = !item.isExpanded;
      this.rebuildVisibleSearchResults();
      return;
    }

    item.isExpanded = true;
    item.isLoadingChildren = true;
    this.rebuildVisibleSearchResults();

    this.terminologyService.expandValueSetFromServer(
      this.loincTerminologyServer,
      this.activeEditionVersion,
      `(<! ${item.code}) AND (${this.loincOrderablesRefset})`,
      '',
      0,
      100
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        item.children = this.markGroupers(result?.expansion?.contains || []);
        item.isLoadingChildren = false;
        this.rebuildVisibleSearchResults();
      },
      error: () => {
        item.children = [];
        item.isExpanded = false;
        item.isLoadingChildren = false;
        this.rebuildVisibleSearchResults();
      }
    });
  }

  private preloadGroupers(): void {
    this.loincGrouperCacheService.warmGroupers(this.loincTerminologyServer, this.activeEditionVersion)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.searchResults = this.markGroupers(this.searchResults);
          this.rebuildVisibleSearchResults();
          this.searchControl.enable();
          this.initializing = false;
        },
        error: () => {
          this.searchControl.enable();
          this.initializing = false;
        }
      });
  }

  private markGroupers(results: SearchResultItem[]): SearchResultItem[] {
    return results.map((result) => ({
      ...result,
      children: result.children,
      isExpanded: result.isExpanded || false,
      isLoadingChildren: result.isLoadingChildren || false,
      isGrouper: this.loincGrouperCacheService.isGrouper(this.activeEditionVersion, result.code)
    }));
  }

  private rebuildVisibleSearchResults(): void {
    this.visibleSearchResults = this.flattenSearchResults(this.searchResults);
  }

  private flattenSearchResults(results: SearchResultItem[], level = 0): SearchResultItem[] {
    return results.flatMap((result) => {
      result.level = level;

      if (!result.isExpanded || !result.children?.length) {
        return [result];
      }

      return [
        result,
        ...this.flattenSearchResults(result.children, level + 1)
      ];
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
