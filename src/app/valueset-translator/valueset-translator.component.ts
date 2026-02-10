import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TerminologyService } from '../services/terminology.service';
import { Subscription, combineLatest } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import * as pako from 'pako';

interface ColumnOption {
  header: string;
  index: number;
}

interface TerminologyContext {
  fhirUrlParam: string;
  language: string;
  editionName: string;
}

interface FHIRResource {
  resourceType: string;
  id: string;
  url: string;
  name: string;
  version?: string;
  status: string;
  content?: string;
  concept?: Array<{code: string, display: string}>;
  compose?: {
    include: Array<{
      system: string,
      concept: Array<{code: string, display: string}>
    }>
  };
  sourceUri?: string;
  targetUri?: string;
  sourceCanonical?: string;
  targetCanonical?: string;
  group?: Array<{
    source: string;
    target: string;
    element: Array<{
      code: string;
      display: string;
      target: Array<{
        code: string;
        display: string;
        equivalence: string;
      }>;
    }>;
  }>;
}

interface FHIRPackage {
  manifest: {
    name: string;
    version: string;
    description?: string;
    fhirVersion: string;
    dependencies?: Record<string, string>;
    author?: string;
    url?: string;
    resources: Array<{type: string, reference: string}>;
  };
  index: {
    'index-version': number;
    files: Array<{
      filename: string;
      resourceType: string;
      id: string;
      kind?: string;
      version?: string;
      url: string;
    }>;
  };
  resources: {
    codeSystem: FHIRResource;
    valueSet: FHIRResource;
    snomedValueSet: FHIRResource;
    conceptMap: FHIRResource;
  };
}

interface ConceptRow {
  code: string;
  display?: string;
  system?: string;
}

