import { Component, OnInit, OnDestroy } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { concatMap, delay, of, from, Subscription, catchError } from 'rxjs';
import * as XLSX from 'xlsx';

export interface EditionWithResult {
  edition: any;
  total: number;
  firstPage: any[];
  executedEcl?: string;
  hasError?: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-extensions-search',
  templateUrl: './extensions-search.component.html',
  styleUrl: './extensions-search.component.css',
  standalone: false
})
export class ExtensionsSearchComponent implements OnInit, OnDestroy {
  eclInput = '';
  latestEditions: any[] = [];
  editionsWithResults: EditionWithResult[] = [];
  selectedEditionIndex: number | null = null;
  resultsFilter = '';
  resultsOffset = 0;
  resultsPageSize = 50;
  loading = false;
  runningEditions = false;
  error: string | null = null;
  rightPanelResults: any[] = [];
  rightPanelTotal = 0;
  loadingRightPanel = false;
  exporting = false;
  /** Index of edition currently running (single-edition play). */
  runningEditionIndex: number | null = null;
  /** Progress tracking for running all editions */
  runningProgress = 0;
  runningTotal = 0;
  currentRunningEditionName = '';
  /** Summary after running all editions */
  successCount = 0;
  errorCount = 0;
  runCompleted = false;
  /** Edition name currently being read during export */
  exportingEditionName = '';

  private readonly DEFAULT_MODULE_ID = '900000000000207008';
  private readonly INTERNATIONAL_MODULE_ID = '900000000000207008';
  private readonly EXPORT_COUNT = 1000;
  private readonly DELAY_MS = 1000;
  private serverChangeSub?: Subscription;

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit(): void {
    this.serverChangeSub = this.terminologyService.snowstormFhirBase$.subscribe(() => {
      this.loadLatestEditions();
    });
  }

  ngOnDestroy(): void {
    this.serverChangeSub?.unsubscribe();
  }

  loadLatestEditions(): void {
    this.loading = true;
    this.error = null;
    this.terminologyService.getCodeSystems().subscribe({
      next: (response: any) => {
        const entries = response?.entry?.filter((el: any) => el.resource?.url?.includes('snomed.info')) || [];
        const editionNames = new Set<string>();
        entries.forEach((el: any) => editionNames.add(el.resource.title));
        const editionsDetails: { editionName: string; editions: any[] }[] = [];
        editionNames.forEach(editionName => {
          const group = entries
            .filter((el: any) => el.resource?.title === editionName)
            .sort((a: any, b: any) => this.compareEditions(a, b));
          if (group.length) {
            editionsDetails.push({ editionName, editions: group });
          }
        });
        this.latestEditions = editionsDetails
          .map(d => d.editions[0])
          .filter(edition => {
            const versionUrl = edition.resource.version;
            // Filter out editions with /null/ in URL or without valid moduleId
            if (!versionUrl || versionUrl.includes('/null/')) {
              return false;
            }
            const moduleId = this.extractModuleId(versionUrl);
            // Filter out editions without valid moduleId or International Edition
            return moduleId !== null && moduleId !== this.INTERNATIONAL_MODULE_ID;
          });
        this.loading = false;
      },
      error: err => {
        this.error = err?.message || 'Failed to load editions';
        this.loading = false;
      }
    });
  }

  private compareEditions(a: any, b: any): number {
    const dateA = a.resource?.date || '';
    const dateB = b.resource?.date || '';
    if (dateA < dateB) return 1;
    if (dateA > dateB) return -1;
    return 0;
  }

  extractModuleId(versionUrl: string): string | null {
    if (!versionUrl || typeof versionUrl !== 'string') return null;
    if (versionUrl.includes('/version/')) {
      const before = versionUrl.split('/version/')[0];
      const parts = before.split('/').filter(Boolean);
      const sctIndex = parts.findIndex((p: string) => p === 'sct');
      if (sctIndex >= 0 && parts.length > sctIndex + 1) {
        return parts[sctIndex + 1];
      }
    }
    if (versionUrl === 'http://snomed.info/sct') return null;
    const parts = versionUrl.replace(/\/$/, '').split('/');
    if (parts.length >= 4) {
      const moduleId = parts[parts.length - 2];
      return moduleId && /^\d+$/.test(moduleId) ? moduleId : null;
    }
    return null;
  }

