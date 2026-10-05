import { HttpClient, HttpEventType } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as Papa from 'papaparse';
import { Observable, Subject, of, throwError } from 'rxjs';
import { catchError, map, retry, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TerminologyService } from '../../services/terminology.service';
import { IcdLoadingDialogComponent } from '../loading-dialog/loading-dialog.component';

@Component({
  selector: 'app-icd-map',
  templateUrl: './icd-map.component.html',
  styleUrls: ['./icd-map.component.css'],
  standalone: false,
})
export class IcdMapComponent implements OnInit {
  genders: any[] = [
    { code: '248152002', display: 'Female' },
    { code: '248153007', display: 'Male' },
    { code: '000000000', display: 'No information' },
  ];
  gender = this.genders[0];
  age = 35;

  eclReason: any = {
    title: 'Diagnosis',
    type: 'Autocomplete',
    ecl: '<< 138875005 |SNOMED CT Concept (SNOMED RT+CTV3)|',
    value: '',
    note: 'Search for a clinical finding or disorder',
  };
  selectedReasonSct: any;
  selectedReasonCIE: any[] = [];
  selectedReasonCIE11: any[] = [];
  icd10Data: any[] = [];
  icd11Data: any[] = [];
  icd11MapData: any[] = [];
  icd11MapDataFormat: 'preview' | 'extended' | null = null;
  icd11FormatSelection: 'preview' | 'extended' = 'preview';
  // Hidden feature: the ICD-11 tab is revealed when the ?icd11 param is present
  // in the URL (e.g. #/icd-mappings?icd11). Not persisted across reloads.
  showICD11Map = false;

  // Resource files (neutral names so the raw mapping data is not obvious).
  private readonly ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';
  private readonly RES = {
    icd11Preview: 'assets/res/ds1.dat',
    icd11Extended: 'assets/res/ds2.dat',
    icd11Labels: 'assets/res/lx-en.dat',
    icd10Labels: 'assets/res/lx10.dat',
    icd10To11: 'assets/res/m1011.dat',
  };
  term: any = '';

  /** WHO ICD-10 to ICD-11 map (multiple categories), indexed by ICD-10 code. */
  private icd10To11Index = new Map<string, any[]>();
  icd10To11Rows: any[] = [];
  /** ICD-11 MMS release of the bridge file (e.g. 2026-01), derived from its linearization URIs. */
  icd10To11Release = '';
  icd10To11DisplayedColumns: string[] = ['icd10', 'icd11', 'link'];

