import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TerminologyService } from '../services/terminology.service';
import { Subscription, combineLatest } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

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
  baseUri = 'http://salud.gob.sv/fhir';
  resourceName = 'procedimientos';
  isMap = false;

  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService,
    private snackBar: MatSnackBar
  ) {
    this.importForm = this.fb.group({
      codeColumn: ['', Validators.required],
      displayColumn: ['', Validators.required],
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
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  onFileSelected(event: any) {
    this.file = event.target.files[0];
    if (this.file) {
      // Hide ECL input if it was shown
      this.showEclInput = false;
      this.eclExpression = '';
      this.readFile();
    }
  }

  private readFile() {
    this.isLoading = true;
    this.error = null;
    this.successMessage = null;
    this.showPreview = false;
    this.sourceValueSet = null;
    this.targetValueSet = null;
    this.isValueSetFile = false;
    this.originalData = []; // Reset original data
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        if (this.file?.name.toLowerCase().endsWith('.json')) {
          // Try to parse as FHIR ValueSet
          const jsonContent = JSON.parse(e.target.result);
          if (this.isFhirValueSet(jsonContent)) {
            this.handleValueSetFile(jsonContent);
            return;
          }
        }

        // Handle other file types (Excel, CSV, TSV)
        if (this.file?.name.toLowerCase().endsWith('.tsv')) {
          // Handle TSV file
          const content = e.target.result;
          const rows = content.split('\n').map((row: string) => row.split('\t'));
          this.previewData = rows;
          this.originalData = rows; // Store original data
        } else {
          // Handle Excel/CSV files
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          this.previewData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          this.originalData = [...this.previewData]; // Store original data
        }
        
        if (this.previewData.length > 0) {
          // Get headers from first row
          this.columns = this.previewData[0].map((header: string, index: number) => ({
            header: header || `Column ${index + 1}`,
            index: index
          }));
          // Set displayed columns for mat-table
          this.displayedColumns = this.columns.map((_, index) => `${index}`);
          this.showPreview = true;
          // Reset form when new file is loaded but keep skipHeader value
          const currentSkipHeader = this.importForm.get('skipHeader')?.value;
          this.importForm.reset({ skipHeader: currentSkipHeader });
        }

        this.isLoading = false;
      } catch (error) {
        this.error = 'Error reading file. Please make sure it\'s a valid file format.';
        this.isLoading = false;
      }
    };

    reader.onerror = () => {
      this.error = 'Error reading file';
      this.isLoading = false;
    };

    if (this.file?.name.toLowerCase().endsWith('.json') || this.file?.name.toLowerCase().endsWith('.tsv')) {
      reader.readAsText(this.file);
    } else {
      reader.readAsBinaryString(this.file as Blob);
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

    this.sourceValueSet = {
      resourceType: 'Parameters',
      parameter: [{
        name: 'valueSet',
        resource: json
      }]
    };

    // Create preview data from ValueSet concepts
    const concepts = json.compose?.include?.[0]?.concept || [];
    this.previewData = [
      ['Code', 'Display', 'System'], // Headers
      ...concepts.map((concept: any) => [
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
      const codes = this.previewData.slice(startIndex).map(row => ({
        code: row[this.selectedCodeColumn!],
        display: row[this.selectedDisplayColumn!]
      })).filter(item => item.code && item.display); // Filter out empty rows

      // Create source ValueSet from codes
      this.sourceValueSet = this.terminologyService.getValueSetFromCodes(codes);
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
    // Reset common states
    this.showPreview = false;
    this.previewData = [];
    this.columns = [];
    this.error = null;
    this.successMessage = null;
    this.sourceValueSet = null;
    this.targetValueSet = null;
  }

  expandEcl() {
    if (!this.eclExpression.trim()) {
      this.error = 'Please enter an ECL expression';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.successMessage = null;

    // Directly expand the ECL expression with page size 1000
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
          this.isLoading = false;
          this.showPreview = false;
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

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(translatedData);

    // Set column widths based on content
    const maxLengths = translatedData[0].map((_, colIndex) => 
      Math.max(...translatedData.map(row => 
        String(row[colIndex] || '').length
      ))
    );
    
    ws['!cols'] = maxLengths.map(length => ({
      wch: Math.min(Math.max(length, 10), 50) // Min width 10, max width 50
    }));

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Translated');

    // Generate filename based on original file
    const originalExt = this.file?.name.split('.').pop() || 'xlsx';
    const filename = this.file?.name.replace(
      `.${originalExt}`, 
      `_translated.xlsx`
    ) || 'translated_file.xlsx';

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
      if (this.outputFormat === 'fhir' && this.isMap) {
        await this.generateFHIRPackage();
      } else {
        await this.convertToCSV();
      }
    } catch (error) {
      console.error('Conversion error:', error);
      this.snackBar.open('Error during conversion', 'OK', { duration: 3000 });
    } finally {
      this.isProcessing = false;
    }
  }

  private async generateFHIRPackage(): Promise<void> {
    const data = await this.readExcelFile(this.selectedFile!);
    const concepts = this.extractConcepts(data);
    
    const packageData = this.createFHIRPackage(concepts);
    const tarBlob = await this.createTarGz(packageData);
    
    saveAs(tarBlob, `${this.resourceName}.tgz`);
    this.snackBar.open('FHIR package generated successfully!', 'OK', { duration: 3000 });
  }

  private extractConcepts(data: any[]): Array<{code: string, display: string}> {
    const sourceCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('source'))!;
    const targetCol = Object.keys(data[0]).find(h => h.toLowerCase().includes('target'))!;
    
    return data.map(row => ({
      code: String(row[sourceCol]).trim(),
      display: String(row[targetCol]).trim()
    })).filter(c => c.code && c.display);
  }

  private createFHIRPackage(concepts: Array<{code: string, display: string}>): FHIRPackage {
    const codeSystemUrl = `${this.baseUri}/CodeSystem/${this.resourceName}`;
    const valueSetUrl = `${this.baseUri}/ValueSet/${this.resourceName}`;

    const codeSystem: FHIRResource = {
      resourceType: 'CodeSystem',
      id: uuidv4(),
      url: codeSystemUrl,
      name: `${this.resourceName}CodeSystem`,
      version: '1.0.0',
      status: 'active',
      content: 'complete',
      concept: concepts
    };

    const valueSet: FHIRResource = {
      resourceType: 'ValueSet',
      id: uuidv4(),
      url: valueSetUrl,
      name: `${this.resourceName}ValueSet`,
      status: 'active',
      compose: {
        include: [{
          system: codeSystemUrl,
          concept: concepts
        }]
      }
    };

    return {
      manifest: {
        name: `${this.resourceName}.codesystem.package`,
        version: '1.0.0',
        fhirVersion: '4.0.1',
        resources: [
          { type: 'CodeSystem', reference: `CodeSystem/${codeSystem.name}` },
          { type: 'ValueSet', reference: `ValueSet/${valueSet.name}` }
        ]
      },
      index: {
        'index-version': 1,
        files: [
          { filename: `CodeSystem/${codeSystem.name}.json`, resourceType: 'CodeSystem', id: codeSystem.id, url: codeSystem.url },
          { filename: `ValueSet/${valueSet.name}.json`, resourceType: 'ValueSet', id: valueSet.id, url: valueSet.url }
        ]
      },
      resources: { codeSystem, valueSet }
    };
  }

  private async createTarGz(packageData: FHIRPackage): Promise<Blob> {
    const zip = new JSZip();
    
    // Create package directory structure
    const packageFolder = zip.folder('package');
    if (!packageFolder) throw new Error('Failed to create package folder');
    
    const codeSystemFolder = packageFolder.folder('CodeSystem');
    const valueSetFolder = packageFolder.folder('ValueSet');
    
    if (!codeSystemFolder || !valueSetFolder) {
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

  private async checkIfMap(): Promise<void> {
    if (!this.selectedFile) return;

    try {
      const data = await this.readExcelFile(this.selectedFile);
      const headers = Object.keys(data[0]);
      
      // Check if it's a map by looking for source/target columns
      this.isMap = headers.some(h => h.toLowerCase().includes('source')) && 
                  headers.some(h => h.toLowerCase().includes('target'));
      
      if (this.isMap) {
        this.snackBar.open('Map detected! FHIR package generation is available.', 'OK', { duration: 3000 });
      }
    } catch (error) {
      console.error('Error checking file type:', error);
    }
  }
}
