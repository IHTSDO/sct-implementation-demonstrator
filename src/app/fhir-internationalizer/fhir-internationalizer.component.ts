import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { from, Observable, of, Subscription } from 'rxjs';
import { catchError, concatMap, finalize, tap } from 'rxjs/operators';
import { SnomedCodingLocalizationService } from '../services/snomed-coding-localization.service';

export interface FoundCoding {
  path: string;
  system: string;
  code: string;
  display?: string;
  version?: string;
  isExtension: boolean;
  moduleId?: string;
  editionFhirUrl?: string;
  replacements: Array<{ code: string; display: string; system?: string; selected: boolean }>;
  loading: boolean;
  error?: string;
  analyzed: boolean;
  inactive?: boolean;
  inactiveReplacements?: Array<{ code: string; display: string; system: string; equivalence: string; selected: boolean }>;
  loadingInactiveReplacements?: boolean;
  notFoundInEdition?: boolean;
}

export interface PreviewRow {
  path: string;
  code: string;
  display: string;
  isExtension: boolean;
  moduleId?: string;
  modifiedDisplay: string | null;
  replacements: Array<{ code: string; display: string; system?: string; selected: boolean }>;
  loading: boolean;
  analyzed: boolean;
  inactive?: boolean;
  inactiveReplacements?: Array<{ code: string; display: string; system: string; equivalence: string; selected: boolean }>;
  loadingInactiveReplacements?: boolean;
}

export interface FlatTreeItem {
  type: 'node' | 'leaf';
  label: string;
  depth: number;
  nodeId: string;
  parentIds: string[];
  isExpandable: boolean;
  row?: PreviewRow;
}

export interface DisplayUpdate {
  code: string;
  path: string;
  documentDisplay: string;
  editionDisplay: string;
}

@Component({
  selector: 'app-fhir-internationalizer',
  templateUrl: './fhir-internationalizer.component.html',
  styleUrls: ['./fhir-internationalizer.component.css'],
  standalone: false
})
export class FhirInternationalizerComponent implements OnInit, OnDestroy {
  fhirResource: any = null;
  resourceType = '';
  resourceId = '';
  validationError = '';
  isDragging = false;
  fileName = '';

  allCodings: FoundCoding[] = [];
  extensionCodings: FoundCoding[] = [];
  internationalSnomedCodings: FoundCoding[] = [];

  extensionCodingsColumns = ['code', 'display', 'moduleId', 'action', 'replacements'];
  collapsedNodes = new Set<string>();
  displayUpdatesColumns = ['code', 'documentDisplay', 'editionDisplay'];

  editionsDetails: any[] = [];

  displayUpdates: DisplayUpdate[] = [];
  loadingDisplayUpdates = false;
  displayUpdatesAnalyzed = false;
  displayUpdatesError: string | undefined;

  verifyingModules = false;
  private verifyRun = 0;

  private serverSub?: Subscription;
  private analyzeAllSub?: Subscription;
  private inactiveSub?: Subscription;

  constructor(
    private terminologyService: TerminologyService,
    private localization: SnomedCodingLocalizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.serverSub = this.terminologyService.snowstormFhirBase$.subscribe(() => {
      this.extensionCodings.forEach(c => {
        c.replacements = [];
        c.analyzed = false;
        c.error = undefined;
      });
      this.displayUpdates = [];
      this.displayUpdatesAnalyzed = false;
      this.displayUpdatesError = undefined;
    });

    this.terminologyService.editionsDetails$.subscribe(details => {
      this.editionsDetails = details;
    });
  }

  ngOnDestroy(): void {
    this.serverSub?.unsubscribe();
    this.analyzeAllSub?.unsubscribe();
    this.inactiveSub?.unsubscribe();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.processFile(file);
    event.target.value = '';
  }

