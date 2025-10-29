import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { 
  FileType, 
  FileProcessingResult, 
  FileMetadata, 
  ColumnOption, 
  FileDetectionResult, 
  ColumnConfig,
  CodeItem 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class FileProcessingService {

  async processFile(file: File): Promise<FileProcessingResult> {
    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: this.detectFileTypeFromName(file.name),
      lastModified: new Date(file.lastModified)
    };

    try {
      const data = await this.readFileData(file);
      const detection = this.detectFileTypeFromData(data);
      
      return {
        type: metadata.type,
        data,
        columns: this.buildColumns(data),
        metadata,
        isMap: detection.isMap,
        isRf2Refset: detection.isRf2Refset,
        isValueSetFile: detection.isValueSetFile,
        isEclResult: false
      };
    } catch (error) {
      throw new Error(`Error processing file: ${error}`);
    }
  }

  private async readFileData(file: File): Promise<any[][]> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
      return this.processJsonFile(file);
    } else if (name.endsWith('.tsv') || name.endsWith('.txt')) {
      return this.processTextFile(file);
    } else if (name.endsWith('.csv')) {
      return this.processCsvFile(file);
    } else {
      return this.processExcelFile(file);
    }
  }

  private async processJsonFile(file: File): Promise<any[][]> {
    const text = await file.text();
    const jsonContent = JSON.parse(text);
    
    if (this.isFhirValueSet(jsonContent)) {
      return this.extractValueSetData(jsonContent);
    }
    
    throw new Error('Invalid JSON file format');
  }

  private async processTextFile(file: File): Promise<any[][]> {
    const text = await file.text();
    const isTsv = text.includes('\t');
    
    if (isTsv) {
      return text.split(/\r?\n/)
        .filter(line => line.trim())
        .map(row => row.split('\t').map(cell => cell.trim()));
    } else {
      return text.split(/\r?\n/)
        .filter(line => line.trim())
        .map(row => [row.trim()]);
    }
  }

  private async processCsvFile(file: File): Promise<any[][]> {
    const text = await file.text();
    const wb = XLSX.read(text, { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1 });
  }

  private async processExcelFile(file: File): Promise<any[][]> {
    const buf = await file.arrayBuffer();
    const view = new Uint8Array(buf);

    // Validate ZIP signature for XLSX files
    if (!(view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04)) {
      throw new Error('Not a valid XLSX file - wrong signature');
    }

    if (buf.byteLength !== file.size) {
      throw new Error(`ArrayBuffer truncated (${buf.byteLength} ≠ ${file.size})`);
    }

    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1 });
  }

  private detectFileTypeFromName(fileName: string): FileType {
    const name = fileName.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') || name.endsWith('.xlsb')) {
      return FileType.EXCEL;
    } else if (name.endsWith('.csv')) {
      return FileType.CSV;
    } else if (name.endsWith('.tsv')) {
      return FileType.TSV;
    } else if (name.endsWith('.json')) {
      return FileType.JSON;
    } else if (name.endsWith('.txt')) {
      return FileType.TXT;
    }
    return FileType.UNKNOWN;
  }

  private detectFileTypeFromData(data: any[][]): FileDetectionResult {
    if (!data.length) {
      return { isMap: false, isRf2Refset: false, isValueSetFile: false, suggestedColumns: {} };
    }

    const headers = data[0].map((h: string) => h.toLowerCase());
    
    // Check for map files
    const isMap = headers.some((h: string) => h.includes('source')) && 
                  headers.some((h: string) => h.includes('target'));
    
    // Check for RF2 refset files
    const rf2Headers = ['id', 'effectivetime', 'active', 'moduleid', 'refsetid', 'referencedcomponentid'];
    const isRf2Refset = rf2Headers.every((header: string) => 
      headers.some((h: string) => h === header)
    );

    // Check for ValueSet files (this would be detected earlier in JSON processing)
    const isValueSetFile = false; // This is handled in JSON processing

    const suggestedColumns = this.suggestColumns(data, isMap, isRf2Refset);

    return {
      isMap,
      isRf2Refset,
      isValueSetFile,
      suggestedColumns
    };
  }

  private suggestColumns(data: any[][], isMap: boolean, isRf2Refset: boolean): Partial<ColumnConfig> {
    if (!data.length || data.length < 2) {
      return {};
    }

    const headers = data[0].map((h: string) => h.toLowerCase());
    const dataRow = data[1];

    if (isMap) {
      const targetCodeCol = headers.findIndex((h: string) => h.includes('target code'));
      const targetDisplayCol = headers.findIndex((h: string) => h.includes('target display'));
      
      return {
        codeColumn: targetCodeCol !== -1 ? targetCodeCol : 0,
        displayColumn: targetDisplayCol !== -1 ? targetDisplayCol : null
      };
    }

    if (isRf2Refset) {
      const refsetCodeCol = headers.findIndex((h: string) => h === 'referencedcomponentid');
      return {
        codeColumn: refsetCodeCol !== -1 ? refsetCodeCol : 0,
        displayColumn: null
      };
    }

    // For simple spreadsheets, guess columns
    let codeColumn = -1;
    let displayColumn = -1;

    // Find first column with only numbers
    for (let i = 0; i < dataRow.length; i++) {
      const cellValue = String(dataRow[i] || '').trim();
      if (cellValue && /^\d+$/.test(cellValue)) {
        codeColumn = i;
        break;
      }
    }

    // Find first column with alphanumeric text
    for (let i = 0; i < dataRow.length; i++) {
      const cellValue = String(dataRow[i] || '').trim();
      const isAlphanumeric = /^[a-zA-Z0-9\s\-_\.\(\)]+$/i.test(cellValue);
      const isNotNumeric = !/^\d+$/.test(cellValue);
      if (cellValue && isAlphanumeric && isNotNumeric) {
        displayColumn = i;
        break;
      }
    }

    // Fallback to header-based guessing
    if (codeColumn === -1) {
      const codeHeaders = ['code', 'snomed code', 'id', 'concept id', 'snomed concept'];
      for (let i = 0; i < headers.length; i++) {
        if (codeHeaders.some(header => headers[i].includes(header))) {
          codeColumn = i;
          break;
        }
      }
    }

    if (displayColumn === -1) {
      const displayHeaders = ['term', 'display', 'name', 'description', 'snomed term', 'concept name'];
      for (let i = 0; i < headers.length; i++) {
        if (displayHeaders.some(header => headers[i].includes(header))) {
          displayColumn = i;
          break;
        }
      }
    }

    return {
      codeColumn: codeColumn !== -1 ? codeColumn : null,
      displayColumn: displayColumn !== -1 ? displayColumn : null
    };
  }

  private buildColumns(data: any[][]): ColumnOption[] {
    if (!data.length) return [];
    
    return data[0].map((header: string, index: number) => ({
      header: header || `Column ${index + 1}`,
      index
    }));
  }

  private isFhirValueSet(json: any): boolean {
    return json.resourceType === 'ValueSet' || 
           (json.resourceType === 'Parameters' && json.parameter?.some((p: any) => p.name === 'valueSet'));
  }

  private extractValueSetData(json: any): any[][] {
    // Extract ValueSet from Parameters if needed
    if (json.resourceType === 'Parameters') {
      const valueSetParam = json.parameter?.find((p: any) => p.name === 'valueSet');
      if (valueSetParam?.resource) {
        json = valueSetParam.resource;
      }
    }

    const concepts = json.compose?.include?.[0]?.concept || [];
    return [
      ['Code', 'Display', 'System'], // Headers
      ...concepts.map((concept: any) => [
        concept.code || '',
        concept.display || '',
        json.compose?.include?.[0]?.system || ''
      ])
    ];
  }

  extractCodesFromData(data: any[][], config: ColumnConfig): CodeItem[] {
    if (!data.length) return [];

    const startIndex = config.skipHeader ? 1 : 0;
    
    return data.slice(startIndex)
      .map(row => {
        const code = String(row[config.codeColumn!] || '').trim();
        const display = config.displayColumn !== null && config.displayColumn !== undefined ? 
          String(row[config.displayColumn] || '').trim() : undefined;
        return { code, display };
      })
      .filter(item => item.code && item.code !== '');
  }

  async readExcelFile(file: File): Promise<any[]> {
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
}