@Component({
  selector: 'app-valueset-translator',
  templateUrl: './valueset-translator.component.html',
  styleUrl: './valueset-translator.component.scss',
  standalone: false
})
export class ValuesetTranslatorComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  private readonly scrollHandler = () => this.onScroll();
  
  file: File | null = null;
  columns: ColumnOption[] = [];
  displayedColumns: string[] = [];
  importForm: FormGroup;
  previewData: any[] = [];
  originalData: any[] = [];
  selectedCodeColumn: number | null = null;
  selectedDisplayColumn: number | null = null;
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;
  showPreview = false;
  sourceValueSet: any = null;
  targetValueSet: any = null;
  isValueSetFile = false;
  showEclInput = false;
  eclExpression = '';
  terminologyContext: TerminologyContext = {
    fhirUrlParam: '',
    language: '',
    editionName: ''
  };
  private subscriptions = new Subscription();
  selectedFile: File | null = null;
  isMap = false;
  showIndicators = true;
  sourceSystemUri = '';
  valueSetUri = '';
  valueSetName = '';
  valueSetVersion = '1.0.0';
  mapBetweenValueSets = false;
  targetPreviewData: Array<{code: string, originalDisplay: string, translatedDisplay: string}> = [];
  targetPreviewColumns = ['code', 'originalDisplay', 'translatedDisplay'];
  previewVisibleCount = 5;
  previewIncrement = 25;
  targetPreviewVisibleCount = 10;
  targetPreviewIncrement = 25;
  selectedAction: string | null = null;
  codeDisplayExported = false;
  codeDisplayExportedCount = 0;
  translationEnabled = true;
  isRf2Refset = false;
  isEclResult = false;
  fullEclConcepts: ConceptRow[] = [];
  public editionsDetails: any[] = [];
  public languages: string[] = [];
  public contexts: any[] = [];
  public selectedContext: any = null;
  public selectedLanguageDisplayLabel: string = 'Language';
  public selectedLanRefsetConcept: any = null;
  public languageRefsets: any[] = [];
  public isFileLoading = false;
  public isTranslationLoading = false;
  totalCount: number = 0;
  generatedPackage: FHIRPackage | null = null;


  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar
  ) {
    this.importForm = this.fb.group({
      codeColumn: ['', Validators.required],
      displayColumn: [''],
      skipHeader: [true]
    });
  }

  ngOnInit() {
    // Subscribe to all relevant parameters
    this.subscriptions.add(
      combineLatest([
        this.terminologyService.fhirUrlParam$,
        this.terminologyService.lang$,
        this.terminologyService.languageRefsetConcept$,
        this.terminologyService.context$,
        this.terminologyService.editionName$
      ]).subscribe(([fhirUrlParam, lang, languageRefsetConcept, context, editionName]) => {
        this.terminologyContext = {
          fhirUrlParam,
          language: this.terminologyService.getComputedLanguageContext(),
          editionName
        };
        this.selectedContext = context;
        this.selectedLanRefsetConcept = languageRefsetConcept;
        this.updateSelectedLanguageLabel();
      })
    );

    // Subscribe to editionsDetails and languages from the service
    this.subscriptions.add(
      this.terminologyService.editionsDetails$.subscribe(editions => {
        this.editionsDetails = editions;
      })
    );
    this.subscriptions.add(
      this.terminologyService.languages$.subscribe(langs => {
        this.languages = langs;
      })
    );
    this.subscriptions.add(
      this.terminologyService.contexts$.subscribe(contexts => {
        this.contexts = contexts;
      })
    );
    if ((this.terminologyService as any).languageRefsets) {
      this.languageRefsets = (this.terminologyService as any).languageRefsets;
    }

    // Register a stable scroll handler so it can be removed correctly on destroy.
    window.addEventListener('scroll', this.scrollHandler);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    window.removeEventListener('scroll', this.scrollHandler);
  }

  private onScroll(): void {
    // Hide indicators if scrolled more than 50px
    this.showIndicators = window.scrollY < 50;
  }

  onFileSelected(event: any) {
    // Reset state but preserve the file input value
    this.resetStateForNewFile();
    this.file = event.target.files[0];
    this.selectedFile = event.target.files[0];
    if (this.file) {
      // Hide ECL input if it was shown
      this.showEclInput = false;
      this.eclExpression = '';
      this.readFile();
    }
  }

  // NEW implementation – no FileReader / no "binary" strings
  private async readFile(): Promise<void> {
    /* ---------- reset UI state ---------- */
    this.isFileLoading  = true;
    this.error           = null;
    this.successMessage  = null;
    this.showPreview     = false;
    this.sourceValueSet  = null;
    this.targetValueSet  = null;
    this.isValueSetFile  = false;
    this.originalData    = [];
    this.isMap = false;
    this.isRf2Refset = false;

    try {
      if (!this.file) { return; }

      const name = this.file.name.toLowerCase();

      /* ---------- JSON (FHIR ValueSet) ---------- */
      if (name.endsWith('.json')) {
        const jsonText    = await this.file.text();
        const jsonContent = JSON.parse(jsonText);
        if (this.isFhirValueSet(jsonContent)) {
          this.handleValueSetFile(jsonContent);    // builds preview internally
          return;                                  // done
        }
      }

      /* ---------- TSV or TXT (potential TSV) ---------- */
      if (name.endsWith('.tsv') || name.endsWith('.txt')) {
        const text = await this.file.text();
        // Check if the file contains tab characters to determine if it's a TSV
        const isTsv = text.includes('\t');
        if (isTsv) {
          // Split by newlines and then by tabs, preserving empty values
          this.previewData = text.split(/\r?\n/)
            .filter(line => line.trim()) // Remove empty lines
            .map(r => r.split('\t').map(cell => cell.trim()));
          this.originalData = [...this.previewData];

          // Build columns from the first row (header)
          if (this.previewData.length > 0) {
            this.columns = this.previewData[0].map(
              (h: string, i: number) => ({ header: h || `Column ${i + 1}`, index: i })
            );
            this.displayedColumns = this.columns.map((_, i) => `${i}`);
            this.showPreview = true;

            // keep current "skip header" checkbox state
            const keepSkip = this.importForm.get('skipHeader')!.value;
            this.importForm.reset({ skipHeader: keepSkip });

            // Check for file types based on headers
            this.detectFileTypeFromHeaders();
          }
        } else {
          // If it's a txt file without tabs, treat it as a simple text file
          // Each line becomes a row with a single column
          this.previewData = text.split(/\r?\n/)
            .filter(line => line.trim()) // Remove empty lines
            .map(r => [r.trim()]);
          this.originalData = [...this.previewData];

          if (this.previewData.length) {
            this.columns = [{ header: 'Value', index: 0 }];
            this.displayedColumns = ['0'];
            this.showPreview = true;

            // keep current "skip header" checkbox state
            const keepSkip = this.importForm.get('skipHeader')!.value;
            this.importForm.reset({ skipHeader: keepSkip });
          }
        }
      }

      /* ---------- CSV ---------- */
      else if (name.endsWith('.csv')) {
        const text      = await this.file.text();
        const wb        = XLSX.read(text, { type: 'string' });
        const ws        = wb.Sheets[wb.SheetNames[0]];
        this.previewData  = XLSX.utils.sheet_to_json(ws, { header: 1 });
        this.originalData = [...this.previewData];

        /* ---------- build table preview ---------- */
        if (this.previewData.length) {
          this.columns = this.previewData[0].map(
            (h: string, i: number) => ({ header: h || `Column ${i + 1}`, index: i })
          );
          this.displayedColumns = this.columns.map((_, i) => `${i}`);
          this.showPreview      = true;

          // Check for file types based on headers
          this.detectFileTypeFromHeaders();

          // keep current "skip header" checkbox state
          const keepSkip = this.importForm.get('skipHeader')!.value;
          this.importForm.reset({ skipHeader: keepSkip });
        }
      }

      /* ---------- XLSX / XLSM / XLSB / XLS ---------- */
      else {
        const buf = await this.file.arrayBuffer();              // raw bytes
        const view = new Uint8Array(buf);

        /* hard-fail if it is not a ZIP file */
        if (!(view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04)) {
          throw new Error('Not a valid XLSX (ZIP) file - wrong signature');
        }
        /* hard-fail if the buffer is truncated */
        if (buf.byteLength !== this.file.size) {
          throw new Error(`ArrayBuffer truncated (${buf.byteLength} ≠ ${this.file.size})`);
        }

        const wb = XLSX.read(buf);            // should be safe now
        const ws = wb.Sheets[wb.SheetNames[0]];
        this.previewData  = XLSX.utils.sheet_to_json(ws, { header: 1 });
        this.originalData = [...this.previewData];

        /* ---------- build table preview ---------- */
        if (this.previewData.length) {
          this.columns = this.previewData[0].map(
            (h: string, i: number) => ({ header: h || `Column ${i + 1}`, index: i })
          );
          this.displayedColumns = this.columns.map((_, i) => `${i}`);
          this.showPreview      = true;

          // Check for file types based on headers
          this.detectFileTypeFromHeaders();

          // keep current "skip header" checkbox state
          const keepSkip = this.importForm.get('skipHeader')!.value;
          this.importForm.reset({ skipHeader: keepSkip });
        }
      }
    } catch (err: any) {
      this.error = `Error reading file: ${err.message || err}`;
    } finally {
      this.isFileLoading = false;
    }
  }

  private detectFileTypeFromHeaders(): void {
    if (!this.previewData.length) return;

    const headers = this.previewData[0].map((h: string) => h.toLowerCase());
    
    // Check if it's a map by looking for source/target columns
    this.isMap = headers.some((h: string) => h.includes('source')) && 
                headers.some((h: string) => h.includes('target'));
    
    // Check if it's an RF2 refset by looking for specific headers
    const rf2Headers = ['id', 'effectivetime', 'active', 'moduleid', 'refsetid', 'referencedcomponentid'];
    this.isRf2Refset = rf2Headers.every((header: string) => 
      headers.some((h: string) => h === header)
    );
    
    if (this.isMap) {
      // Find the target code and display columns
      const targetCodeCol = headers.findIndex((h: string) => h.includes('target code'));
      const targetDisplayCol = headers.findIndex((h: string) => h.includes('target display'));
      
      
      // Always set form values for maps, even if target display column is not found
      const formValues = {
        codeColumn: targetCodeCol !== -1 ? targetCodeCol : 0, // Default to first column if not found
        displayColumn: targetDisplayCol !== -1 ? targetDisplayCol : ''
      };
      this.importForm.patchValue(formValues);
      
      // Mark the form as valid for maps since we auto-configure columns
      this.importForm.markAsTouched();
      this.importForm.updateValueAndValidity();
      
    }
    
    if (this.isRf2Refset) {
      // Pre-select the referencedComponentId column for RF2 refsets
      const refsetCodeCol = headers.findIndex((h: string) => h === 'referencedcomponentid');
      if (refsetCodeCol !== -1) {
        this.importForm.patchValue({
          codeColumn: refsetCodeCol,
          displayColumn: '' // RF2 refsets typically don't have display columns
        });
      }
    }
    
    // For simple spreadsheets, guess the code and display columns
    if (!this.isMap && !this.isRf2Refset && !this.isValueSetFile) {
      setTimeout(() => this.guessColumns(), 0); // Ensure patchValue happens after form reset
    }
  }

  private guessColumns(): void {
    if (this.previewData.length < 2) return; // Need at least header and one data row
    
    const dataRow = this.previewData[1]; // Use row 2 (index 1) for testing
    let codeColumn = -1;
    let displayColumn = -1;
    
    // Find the first column that contains only numbers (potential code column)
    for (let i = 0; i < dataRow.length; i++) {
      const cellValue = String(dataRow[i] || '').trim();
      if (cellValue && /^\d+$/.test(cellValue)) {
        codeColumn = i;
        break;
      }
    }
    
    // Find the first column that contains alphanumeric text (potential display column)
    for (let i = 0; i < dataRow.length; i++) {
      const cellValue = String(dataRow[i] || '').trim();
      const isAlphanumeric = /^[a-zA-Z0-9\s\-_\.\(\)]+$/i.test(cellValue);
      const isNotNumeric = !/^\d+$/.test(cellValue);
      if (cellValue && isAlphanumeric && isNotNumeric) {
        displayColumn = i;
        break;
      }
    }
    
    // Pre-select the guessed columns in the form
    if (codeColumn !== -1) {
      this.importForm.patchValue({
        codeColumn: codeColumn,
        displayColumn: displayColumn !== -1 ? displayColumn : null
      });
    } else {
      // Fallback: try to guess based on header names
      this.guessColumnsFromHeaders();
    }
  }

  private guessColumnsFromHeaders(): void {
    if (!this.previewData.length) return;
    
    const headers = this.previewData[0].map((h: string) => h.toLowerCase());
    
    let codeColumn = -1;
    let displayColumn = -1;
    
    // Look for common code column headers
    const codeHeaders = ['code', 'snomed code', 'id', 'concept id', 'snomed concept'];
    for (let i = 0; i < headers.length; i++) {
      if (codeHeaders.some(header => headers[i].includes(header))) {
        codeColumn = i;
        break;
      }
    }
    
    // Look for common display column headers
    const displayHeaders = ['term', 'display', 'name', 'description', 'snomed term', 'concept name'];
    for (let i = 0; i < headers.length; i++) {
      if (displayHeaders.some(header => headers[i].includes(header))) {
        displayColumn = i;
        break;
      }
    }
    
    // Pre-select the guessed columns in the form
    if (codeColumn !== -1) {
      this.importForm.patchValue({
        codeColumn: codeColumn,
        displayColumn: displayColumn !== -1 ? displayColumn : null
      });
    }
  }



  private isFhirValueSet(json: any): boolean {
    return json.resourceType === 'ValueSet' || 
           (json.resourceType === 'Parameters' && json.parameter?.some((p: any) => p.name === 'valueSet'));
  }

  private handleValueSetFile(json: any) {
    // Extract ValueSet from Parameters if needed
    if (json.resourceType === 'Parameters') {
      const valueSetParam = json.parameter?.find((p: any) => p.name === 'valueSet');
      if (valueSetParam?.resource) {
        json = valueSetParam.resource;
      }
    }

    // Always set sourceValueSet for JSON files
    this.sourceValueSet = {
      resourceType: 'Parameters',
      parameter: [{
        name: 'valueSet',
        resource: json
      }]
    };

    this.sourceValueSet = this.sourceValueSet;

    // Pre-fill ValueSet metadata fields from the source FHIR ValueSet
    if (json.url) {
      this.valueSetUri = this.normalizeBaseUrl(json.url);
    }
    if (json.name) {
      this.valueSetName = json.name;
    }
    if (json.version) {
      this.valueSetVersion = json.version;
    }

    this.previewData = [
      ['Code', 'Display', 'System'], // Headers
      ...(json.compose?.include?.[0]?.concept || []).map((concept: any) => [
        concept.code || '',
        concept.display || '',
        json.compose?.include?.[0]?.system || ''
      ])
    ];

    this.columns = ['Code', 'Display', 'System'].map((header, index) => ({
      header,
      index
    }));
    this.displayedColumns = this.columns.map((_, index) => `${index}`);
    this.showPreview = true;
    this.isValueSetFile = true;
    this.isLoading = false;
  }

  downloadSourceValueSet() {
    if (!this.sourceValueSet) return;
    this.downloadValueSet(this.sourceValueSet, 'source-valueset.json');
  }

  downloadTargetValueSet() {
    if (!this.targetValueSet) return;
    this.downloadValueSet(this.targetValueSet, 'target-valueset.json');
  }

  downloadTargetAsExcel() {
    if (!this.targetValueSet) return;

    // Extract concepts from the expanded ValueSet
    const concepts = this.targetValueSet.expansion?.contains || [];
    
    // Transform concepts into rows with headers
    const data = [
      ['Code', 'Display', 'System', 'Version'], // Headers
      ...concepts.map((concept: any) => [
        concept.code || '',
        concept.display || '',
        concept.system || '',
        concept.version || ''
      ])
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Code
      { wch: 40 }, // Display
      { wch: 30 }, // System
      { wch: 15 }  // Version
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'ValueSet');

    // Generate and download file
    XLSX.writeFile(wb, 'target-valueset.xlsx');
  }

  async downloadCodeDisplayAsExcel(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const concepts = await this.getCodesForPreview();
      if (!concepts.length) {
        this.snackBar.open('No concepts available to export', 'OK', { duration: 3000 });
        return;
      }

      const data = [
        ['code', 'display'],
        ...concepts.map(concept => [
          concept.code || '',
          concept.display || ''
        ])
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 24 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws, 'CodeDisplay');
      XLSX.writeFile(wb, 'code-display-list.xlsx');
      this.codeDisplayExported = true;
      this.codeDisplayExportedCount = concepts.length;
      this.successMessage = `Exported ${concepts.length} concepts to code-display-list.xlsx`;
    } catch (error: any) {
      this.error = `Error exporting code/display table: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  private downloadValueSet(valueSet: any, filename: string) {
    const valueSetString = JSON.stringify(valueSet, null, 2);
    const blob = new Blob([valueSetString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  toggleEclInput() {
    this.resetState();
    this.showEclInput = !this.showEclInput;
    // Reset file-related state when switching to ECL input
    if (this.showEclInput) {
      this.file = null;
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
    }
    // Reset ECL-related state when switching away from ECL
    if (!this.showEclInput) {
      this.eclExpression = '';
    }
  }

  private resetState(): void {
    // Reset file-related state
    this.file = null;
    this.selectedFile = null;
    this.showPreview = false;
    this.previewData = [];
    this.originalData = [];
    this.columns = [];
    this.displayedColumns = [];
    this.selectedCodeColumn = null;
    this.selectedDisplayColumn = null;
    
    // Reset form state
    if (this.importForm) {
      const currentSkipHeader = this.importForm.get('skipHeader')?.value;
      this.importForm.reset({ skipHeader: currentSkipHeader });
    }
    
    // Reset ValueSet state
    this.sourceValueSet = null;
    this.targetValueSet = null;
    this.isValueSetFile = false;
    this.isMap = false;
    this.isRf2Refset = false;
    
    // Reset action state
    this.selectedAction = null;
    this.codeDisplayExported = false;
    this.codeDisplayExportedCount = 0;
    this.targetPreviewData = [];
    this.targetPreviewVisibleCount = 10;
    this.previewVisibleCount = 5;
    
    // Reset UI state
    this.error = null;
    this.successMessage = null;
    this.isLoading = false;
    this.isTranslationLoading = false;
    
    // Reset ECL state
    this.eclExpression = '';
    this.isEclResult = false;
    this.fullEclConcepts = [];
    this.totalCount = 0;
    
    // Reset file input
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private resetStateForNewFile(): void {
    // Reset all state except file input value (which we need to preserve for file selection)
    this.showPreview = false;
    this.previewData = [];
    this.originalData = [];
    this.columns = [];
    this.displayedColumns = [];
    this.selectedCodeColumn = null;
    this.selectedDisplayColumn = null;
    
    // Reset form state
    if (this.importForm) {
      const currentSkipHeader = this.importForm.get('skipHeader')?.value;
      this.importForm.reset({ skipHeader: currentSkipHeader });
    }
    
    // Reset ValueSet state
    this.sourceValueSet = null;
    this.targetValueSet = null;
    this.isValueSetFile = false;
    this.isMap = false;
    this.isRf2Refset = false;
    
    // Reset action state
    this.selectedAction = null;
    this.codeDisplayExported = false;
    this.codeDisplayExportedCount = 0;
    this.targetPreviewData = [];
    this.targetPreviewVisibleCount = 10;
    this.previewVisibleCount = 5;
    
    // Reset UI state
    this.error = null;
    this.successMessage = null;
    this.isLoading = false;
    this.isTranslationLoading = false;
    
    // Reset ECL state
    this.eclExpression = '';
    this.isEclResult = false;
    this.fullEclConcepts = [];
    this.totalCount = 0;
    
    // Note: We don't reset file input value here as we need it for file selection
  }

  expandEcl() {
    if (!this.eclExpression.trim()) {
      this.error = 'Please enter an ECL expression';
      return;
    }

    // Clear preview table and reset state
    this.isLoading = true;
    this.error = null;
    this.successMessage = null;
    this.isEclResult = true;
    this.previewData = [];
    this.fullEclConcepts = [];
    this.previewVisibleCount = 5;
    this.showPreview = false;
    this.targetValueSet = null;

    this.terminologyService.expandValueSet(this.eclExpression, '', 0, 1000).subscribe(
      (expandedValueSet) => {
        const total = expandedValueSet?.expansion?.total || 0;
        const matchCount = expandedValueSet?.expansion?.contains?.length || 0;

        if (total > 1000) {
          this.error = `Found ${total} matching concepts. This tool currently supports a maximum of 1000 concepts. Please refine your ECL expression to return fewer results.`;
          this.isLoading = false;
          return;
        }

        if (matchCount > 0) {
          this.targetValueSet = expandedValueSet;
          this.fullEclConcepts = (expandedValueSet.expansion.contains || []).map((c: any) => ({
            code: c.code || '',
            display: c.display || '',
            system: c.system || ''
          }));

          // Keep the full ECL result as source data for all downstream actions.
          const eclCodes = this.fullEclConcepts.map(c => ({
            code: c.code,
            display: c.display || ''
          }));
          this.sourceValueSet = {
            resourceType: 'Parameters',
            parameter: [{
              name: 'valueSet',
              resource: this.buildValueSetResource(eclCodes)
            }]
          };

          // Build full preview data and render incrementally via "Load more".
          this.previewData = [
            ['Code', 'Display', 'System'],
            ...this.fullEclConcepts.map(c => [c.code, c.display || '', c.system || ''])
          ];
          
          // Set up columns for the preview table
          this.columns = [
            { header: 'Code', index: 0 },
            { header: 'Display', index: 1 },
            { header: 'System', index: 2 }
          ];
          this.displayedColumns = ['0', '1', '2'];
          
          // Auto-set the form values for code and display columns
          this.importForm.patchValue({
            codeColumn: 0,
            displayColumn: 1,
            skipHeader: true
          });
          
          this.showPreview = true;
          this.totalCount = total;
          this.isLoading = false;
          this.successMessage = `Successfully expanded ECL expression. Found ${matchCount} matching concepts.`;
        } else {
          this.error = 'No concepts found for the given ECL expression';
          this.isLoading = false;
        }
      },
      (error) => {
        this.error = 'Error expanding ECL: ' + error.message;
        this.isLoading = false;
      }
    );
  }

  downloadTranslatedFile() {
    if (this.isMap) {
      this.downloadMapFile();
      return;
    }

    if (!this.originalData.length || !this.targetValueSet?.expansion?.contains || 
        this.selectedCodeColumn === null || this.selectedDisplayColumn === null) {
      return;
    }

    // Create a map of codes to translated display values from the target expansion
    const translationMap = new Map<string, string>();
    if (this.targetValueSet?.expansion?.contains) {
      this.targetValueSet.expansion.contains.forEach((concept: any) => {
        if (concept.code && concept.display) {
          translationMap.set(concept.code.trim(), concept.display);
        }
      });
    }

    // Create a copy of the original data and update the display column
    const translatedData = this.originalData.map((row: any[], index: number) => {
      if (index === 0) {
        return [...row]; // Keep header row unchanged
      }
      
      const newRow = [...row];
      const code = String(row[this.selectedCodeColumn!] || '').trim();
      
      if (code && translationMap.has(code)) {
        newRow[this.selectedDisplayColumn!] = translationMap.get(code);
      }
      return newRow;
    });

    this.downloadExcelFile(translatedData, 'translated');
  }

  private async downloadMapFile() {
    if (!this.selectedFile) return;

    try {
      const data = await this.readExcelFile(this.selectedFile);
      const headers = Object.keys(data[0]);
      
      // Find source and target columns
      const sourceCodeCol = headers.find(h => h.toLowerCase().includes('source code'))!;
      const sourceDisplayCol = headers.find(h => h.toLowerCase().includes('source display'))!;
      const targetCodeCol = headers.find(h => h.toLowerCase().includes('target code'))!;
      const targetDisplayCol = headers.find(h => h.toLowerCase().includes('target display'))!;

      // Create a ValueSet from the target codes, filtering out undefined codes
      const targetCodes = data
        .map(row => {
          const code = String(row[targetCodeCol] || '').trim();
          const display = String(row[targetDisplayCol] || '').trim();
          return { code, display };
        })
        .filter(item => {
          // Filter out empty, undefined, or invalid codes
          return item.code && 
                 item.code !== 'undefined' && 
                 item.code !== 'null' && 
                 item.code !== '' && 
                 item.display && 
                 item.display !== 'undefined' && 
                 item.display !== 'null' && 
                 item.display !== '';
        });

      if (targetCodes.length === 0) {
        this.snackBar.open('No valid target codes found in the file', 'OK', { duration: 3000 });
        return;
      }

      // Create source ValueSet and expand it
      const sourceValueSet = this.terminologyService.getValueSetFromCodes(targetCodes);
      
      // Show loading state
      this.isLoading = true;
      
      // Expand the ValueSet to get translations
      const expandedValueSet = await this.terminologyService.expandInlineValueSet(sourceValueSet).toPromise();
      
      // Create a map of codes to translated display values
      const translationMap = new Map<string, string>();
      if (expandedValueSet?.expansion?.contains) {
        expandedValueSet.expansion.contains.forEach((concept: any) => {
          if (concept.code && 
              concept.code !== 'undefined' && 
              concept.code !== 'null' && 
              concept.display && 
              concept.display !== 'undefined' && 
              concept.display !== 'null') {
            translationMap.set(concept.code.trim(), concept.display);
          }
        });
      }

      // Create a copy of the data with translated target displays
      const translatedData = data.map(row => {
        const newRow = { ...row };
        const code = String(row[targetCodeCol] || '').trim();
        if (code && 
            code !== 'undefined' && 
            code !== 'null' && 
            code !== '' && 
            translationMap.has(code)) {
          newRow[targetDisplayCol] = translationMap.get(code);
        }
        return newRow;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        // Headers
        headers,
        // Data
        ...translatedData.map(row => headers.map(header => row[header]))
      ]);

      // Set column widths based on content
      const maxLengths = headers.map((_, colIndex) => 
        Math.max(
          headers[colIndex].length,
          ...translatedData.map(row => String(row[headers[colIndex]] || '').length)
        )
      );
      
      ws['!cols'] = maxLengths.map(length => ({
        wch: Math.min(Math.max(length, 10), 50) // Min width 10, max width 50
      }));

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Map');

      // Generate filename based on original file
      const originalExt = this.selectedFile.name.split('.').pop() || 'xlsx';
      const filename = this.selectedFile.name.replace(
        `.${originalExt}`, 
        `_translated_map.xlsx`
      );

      // Generate and download file
      XLSX.writeFile(wb, filename);
      
      // Hide loading state
      this.isLoading = false;
      this.snackBar.open('Map file downloaded with translations', 'OK', { duration: 3000 });
    } catch (error) {
      this.snackBar.open('Error downloading map file', 'OK', { duration: 3000 });
      this.isLoading = false;
    }
  }

  private downloadExcelFile(data: any[], suffix: string) {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths based on content
    const maxLengths = data[0].map((_: any, colIndex: number) => 
      Math.max(...data.map(row => 
        String(row[colIndex] || '').length
      ))
    );
    
    ws['!cols'] = maxLengths.map((length: number) => ({
      wch: Math.min(Math.max(length, 10), 50) // Min width 10, max width 50
    }));

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate filename based on original file
    const originalExt = this.file?.name.split('.').pop() || 'xlsx';
    const filename = this.file?.name.replace(
      `.${originalExt}`, 
      `_${suffix}.xlsx`
    ) || `${suffix}_file.xlsx`;

    // Generate and download file
    XLSX.writeFile(wb, filename);
  }

  async generateFHIRPackage(): Promise<void> {
    const data = await this.readExcelFile(this.selectedFile!);
    const { source, snomed } = this.extractConcepts(data);
    
    this.generatedPackage = this.createFHIRPackage(source, snomed);
    const tarBlob = await this.createTarGz(this.generatedPackage);
    
    saveAs(tarBlob, `${this.valueSetName}.tgz`);
    this.snackBar.open('FHIR package generated successfully!', 'OK', { duration: 3000 });
  }

  private extractConcepts(data: any[]): { source: Array<{code: string, display: string}>, snomed: Array<{code: string, display: string}> } {
    const sourceCodeCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('source code'))!;
    const sourceDisplayCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('source display'))!;
    const targetCodeCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('target code'))!;
    const targetDisplayCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('target display'))!;
    
    // Create paired arrays to ensure they stay in sync
    const pairedConcepts = data.map(row => ({
      source: {
        code: String(row[sourceCodeCol] || '').trim(),
        display: String(row[sourceDisplayCol] || '').trim()
      },
      snomed: {
        code: String(row[targetCodeCol] || '').trim(),
        display: String(row[targetDisplayCol] || '').trim()
      }
    })).filter(pair => 
      // Only keep pairs where both source and SNOMED concepts are valid
      pair.source.code && 
      pair.source.code !== 'undefined' && 
      pair.source.code !== 'null' && 
      pair.source.code !== '' &&
      pair.source.display && 
      pair.source.display !== 'undefined' && 
      pair.source.display !== 'null' && 
      pair.source.display !== '' &&
      pair.snomed.code && 
      pair.snomed.code !== 'undefined' && 
      pair.snomed.code !== 'null' && 
      pair.snomed.code !== '' &&
      pair.snomed.display && 
      pair.snomed.display !== 'undefined' && 
      pair.snomed.display !== 'null' && 
      pair.snomed.display !== ''
    );

    // Split the paired concepts into separate arrays
    return {
      source: pairedConcepts.map(pair => pair.source),
      snomed: pairedConcepts.map(pair => pair.snomed)
    };
  }

  private createFHIRPackage(concepts: Array<{code: string, display: string}>, snomedConcepts: Array<{code: string, display: string}>): FHIRPackage {
    // Validate input arrays
    if (!concepts || !snomedConcepts || concepts.length === 0 || snomedConcepts.length === 0) {
      throw new Error('Invalid input: concepts arrays cannot be empty or undefined');
    }

    // Ensure arrays are of equal length
    if (concepts.length !== snomedConcepts.length) {
      throw new Error('Invalid input: source and SNOMED concept arrays must have the same length');
    }

    // Filter out any invalid concepts
    const validConcepts = concepts.filter(c => c && c.code && c.display);
    const validSnomedConcepts = snomedConcepts.filter(c => c && c.code && c.display);

    if (validConcepts.length === 0 || validSnomedConcepts.length === 0) {
      throw new Error('No valid concepts found after filtering');
    }

    // Use sourceSystemUri for CodeSystem, valueSetUri for ValueSets
    const baseUri = this.normalizeBaseUrl(this.valueSetUri);
    const codeSystemUrl = this.sourceSystemUri;
    const valueSetUrl = `${baseUri}/ValueSet/${this.valueSetName}`;
    const snomedValueSetUrl = `${baseUri}/ValueSet/${this.valueSetName}-snomed`;
    const conceptMapUrl = `${baseUri}/ConceptMap/${this.valueSetName}-to-snomed`;

    const codeSystem: FHIRResource = {
      resourceType: 'CodeSystem',
      id: uuidv4(),
      url: codeSystemUrl,
      name: `${this.valueSetName}CodeSystem`,
      version: this.valueSetVersion,
      status: 'active',
      content: 'complete',
      concept: validConcepts
    };

    const valueSet: FHIRResource = {
      resourceType: 'ValueSet',
      id: uuidv4(),
      url: valueSetUrl,
      name: `${this.valueSetName}ValueSet`,
      version: this.valueSetVersion,
      status: 'active',
      compose: {
        include: [{
          system: codeSystemUrl,
          concept: validConcepts
        }]
      }
    };

    const snomedValueSet: FHIRResource = {
      resourceType: 'ValueSet',
      id: uuidv4(),
      url: snomedValueSetUrl,
      name: `${this.valueSetName}SnomedValueSet`,
      version: this.valueSetVersion,
      status: 'active',
      compose: {
        include: [{
          system: 'http://snomed.info/sct',
          concept: validSnomedConcepts
        }]
      }
    };

    // Determine source and target URIs based on mapping mode
    const sourceUri = this.mapBetweenValueSets ? valueSetUrl : codeSystemUrl;
    const targetUri = this.mapBetweenValueSets ? snomedValueSetUrl : 'http://snomed.info/sct';

    const conceptMap: FHIRResource = {
      resourceType: 'ConceptMap',
      id: uuidv4(),
      url: conceptMapUrl,
      name: `${this.valueSetName}ToSnomedMap`,
      version: this.valueSetVersion,
      status: 'active',
      ...(this.mapBetweenValueSets
        ? { sourceCanonical: sourceUri, targetCanonical: targetUri }
        : { sourceUri: sourceUri, targetUri: targetUri }),
      group: [{
        source: sourceUri,
        target: targetUri,
        element: validConcepts.map((concept, index) => {
          const snomedConcept = validSnomedConcepts[index];
          if (!snomedConcept) {
            throw new Error(`No matching SNOMED concept found for source concept ${concept.code}`);
          }
          return {
            code: concept.code,
            display: concept.display,
            target: [{
              code: snomedConcept.code,
              display: snomedConcept.display,
              equivalence: 'equivalent'
            }]
          };
        })
      }]
    };

    return {
      manifest: {
        name: `${this.valueSetName}.codesystem.package`,
        version: this.valueSetVersion,
        description: `${this.valueSetName} FHIR package`,
        fhirVersion: '4.0.1',
        dependencies: {},
        author: 'SCT Implementation Demonstrator',
        url: baseUri,
        resources: [
          { type: 'CodeSystem', reference: `CodeSystem/${codeSystem.name}` },
          { type: 'ValueSet', reference: `ValueSet/${valueSet.name}` },
          { type: 'ValueSet', reference: `ValueSet/${snomedValueSet.name}` },
          { type: 'ConceptMap', reference: `ConceptMap/${conceptMap.name}` }
        ]
      },
      index: {
        'index-version': 1,
        files: [
          { filename: `CodeSystem/${codeSystem.name}.json`, resourceType: 'CodeSystem', id: codeSystem.id, url: codeSystem.url, kind: 'codesystem', version: codeSystem.version },
          { filename: `ValueSet/${valueSet.name}.json`, resourceType: 'ValueSet', id: valueSet.id, url: valueSet.url, kind: 'valueset', version: valueSet.version },
          { filename: `ValueSet/${snomedValueSet.name}.json`, resourceType: 'ValueSet', id: snomedValueSet.id, url: snomedValueSet.url, kind: 'valueset', version: snomedValueSet.version },
          { filename: `ConceptMap/${conceptMap.name}.json`, resourceType: 'ConceptMap', id: conceptMap.id, url: conceptMap.url, kind: 'conceptmap', version: conceptMap.version }
        ]
      },
      resources: { codeSystem, valueSet, snomedValueSet, conceptMap }
    };
  }

  private async createTarGz(packageData: FHIRPackage): Promise<Blob> {
    const textEncoder = new TextEncoder();

    const files: Array<{ name: string; data: Uint8Array }> = [
      {
        name: 'package/package.json',
        data: textEncoder.encode(JSON.stringify(packageData.manifest, null, 2))
      },
      {
        name: 'package/.index.json',
        data: textEncoder.encode(JSON.stringify(packageData.index, null, 2))
      },
      {
        name: `package/CodeSystem/${packageData.resources.codeSystem.name}.json`,
        data: textEncoder.encode(JSON.stringify(packageData.resources.codeSystem, null, 2))
      },
      {
        name: `package/ValueSet/${packageData.resources.valueSet.name}.json`,
        data: textEncoder.encode(JSON.stringify(packageData.resources.valueSet, null, 2))
      },
      {
        name: `package/ValueSet/${packageData.resources.snomedValueSet.name}.json`,
        data: textEncoder.encode(JSON.stringify(packageData.resources.snomedValueSet, null, 2))
      },
      {
        name: `package/ConceptMap/${packageData.resources.conceptMap.name}.json`,
        data: textEncoder.encode(JSON.stringify(packageData.resources.conceptMap, null, 2))
      }
    ];

    const tarData = this.buildTarArchive(files);
    
    // Compress with gzip using pako
    const gzipped = pako.gzip(tarData, { level: 9 });
    
    // Return as Blob with correct MIME type
    return new Blob([gzipped], { type: 'application/gzip' });
  }

  private normalizeBaseUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const withoutTrailingSlash = withScheme.replace(/\/+$/, '');
    const withoutResourceTail = withoutTrailingSlash.replace(
      /(\/(ValueSet|CodeSystem|ConceptMap)(\/.*)?)$/i,
      ''
    );
    return withoutResourceTail.replace(/\/+$/, '');
  }

  private buildTarArchive(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
    const blocks: Uint8Array[] = [];
    let totalLength = 0;
    const mtime = Math.floor(Date.now() / 1000);

    for (const file of files) {
      const header = this.createTarHeader(file.name, file.data.length, mtime);
      blocks.push(header);
      blocks.push(file.data);
      totalLength += header.length + file.data.length;

      const padding = (512 - (file.data.length % 512)) % 512;
      if (padding) {
        const pad = new Uint8Array(padding);
        blocks.push(pad);
        totalLength += padding;
      }
    }

    const end = new Uint8Array(1024);
    blocks.push(end);
    totalLength += end.length;

    const out = new Uint8Array(totalLength);
    let offset = 0;
    for (const block of blocks) {
      out.set(block, offset);
      offset += block.length;
    }

    return out;
  }

  private createTarHeader(name: string, size: number, mtime: number): Uint8Array {
    const header = new Uint8Array(512);
    this.writeString(header, 0, 100, name);
    this.writeOctal(header, 100, 8, 0o644);
    this.writeOctal(header, 108, 8, 0);
    this.writeOctal(header, 116, 8, 0);
    this.writeOctal(header, 124, 12, size);
    this.writeOctal(header, 136, 12, mtime);

    for (let i = 148; i < 156; i += 1) {
      header[i] = 0x20;
    }

    this.writeString(header, 156, 1, '0');
    this.writeString(header, 257, 6, 'ustar\0');
    this.writeString(header, 263, 2, '00');

    let checksum = 0;
    for (let i = 0; i < header.length; i += 1) {
      checksum += header[i];
    }

    this.writeChecksum(header, checksum);

    return header;
  }

  private writeString(buffer: Uint8Array, offset: number, length: number, value: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    buffer.set(bytes.slice(0, length), offset);
  }

  private writeOctal(buffer: Uint8Array, offset: number, length: number, value: number): void {
    const octal = value.toString(8).padStart(length - 1, '0');
    this.writeString(buffer, offset, length - 1, octal);
    buffer[offset + length - 1] = 0x00;
  }

  private writeChecksum(buffer: Uint8Array, checksum: number): void {
    const checksumString = checksum.toString(8).padStart(6, '0');
    this.writeString(buffer, 148, 6, checksumString);
    buffer[154] = 0x00;
    buffer[155] = 0x20;
  }

  private async readExcelFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  async generateTargetPreview(): Promise<void> {
    if (!this.previewData.length && !this.isValueSetFile && !this.isEclResult) {
      this.error = 'No preview data available.';
      return;
    }

    this.isTranslationLoading = true;
    this.error = null;

    try {
      // Use the same inline ValueSet builder used by map translation to keep behavior consistent.
      const codes = await this.getCodesForPreview();
      if (!codes.length) {
        this.error = 'No codes found to create preview.';
        this.isTranslationLoading = false;
        return;
      }
      const sourceValueSet = this.terminologyService.getValueSetFromCodes(codes);

      // Expand the ValueSet to get translations
      const expandedValueSet = await this.terminologyService.expandInlineValueSet(sourceValueSet).toPromise();
      this.targetValueSet = expandedValueSet;
      
      this.targetPreviewData = codes.map(codeItem => {
        const translatedConcept = expandedValueSet?.expansion?.contains?.find(
          (concept: any) => concept.code === codeItem.code
        );
        return {
          code: codeItem.code,
          originalDisplay: codeItem.display || 'N/A',
          translatedDisplay: translatedConcept?.display || 'Not found'
        };
      });
      this.targetPreviewVisibleCount = 10;

    } catch (error: any) {
      this.error = `Error generating preview: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isTranslationLoading = false;
    }
  }

  selectAction(action: string) {
    this.selectedAction = action;
    if (action !== 'code-display-excel') {
      this.codeDisplayExported = false;
      this.codeDisplayExportedCount = 0;
    }
    this.targetPreviewData = [];
    this.targetPreviewVisibleCount = 10;
    this.targetValueSet = null;
    // Don't clear sourceValueSet as it's needed for JSON ValueSet operations
    // this.sourceValueSet = null;

    // For ECL code/display export, run immediately from step 3 with no extra button click.
    if (action === 'code-display-excel') {
      this.executeAction();
    }
  }

  canExecuteAction(): boolean {
    if (!this.hasRequiredMetadataForAction()) {
      return false;
    }

    if (this.isValueSetFile) {
      // For JSON ValueSets, require that sourceValueSet exists
      const result = !!this.sourceValueSet;
      return result;
    }

    if (this.isEclResult) {
      // For ECL results, require the prepared source ValueSet from full expansion.
      return !!this.sourceValueSet;
    }
    
    if (this.isMap) {
      // For SnapSNOMED maps, only require that we have preview data
      // Form validation is not needed since columns are auto-configured
      const result = this.previewData.length > 0;
      return result;
    }
    
    if (this.isRf2Refset) {
      // For RF2 refsets, require that we have preview data and valid form
      const result = this.previewData.length > 0 && this.importForm.valid;
      return result;
    }
    
    // For simple spreadsheets, require code column selection
    if (this.importForm && this.importForm.get('codeColumn')) {
      const result = this.importForm.get('codeColumn')!.valid;
      return result;
    }
    
    return false;
  }

  private hasRequiredMetadataForAction(): boolean {
    if (!this.selectedAction) {
      return false;
    }

    // Translation-only preview does not require metadata.
    if (this.selectedAction === 'translate' || this.selectedAction === 'translate-target') {
      return true;
    }

    const hasValueSetUri = !!this.normalizeBaseUrl(this.valueSetUri);
    const hasValueSetName = !!(this.valueSetName || '').trim();
    const hasVersion = !!(this.valueSetVersion || '').trim();

    if (this.selectedAction === 'source-valueset' || this.selectedAction === 'target-valueset') {
      return hasValueSetUri && hasValueSetName && hasVersion;
    }

    if (this.selectedAction === 'fhir-package') {
      if (!this.isMap) return false;
      const hasSourceSystemUri = !!(this.sourceSystemUri || '').trim();
      return hasSourceSystemUri && hasValueSetUri && hasValueSetName && hasVersion;
    }

    return true;
  }

  getActionIcon(): string {
    switch (this.selectedAction) {
      case 'translate': return 'translate';
      case 'source-valueset': return 'code';
      case 'target-valueset': return 'expand_more';
      case 'translate-target': return 'swap_horiz';
      case 'fhir-package': return 'archive';
      case 'code-display-excel': return 'table_view';
      default: return 'play_arrow';
    }
  }

  getActionButtonText(): string {
    switch (this.selectedAction) {
      case 'translate': return 'Generate Translation Preview';
      case 'source-valueset': return 'Generate Source ValueSet';
      case 'target-valueset': return 'Generate Target ValueSet';
      case 'translate-target': return 'Translate Target Column';
      case 'fhir-package': return 'Generate FHIR Package';
      case 'code-display-excel': return 'Generate code/display Excel';
      default: return 'Execute Action';
    }
  }

  async executeAction(): Promise<void> {
    if (!this.selectedAction) return;

    switch (this.selectedAction) {
      case 'translate':
        await this.generateTargetPreview();
        break;
      case 'source-valueset':
        await this.generateSourceValueSet();
        break;
      case 'target-valueset':
        await this.generateTargetValueSet();
        break;
      case 'translate-target':
        await this.translateTargetColumn();
        break;
      case 'fhir-package':
        await this.generateFHIRPackage();
        break;
      case 'code-display-excel':
        await this.downloadCodeDisplayAsExcel();
        break;
    }
  }

  async generateSourceValueSet(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      if ((this.isValueSetFile || this.isEclResult) && this.sourceValueSet) {
        // For JSON and ECL flows, use the prepared source ValueSet.
        this.targetValueSet = this.sourceValueSet;
      } else {
        // For other file types, check previewData and extract codes
        if (!this.previewData.length) {
          this.error = 'No preview data available.';
          this.isLoading = false;
          return;
        }
        
        const codes = await this.extractCodesFromForm();
        
        this.sourceValueSet = {
          resourceType: 'Parameters',
          parameter: [{
            name: 'valueSet',
            resource: this.buildValueSetResource(codes)
          }]
        };

        this.targetValueSet = this.sourceValueSet;
      }
    } catch (error: any) {
      this.error = `Error generating source ValueSet: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  async generateTargetValueSet(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      // Use the same inline ValueSet builder used by map translation and preview.
      const codes = await this.getCodesForPreview();
      if (!codes.length) {
        this.error = 'No codes found to generate target ValueSet.';
        this.isLoading = false;
        return;
      }

      this.sourceValueSet = this.terminologyService.getValueSetFromCodes(codes);
      const expandedValueSet = await this.terminologyService.expandInlineValueSet(this.sourceValueSet).toPromise();
      this.targetValueSet = expandedValueSet;
    } catch (error: any) {
      this.error = `Error generating target ValueSet: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  async translateTargetColumn(): Promise<void> {
    if (!this.selectedFile) return;

    this.isLoading = true;
    this.error = null;

    try {
      const data = await this.readExcelFile(this.selectedFile);
      const { source, snomed } = this.extractConcepts(data);
      
      // Create source ValueSet and expand it
      const sourceValueSet = this.terminologyService.getValueSetFromCodes(snomed);
      const expandedValueSet = await this.terminologyService.expandInlineValueSet(sourceValueSet).toPromise();
      
      this.targetValueSet = expandedValueSet;
    } catch (error: any) {
      this.error = `Error translating target column: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  private async extractCodesFromForm(): Promise<Array<{code: string, display?: string}>> {
    const codeColumn = this.importForm.get('codeColumn')?.value;
    const displayColumn = this.importForm.get('displayColumn')?.value;
    const skipHeader = this.importForm.get('skipHeader')?.value;

    const startIndex = skipHeader ? 1 : 0;

    return this.previewData.slice(startIndex)
      .map(row => {
        const code = String(row[codeColumn] || '').trim();
        const display = displayColumn !== null && displayColumn !== undefined ? 
          String(row[displayColumn] || '').trim() : undefined;
        return { code, display };
      })
      .filter(item => item.code && item.code !== '');
  }

  private buildValueSetResource(codes: Array<{code: string, display?: string}>): any {
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultUrl = this.valueSetUri || `http://example.org/fhir/ValueSet/preview-${timestamp}`;
    const defaultName = this.valueSetName || `PreviewValueSet-${timestamp}`;

    return {
      resourceType: 'ValueSet',
      url: defaultUrl,
      name: defaultName,
      version: this.valueSetVersion,
      status: 'draft',
      experimental: true,
      compose: {
        include: [{
          system: 'http://snomed.info/sct',
          version: this.terminologyContext.fhirUrlParam,
          concept: codes
        }]
      }
    };
  }

  private async getCodesForPreview(): Promise<Array<{code: string, display?: string}>> {
    if (this.isEclResult && this.fullEclConcepts.length > 0) {
      return this.fullEclConcepts.map(c => ({ code: c.code, display: c.display }));
    }

    if (this.isValueSetFile && this.sourceValueSet?.parameter?.[0]?.resource) {
      const valueSet = this.sourceValueSet.parameter[0].resource;
      if (valueSet.compose?.include?.[0]?.concept?.length) {
        return valueSet.compose.include[0].concept.map((c: any) => ({
          code: c.code,
          display: c.display
        }));
      }
      if (valueSet.expansion?.contains?.length) {
        return valueSet.expansion.contains.map((c: any) => ({
          code: c.code,
          display: c.display
        }));
      }
      return [];
    }

    return this.extractCodesFromForm();
  }

  get visiblePreviewRows(): any[] {
    if (!this.previewData.length) return [];
    return this.previewData.slice(1, this.previewVisibleCount + 1);
  }

  get hasInputReady(): boolean {
    return this.showPreview && this.previewData.length > 0;
  }

  get hasResultData(): boolean {
    return this.targetPreviewData.length > 0 || !!this.targetValueSet;
  }

  get currentWorkflowStep(): number {
    if (this.codeDisplayExported) return 4;
    if (this.hasResultData || this.isTranslationLoading) return 4;
    if (this.selectedAction) return 3;
    if (this.hasInputReady) return 2;
    return 1;
  }

  get totalPreviewRowCount(): number {
    return Math.max(this.previewData.length - 1, 0);
  }

  get canLoadMorePreviewRows(): boolean {
    return this.totalPreviewRowCount > this.previewVisibleCount;
  }

  loadMorePreviewRows(): void {
    const totalRows = this.totalPreviewRowCount;
    this.previewVisibleCount = Math.min(this.previewVisibleCount + this.previewIncrement, totalRows);
  }

  get visibleTargetPreviewRows(): Array<{code: string, originalDisplay: string, translatedDisplay: string}> {
    return this.targetPreviewData.slice(0, this.targetPreviewVisibleCount);
  }

  get canLoadMoreTargetPreviewRows(): boolean {
    return this.targetPreviewData.length > this.targetPreviewVisibleCount;
  }

  loadMoreTargetPreviewRows(): void {
    this.targetPreviewVisibleCount = Math.min(
      this.targetPreviewVisibleCount + this.targetPreviewIncrement,
      this.targetPreviewData.length
    );
  }

  onEditionChange(editionName: string) {
    // Find the edition object by name and set it
    const editionObj = this.editionsDetails.find(e => e.editionName === editionName);
    if (editionObj && editionObj.editions && editionObj.editions.length > 0) {
      // Use the first version for the selected edition
      this.terminologyService.setFhirUrlParam(editionObj.editions[0].resource.version);
    }
  }

  onLanguageChange(language: string) {
    this.terminologyService.setLang(language);
  }

  onContextChange(context: any) {
    this.terminologyService.setContext(context);
  }

  onLanguageRefsetChange(langRefset: any) {
    this.terminologyService.setLanguageRefsetConcept(langRefset);
  }

  updateSelectedLanguageLabel() {
    const activeLanguage = this.terminologyService.getComputedLanguageContext();
    if (activeLanguage && typeof activeLanguage === 'string') {
      if (!activeLanguage.includes('-X-')) {
        this.selectedLanguageDisplayLabel = activeLanguage;
      } else {
        const languageParts = activeLanguage.split('-X-');
        this.selectedLanguageDisplayLabel = languageParts[0] + '*';
      }
    } else if (activeLanguage && typeof activeLanguage === 'object') {
      this.selectedLanguageDisplayLabel = activeLanguage['name'];
    }
  }
}