  getLastRelease(edition: any): string {
    const version = edition?.resource?.version;
    if (!version) return edition?.resource?.date || 'Unknown';
    if (version.includes('/version/')) {
      const part = version.split('/version/')[1];
      return part || edition?.resource?.date || 'Unknown';
    }
    return edition?.resource?.date || 'Unknown';
  }

  buildEclWithModule(userEcl: string, moduleId: string | null): string {
    const base = (userEcl || '').trim();
    if (!base || !moduleId) return base;
    const wrappedBase = base.startsWith('(') && base.endsWith(')') ? base : `(${base})`;
    return wrappedBase + ' {{ C moduleId = ' + moduleId + ' }}';
  }

  runExecute(): void {
    if (!this.eclInput.trim()) {
      this.error = 'Please enter an ECL expression';
      return;
    }
    this.error = null;
    this.editionsWithResults = [];
    this.selectedEditionIndex = null;
    this.rightPanelResults = [];
    this.rightPanelTotal = 0;
    this.runningEditions = true;
    this.runningProgress = 0;
    this.runningTotal = this.latestEditions.length;
    this.currentRunningEditionName = '';
    this.successCount = 0;
    this.errorCount = 0;
    this.runCompleted = false;

    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const editions = [...this.latestEditions];

    from(editions).pipe(
      concatMap((edition, index) => {
        this.currentRunningEditionName = this.getEditionTitle(edition);
        this.runningProgress = index + 1; // Update progress at start of processing
        const delayObs = index === 0 ? of(edition) : of(edition).pipe(delay(this.DELAY_MS));
        return delayObs.pipe(
          concatMap(() => {
            const fhirUrl = edition.resource.version;
            const moduleId = this.extractModuleId(fhirUrl);
            const eclWithModule = this.buildEclWithModule(this.eclInput, moduleId);
            return this.terminologyService.expandValueSetFromServer(
              fhirBase,
              fhirUrl,
              eclWithModule,
              '',
              0,
              this.resultsPageSize
            ).pipe(
              concatMap((res: any) => {
                const total = res?.expansion?.total ?? 0;
                const contains = res?.expansion?.contains ?? [];
                this.editionsWithResults[index] = {
                  edition,
                  total,
                  firstPage: contains,
                  executedEcl: eclWithModule,
                  hasError: false
                };
                this.successCount++;
                return of(null);
              }),
              catchError((err) => {
                this.editionsWithResults[index] = {
                  edition,
                  total: 0,
                  firstPage: [],
                  executedEcl: eclWithModule,
                  hasError: true,
                  errorMessage: err?.message || 'Request failed'
                };
                this.errorCount++;
                return of(null);
              })
            );
          })
        );
      })
    ).subscribe({
      next: () => {},
      error: err => {
        this.error = err?.message || 'Error running ECL';
        this.runningEditions = false;
        this.currentRunningEditionName = '';
        this.runCompleted = true;
      },
      complete: () => {
        this.runningEditions = false;
        this.currentRunningEditionName = '';
        this.runCompleted = true;
      }
    });
  }

  onSelectEdition(index: number): void {
    this.selectedEditionIndex = index;
    const item = this.editionsWithResults[index];
    if (item) {
      this.rightPanelResults = item.firstPage;
      this.rightPanelTotal = item.total;
    } else {
      this.rightPanelResults = [];
      this.rightPanelTotal = 0;
    }
  }

  /** Run ECL for the currently selected edition (play button in right panel). */
  runSelectedEdition(): void {
    if (this.selectedEditionIndex != null) {
      this.runSingleEdition(this.selectedEditionIndex);
    }
  }