  loadExample(): void {
    fetch('assets/data/ips-example-argentina-problematic-use.json')
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'ips-example-argentina-problematic-use.json', { type: 'application/json' });
        this.processFile(file);
      });
  }

  async processFile(file: File): Promise<void> {
    this.verifyRun++;
    this.analyzeAllSub?.unsubscribe();
    this.inactiveSub?.unsubscribe();
    this.verifyingModules = false;
    this.validationError = '';
    this.fhirResource = null;
    this.allCodings = [];
    this.extensionCodings = [];
    this.internationalSnomedCodings = [];
    this.displayUpdates = [];
    this.displayUpdatesAnalyzed = false;
    this.displayUpdatesError = undefined;
    this.fileName = file.name;

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.validationError = 'Please upload a JSON file (.json)';
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!this.isFhirResource(json)) {
        this.validationError =
          'The file does not appear to be a FHIR resource. A valid FHIR resource must have a "resourceType" property.';
        return;
      }

      this.fhirResource = json;
      this.resourceType = json.resourceType;
      this.resourceId = json.id || '(no id)';

      this.collapsedNodes = new Set<string>();
      this.allCodings = this.findAllCodings(json);
      this.extensionCodings = this.allCodings.filter(c => c.isExtension);
      this.splitCodingsByOrigin();
      this.verifyExtensionModules();
    } catch (e: any) {
      this.validationError = 'Failed to parse JSON: ' + (e?.message || String(e));
    }
  }

  isFhirResource(obj: any): boolean {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      !Array.isArray(obj) &&
      typeof obj.resourceType === 'string' &&
      obj.resourceType.trim().length > 0
    );
  }

  findAllCodings(obj: any): FoundCoding[] {
    const results: FoundCoding[] = [];
    this.traverseForCodings(obj, '', results);
    return results;
  }

  private traverseForCodings(obj: any, path: string, results: FoundCoding[]): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item, i) =>
        this.traverseForCodings(item, `${path}[${i}]`, results)
      );
      return;
    }

    if (typeof obj.system === 'string' && typeof obj.code === 'string') {
      results.push(this.buildFoundCoding(path, obj));
      return;
    }

    for (const key of Object.keys(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      this.traverseForCodings(obj[key], childPath, results);
    }
  }

  private buildFoundCoding(path: string, obj: any): FoundCoding {
    const system: string = obj.system || '';
    const version: string | undefined = obj.version;
    const { isExtension, moduleId, editionFhirUrl } = this.localization.classifyCoding(system, version);

    return {
      path,
      system,
      code: obj.code || '',
      display: obj.display,
      version,
      isExtension,
      moduleId,
      editionFhirUrl,
      replacements: [],
      loading: false,
      analyzed: false
    };
  }

  private splitCodingsByOrigin(): void {
    this.extensionCodings = this.allCodings.filter(c => c.isExtension);
    this.internationalSnomedCodings = this.allCodings.filter(
      c => this.localization.isSnomedSystem(c.system) && !c.isExtension && !!c.code && !!c.display
    );
  }

  /**
   * `version` identifies the edition a concept was selected from, not the
   * module the concept lives in: an extension edition also contains every
   * International concept. Ask each edition which of its codes are actually
   * in the International module and reclassify those as International.
   */
  private async verifyExtensionModules(): Promise<void> {
    const byEdition = new Map<string, FoundCoding[]>();
    for (const c of this.extensionCodings) {
      if (!c.editionFhirUrl || !c.code) continue;
      byEdition.set(c.editionFhirUrl, [...(byEdition.get(c.editionFhirUrl) ?? []), c]);
    }
    if (!byEdition.size) return;

    const run = ++this.verifyRun;
    this.verifyingModules = true;

    try {
      const codesByEdition = new Map([...byEdition].map(([url, codings]) => [url, codings.map(c => c.code)]));
      const results = await this.localization.resolveInternationalCodes(codesByEdition);
      if (run !== this.verifyRun) return;
      for (const [editionUrl, codings] of byEdition) {
        const { inModule, missing } = results.get(editionUrl)!;
        for (const c of codings) {
          if (inModule.has(c.code)) {
            c.isExtension = false;
            c.moduleId = SnomedCodingLocalizationService.INTERNATIONAL_MODULE_ID;
          } else if (missing.has(c.code)) {
            c.notFoundInEdition = true;
            c.analyzed = true;
            c.error = `Concept not found in ${this.getExtensionName(c.moduleId)}`;
          }
        }
      }
    } catch (err) {
      // Keep the version-based classification when the server cannot answer
      console.warn('Could not verify concept modules', err);
    } finally {
      if (run === this.verifyRun) {
        this.splitCodingsByOrigin();
        this.verifyingModules = false;
        this.cdr.detectChanges();
      }
    }
  }

  // --- Extension codings analysis ---

  analyzeExtensionCoding(coding: FoundCoding): void {
    if (!this.canAnalyzeExtension(coding)) return;
    this.extensionAnalysis$(coding).subscribe();
  }

  analyzeAll(): void {
    const pending = this.extensionCodings.filter(c => !c.loading && this.canAnalyzeExtension(c));
    pending.forEach(c => (c.loading = true));

    // One terminology request at a time: extension codings first, then displays
    this.analyzeAllSub?.unsubscribe();
    this.analyzeAllSub = from(pending)
      .pipe(concatMap(c => this.extensionAnalysis$(c)))
      .subscribe({
        complete: () => {
          if (this.internationalSnomedCodings.length) {
            this.checkInternationalDisplays();
          }
        }
      });
  }

  private canAnalyzeExtension(coding: FoundCoding): boolean {
    return !!coding.code && !!coding.editionFhirUrl && !coding.notFoundInEdition;
  }

  private extensionAnalysis$(coding: FoundCoding): Observable<unknown> {
    coding.loading = true;
    coding.error = undefined;
    coding.replacements = [];
    coding.analyzed = false;

    return this.localization.findInternationalAncestors(coding.code, coding.editionFhirUrl!).pipe(
      tap(alternatives => {
        coding.replacements = alternatives.map(r => ({ ...r, selected: true }));
      }),
      catchError((err: any) => {
        coding.error = err?.message || 'Failed to expand ECL — check the server and edition availability';
        return of(null);
      }),
      finalize(() => {
        coding.loading = false;
        coding.analyzed = true;
        this.cdr.detectChanges();
      })
    );
  }

  // --- International codings display verification ---

  checkInternationalDisplays(): void {
    if (!this.internationalSnomedCodings.length) return;

    this.loadingDisplayUpdates = true;
    this.displayUpdatesError = undefined;
    this.displayUpdates = [];
    this.displayUpdatesAnalyzed = false;

    this.localization.checkInSelectedEdition(this.internationalSnomedCodings.map(c => c.code)).subscribe({
      next: ({ displays, notActive }) => {
        this.internationalSnomedCodings.forEach(c => (c.inactive = notActive.has(c.code)));
        this.findInactiveReplacements(this.internationalSnomedCodings.filter(c => c.inactive));

        // One row per coding occurrence where the display differs
        this.displayUpdates = this.internationalSnomedCodings
          .filter(c => {
            const editionDisplay = displays.get(c.code);
            return !!editionDisplay && !!c.display && c.display.trim() !== editionDisplay.trim();
          })
          .map(c => ({
            code: c.code,
            path: c.path,
            documentDisplay: c.display!,
            editionDisplay: displays.get(c.code)!
          }));

        this.loadingDisplayUpdates = false;
        this.displayUpdatesAnalyzed = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.displayUpdatesError = err?.message || 'Failed to fetch displays from current edition';
        this.loadingDisplayUpdates = false;
        this.displayUpdatesAnalyzed = true;
        this.cdr.detectChanges();
      }
    });
  }

  // --- Inactive concept replacement lookup ---

  private findInactiveReplacements(codings: FoundCoding[]): void {
    codings.forEach(c => {
      c.loadingInactiveReplacements = true;
      c.inactiveReplacements = [];
    });

    this.inactiveSub?.unsubscribe();
    this.inactiveSub = from(codings)
      .pipe(
        concatMap(c =>
          this.localization.findHistoricalReplacements(c.code).pipe(
            tap(replacements => {
              c.inactiveReplacements = replacements.map(r => ({ ...r, selected: true }));
              c.loadingInactiveReplacements = false;
              this.cdr.detectChanges();
            })
          )
        )
      )
      .subscribe();
  }

  // --- Download modified resource ---

  get canDownload(): boolean {
    if (!this.fhirResource) return false;
    const hasReplacements = this.extensionCodings.some(c => c.analyzed && c.replacements.length > 0);
    const hasDisplayUpdates = this.displayUpdatesAnalyzed && this.displayUpdates.length > 0;
    return hasReplacements || hasDisplayUpdates;
  }

  downloadModifiedResource(): void {
    if (!this.fhirResource) return;

    const modified = JSON.parse(JSON.stringify(this.fhirResource));

    // 1. Extension codings: insert replacement(s) as new slice in the parent coding array
    for (const coding of this.extensionCodings) {
      if (!coding.analyzed || coding.replacements.length === 0) continue;

      const parentInfo = this.getParentArrayInfo(coding.path);
      if (!parentInfo) continue;

      const parentArray = this.navigatePath(modified, parentInfo.arrayPath);
      if (!Array.isArray(parentArray)) continue;

      for (const replacement of coding.replacements.filter(r => r.selected)) {
        const alreadyPresent = parentArray.some(
          (c: any) => c.code === replacement.code && c.system === replacement.system
        );
        if (!alreadyPresent) {
          parentArray.push({
            system: replacement.system || 'http://snomed.info/sct',
            code: replacement.code,
            display: replacement.display
          });
        }
      }
    }

    // 2. International codings: update display on the coding object and text on the CodeableConcept
    for (const update of this.displayUpdates) {
      // Find the FoundCoding that matches (code + path uniquely identifies it)
      const original = this.internationalSnomedCodings.find(
        c => c.code === update.code && c.path === update.path
      );
      if (!original) continue;

      // Update coding.display
      const codingObj = this.navigatePath(modified, original.path);
      if (codingObj && typeof codingObj.display !== 'undefined') {
        codingObj.display = update.editionDisplay;
      }

      // Update CodeableConcept.text if present
      const codeableConceptPath = this.getCodeableConceptPath(original.path);
      const concept = codeableConceptPath !== null
        ? this.navigatePath(modified, codeableConceptPath)
        : modified;
      if (concept && typeof concept.text === 'string') {
        concept.text = update.editionDisplay;
      }
    }

    // Serialize and trigger download
    const json = JSON.stringify(modified, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName.replace(/\.json$/i, '_internationalized.json');
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Given a coding path like "code.coding[0]" or "reaction[0].substance.coding[1]",
   * returns the path of the parent array ("code.coding", "reaction[0].substance.coding")
   * and the index within it.
   */
  private getParentArrayInfo(codingPath: string): { arrayPath: string; index: number } | null {
    const match = codingPath.match(/^(.*)\[(\d+)\]$/);
    if (!match) return null;
    return { arrayPath: match[1], index: parseInt(match[2], 10) };
  }

  /**
   * Returns the path of the CodeableConcept that owns the coding array.
   * e.g. "code.coding[0]"      → "code"
   *      "reaction[0].substance.coding[0]" → "reaction[0].substance"
   *      "coding[0]"           → "" (root object)
   */
  private getCodeableConceptPath(codingPath: string): string | null {
    const parentInfo = this.getParentArrayInfo(codingPath);
    if (!parentInfo) return null;
    const dotIdx = parentInfo.arrayPath.lastIndexOf('.');
    return dotIdx === -1 ? '' : parentInfo.arrayPath.substring(0, dotIdx);
  }

  /**
   * Navigates an object using a dot/bracket path string.
   * e.g. "reaction[0].substance.coding" on a FHIR resource.
   * Empty string returns the root object itself.
   */
  private navigatePath(obj: any, pathStr: string): any {
    if (!pathStr) return obj;
    const normalized = pathStr.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  // --- Reset ---

  reset(): void {
    this.verifyRun++;
    this.analyzeAllSub?.unsubscribe();
    this.inactiveSub?.unsubscribe();
    this.verifyingModules = false;
    this.fhirResource = null;
    this.resourceType = '';
    this.resourceId = '';
    this.validationError = '';
    this.allCodings = [];
    this.extensionCodings = [];
    this.internationalSnomedCodings = [];
    this.displayUpdates = [];
    this.displayUpdatesAnalyzed = false;
    this.displayUpdatesError = undefined;
    this.collapsedNodes = new Set<string>();
    this.fileName = '';
  }

  getExtensionName(moduleId: string | undefined): string {
    if (!moduleId || !this.editionsDetails.length) return moduleId ?? '';
    for (const editionGroup of this.editionsDetails) {
      const match = editionGroup.editions?.some((e: any) =>
        `${e?.resource?.version || ''}`.includes(`snomed.info/sct/${moduleId}/version/`)
      );
      if (match) return editionGroup.editionName;
    }
    return moduleId;
  }

  get extensionEditionTooltip(): string {
    const seen = new Set<string>();
    for (const c of this.extensionCodings) {
      if (c.moduleId) seen.add(this.getExtensionName(c.moduleId));
    }
    return seen.size ? [...seen].join('\n') : '';
  }

  getSystemLabel(system: string): string {
    if (system.includes('snomed.info/sct')) return 'SNOMED CT';
    if (system.includes('loinc.org')) return 'LOINC';
    if (system.includes('hl7.org/fhir')) return 'HL7 FHIR';
    if (system.includes('terminology.hl7.org')) return 'HL7 Terminology';
    if (system.includes('icd')) return 'ICD';
    const parts = system.split('/').filter(Boolean);
    return parts[parts.length - 1] || system;
  }

  // --- Preview tree ---

  private get snomedPreviewRows(): PreviewRow[] {
    return this.allCodings
      .filter(c => c.system.includes('snomed.info/sct'))
      .map(c => {
        const displayUpdate = this.displayUpdates.find(
          u => u.code === c.code && u.path === c.path
        );
        const replacements =
          c.isExtension && c.analyzed && !c.error
            ? c.replacements  // pass by reference so checkbox mutations persist
            : [];
        return {
          path: c.path,
          code: c.code,
          display: c.display || c.code,
          isExtension: c.isExtension,
          moduleId: c.moduleId,
          modifiedDisplay: displayUpdate?.editionDisplay ?? null,
          replacements,
          loading: c.loading,
          analyzed: c.analyzed,
          inactive: c.inactive,
          inactiveReplacements: c.inactiveReplacements,
          loadingInactiveReplacements: c.loadingInactiveReplacements
        };
      });
  }

  get previewTree(): FlatTreeItem[] {
    const rows = this.snomedPreviewRows;
    if (!rows.length) return [];

    type NodeEntry = { nodeId: string; children: Map<string, NodeEntry>; rows: PreviewRow[] };
    const root = new Map<string, NodeEntry>();

    const getOrCreate = (map: Map<string, NodeEntry>, key: string, nodeId: string): NodeEntry => {
      if (!map.has(key)) map.set(key, { nodeId, children: new Map(), rows: [] });
      return map.get(key)!;
    };

    for (const row of rows) {
      const segments = this.pathSegments(row.path);
      let map = root;
      let pathPrefix = '';
      for (let i = 0; i < segments.length; i++) {
        pathPrefix = pathPrefix ? `${pathPrefix}/${segments[i]}` : segments[i];
        const node = getOrCreate(map, segments[i], pathPrefix);
        if (i === segments.length - 1) {
          node.rows.push(row);
        } else {
          map = node.children;
        }
      }
    }

    const result: FlatTreeItem[] = [];
    const flatten = (map: Map<string, NodeEntry>, depth: number, parentIds: string[]) => {
      for (const [seg, node] of map) {
        const isExpandable = node.children.size > 0;
        // If the object at this path has a resourceType, use "Resource: X" as label
        const nodePath = node.nodeId.replace(/\//g, '.');
        const nodeObj = this.navigatePath(this.fhirResource, nodePath);
        const label = nodeObj?.resourceType
          ? `Resource: ${nodeObj.resourceType}`
          : this.formatSegment(seg);
        result.push({
          type: 'node',
          label,
          depth,
          nodeId: node.nodeId,
          parentIds: [...parentIds],
          isExpandable
        });
        const childParentIds = [...parentIds, node.nodeId];
        flatten(node.children, depth + 1, childParentIds);
        for (const row of node.rows) {
          result.push({
            type: 'leaf',
            label: row.code,
            depth: depth + 1,
            nodeId: `${node.nodeId}#${row.code}`,
            parentIds: childParentIds,
            isExpandable: false,
            row
          });
        }
      }
    };
    flatten(root, 1, ['__root__']);

    const rootNode: FlatTreeItem = {
      type: 'node',
      label: `Resource: ${this.resourceType}`,
      depth: 0,
      nodeId: '__root__',
      parentIds: [],
      isExpandable: true
    };

    return [rootNode, ...result];
  }

  get visiblePreviewTree(): FlatTreeItem[] {
    if (!this.collapsedNodes.size) return this.previewTree;
    return this.previewTree.filter(item =>
      item.parentIds.every(id => !this.collapsedNodes.has(id))
    );
  }

  toggleNode(nodeId: string): void {
    const next = new Set(this.collapsedNodes);
    next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
    this.collapsedNodes = next;
  }

  isNodeExpanded(nodeId: string): boolean {
    return !this.collapsedNodes.has(nodeId);
  }

  /** Splits a coding path into meaningful tree segments, stripping the trailing coding[N]. */
  private pathSegments(path: string): string[] {
    const clean = path.replace(/\.?coding\[\d+\]$/, '');
    return clean ? clean.split('.').filter(Boolean) : ['(root)'];
  }

  /** Makes a path segment human-readable: "clinicalStatus" → "Clinical Status", "reaction[0]" → "Reaction [0]" */
  private formatSegment(seg: string): string {
    return seg
      .replace(/\[(\d+)\]/, ' [$1]')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^(.)/, s => s.toUpperCase())
      .trim();
  }

  getShortPath(path: string): string {
    const segments = path.replace(/\[(\d+)\]/g, '[$1]').split('.');
    return segments.slice(-3).join('.');
  }

  get anyLoading(): boolean {
    return this.verifyingModules || this.extensionCodings.some(c => c.loading);
  }

  get analyzedCount(): number {
    return this.extensionCodings.filter(c => c.analyzed).length;
  }
}
