import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TerminologyService } from '../services/terminology.service';
import { Subscription, combineLatest } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { MatDialog } from '@angular/material/dialog';
import { FhirServerDialogComponent } from './fhir-server-dialog/fhir-server-dialog.component';

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
    fhirVersion: string;
    resources: Array<{type: string, reference: string}>;
  };
  index: {
    'index-version': number;
    files: Array<{
      filename: string;
      resourceType: string;
      id: string;
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

@Component({
  selector: 'app-valueset-translator',
  templateUrl: './valueset-translator.component.html',
  styleUrl: './valueset-translator.component.scss',
  standalone: false
})
export class ValuesetTranslatorComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;
  
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
  isProcessing = false;
  outputFormat = 'csv';
  baseUri = 'http://organization.org/fhir';
  setName = 'LocalCodes';
  isMap = false;
  showFhirOptions = false;
  showIndicators = true;
  showValueSetMetadata = true;
  sourceSystemUri = '';
  valueSetUri = '';
  valueSetName = '';
  valueSetVersion = '1.0.0';
  mapBetweenValueSets = false;
  targetPreviewData: Array<{code: string, originalDisplay: string, translatedDisplay: string}> = [];
  targetPreviewColumns = ['code', 'originalDisplay', 'translatedDisplay'];
  selectedAction: string | null = null;
  translationEnabled = false;
  isRf2Refset = false;
  isEclResult = false;
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
  
  // FHIR Package upload properties
  showFhirServerUpload = false;
  fhirServerUrl = '';
  isUploading = false;
  instructionTab = 'download';
  generatedPackage: FHIRPackage | null = null;


  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
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

    // Add scroll event listener with arrow function
    window.addEventListener('scroll', () => this.onScroll());
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    // Remove scroll event listener with arrow function
    window.removeEventListener('scroll', () => this.onScroll());
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
      // Reset FHIR options
      this.showFhirOptions = false;
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
      this.valueSetUri = json.url;
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

  importCodes() {
    if (!this.previewData.length) return;

    if (this.isValueSetFile) {
      // For ValueSet files, just expand the source ValueSet
      this.expandValueSet();
    } else {
      // For Excel/CSV/TSV files, process as before
      if (!this.importForm.valid) return;

      // Store selected columns before resetting the form
      this.selectedCodeColumn = this.importForm.get('codeColumn')?.value;
      this.selectedDisplayColumn = this.importForm.get('displayColumn')?.value;
      const skipHeader = this.importForm.get('skipHeader')?.value;



      // Start from index 1 if skipping header, or 0 if not
      const startIndex = skipHeader ? 1 : 0;



      // Map data starting from appropriate row
      const codes = this.previewData.slice(startIndex)
        .map(row => {
          const code = String(row[this.selectedCodeColumn!] || '').trim();
          // Only include display if display column is selected and has a value
          const display = this.selectedDisplayColumn !== null && this.selectedDisplayColumn !== undefined ? 
            String(row[this.selectedDisplayColumn] || '').trim() : undefined;
          return { code, display };
        })
        .filter(item => item.code && item.code !== ''); // Only filter out empty codes



      if (codes.length === 0) {
        this.error = 'No valid codes found in the selected column';
        return;
      }

      // Create source ValueSet from codes
      this.sourceValueSet = {
        resourceType: 'Parameters',
        parameter: [{
          name: 'valueSet',
          resource: {
            resourceType: 'ValueSet',
            status: 'draft',
            experimental: true,
            compose: {
              include: [{
                system: 'http://snomed.info/sct',
                version: this.terminologyContext.fhirUrlParam,
                concept: codes
              }]
            }
          }
        }]
      };


      
      this.expandValueSet();
    }
  }

  private expandValueSet() {
    // Create target ValueSet by expanding the source ValueSet
    this.isLoading = true;
    this.terminologyService.expandInlineValueSet(this.sourceValueSet).subscribe(
      (expandedValueSet) => {
        this.targetValueSet = expandedValueSet;
        this.isLoading = false;
        this.showPreview = false;
        this.successMessage = 'Successfully created expanded ValueSet';
      },
      (error) => {
        this.error = 'Error expanding ValueSet: ' + error.message;
        this.isLoading = false;
      }
    );
    
    // Reset form and file input but keep skipHeader value
    if (!this.isValueSetFile) {
      const currentSkipHeader = this.importForm.get('skipHeader')?.value;
      this.importForm.reset({ skipHeader: currentSkipHeader });
    }
    this.file = null;
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
    this.targetPreviewData = [];
    
    // Reset UI state
    this.error = null;
    this.successMessage = null;
    this.isLoading = false;
    this.isProcessing = false;
    this.isTranslationLoading = false;
    this.showFhirOptions = false;
    
    // Reset ECL state
    this.eclExpression = '';
    this.isEclResult = false;
    
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
    this.targetPreviewData = [];
    
    // Reset UI state
    this.error = null;
    this.successMessage = null;
    this.isLoading = false;
    this.isProcessing = false;
    this.isTranslationLoading = false;
    this.showFhirOptions = false;
    
    // Reset ECL state
    this.eclExpression = '';
    this.isEclResult = false;
    
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
          // Populate previewData and showPreview
          const first5 = expandedValueSet.expansion.contains.slice(0, 5).map((c: any) => [
            c.code || '',
            c.display || '',
            c.system || ''
          ]);
          this.previewData = [
            ['Code', 'Display', 'System'],
            ...first5
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

  async convert(): Promise<void> {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file first', 'OK', { duration: 3000 });
      return;
    }

    this.isProcessing = true;

    try {
      if (this.isMap) {
        await this.generateFHIRPackage();
      } else {
        await this.convertToCSV();
      }
    } catch (error) {
      this.snackBar.open('Error during conversion', 'OK', { duration: 3000 });
    } finally {
      this.isProcessing = false;
    }
  }

  async generateFHIRPackage(): Promise<void> {
    const data = await this.readExcelFile(this.selectedFile!);
    const { source, snomed } = this.extractConcepts(data);
    
    this.generatedPackage = this.createFHIRPackage(source, snomed);
    const tarBlob = await this.createTarGz(this.generatedPackage);
    
    saveAs(tarBlob, `${this.valueSetName}.tgz`);
    this.snackBar.open('FHIR package generated successfully!', 'OK', { duration: 3000 });
  }

  downloadFHIRPackage(): void {
    if (!this.generatedPackage) {
      this.snackBar.open('No package available to download', 'OK', { duration: 3000 });
      return;
    }
    
    this.createTarGz(this.generatedPackage).then(tarBlob => {
      saveAs(tarBlob, `${this.valueSetName}.tgz`);
    });
  }

  toggleFhirServerInput(): void {
    this.showFhirServerUpload = !this.showFhirServerUpload;
    if (!this.showFhirServerUpload) {
      this.fhirServerUrl = '';
    }
  }

  async uploadToFhirServer(): Promise<void> {
    if (!this.generatedPackage || !this.fhirServerUrl) {
      this.snackBar.open('No package or server URL provided', 'OK', { duration: 3000 });
      return;
    }

    this.isUploading = true;
    const serverUrl = this.fhirServerUrl.endsWith('/') ? this.fhirServerUrl.slice(0, -1) : this.fhirServerUrl;

    try {
      const resources = [
        { resource: this.generatedPackage.resources.codeSystem, type: 'CodeSystem' },
        { resource: this.generatedPackage.resources.valueSet, type: 'ValueSet' },
        { resource: this.generatedPackage.resources.snomedValueSet, type: 'ValueSet' },
        { resource: this.generatedPackage.resources.conceptMap, type: 'ConceptMap' }
      ];

      const results = [];
      for (const { resource, type } of resources) {
        try {
          const response = await fetch(`${serverUrl}/${type}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/fhir+json',
              'Accept': 'application/fhir+json'
            },
            body: JSON.stringify(resource)
          });

          if (response.ok) {
            const result = await response.json();
            results.push({ type, success: true, id: result.id });
          } else {
            const error = await response.text();
            results.push({ type, success: false, error: error });
          }
        } catch (error) {
          results.push({ type, success: false, error: error });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        this.snackBar.open(`Successfully uploaded all ${totalCount} resources to FHIR server!`, 'OK', { duration: 5000 });
      } else {
        this.snackBar.open(`Uploaded ${successCount}/${totalCount} resources. Check console for details.`, 'OK', { duration: 5000 });
      }

      // Log detailed results

    } catch (error) {
      this.snackBar.open('Error uploading to FHIR server', 'OK', { duration: 5000 });
    } finally {
      this.isUploading = false;
    }
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
    const codeSystemUrl = this.sourceSystemUri;
    const valueSetUrl = `${this.valueSetUri}/ValueSet/${this.valueSetName}`;
    const snomedValueSetUrl = `${this.valueSetUri}/ValueSet/${this.valueSetName}-snomed`;
    const conceptMapUrl = `${this.valueSetUri}/ConceptMap/${this.valueSetName}-to-snomed`;

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
      sourceUri: sourceUri,
      targetUri: targetUri,
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
        fhirVersion: '4.0.1',
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
          { filename: `CodeSystem/${codeSystem.name}.json`, resourceType: 'CodeSystem', id: codeSystem.id, url: codeSystem.url },
          { filename: `ValueSet/${valueSet.name}.json`, resourceType: 'ValueSet', id: valueSet.id, url: valueSet.url },
          { filename: `ValueSet/${snomedValueSet.name}.json`, resourceType: 'ValueSet', id: snomedValueSet.id, url: snomedValueSet.url },
          { filename: `ConceptMap/${conceptMap.name}.json`, resourceType: 'ConceptMap', id: conceptMap.id, url: conceptMap.url }
        ]
      },
      resources: { codeSystem, valueSet, snomedValueSet, conceptMap }
    };
  }

  private async createTarGz(packageData: FHIRPackage): Promise<Blob> {
    const zip = new JSZip();
    
    // Create package directory structure
    const packageFolder = zip.folder('package');
    if (!packageFolder) throw new Error('Failed to create package folder');
    
    const codeSystemFolder = packageFolder.folder('CodeSystem');
    const valueSetFolder = packageFolder.folder('ValueSet');
    const conceptMapFolder = packageFolder.folder('ConceptMap');
    
    if (!codeSystemFolder || !valueSetFolder || !conceptMapFolder) {
      throw new Error('Failed to create resource folders');
    }

    // Add resources with proper formatting
    codeSystemFolder.file(
      `${packageData.resources.codeSystem.name}.json`,
      JSON.stringify(packageData.resources.codeSystem, null, 2)
    );
    
    valueSetFolder.file(
      `${packageData.resources.valueSet.name}.json`,
      JSON.stringify(packageData.resources.valueSet, null, 2)
    );
    
    valueSetFolder.file(
      `${packageData.resources.snomedValueSet.name}.json`,
      JSON.stringify(packageData.resources.snomedValueSet, null, 2)
    );

    conceptMapFolder.file(
      `${packageData.resources.conceptMap.name}.json`,
      JSON.stringify(packageData.resources.conceptMap, null, 2)
    );
    
    packageFolder.file('package.json', JSON.stringify(packageData.manifest, null, 2));
    packageFolder.file('.index.json', JSON.stringify(packageData.index, null, 2));
    
    // Generate the zip file
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      }
    });
  }

  private async convertToCSV(): Promise<void> {
    // ... existing CSV conversion code ...
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

  async processAndDownload(type: 'source' | 'target' | 'excel' | 'fhir'): Promise<void> {
    if (!this.previewData.length) return;

    this.isLoading = true;
    this.error = null;

    try {
      // Get the selected columns from the form
      const codeColumn = this.importForm.get('codeColumn')?.value;
      const displayColumn = this.importForm.get('displayColumn')?.value;
      const skipHeader = this.importForm.get('skipHeader')?.value;

      // Start from index 1 if skipping header, or 0 if not
      const startIndex = skipHeader ? 1 : 0;

      // Map data starting from appropriate row
      const codes = this.previewData.slice(startIndex)
        .map(row => {
          const code = String(row[codeColumn] || '').trim();
          // Only include display if display column is selected and has a value
          const display = displayColumn !== null && displayColumn !== undefined ? 
            String(row[displayColumn] || '').trim() : undefined;
          return { code, display };
        })
        .filter(item => item.code && item.code !== ''); // Only filter out empty codes

      if (codes.length === 0) {
        this.error = 'No valid codes found in the selected column';
        this.isLoading = false;
        return;
      }

      // Create source ValueSet from codes
      this.sourceValueSet = {
        resourceType: 'Parameters',
        parameter: [{
          name: 'valueSet',
          resource: {
            resourceType: 'ValueSet',
            url: this.valueSetUri,
            name: this.valueSetName,
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
          }
        }]
      };

      if (type === 'source') {
        this.downloadSourceValueSet();
        return;
      }

      if (type === 'fhir') {
        await this.generateFHIRPackage();
        return;
      }

      // For target and excel, we need to expand the ValueSet
      const expandedValueSet = await this.terminologyService.expandInlineValueSet(this.sourceValueSet).toPromise();
      this.targetValueSet = expandedValueSet;

      if (type === 'target') {
        this.downloadTargetValueSet();
      } else if (type === 'excel') {
        this.downloadTargetAsExcel();
      }
    } catch (error: any) {
      this.error = `Error processing file: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  postToFhirServer() {
    if (!this.targetValueSet) {
      this.snackBar.open('No ValueSet available to post', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(FhirServerDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(serverUrl => {
      if (serverUrl) {
        this.isLoading = true;

        // Extract ValueSet if it's wrapped in Parameters
        let valueSetToPost = this.targetValueSet;
        if (this.targetValueSet.resourceType === 'Parameters' && this.targetValueSet.parameter) {
          const valueSetParam = this.targetValueSet.parameter.find((p: any) => p.name === 'valueSet');
          if (valueSetParam?.resource) {
            valueSetToPost = valueSetParam.resource;
          }
        }

        // Add required FHIR metadata
        const id = valueSetToPost.id || uuidv4();
        valueSetToPost.id = id;
        valueSetToPost.url = `http://example.org/vs/${id}`;
        valueSetToPost.status = valueSetToPost.status || 'active';

        // Add name if not present
        if (!valueSetToPost.name) {
          const timestamp = new Date().toISOString().split('T')[0];
          if (this.showEclInput && this.eclExpression) {
            // For ECL-based ValueSets
            const eclForName = this.eclExpression.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            valueSetToPost.name = `ECL_${eclForName}_${timestamp}`;
          } else {
            // For file-based ValueSets
            const fileName = this.file?.name.split('.')[0] || 'custom';
            valueSetToPost.name = `${fileName}_${timestamp}`;
          }
        }

        // Add title if not present
        if (!valueSetToPost.title) {
          if (this.showEclInput && this.eclExpression) {
            valueSetToPost.title = `ECL ValueSet: ${this.eclExpression}`;
          } else {
            valueSetToPost.title = `ValueSet from ${this.file?.name || 'uploaded file'}`;
          }
        }

        // Add description if not present
        if (!valueSetToPost.description) {
          const conceptCount = valueSetToPost.expansion?.contains?.length || 
                             valueSetToPost.compose?.include?.[0]?.concept?.length || 0;
          const system = valueSetToPost.compose?.include?.[0]?.system || 'unknown system';
          
          if (this.showEclInput && this.eclExpression) {
            valueSetToPost.description = `ValueSet created from ECL expression: "${this.eclExpression}". Contains ${conceptCount} matching concepts.`;
          } else {
            valueSetToPost.description = `ValueSet containing ${conceptCount} concepts from ${system}`;
          }
        }

        this.terminologyService.postValueSetToFhirServer(valueSetToPost, serverUrl).subscribe({
          next: (response: any) => {
            this.snackBar.open('ValueSet successfully posted to FHIR server', 'Close', { duration: 5000 });
          },
          error: (error: any) => {
            this.error = `Error posting to FHIR server: ${error.message || error}`;
            this.snackBar.open(this.error, 'Close', { duration: 5000 });
          },
          complete: () => {
            this.isLoading = false;
          }
        });
      }
    });
  }

  async generateTargetPreview(): Promise<void> {
    
    // For JSON ValueSets, check sourceValueSet instead of previewData
    if (this.isValueSetFile) {
      if (!this.sourceValueSet) {
        this.error = 'No ValueSet resource loaded from JSON file.';
        return;
      }
    } else {
      // For other file types, check previewData
      if (!this.previewData.length) {
        this.error = 'No preview data available.';
        return;
      }
    }

    this.isTranslationLoading = true;
    this.error = null;

    try {
      let valueSetToExpand: any;

      if (this.isValueSetFile && this.sourceValueSet) {
        // Use the loaded ValueSet JSON directly
        valueSetToExpand = this.sourceValueSet.parameter[0].resource;
        // If compose.include[0].concept is empty but expansion.contains exists, reconstruct compose
        if (
          valueSetToExpand.compose?.include?.[0]?.concept?.length === 0 &&
          valueSetToExpand.expansion?.contains?.length > 0
        ) {
          valueSetToExpand.compose = {
            include: [
              {
                system: valueSetToExpand.expansion.contains[0].system || 'http://snomed.info/sct',
                concept: valueSetToExpand.expansion.contains.map((c: any) => ({
                  code: c.code,
                  display: c.display
                }))
              }
            ]
          };
        }
        // If still no codes, show error and abort
        if (!valueSetToExpand.compose?.include?.[0]?.concept?.length) {
          this.error = 'No codes found in the ValueSet. Please upload a ValueSet with at least one concept.';
          this.isTranslationLoading = false;
          return;
        }
      } else {
        // Existing logic for spreadsheets
        const codes = await this.extractCodesFromForm();
        const timestamp = new Date().toISOString().split('T')[0];
        const defaultUrl = this.valueSetUri || `http://example.org/fhir/ValueSet/preview-${timestamp}`;
        const defaultName = this.valueSetName || `PreviewValueSet-${timestamp}`;
        valueSetToExpand = {
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
        if (!codes.length) {
          this.error = 'No codes found in the selected columns.';
          this.isTranslationLoading = false;
          return;
        }
      }

      // Expand the ValueSet to get translations
      const expandedValueSet = await this.terminologyService.expandInlineValueSet({
        resourceType: 'Parameters',
        parameter: [{
          name: 'valueSet',
          resource: valueSetToExpand
        }]
      }).toPromise();
      this.targetValueSet = expandedValueSet;

      // Create preview data
      let codes: any[] = [];
      if (this.isValueSetFile) {
        // For JSON ValueSets, extract codes from the ValueSet
        if (valueSetToExpand.compose?.include?.[0]?.concept) {
          codes = valueSetToExpand.compose.include[0].concept;
        } else if (valueSetToExpand.expansion?.contains) {
          // If the ValueSet is already expanded, use the expansion
          codes = valueSetToExpand.expansion.contains.map((c: any) => ({
            code: c.code,
            display: c.display
          }));
        } else if (this.previewData.length > 1) {
          // Fallback: use the preview data that was created during file loading
          codes = this.previewData.slice(1).map((row: any[]) => ({
            code: row[0] || '',
            display: row[1] || ''
          })).filter((item: any) => item.code && item.code !== '');
        }
      } else {
        // For other file types, extract codes from form
        codes = await this.extractCodesFromForm();
      }
      
      if (!codes.length) {
        this.error = 'No codes found to create preview.';
        this.isTranslationLoading = false;
        return;
      }
      
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

    } catch (error: any) {
      this.error = `Error generating preview: ${error.message || error}`;
      this.snackBar.open(this.error, 'Close', { duration: 5000 });
    } finally {
      this.isTranslationLoading = false;
    }
  }

  selectAction(action: string) {
    this.selectedAction = action;
    this.targetPreviewData = [];
    this.targetValueSet = null;
    // Don't clear sourceValueSet as it's needed for JSON ValueSet operations
    // this.sourceValueSet = null;
    
    // Check form state after action selection
  }

  canExecuteAction(): boolean {

    if (this.isValueSetFile) {
      // For JSON ValueSets, require that sourceValueSet exists
      const result = !!this.sourceValueSet;
      return result;
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

  getActionIcon(): string {
    switch (this.selectedAction) {
      case 'translate': return 'translate';
      case 'source-valueset': return 'code';
      case 'target-valueset': return 'expand_more';
      case 'translate-target': return 'swap_horiz';
      case 'fhir-package': return 'archive';
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
    }
  }

  async generateSourceValueSet(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      if (this.isValueSetFile && this.sourceValueSet) {
        // For JSON ValueSets, use the existing sourceValueSet
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
            resource: {
              resourceType: 'ValueSet',
              url: this.valueSetUri,
              name: this.valueSetName,
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
            }
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
      if (this.isValueSetFile && this.sourceValueSet) {
        // For JSON ValueSets, expand the existing sourceValueSet
        const expandedValueSet = await this.terminologyService.expandInlineValueSet(this.sourceValueSet).toPromise();
        this.targetValueSet = expandedValueSet;
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
            resource: {
              resourceType: 'ValueSet',
              url: this.valueSetUri,
              name: this.valueSetName,
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
            }
          }]
        };

        // Expand the ValueSet to get translations
        const expandedValueSet = await this.terminologyService.expandInlineValueSet(this.sourceValueSet).toPromise();
        this.targetValueSet = expandedValueSet;
      }
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
