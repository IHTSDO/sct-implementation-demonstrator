import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface IntegrationData {
  id: string;
  section: string;
  label: string;
  description: string;
  annotationValue: string;
  refsetIds: string[];
  type: 'content' | 'map' | 'extension' | 'refset';
}

@Injectable({
  providedIn: 'root'
})
export class SpreadsheetService {
  private readonly BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJpQfY5_9-BFPHHG13MbSJJKqqnrcKr_FIepQ5ieUaNoQt9YKjJdb-_MO-KAChQoavgcj_ZsxYXZHS/pub?gid=0&single=true&output=csv';

  constructor(private http: HttpClient) {}

  getIntegrationsData(): Observable<IntegrationData[]> {
    // Add timestamp to prevent caching
    const url = `${this.BASE_URL}&_=${new Date().getTime()}`;
    
    return this.http.get(url, { 
      responseType: 'text',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }).pipe(
      map(csv => {
        const rows = csv.split('\n');
        if (rows.length < 2) return [];

        // Skip header row and map data
        return rows.slice(1).map(row => {
          // Split by comma but preserve commas within quotes
          const columns = this.parseCSVRow(row);
          
          return {
            id: columns[0] || '',
            section: columns[1] || '',
            label: columns[2] || '',
            description: columns[3] || '',
            annotationValue: columns[4] || '',
            refsetIds: this.parseRefsetIds(columns[5]),
            type: (columns[6] || '').toLowerCase() as 'content' | 'map' | 'extension' | 'refset'
          };
        });
      })
    );
  }

  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parseRefsetIds(refsetIdsStr: string): string[] {
    if (!refsetIdsStr) return [];
    
    // Remove any quotes and split by comma
    return refsetIdsStr
      .replace(/"/g, '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }
} 