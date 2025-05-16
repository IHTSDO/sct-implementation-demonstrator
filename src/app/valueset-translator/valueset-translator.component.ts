import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TerminologyService } from '../services/terminology.service';
import { Subscription, combineLatest } from 'rxjs';

interface ColumnOption {
  header: string;
  index: number;
}

interface TerminologyContext {
  fhirUrlParam: string;
  language: string;
  editionName: string;
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

  constructor(
    private fb: FormBuilder,
    private terminologyService: TerminologyService
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
}