  icd10rules: any[] = [];
  /** True when the ICD-10 lookup could not be completed (as opposed to finding no map). */
  icd10LookupFailed = false;
  /** Latest-wins queue of ICD-10 lookups: a newer selection cancels the pending one. */
  private icd10Lookup$ = new Subject<any>();
  icd10DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'link', 'result'];
  loadingIcd10 = false;
  icd11rules: any[] = [];
  icd11DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'result'];
  loadingIcd11 = false;

  chips = [
    { code: '195967001', display: 'Asthma' },
    { code: '421671002', display: 'Pneumonia with AIDS (acquired immunodeficiency syndrome)' },
    { code: '16705321000119109', display: 'Neoplasm of right kidney' },
    { code: '95208000', display: 'Photogenic epilepsy' },
    { code: '8619003', display: 'Infertile' },
    { code: '717934004', display: 'Osteomalacia due to vitamin D deficiency' },
    { code: '39607008', display: 'Lung structure' },
    { code: '82711006', display: 'Infiltrating duct carcinoma' },
  ];

  icdOMapDefinition = {
    title: 'ICD-O-3',
    subtitle: 'International Classification of Diseases for Oncology, Third Edition',
    codeSystem: 'http://hl7.org/fhir/sid/icd-o',
    headerImage: 'assets/img/icd-o.png',
  };

  /** Servers eligible for the maps: they need the native API, which Snowstorm Lite and Ontoserver lack. */
  private readonly mapServerCandidates = environment.fhirServers
    .map((server) => server.url.replace(/\/+$/, ''))
    .filter((url) => !/snowstorm-lite|ontoserver/i.test(url));
  /** Resolved (and cached) by the service; changes only after a server is reported as failing. */
  get mapServer$(): Observable<string> {
    return this.terminologyService.resolveMapServer(this.mapServerCandidates);
  }

  /** Raw ICD-10 map rows per server and concept, so context changes (age, gender) do not hit the network. */
  private icd10Cache = new Map<string, any[]>();

  constructor(
    private terminologyService: TerminologyService,
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Hidden feature: the mere presence of the ?icd11 param reveals the tab.
    this.showICD11Map = this.isIcd11Unlocked();
    // Start probing the map servers now, in parallel with the resource files loading.
    this.mapServer$.subscribe();
    this.icd10Lookup$.pipe(switchMap((event) => this.lookupIcd10(event))).subscribe((result) => {
      if (result.failed) {
        this.icd10LookupFailed = true;
      } else {
        this.applyIcd10Rules(result.items ?? []);
      }
      this.loadingIcd10 = false;
    });
    this.fetchAllData('preview');
  }

  /**
   * Detects the ?icd11 param. With hash routing (useHash: true) the query string
   * lives inside the hash fragment (e.g. #/icd-mappings?icd11), so we read it from
   * there, falling back to the regular search string just in case.
   */
  private isIcd11Unlocked(): boolean {
    const hash = window.location.hash || '';
    const queryIndex = hash.indexOf('?');
    const search = queryIndex >= 0 ? hash.substring(queryIndex) : window.location.search;
    return new URLSearchParams(search).has('icd11');
  }

  setChip(chip: any) {
    // Pass a fresh concept object so the autocomplete's ngOnChanges fires and
    // shows the selected display + SNOMED code hint (new component behaviour).
    this.term = { code: chip.code, display: chip.display };
    this.selectedReasonSct = chip;
    this.updateReason(chip);
  }

  updateReason(event: any) {
    this.selectedReasonSct = event;
    if (event && event.code) {
      this.matchIcd10(event);
      if (this.showICD11Map) this.matchIcd11(event);
    }
  }

  /** Re-evaluate the maps when the patient age/gender changes (rules are context-dependent). */
  onContextChange() {
    if (this.selectedReasonSct?.code) {
      this.matchIcd10(this.selectedReasonSct);
      if (this.showICD11Map) this.matchIcd11(this.selectedReasonSct);
    }
  }

  onFormatChange(format: 'preview' | 'extended') {
    this.icd11FormatSelection = format;
    this.reloadIcd11MapData(format);
  }

  matchIcd11(event: any) {
    this.loadingIcd11 = true;
    this.selectedReasonCIE11 = [];
    this.icd11rules = [];
    let filteredData = this.icd11MapData.filter(
      (element: any) => element.referencedComponentId == event.code,
    );

    if (!filteredData || !filteredData[0]?.mapTarget) {
      this.selectedReasonCIE11.push([
        { code: '', display: 'MAP SOURCE CONCEPT CANNOT BE CLASSIFIED WITH AVAILABLE DATA' },
      ]);
      this.icd11rules = filteredData;
    } else {
      filteredData = filteredData.filter((element: any) =>
        this.evaluateMapRule(element.mapRule),
      );

      filteredData.sort((a: any, b: any) => {
        if (a.mapGroup !== b.mapGroup) return a.mapGroup < b.mapGroup ? -1 : 1;
        if (a.mapPriority !== b.mapPriority) return a.mapPriority < b.mapPriority ? -1 : 1;
        return a.mapTarget < b.mapTarget ? -1 : 1;
      });

      this.icd11rules = filteredData;
      let mapGroup = 0;
      let mapTargets: any[] = [];

      filteredData.forEach((element: any) => {
        if (element.mapGroup != mapGroup) {
          if (mapTargets.length > 0) this.selectedReasonCIE11.push(mapTargets);
          mapGroup = element.mapGroup;
          mapTargets = [];
        }
        let display = this.icd11Data.find((e: any) => e.Code == element.mapTarget);
        if (display) {
          display.Title = display?.Title?.replace(/- /g, '');
          const uri = this.toIcd11BrowserUrl(display['Linearization URI'] || display['Linearization (release) URI']);
          mapTargets.push({ code: element.mapTarget, display: display.Title, uri });
        } else {
          mapTargets.push({ code: element.mapTarget, display: 'Not found in ICD-11' });
        }
      });
      if (mapTargets.length > 0) this.selectedReasonCIE11.push(mapTargets);
    }

    this.loadingIcd11 = false;
    this.cdr.detectChanges();
  }

  matchIcd10(event: any) {
    this.loadingIcd10 = true;
    this.icd10LookupFailed = false;
    this.icd10rules = [];
    this.selectedReasonCIE = [];
    this.icd10To11Rows = [];
    this.icd10Lookup$.next(event);
  }

  /**
   * Resolves the ICD-10 map rules of a concept. Errors are reported apart from "no map",
   * so a flaky server is not shown as a missing map.
   */
  private lookupIcd10(event: any): Observable<{ items?: any[]; failed?: boolean }> {
    return this.fetchIcd10Items(event.code).pipe(
      map((items) => ({ items })),
      catchError((err) => {
        console.warn('[icd-map] ICD-10 map lookup failed for', event.code, err);
        return of({ failed: true });
      }),
    );
  }

  /**
   * Strategy: FHIR ConceptMap/$translate first (works on FHIR-only servers that block the
   * native API), retried once for transient errors; if it errors or returns nothing, fall back
   * to the native complex-map query. If the server still fails, it is reported as failing and
   * the lookup is retried once on the next candidate server.
   */
  private fetchIcd10Items(code: string, attempt = 0): Observable<any[]> {
    return this.mapServer$.pipe(
      switchMap((base) => {
        const key = `${base}|${code}`;
        const cached = this.icd10Cache.get(key);
        if (cached) return of(cached.map((row) => ({ ...row })));
        return this.terminologyService.getIcd10MapTargets(code, true, base).pipe(
          retry({ count: 1, delay: 500 }),
          map((response) => this.parseIcd10TranslateResponse(response)),
          catchError(() => of([] as any[])),
          switchMap((items) => (items.length > 0 ? of(items) : this.lookupIcd10ViaNativeApi(code, base))),
          tap((items) => this.icd10Cache.set(key, items.map((row) => ({ ...row })))),
          catchError((err) => {
            if (attempt >= 1) return throwError(() => err);
            this.terminologyService.reportMapServerFailure(base);
            return this.fetchIcd10Items(code, attempt + 1);
          }),
        );
      }),
    );
  }

  /** Fallback for servers whose FHIR $translate is unavailable but expose the native API. */
  private lookupIcd10ViaNativeApi(code: string, base: string): Observable<any[]> {
    return this.terminologyService
      .runEclLegacy(
        `^[*] 447562003 |ICD-10 complex map reference set| {{ M referencedComponentId = ${code} }}`,
        true,
        base,
      )
      .pipe(
        retry({ count: 1, delay: 500 }),
        map((result) => result?.items ?? []),
      );
  }

  /** Sorts the map rules, evaluates them against the patient context and builds the results. */
  private applyIcd10Rules(items: any[]) {
    items.sort((a: any, b: any) => {
      if (a.mapGroup !== b.mapGroup) return a.mapGroup < b.mapGroup ? -1 : 1;
      if (a.mapPriority !== b.mapPriority) return a.mapPriority < b.mapPriority ? -1 : 1;
      return a.mapTarget < b.mapTarget ? -1 : 1;
    });
    this.icd10rules = items;
    let group = 0;
    items.forEach((element: any) => {
      const passesMapRules = this.evaluateMapRule(element.mapRule);
      if (passesMapRules && element.mapGroup !== group) {
        element.result = true;
        group = element.mapGroup;
        if (element.mapTarget) {
          const searchCode = this.removeSecondDigitAfterDot(element.mapTarget);
          const cieCode = { code: element.mapTarget, display: this.getDisplayFromICD10Data(searchCode) };
          this.selectedReasonCIE.push(cieCode);
        } else {
          this.selectedReasonCIE.push({ code: element.mapTarget, display: element.mapAdvice });
        }
      }
    });
    this.buildIcd10To11Rows();
  }

  /** Looks up the ICD-11 targets of the ICD-10 codes selected by the SNOMED CT map. */
  private buildIcd10To11Rows() {
    const rows: any[] = [];
    this.selectedReasonCIE.forEach((item: any) => {
      const code = (item.code ?? '').replace(/[†*]/g, '').trim();
      if (!code) return;
      const targets =
        this.icd10To11Index.get(code) ?? this.icd10To11Index.get(this.removeSecondDigitAfterDot(code)) ?? [];
      if (!targets.length) {
        rows.push({ icd10Code: code, icd10Title: item.display, icd11Code: '', icd11Title: '', uri: '' });
      }
      const group = targets.map((t: any) => ({ ...t, icd10Code: code }));
      this.markIcd11TitleDifferences(group);
      rows.push(...group);
    });
    this.icd10To11Rows = rows;
  }

  /**
   * When one ICD-10 code maps to several ICD-11 categories, splits each ICD-11 title into
   * words and flags those that are not shared by all the titles, so the template can
   * highlight what distinguishes the targets (e.g. "uncertain" vs "unknown").
   */
  private markIcd11TitleDifferences(group: any[]) {
    const wordsOf = (title: string) => (title ?? '').split(/\s+/).filter(Boolean);
    const norm = (word: string) => word.toLowerCase();
    const shared = group.length > 1
      ? group.map((r) => new Set(wordsOf(r.icd11Title).map(norm))).reduce((a, b) => new Set([...a].filter((w) => b.has(w))))
      : null;
    group.forEach((r) => {
      r.icd11TitleParts = wordsOf(r.icd11Title).map((text) => ({ text, diff: !!shared && !shared.has(norm(text)) }));
    });
  }

  /**
   * Converts an MMS linearization URI (e.g. http://id.who.int/icd/release/11/2026-01/mms/1423357983
   * or .../1435254666/unspecified) into the matching entity page of the official ICD-11 browser.
   */
  private getIcd11Release(linearizationUri: string): string {
    return (linearizationUri ?? '').match(/\/release\/11\/([^/]+)\//)?.[1] ?? '';
  }

  private toIcd11BrowserUrl(linearizationUri: string): string {
    // URIs of some WHO files carry no release (.../release/11/mms/<id>): use the latest one.
    const match = (linearizationUri ?? '').match(/\/release\/11\/(?:([^/]+)\/)?mms\/(.+)$/);
    return match ? `https://icd.who.int/browse/${match[1] ?? 'latestrelease'}/mms/en#${match[2].replace(/\//g, '%2F')}` : '';
  }

  private indexIcd10To11(data: any[]) {
    this.icd10To11Index.clear();
    this.icd10To11Release = data.find((r: any) => r.release)?.release ?? '';
    data
      .filter((r: any) => r.icd10Code && r.icd11Code)
      .forEach((r: any) => {
        const list = this.icd10To11Index.get(r.icd10Code) ?? [];
        list.push(r);
        this.icd10To11Index.set(r.icd10Code, list);
      });
    this.buildIcd10To11Rows();
    this.cdr.detectChanges();
  }

  /**
   * Parses a FHIR ConceptMap/$translate response for the ICD-10 complex map into
   * map-rule rows. Each "match" parameter is preceded by a "message" parameter that
   * carries the rule details, e.g.:
   *   "...Group:1, Priority:2, Rule:IFA 248153007 | Male (finding) |, Advice:'...', Map Category:'null'."
   */
  private parseIcd10TranslateResponse(response: any): any[] {
    const params: any[] = response?.parameter ?? [];
    const rows: any[] = [];
    let pendingMessage = '';
    for (const p of params) {
      if (p.name === 'message') {
        pendingMessage = p.valueString ?? '';
      } else if (p.name === 'match') {
        const concept = (p.part ?? []).find((part: any) => part.name === 'concept');
        // Some servers ignore targetSystem and answer with other maps (e.g. the ICD-O simple map).
        if (concept?.valueCoding?.system !== this.ICD10_SYSTEM) {
          pendingMessage = '';
          continue;
        }
        const mapTarget = concept?.valueCoding?.code ?? '';
        rows.push({ ...this.parseMapAdviceMessage(pendingMessage), mapTarget });
        pendingMessage = '';
      }
    }
    return rows;
  }

  /** Extracts mapGroup/mapPriority/mapRule/mapAdvice from a $translate advice message. */
  private parseMapAdviceMessage(message: string): any {
    const group = message.match(/Group:(\d+)/);
    const priority = message.match(/Priority:(\d+)/);

    let mapRule = 'TRUE';
    const ruleStart = message.indexOf('Rule:');
    const adviceMarker = message.indexOf(", Advice:'");
    if (ruleStart >= 0 && adviceMarker > ruleStart) {
      mapRule = message.substring(ruleStart + 'Rule:'.length, adviceMarker).trim();
    }

    let mapAdvice = '';
    const adviceStart = message.indexOf("Advice:'");
    const catMarker = message.indexOf("', Map Category");
    if (adviceStart >= 0 && catMarker > adviceStart) {
      mapAdvice = message.substring(adviceStart + "Advice:'".length, catMarker);
    }

    return {
      mapGroup: group ? parseInt(group[1], 10) : 1,
      mapPriority: priority ? parseInt(priority[1], 10) : 1,
      mapRule,
      mapAdvice,
    };
  }

  private evaluateMapRule(rule: string): boolean {
    if (!rule || rule === 'TRUE' || rule === 'OTHERWISE TRUE') return true;

    // Handle AND (evaluated left-to-right, all must pass)
    const andParts = rule.split(' AND ');
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluateMapRule(part.trim()));
    }

    // Handle OR (any must pass)
    const orParts = rule.split(' OR ');
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluateMapRule(part.trim()));
    }

    // Atomic IFA condition: IFA <conceptId> | <term> | [<operator> <value> years]
    const ifaMatch = rule.match(/^IFA\s+(\d+)\s*\|[^|]*\|\s*(.*)$/);
    if (!ifaMatch) return true;

    const conceptId = ifaMatch[1];
    const remainder = ifaMatch[2].trim();

    if (conceptId === '248153007') return this.gender.code === '248153007'; // Male
    if (conceptId === '248152002') return this.gender.code === '248152002'; // Female

    if (conceptId === '445518008') {
      // Age condition, e.g. ">= 65.0 years", "<= 18.0 years", "< 65 years".
      const ageMatch = remainder.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)\s*years?$/i);
      if (!ageMatch) return true;
      const value = parseFloat(ageMatch[2]);
      switch (ageMatch[1]) {
        case '>=': return this.age >= value;
        case '<=': return this.age <= value;
        case '>':  return this.age > value;
        case '<':  return this.age < value;
        case '=':  return this.age === value;
      }
    }

    return true; // Unknown concept code: default to include
  }

  getDisplayFromICD10Data(code: string) {
    const display = this.icd10Data.find((element: any) => element.ICD10_Code === code);
    return display ? display.Short_Description : '';
  }

  removeSecondDigitAfterDot(code: string) {
    const dotIndex = code.indexOf('.');
    if (dotIndex > 0) {
      code = code.substring(0, dotIndex + 2) + code.substring(dotIndex + 3);
    }
    return code;
  }

  private fetchAllData(icd11Format: 'preview' | 'extended') {
    const dialogRef = this.dialog.open(IcdLoadingDialogComponent, { disableClose: true });
    const icd11File =
      icd11Format === 'extended' ? this.RES.icd11Extended : this.RES.icd11Preview;

    // The ICD-11 map files are large and only needed by the hidden ICD-11 tab.
    const icd11Files = this.showICD11Map
      ? this.loadIcd11MapFile(icd11File, dialogRef).then(() =>
          this.loadTextFile(this.RES.icd11Labels, dialogRef).then((body) => {
            this.icd11Data = Papa.parse(body, { header: true }).data;
          }),
        )
      : Promise.resolve();

    icd11Files
      .then(() =>
        this.loadTextFile(this.RES.icd10Labels, dialogRef).then((body) => {
          this.icd10Data = Papa.parse(body, { header: true }).data;
        }),
      )
      .then(() =>
        this.loadTextFile(this.RES.icd10To11, dialogRef).then((body) => {
          const parsed = Papa.parse(body, { header: true, delimiter: '\t', quoteChar: '\0' }).data as any[];
          this.indexIcd10To11(
            parsed.map((r: any) => ({
              icd10Code: r['icd10Code'],
              icd10Title: r['icd10Title'],
              icd11Code: r['icd11Code'],
              icd11Title: r['icd11Title'],
              uri: this.toIcd11BrowserUrl(r['Linearization (release) URI']),
              release: this.getIcd11Release(r['Linearization (release) URI']),
            })),
          );
          dialogRef.close();
        }),
      )
      .catch(() => dialogRef.close());
  }

  private loadTextFile(filePath: string, dialogRef: any): Promise<string> {
    return new Promise((resolve, reject) => {
      this.http
        .get(filePath, { responseType: 'text', reportProgress: true, observe: 'events' })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress && event.total) {
              dialogRef.componentInstance.progress = Math.round((100 * event.loaded) / event.total);
            } else if (event.type === HttpEventType.Response && typeof event.body === 'string') {
              resolve(event.body);
            }
          },
          error: reject,
        });
    });
  }

  private loadIcd11MapFile(filePath: string, dialogRef: any): Promise<void> {
    return this.loadTextFile(filePath, dialogRef).then((body) => {
      const parsedData = Papa.parse(body, { header: true }).data;
      this.icd11MapDataFormat = this.detectIcd11MapFormat(parsedData);
      this.icd11MapData = this.normalizeIcd11MapData(parsedData, this.icd11MapDataFormat);
      if (this.selectedReasonSct?.code) {
        setTimeout(() => this.matchIcd11(this.selectedReasonSct), 100);
      }
    });
  }

  reloadIcd11MapData(format: 'preview' | 'extended') {
    const dialogRef = this.dialog.open(IcdLoadingDialogComponent, { disableClose: true });
    const fileName =
      format === 'extended' ? this.RES.icd11Extended : this.RES.icd11Preview;
    this.selectedReasonCIE11 = [];
    this.icd11rules = [];
    this.loadIcd11MapFile(fileName, dialogRef)
      .then(() => dialogRef.close())
      .catch(() => dialogRef.close());
  }

  private detectIcd11MapFormat(data: any[]): 'preview' | 'extended' {
    if (!data.length) return 'preview';
    const columns = Object.keys(data[0]);
    return columns.includes('id') && columns.includes('effectiveTime') && columns.includes('active')
      ? 'extended'
      : 'preview';
  }

  private normalizeIcd11MapData(data: any[], format: 'preview' | 'extended'): any[] {
    if (format === 'preview') {
      return data.map((item) => ({ ...item, mapRule: item.mapRule || 'TRUE', active: '1' }));
    }
    return data
      .filter((item) => item.active === '1')
      .map((item) => ({
        referencedComponentId: item.referencedComponentId,
        mapGroup: item.mapGroup,
        mapPriority: item.mapPriority,
        mapAdvice: item.mapAdvice,
        mapTarget: item.mapTarget,
        mapRule: item.mapRule || 'TRUE',
        active: item.active,
      }));
  }
}
