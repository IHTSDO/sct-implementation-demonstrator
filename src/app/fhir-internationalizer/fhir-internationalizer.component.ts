import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface FoundCoding {
  path: string;
  system: string;
  code: string;
  display?: string;
  version?: string;
  isExtension: boolean;
  moduleId?: string;
  editionFhirUrl?: string;
  ecl?: string;
  replacements: Array<{ code: string; display: string; system?: string; selected: boolean }>;
  loading: boolean;
  error?: string;
  analyzed: boolean;
  inactive?: boolean;
  inactiveReplacements?: Array<{ code: string; display: string; system: string; equivalence: string; selected: boolean }>;
  loadingInactiveReplacements?: boolean;
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
  readonly INTERNATIONAL_MODULE_ID = '900000000000207008';

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

  private serverSub?: Subscription;

  constructor(
    private terminologyService: TerminologyService,
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

  async processFile(file: File): Promise<void> {
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
      this.internationalSnomedCodings = this.allCodings.filter(
        c => c.system.includes('snomed.info/sct') && !c.isExtension && !!c.code && !!c.display
      );
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
    const code: string = obj.code || '';
    const display: string | undefined = obj.display;
    const version: string | undefined = obj.version;

    const { isExtension, moduleId, editionFhirUrl } = this.classifyCoding(system, version);

    let ecl: string | undefined;
    if (isExtension && code) {
      ecl =
        `((> ${code} {{ C moduleId = ${this.INTERNATIONAL_MODULE_ID} }} ) ` +
        `MINUS (> (> ${code} {{ C moduleId = ${this.INTERNATIONAL_MODULE_ID} }} )))`;
    }

    return {
      path,
      system,
      code,
      display,
      version,
      isExtension,
      moduleId,
      editionFhirUrl,
      ecl,
      replacements: [],
      loading: false,
      analyzed: false
    };
  }

  private classifyCoding(
    system: string,
    version?: string
  ): { isExtension: boolean; moduleId?: string; editionFhirUrl?: string } {
    const isSnomedSystem = system.includes('snomed.info/sct');
    if (!isSnomedSystem) {
      return { isExtension: false };
    }

    const uriToCheck = version || system;
    const moduleId = this.extractModuleId(uriToCheck);

    if (!moduleId || moduleId === this.INTERNATIONAL_MODULE_ID) {
      return { isExtension: false };
    }

    return {
      isExtension: true,
      moduleId,
      editionFhirUrl: `http://snomed.info/sct/${moduleId}`
    };
  }

  extractModuleId(uri: string): string | null {
    if (!uri) return null;
    const match = uri.match(/snomed\.info\/sct\/(\d+)/);
    return match ? match[1] : null;
  }

  // --- Extension codings analysis ---

  analyzeExtensionCoding(coding: FoundCoding): void {
    if (!coding.ecl || !coding.editionFhirUrl) return;

    coding.loading = true;
    coding.error = undefined;
    coding.replacements = [];
    coding.analyzed = false;

    const fhirBase = this.terminologyService.getSnowstormFhirBase();

    this.terminologyService
      .expandValueSetFromServer(fhirBase, coding.editionFhirUrl, coding.ecl, '', 0, 50)
      .subscribe({
        next: (res: any) => {
          coding.replacements = (res?.expansion?.contains ?? []).map((r: any) => ({ ...r, selected: true }));
          coding.loading = false;
          coding.analyzed = true;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          coding.error = err?.message || 'Failed to expand ECL — check the server and edition availability';
          coding.loading = false;
          coding.analyzed = true;
          this.cdr.detectChanges();
        }
      });
  }

  analyzeAll(): void {
    this.extensionCodings
      .filter(c => !c.loading)
      .forEach(c => this.analyzeExtensionCoding(c));
    if (this.internationalSnomedCodings.length) {
      this.checkInternationalDisplays();
    }
  }

  // --- International codings display verification ---

  checkInternationalDisplays(): void {
    if (!this.internationalSnomedCodings.length) return;

    this.loadingDisplayUpdates = true;
    this.displayUpdatesError = undefined;
    this.displayUpdates = [];
    this.displayUpdatesAnalyzed = false;

    // Deduplicate codes for the ECL, but keep all original occurrences for comparison
    const uniqueCodes = [...new Set(this.internationalSnomedCodings.map(c => c.code))];
    const ecl = uniqueCodes.join(' OR ');

    this.terminologyService.expandValueSet(ecl, '', 0, uniqueCodes.length + 50).subscribe({
      next: (res: any) => {
        const contains: any[] = res?.expansion?.contains ?? [];

        // code → display as returned by the current edition
        const serverDisplayMap = new Map<string, string>();
        contains.forEach((item: any) => {
          if (item.code && item.display) {
            serverDisplayMap.set(item.code, item.display);
          }
        });

        // Mark concepts not returned by the expansion as inactive; fetch replacements for those
        this.internationalSnomedCodings.forEach(c => {
          c.inactive = !serverDisplayMap.has(c.code);
          if (c.inactive) this.findInactiveReplacements(c);
        });

        // Emit one row per coding occurrence where the display differs
        this.displayUpdates = this.internationalSnomedCodings
          .filter(c => {
            const editionDisplay = serverDisplayMap.get(c.code);
            if (!editionDisplay || !c.display) return false;
            return c.display.trim() !== editionDisplay.trim();
          })
          .map(c => ({
            code: c.code,
            path: c.path,
            documentDisplay: c.display!,
            editionDisplay: serverDisplayMap.get(c.code)!
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

  private readonly INACTIVE_REFSETS = [
    { id: '900000000000526001', label: 'REPLACED BY' },
    { id: '900000000000527005', label: 'SAME AS' },
    { id: '900000000000530003', label: 'ALTERNATIVE' },
    { id: '900000000000523009', label: 'POSSIBLY EQUIVALENT TO' },
  ];

  private findInactiveReplacements(coding: FoundCoding): void {
    coding.loadingInactiveReplacements = true;
    coding.inactiveReplacements = [];

    forkJoin(
      this.INACTIVE_REFSETS.map(r =>
        this.terminologyService.translate(r.id, coding.code).pipe(
          map((res: any) => this.parseTranslateResult(res)),
          catchError(() => of([]))
        )
      )
    ).subscribe(results => {
      coding.inactiveReplacements = (results as any[][]).flat();
      coding.loadingInactiveReplacements = false;
      this.cdr.detectChanges();
    });
  }

  private parseTranslateResult(res: any): Array<{ code: string; display: string; system: string; equivalence: string }> {
    const out: any[] = [];
    if (!res?.parameter) return out;
    for (const param of res.parameter) {
      if (param.name !== 'match') continue;
      const item: any = {};
      for (const part of param.part ?? []) {
        if (part.name === 'concept' && part.valueCoding) {
          item.code = part.valueCoding.code;
          item.display = part.valueCoding.display;
          item.system = part.valueCoding.system;
        }
        if (part.name === 'equivalence' && part.valueCode) {
          item.equivalence = part.valueCode;
        }
      }
      if (item.code) out.push({ ...item, selected: true });
    }
    return out;
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
    return this.extensionCodings.some(c => c.loading);
  }

  get analyzedCount(): number {
    return this.extensionCodings.filter(c => c.analyzed).length;
  }
}