  /** Run ECL for a single edition. */
  runSingleEdition(index: number): void {
    if (!this.eclInput.trim() || index < 0 || index >= this.latestEditions.length) return;
    const edition = this.latestEditions[index];
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const fhirUrl = edition.resource.version;
    const moduleId = this.extractModuleId(fhirUrl);
    const eclWithModule = this.buildEclWithModule(this.eclInput, moduleId);
    this.runningEditionIndex = index;
    this.error = null;
    this.terminologyService.expandValueSetFromServer(
      fhirBase,
      fhirUrl,
      eclWithModule,
      '',
      0,
      this.resultsPageSize
    ).subscribe({
      next: (res: any) => {
        const total = res?.expansion?.total ?? 0;
        const contains = res?.expansion?.contains ?? [];
        this.editionsWithResults[index] = { edition, total, firstPage: contains, executedEcl: eclWithModule };
        this.runningEditionIndex = null;
        if (this.selectedEditionIndex === index) {
          this.rightPanelResults = contains;
          this.rightPanelTotal = total;
        }
      },
      error: err => {
        this.error = err?.message || 'Error running ECL for this edition';
        this.runningEditionIndex = null;
      }
    });
  }

  loadRightPanelPage(): void {
    if (this.selectedEditionIndex == null) return;
    const edition = this.editionsWithResults[this.selectedEditionIndex]?.edition ?? this.latestEditions[this.selectedEditionIndex];
    if (!edition || !this.eclInput.trim()) return;
    this.loadingRightPanel = true;
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const fhirUrl = edition.resource.version;
    const moduleId = this.extractModuleId(fhirUrl);
    const eclWithModule = this.buildEclWithModule(this.eclInput, moduleId);
    this.terminologyService.expandValueSetFromServer(
      fhirBase,
      fhirUrl,
      eclWithModule,
      this.resultsFilter,
      this.resultsOffset,
      this.resultsPageSize
    ).subscribe({
      next: (res: any) => {
        this.rightPanelResults = res?.expansion?.contains ?? [];
        this.rightPanelTotal = res?.expansion?.total ?? 0;
        this.loadingRightPanel = false;
      },
      error: () => {
        this.loadingRightPanel = false;
      }
    });
  }

  onFilterOrPageChange(): void {
    this.loadRightPanelPage();
  }

  /** Load more results for the current edition (pagination) */
  loadMore(): void {
    if (this.selectedEditionIndex == null || this.loadingRightPanel) return;
    const edition = this.editionsWithResults[this.selectedEditionIndex]?.edition ?? this.latestEditions[this.selectedEditionIndex];
    if (!edition || !this.eclInput.trim()) return;
    
    this.loadingRightPanel = true;
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const fhirUrl = edition.resource.version;
    const moduleId = this.extractModuleId(fhirUrl);
    const eclWithModule = this.buildEclWithModule(this.eclInput, moduleId);
    const offset = this.rightPanelResults.length; // Start from where we left off
    
    this.terminologyService.expandValueSetFromServer(
      fhirBase,
      fhirUrl,
      eclWithModule,
      '',
      offset,
      this.resultsPageSize
    ).subscribe({
      next: (res: any) => {
        const newResults = res?.expansion?.contains ?? [];
        this.rightPanelResults = [...this.rightPanelResults, ...newResults]; // Accumulate results
        this.rightPanelTotal = res?.expansion?.total ?? this.rightPanelTotal;
        this.loadingRightPanel = false;
      },
      error: () => {
        this.loadingRightPanel = false;
      }
    });
  }

  getEditionTitle(edition: any): string {
    return edition?.resource?.title?.replace('SNOMED CT release ', '') || 'Edition';
  }

  /** Count for edition at index: number from editionsWithResults after run, or "-" before run. */
  getCountDisplay(index: number): string | number {
    const item = this.editionsWithResults[index];
    if (item != null && !item.hasError) return item.total;
    if (item?.hasError) return 'Error';
    return '-';
  }

