import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { TerminologyService } from '../services/terminology.service';

interface ColumnOption {
  header: string;
  index: number;
}

@Component({
  selector: 'app-valueset-translator',
  templateUrl: './valueset-translator.component.html',
  styleUrl: './valueset-translator.component.scss',
  standalone: false
})
export class ValuesetTranslatorComponent implements OnInit {
  file: File | null = null;
  columns: ColumnOption[] = [];
  displayedColumns: string[] = [];
  importForm: FormGroup;
  previewData: any[] = [];
  isLoading = false;
  error: string | null = null;
  successMessage: string | null = null;
  showPreview = false;
  sourceValueSet: any = null;
  targetValueSet: any = null;

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

  ngOnInit() {}

  onFileSelected(event: any) {
    this.file = event.target.files[0];
    if (this.file) {
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
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        if (this.file?.name.toLowerCase().endsWith('.tsv')) {
          // Handle TSV file
          const content = e.target.result;
          const rows = content.split('\n').map((row: string) => row.split('\t'));
          this.previewData = rows;
        } else {
          // Handle Excel/CSV files
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          this.previewData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
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
        this.error = 'Error reading file. Please make sure it\'s a valid Excel, CSV, or TSV file.';
        this.isLoading = false;
      }
    };

    reader.onerror = () => {
      this.error = 'Error reading file';
      this.isLoading = false;
    };

    if (this.file?.name.toLowerCase().endsWith('.tsv')) {
      reader.readAsText(this.file);
    } else {
      reader.readAsBinaryString(this.file as Blob);
    }
  }

  importCodes() {
    if (!this.previewData.length || !this.importForm.valid) return;

    const codeColumnIndex = this.importForm.get('codeColumn')?.value;
    const displayColumnIndex = this.importForm.get('displayColumn')?.value;
    const skipHeader = this.importForm.get('skipHeader')?.value;

    // Start from index 1 if skipping header, or 0 if not
    const startIndex = skipHeader ? 1 : 0;

    // Map data starting from appropriate row
    const codes = this.previewData.slice(startIndex).map(row => ({
      code: row[codeColumnIndex],
      display: row[displayColumnIndex]
    })).filter(item => item.code && item.display); // Filter out empty rows

    // Create source ValueSet from codes
    this.sourceValueSet = this.terminologyService.getValueSetFromCodes(codes);
    
    // Create target ValueSet by expanding the source ValueSet
    this.isLoading = true;
    this.terminologyService.expandInlineValueSet(this.sourceValueSet).subscribe(
      (expandedValueSet) => {
        this.targetValueSet = expandedValueSet;
        this.isLoading = false;
        this.showPreview = false;
        this.successMessage = `Successfully imported ${codes.length} codes and created expanded ValueSet`;
      },
      (error) => {
        this.error = 'Error expanding ValueSet: ' + error.message;
        this.isLoading = false;
      }
    );
    
    // Reset form and file input but keep skipHeader value
    const currentSkipHeader = this.importForm.get('skipHeader')?.value;
    this.importForm.reset({ skipHeader: currentSkipHeader });
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
}
