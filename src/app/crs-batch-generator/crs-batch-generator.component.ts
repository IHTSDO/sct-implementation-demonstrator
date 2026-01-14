import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { ConfirmationDialogComponent } from '../questionnaires/confirmation-dialog/confirmation-dialog.component';

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
  displayedColumns: string[] = ['select', 'substanceName', 'substanceType', 'date'];
  isLoading = false;
  error: string | null = null;
  templateWorkbook: XLSX.WorkBook | null = null;
  headerRowIndex: number = -1;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private http: HttpClient
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
        throw new Error('Could not find header row. Expected column H header.');
      }

      // Debug: Log header row and first few data rows
      console.log('Header row index:', this.headerRowIndex);
      console.log('Header row:', data[this.headerRowIndex]);
      if (data.length > this.headerRowIndex + 1) {
        console.log('First data row:', data[this.headerRowIndex + 1]);
      }

      // Filter rows
      const filtered = this.applyFilters(data, startDate, endDate);
      console.log('Filtered rows before deduplication:', filtered.length);
      
      // Deduplicate by substance name (column A)
      this.filteredRows = this.deduplicateRows(filtered);
      console.log('Filtered rows after deduplication:', this.filteredRows.length);

      this.snackBar.open(`Found ${this.filteredRows.length} unique rows matching criteria`, 'Close', { duration: 3000 });
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
    let rowsWithN = 0;
    let rowsWithValidDates = 0;

    console.log('Filtering with date range:', startDate, 'to', endDate);

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 12) continue;

      const colH = String(row[7] || '').trim().toUpperCase(); // Column H (0-indexed = 7)
      
      if (colH !== 'N') {
        continue;
      }
      rowsWithN++;

      const colA = String(row[0] || '').trim(); // Column A (substance name)
      const colB = String(row[1] || '').trim(); // Column B (indication)
      const colC = String(row[2] || '').trim(); // Column C (substance type)
      const colK = row[10]; // Column K (start date, 0-indexed = 10) - may be number or string
      const colL = row[11]; // Column L (restart date, 0-indexed = 11) - may be number or string

      // Parse dates (can be Excel serial numbers or formatted strings)
      const startDateParsed = this.parseDate(colK);
      const restartDateParsed = this.parseDate(colL);

      // Determine latest date
      let latestDate: Date | null = null;
      if (startDateParsed && restartDateParsed) {
        latestDate = startDateParsed > restartDateParsed ? startDateParsed : restartDateParsed;
      } else if (startDateParsed) {
        latestDate = startDateParsed;
      } else if (restartDateParsed) {
        latestDate = restartDateParsed;
      }

      // Check if start date OR restart date falls within range
      const startInRange = startDateParsed && this.isDateInRange(startDateParsed, startDate, endDate);
      const restartInRange = restartDateParsed && this.isDateInRange(restartDateParsed, startDate, endDate);

      if (startDateParsed || restartDateParsed) {
        rowsWithValidDates++;
      }

      if (startInRange || restartInRange) {
        filtered.push({
          substanceName: colA,
          indication: colB,
          substanceType: colC,
          includeFlag: colH,
          startDate: startDateParsed,
          restartDate: restartDateParsed,
          latestDate: latestDate,
          latestDateDisplay: latestDate ? this.formatDate(latestDate) : '',
          selected: true, // Default to selected
          originalRowIndex: i
        });
      }
    }

    console.log('Rows with H=N:', rowsWithN);
    console.log('Rows with valid dates:', rowsWithValidDates);
    console.log('Rows in date range:', filtered.length);

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
        // Create row based on template row 2
        const newRow2 = [...templateRow2];
        // Replace INN/substance name (find the column that contains "INN" or similar in header)
        this.replaceSubstanceName(newRow2, templateData[0] || [], selectedRow.substanceName);
        // For first row, set column H (Preferred Term) equal to column F (FSN)
        if (newRow2.length > 7 && newRow2.length > 5) {
          newRow2[7] = newRow2[5];
        }
        newSheetData.push(newRow2);

        // Create row based on template row 3
        const newRow3 = [...templateRow3];
        // For the second row, replace FSN in column F with "Product containing X"
        this.replaceSubstanceName(newRow3, templateData[0] || [], selectedRow.substanceName, true);
        newSheetData.push(newRow3);
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

  replaceSubstanceName(row: any[], headers: any[], substanceName: string, isSecondRow: boolean = false): void {
    // Find the column index that likely contains the substance name/INN
    // Look for headers containing "INN", "name", "substance", etc.
    const nameColumnIndices: number[] = [];
    const excludedIndices = new Set<number>();
    
    headers.forEach((header, index) => {
      const headerStr = String(header || '').toLowerCase();
      if (headerStr.includes('inn') || headerStr.includes('name') || headerStr.includes('substance')) {
        nameColumnIndices.push(index);
      }
    });

    // For second row, exclude column F (index 5) from name replacement and set special values
    if (isSecondRow) {
      excludedIndices.add(5); // Column F - will be set separately
      excludedIndices.add(7); // Column H - will be set separately
      excludedIndices.add(18); // Column S - will be set separately
    }

    // If we found likely columns, replace them (but exclude special columns for second row)
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

    // For second row, set FSN (column F, index 5) and Preferred Term (column H, index 7) after name replacement
    if (isSecondRow) {
      const productContainingText = `Product containing ${substanceName}`;
      // Column F is index 5 (0-indexed) - FSN (Fully Specified Name)
      if (row.length > 5) {
        row[5] = productContainingText;
      }
      // Column H is index 7 (0-indexed) - Preferred Term
      if (row.length > 7) {
        row[7] = productContainingText;
      }
      // Column S is index 18 (0-indexed) - Synonym
      if (row.length > 18) {
        row[18] = substanceName;
      }
    }
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