  /** Check if edition at index has an error */
  hasEditionError(index: number): boolean {
    const item = this.editionsWithResults[index];
    return item?.hasError === true;
  }

  /** Get error message for edition at index */
  getEditionErrorMessage(index: number): string {
    const item = this.editionsWithResults[index];
    return item?.errorMessage || 'Unknown error';
  }

  /** Data source for table including "Load more" row when applicable */
  get displayedResultsWithLoadMore(): any[] {
    const hasMore = this.rightPanelResults.length < this.rightPanelTotal;
    if (!hasMore || this.loadingRightPanel) {
      return this.rightPanelResults;
    }
    return [...this.rightPanelResults, { _loadMore: true }];
  }

  /** Predicate for data rows (excludes load more row) */
  isDataRow(_index: number, row: any): boolean {
    return !row?._loadMore;
  }

  /** Predicate for load more row */
  isLoadMoreRow(_index: number, row: any): boolean {
    return row?._loadMore === true;
  }

  /** Get executed ECL for the currently selected edition */
  getExecutedEcl(): string {
    if (this.selectedEditionIndex == null) return '';
    const item = this.editionsWithResults[this.selectedEditionIndex];
    return item?.executedEcl || '';
  }

  exportToExcel(): void {
    if (!this.editionsWithResults.length) return;
    this.exporting = true;
    this.exportingEditionName = '';
    const fhirBase = this.terminologyService.getSnowstormFhirBase();
    const rows: any[][] = [
      ['ConceptId', 'FSN/Display', 'ModuleId', 'Extension Name', 'Last Release']
    ];

    from(this.editionsWithResults).pipe(
      concatMap((item, index) => {
        // Skip editions with errors
        if (item.hasError) {
          return of(null);
        }

        const extensionName = this.getEditionTitle(item.edition);
        this.exportingEditionName = extensionName;

        const fhirUrl = item.edition.resource.version;
        const moduleId = this.extractModuleId(fhirUrl);
        const lastRelease = this.getLastRelease(item.edition);

        // If we already have all the data (total <= what we loaded), use cached data
        if (item.total <= item.firstPage.length) {
          item.firstPage.forEach((c: any) => {
            rows.push([
              c.code || '',
              c.display || '',
              moduleId,
              extensionName,
              lastRelease
            ]);
          });
          return of(null);
        }

        // Otherwise, fetch up to EXPORT_COUNT results
        const delayObs = index === 0 ? of(item) : of(item).pipe(delay(this.DELAY_MS));
        return delayObs.pipe(
          concatMap(() => {
            const eclWithModule = this.buildEclWithModule(this.eclInput, moduleId);
            return this.terminologyService.expandValueSetFromServer(
              fhirBase,
              fhirUrl,
              eclWithModule,
              '',
              0,
              this.EXPORT_COUNT
            ).pipe(
              concatMap((res: any) => {
                const contains = res?.expansion?.contains ?? [];
                contains.forEach((c: any) => {
                  rows.push([
                    c.code || '',
                    c.display || '',
                    moduleId,
                    extensionName,
                    lastRelease
                  ]);
                });
                return of(null);
              }),
              catchError(() => {
                // On error, skip this edition
                return of(null);
              })
            );
          })
        );
      })
    ).subscribe({
      next: () => {},
      error: () => {
        this.exporting = false;
        this.exportingEditionName = '';
      },
      complete: () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
          { wch: 18 },
          { wch: 60 },
          { wch: 20 },
          { wch: 40 },
          { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Promotion candidates');
        const timestamp = new Date().toISOString().replace(/-|:|T/g, '').slice(0, 14);
        XLSX.writeFile(wb, `extension_promotion_candidates_${timestamp}.xlsx`);
        this.exporting = false;
        this.exportingEditionName = '';
      }
    });
  }
}
