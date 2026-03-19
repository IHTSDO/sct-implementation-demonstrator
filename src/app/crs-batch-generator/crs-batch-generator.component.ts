import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { ConfirmationDialogComponent } from '../questionnaires/confirmation-dialog/confirmation-dialog.component';
import { TerminologyService } from '../services/terminology.service';

interface ValidationResult {
  exists: boolean;
  total: number;
  firstMatch: string;
  firstMatchCode: string;
}

interface FilteredRow {
  substanceName: string; // Column A
  indication: string; // Column B
  substanceType: string; // Column C
  includeFlag: string; // Column H
  startDate: Date | null; // Column K (parsed)
  restartDate: Date | null; // Column L (parsed)
  latestDate: Date | null; // Latest date between start and restart
  latestDateDisplay: string; // Human readable date string
  selected: boolean; // For checkbox selection
  originalRowIndex: number; // Original row index in the file
  substanceValidation?: ValidationResult;
  productValidation?: ValidationResult;
  [key: string]: any; // Allow additional columns
}

@Component({
  selector: 'app-crs-batch-generator',
  templateUrl: './crs-batch-generator.component.html',
  styleUrls: ['./crs-batch-generator.component.css'],
  standalone: false
})
export class CrsBatchGeneratorComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef;

  dateRangeForm: FormGroup;
  uploadedFile: File | null = null;
  filteredRows: FilteredRow[] = [];
  displayedColumns: string[] = ['select', 'substanceName', 'substanceType', 'date', 'validation'];
  isLoading = false;
  isCheckingSubstances = false;
  currentCheckIndex = 0;
  totalChecks = 0;
  currentCheckName = '';
  error: string | null = null;
  templateWorkbook: XLSX.WorkBook | null = null;
  headerRowIndex: number = -1;
  readonly substanceValidationEcl = '<< 105590001 |Substance (substance)|';
  readonly productValidationEcl = '<< 373873005 |Pharmaceutical / biologic product (product)|';

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private http: HttpClient,
    private terminologyService: TerminologyService
  ) {
    this.dateRangeForm = this.fb.group({
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Load template file on init
    this.loadTemplateFile();
  }

  async loadTemplateFile(): Promise<void> {
    try {
      const response = await this.http.get('assets/crs-utlity/OUTPUT-CRS_Batch_Template_v2.6.1.xls', { responseType: 'arraybuffer' }).toPromise();
      if (response) {
        const data = new Uint8Array(response);
        this.templateWorkbook = XLSX.read(data, { type: 'array' });
      }
    } catch (error: any) {
      console.error('Error loading template file:', error);
      this.error = 'Could not load template file. Please ensure the template file exists.';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    this.uploadedFile = input.files[0];
    this.error = null;
    this.filteredRows = [];
    this.snackBar.open('File selected. Please set date range and click "Filter Rows".', 'Close', { duration: 3000 });
  }

  async filterRows(): Promise<void> {
    if (!this.uploadedFile) {
      this.snackBar.open('Please upload a file first', 'Close', { duration: 3000 });
      return;
    }

    if (this.dateRangeForm.invalid) {
      this.snackBar.open('Please select both start and end dates', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const startDate = this.dateRangeForm.get('startDate')?.value;
      const endDate = this.dateRangeForm.get('endDate')?.value;

      // Read the uploaded file
      const arrayBuffer = await this.uploadedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, cellText: false });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

      // Find header row by searching for column H header
      this.headerRowIndex = this.findHeaderRow(data);
      if (this.headerRowIndex === -1) {
        throw new Error('Could not find the header row in the uploaded spreadsheet.');
      }

      // Filter rows
      const filtered = this.applyFilters(data, startDate, endDate);
      
      // Deduplicate by substance name (column A)
      this.filteredRows = this.deduplicateRows(filtered);

      this.snackBar.open(`Found ${this.filteredRows.length} unique rows in the selected date range`, 'Close', { duration: 3000 });
    } catch (error: any) {
      this.error = error.message || 'Error processing file';
      this.snackBar.open(this.error || 'Error processing file', 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  findHeaderRow(data: any[][]): number {
    // Search for header row - look for column H (index 7) that might contain header text
    // Common header text patterns for column H
    const possibleHeaders = ['include', 'y', 'yes', 'n', 'no', 'flag', 'h'];
    
    for (let i = 0; i < Math.min(data.length, 50); i++) {
      const row = data[i];
      if (row && row.length > 7) {
        const colH = String(row[7] || '').toLowerCase().trim();
        if (possibleHeaders.some(h => colH.includes(h))) {
          return i;
        }
      }
    }
    
    // Fallback: try row 14 (which would be row 15 in Excel, since arrays are 0-indexed)
    if (data.length > 14) {
      return 14;
    }
    
    return -1;
  }

  applyFilters(data: any[][], startDate: Date, endDate: Date): FilteredRow[] {
    const filtered: FilteredRow[] = [];
    const startRow = this.headerRowIndex + 1;
    let rowsWithValidDates = 0;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 12) continue;

      const colH = String(row[7] || '').trim().toUpperCase(); // Column H (0-indexed = 7)
      const colA = String(row[0] || '').trim(); // Column A (substance name)
      const colB = String(row[1] || '').trim(); // Column B (indication)
      const colC = String(row[2] || '').trim(); // Column C (substance type)
      const colK = row[10]; // Column K (start date, 0-indexed = 10) - may be number or string
      const colL = row[11]; // Column L (restart date, 0-indexed = 11) - may be number or string

      // Parse dates (can be Excel serial numbers or formatted strings)
      const startDateParsed = this.parseDate(colK);
      const restartDateParsed = this.parseDate(colL);

      // Only check column K (start date) for filtering
      if (startDateParsed) {
        rowsWithValidDates++;
      }

      // Check if column K (start date) falls within range
      const startInRange = startDateParsed && this.isDateInRange(startDateParsed, startDate, endDate);

      if (startInRange) {
        filtered.push({
          substanceName: colA,
          indication: colB,
          substanceType: colC,
          includeFlag: colH,
          startDate: startDateParsed,
          restartDate: restartDateParsed,
          latestDate: startDateParsed, // Keep for compatibility, but now only column K
          latestDateDisplay: startDateParsed ? this.formatDate(startDateParsed) : '',
          selected: true, // Default to selected
          originalRowIndex: i
        });
      }
    }

    return filtered;
  }

  parseDate(dateStr: string | number): Date | null {
    if (dateStr === null || dateStr === undefined || dateStr === '') {
      return null;
    }

    // Handle Excel serial number (integer)
    if (typeof dateStr === 'number' || (!isNaN(Number(dateStr)) && String(dateStr).trim() !== '' && !String(dateStr).includes('/'))) {
      const serialNumber = typeof dateStr === 'number' ? dateStr : parseFloat(String(dateStr));
      if (!isNaN(serialNumber) && serialNumber > 0) {
        // Excel serial date: days since 1900-01-01 (Excel incorrectly treats 1900 as leap year)
        // JavaScript Date epoch is 1970-01-01
        // Days between 1900-01-01 and 1970-01-01 = 25569 (accounting for Excel's leap year bug)
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899 (Excel's actual epoch)
        const jsDate = new Date(excelEpoch.getTime() + serialNumber * 24 * 60 * 60 * 1000);
        if (!isNaN(jsDate.getTime())) {
          return jsDate;
        }
      }
    }

    const dateStrValue = String(dateStr).trim();
    if (!dateStrValue) {
      return null;
    }

    // Handle MM/DD/YYYY format
    const parts = dateStrValue.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Try parsing as ISO date
    const isoDate = new Date(dateStrValue);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    return null;
  }

  isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    return dateOnly >= startOnly && dateOnly <= endOnly;
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  deduplicateRows(rows: FilteredRow[]): FilteredRow[] {
    const seen = new Set<string>();
    const unique: FilteredRow[] = [];

    for (const row of rows) {
      const key = row.substanceName.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    }

    return unique;
  }

  async validateFilteredRows(rows: FilteredRow[]): Promise<void> {
    this.isCheckingSubstances = true;
    this.totalChecks = rows.length;
    this.currentCheckIndex = 0;
    this.currentCheckName = '';
    rows.forEach(row => {
      row.substanceValidation = undefined;
      row.productValidation = undefined;
    });

    try {
      for (const row of rows) {
        this.currentCheckIndex += 1;
        this.currentCheckName = row.substanceName.trim();
        const filterTerm = row.substanceName.trim();
        const substanceResponse = await firstValueFrom(
          this.terminologyService.expandValueSet(this.substanceValidationEcl, filterTerm, 0, 5)
        );
        await this.delay(1000);
        const productResponse = await firstValueFrom(
          this.terminologyService.expandValueSet(this.productValidationEcl, filterTerm, 0, 5)
        );

        row.substanceValidation = this.mapValidationResult(substanceResponse);
        row.productValidation = this.mapValidationResult(productResponse);

        await this.delay(1000);
      }

      this.snackBar.open(`Checked ${rows.length} row(s) in the selected SNOMED edition`, 'Close', { duration: 3000 });
    } finally {
      this.isCheckingSubstances = false;
      this.currentCheckIndex = 0;
      this.totalChecks = 0;
      this.currentCheckName = '';
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  mapValidationResult(response: any): ValidationResult {
    const total = response?.expansion?.total ?? 0;
    const firstMatch = response?.expansion?.contains?.[0]?.display ?? '';
    const firstMatchCode = response?.expansion?.contains?.[0]?.code ?? '';

    return {
      exists: total > 0,
      total,
      firstMatch,
      firstMatchCode
    };
  }

  getValidationSummary(result?: ValidationResult, typeLabel?: string): string {
    if (!result) {
      return `${typeLabel}: not checked`;
    }

    if (!result.exists) {
      return `${typeLabel}: not found`;
    }

    return `${typeLabel}: ${result.firstMatch} (${result.firstMatchCode})`;
  }

  isValidationPending(row: FilteredRow): boolean {
    return this.isCheckingSubstances && (!row.substanceValidation || !row.productValidation);
  }

  toggleRowSelection(row: FilteredRow): void {
    row.selected = !row.selected;
  }

  toggleAllSelection(): void {
    const allSelected = this.filteredRows.every(row => row.selected);
    this.filteredRows.forEach(row => {
      row.selected = !allSelected;
    });
  }

  getSelectedCount(): number {
    return this.filteredRows.filter(row => row.selected).length;
  }

  get allSelected(): boolean {
    return this.filteredRows.length > 0 && this.filteredRows.every(row => row.selected);
  }

  get someSelected(): boolean {
    return this.filteredRows.some(row => row.selected) && !this.allSelected;
  }

  async generateOutput(): Promise<void> {
    const selectedRows = this.filteredRows.filter(row => row.selected);
    
    if (selectedRows.length === 0) {
      this.snackBar.open('Please select at least one row to generate output', 'Close', { duration: 3000 });
      return;
    }

    if (!this.templateWorkbook) {
      this.snackBar.open('Template file not loaded. Please refresh the page.', 'Close', { duration: 3000 });
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.showConfirmationDialog(selectedRows.length);
    if (!confirmed) {
      return;
    }

    this.isLoading = true;
    try {
      // Find the target sheet (one with "concept" in the name)
      let targetSheetName = this.templateWorkbook.SheetNames[0];
      let templateSheet = this.templateWorkbook.Sheets[targetSheetName];
      
      // Try to find a sheet with "concept" in the name (case insensitive)
      for (const sheetName of this.templateWorkbook.SheetNames) {
        if (sheetName.toLowerCase().includes('concept')) {
          targetSheetName = sheetName;
          templateSheet = this.templateWorkbook.Sheets[sheetName];
          break;
        }
      }

      const templateData: any[][] = XLSX.utils.sheet_to_json(templateSheet, { header: 1, defval: '' });

      // Get template rows 2 and 3 (0-indexed: rows 1 and 2)
      const templateRow2 = templateData[1] || [];
      const templateRow3 = templateData[2] || [];

      // Create new workbook
      const newWorkbook = XLSX.utils.book_new();
      const newSheetData: any[][] = [];

      // Add header row if it exists
      if (templateData.length > 0) {
        newSheetData.push([...templateData[0]]);
      }

      // For each selected row, add two rows based on template rows 2 and 3
      for (const selectedRow of selectedRows) {
        // Create first row (substance row) based on template row 2
        const substanceRow = this.createSubstanceRow(templateRow2, templateData[0] || [], selectedRow.substanceName);
        newSheetData.push(substanceRow);

        // Create second row (product row) based on template row 3
        const productRow = this.createProductRow(templateRow3, templateData[0] || [], selectedRow.substanceName);
        newSheetData.push(productRow);
      }

      // Create worksheet from data for the target sheet
      const newWorksheet = XLSX.utils.aoa_to_sheet(newSheetData);

      // Copy all sheets from template to new workbook in the same order
      // Replace the target sheet with our modified version
      for (const sheetName of this.templateWorkbook.SheetNames) {
        if (sheetName === targetSheetName) {
          // Use our modified worksheet for the target sheet
          XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
        } else {
          // Copy other sheets as-is from template
          const sheetToCopy = this.templateWorkbook.Sheets[sheetName];
          XLSX.utils.book_append_sheet(newWorkbook, sheetToCopy, sheetName);
        }
      }

      // Generate file
      const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileName = `CRS_Batch_Request_${new Date().getTime()}.xlsx`;
      saveAs(blob, fileName);

      this.snackBar.open(`Generated file with ${selectedRows.length * 2} rows`, 'Close', { duration: 3000 });
    } catch (error: any) {
      this.error = error.message || 'Error generating output file';
      this.snackBar.open(this.error || 'Error generating output file', 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  createSubstanceRow(templateRow: any[], headers: any[], substanceName: string): any[] {
    // Create a copy of the template row
    const row = [...templateRow];
    
    // Find columns that should contain the substance name/INN
    const nameColumnIndices: number[] = [];
    headers.forEach((header, index) => {
      const headerStr = String(header || '').toLowerCase();
      if (headerStr.includes('inn') || headerStr.includes('name') || headerStr.includes('substance')) {
        nameColumnIndices.push(index);
      }
    });

    // Replace substance name in appropriate columns
    if (nameColumnIndices.length > 0) {
      nameColumnIndices.forEach(index => {
        if (index < row.length) {
          row[index] = substanceName;
        }
      });
    } else {
      // Fallback: try column A (index 0) or first few columns
      for (let i = 0; i < Math.min(5, row.length); i++) {
        const cellValue = String(row[i] || '').toLowerCase();
        if (cellValue.includes('example') || cellValue.includes('inn') || cellValue === '') {
          row[i] = substanceName;
          break;
        }
      }
    }

    // For first row, set column H (Preferred Term, index 7) equal to column F (FSN, index 5)
    if (row.length > 7 && row.length > 5) {
      row[7] = row[5];
    }

    // Column J (index 9) - ParentId (105590001 for substances)
    if (row.length > 9) {
      row[9] = '105590001';
    }

    return row;
  }

  createProductRow(templateRow: any[], headers: any[], substanceName: string): any[] {
    // Create a copy of the template row
    const row = [...templateRow];
    
    // Find columns that should contain the substance name/INN (excluding special columns)
    const nameColumnIndices: number[] = [];
    const excludedIndices = new Set<number>([5, 7, 9, 18]); // F, H, J, S
    
    headers.forEach((header, index) => {
      const headerStr = String(header || '').toLowerCase();
      if (headerStr.includes('inn') || headerStr.includes('name') || headerStr.includes('substance')) {
        nameColumnIndices.push(index);
      }
    });

    // Replace substance name in appropriate columns (excluding special columns)
    if (nameColumnIndices.length > 0) {
      nameColumnIndices.forEach(index => {
        if (index < row.length && !excludedIndices.has(index)) {
          row[index] = substanceName;
        }
      });
    } else {
      // Fallback: try column A (index 0) or first few columns
      for (let i = 0; i < Math.min(5, row.length); i++) {
        if (excludedIndices.has(i)) continue;
        const cellValue = String(row[i] || '').toLowerCase();
        if (cellValue.includes('example') || cellValue.includes('inn') || cellValue === '') {
          row[i] = substanceName;
          break;
        }
      }
    }

    // Set all product row values correctly from the start
    const substanceNameLowercase = substanceName.charAt(0).toLowerCase() + substanceName.slice(1);
    const productContainingText = `Product containing ${substanceNameLowercase}`;
    const containingProductText = `${substanceName}-containing product`;

    // Column G (index 6) - Semantic tag should be "medicinal product"
    if (row.length > 6) {
      row[6] = 'medicinal product';
    }
    
    // Column F (index 5) - FSN (Fully Specified Name)
    if (row.length > 5) {
      row[5] = productContainingText;
    }
    
    // Column H (index 7) - Preferred Term (format: "XXX-containing product")
    if (row.length > 7) {
      row[7] = containingProductText;
    }
    
    // Column J (index 9) - ParentId (763158003 for products)
    if (row.length > 9) {
      row[9] = '763158003';
    }
    
    // Column S (index 18) - Synonym (should be cleared)
    if (row.length > 18) {
      row[18] = '';
    }

    return row;
  }

  showConfirmationDialog(selectedCount: number): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Generation',
        message: `Generate CRS request spreadsheet for ${selectedCount} selected substance(s)? This will create ${selectedCount * 2} rows in the output file.`
      }
    });

    return dialogRef.afterClosed().toPromise().then(result => result === true);
  }
}
