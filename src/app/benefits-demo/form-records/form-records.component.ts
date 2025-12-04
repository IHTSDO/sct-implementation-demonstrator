import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PatientService, QuestionnaireResponse, OpenEHRComposition } from '../../services/patient.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

export type FormRecord = QuestionnaireResponse | OpenEHRComposition;

@Component({
  selector: 'app-form-records',
  templateUrl: './form-records.component.html',
  styleUrls: ['./form-records.component.css'],
  standalone: false
})
export class FormRecordsComponent implements OnChanges {
  @Input() patientId: string | null = null;
  
  questionnaireResponses: QuestionnaireResponse[] = [];
  openehrCompositions: OpenEHRComposition[] = [];
  allFormRecords: FormRecord[] = [];
  isLoading: boolean = false;
  selectedResponse: FormRecord | null = null;
  isFlipped: boolean = false;

  constructor(
    private patientService: PatientService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] && this.patientId) {
      this.loadAllFormRecords();
    }
  }

  // Public method to refresh the list (can be called from parent)
  refresh(): void {
    this.loadAllFormRecords();
  }

  loadAllFormRecords(): void {
    if (!this.patientId) {
      this.questionnaireResponses = [];
      this.openehrCompositions = [];
      this.allFormRecords = [];
      return;
    }

    this.isLoading = true;
    try {
      // Load both questionnaire responses and openEHR compositions
      this.questionnaireResponses = this.patientService.getPatientQuestionnaireResponses(this.patientId);
      this.openehrCompositions = this.patientService.getPatientOpenEHRCompositions(this.patientId);
      
      // Combine and sort by date, most recent first
      this.allFormRecords = [
        ...this.questionnaireResponses,
        ...this.openehrCompositions
      ].sort((a, b) => {
        const dateA = new Date((a as any).authored || 0).getTime();
        const dateB = new Date((b as any).authored || 0).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error loading form records:', error);
      this.snackBar.open(
        'Error loading form records',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    } finally {
      this.isLoading = false;
    }
  }

  loadQuestionnaireResponses(): void {
    // Keep for backward compatibility, but use loadAllFormRecords
    this.loadAllFormRecords();
  }

  viewResponse(response: FormRecord): void {
    this.selectedResponse = response;
    this.isFlipped = false; // Reset to front view when opening
  }

  isOpenEHRComposition(record: FormRecord): record is OpenEHRComposition {
    return record.resourceType === 'OpenEHRComposition';
  }

  isQuestionnaireResponse(record: FormRecord): record is QuestionnaireResponse {
    return record.resourceType === 'QuestionnaireResponse';
  }

  closeViewer(): void {
    this.selectedResponse = null;
    this.isFlipped = false;
  }

  flipCard(): void {
    this.isFlipped = !this.isFlipped;
  }

  deleteResponse(response: FormRecord, event: Event): void {
    event.stopPropagation();
    
    if (!this.patientId) return;

    const recordName = this.isOpenEHRComposition(response) 
      ? (response.compositionName || 'openEHR composition')
      : (response.questionnaireName || 'questionnaire');

    const confirmDelete = confirm(
      `Are you sure you want to delete this "${recordName}"?`
    );

    if (confirmDelete) {
      if (this.isOpenEHRComposition(response)) {
        this.patientService.deletePatientOpenEHRComposition(this.patientId, response.id);
      } else {
        this.patientService.deletePatientQuestionnaireResponse(this.patientId, response.id);
      }
      this.loadAllFormRecords();
      
      this.snackBar.open(
        'Form record deleted successfully',
        'Close',
        {
          duration: 3000,
          panelClass: ['success-snackbar']
        }
      );

      // Close viewer if this was the selected response
      if (this.selectedResponse?.id === response.id) {
        this.closeViewer();
      }
    }
  }

  exportResponse(response: FormRecord, event: Event): void {
    event.stopPropagation();
    
    try {
      const dataStr = JSON.stringify(response, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const filename = this.isOpenEHRComposition(response)
        ? `openehr-composition-${response.id}.json`
        : `questionnaire-response-${response.id}.json`;
      
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      this.snackBar.open(
        'Form record exported successfully',
        'Close',
        {
          duration: 3000,
          panelClass: ['success-snackbar']
        }
      );
    } catch (error) {
      console.error('Error exporting response:', error);
      this.snackBar.open(
        'Error exporting form record',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  }

  getFormTypeIcon(response: FormRecord): string {
    if (this.isOpenEHRComposition(response)) {
      return 'storage';
    }
    
    const name = (response.questionnaireName || '').toLowerCase();
    
    if (name.includes('phq') || name.includes('depression')) {
      return 'psychology';
    } else if (name.includes('gad') || name.includes('anxiety')) {
      return 'psychology_alt';
    } else if (name.includes('carcinoma') || name.includes('histopathology')) {
      return 'science';
    }
    
    return 'description';
  }

  getFormTypeColor(response: FormRecord): string {
    if (this.isOpenEHRComposition(response)) {
      return 'primary'; // Blue for openEHR
    }
    
    const name = (response.questionnaireName || '').toLowerCase();
    
    if (name.includes('phq') || name.includes('depression')) {
      return 'primary';
    } else if (name.includes('gad') || name.includes('anxiety')) {
      return 'accent';
    } else if (name.includes('carcinoma') || name.includes('histopathology')) {
      return 'warn';
    }
    
    return '';
  }

  getFormRecordName(response: FormRecord): string {
    if (this.isOpenEHRComposition(response)) {
      return response.compositionName || response.templateName || 'openEHR Composition';
    }
    return response.questionnaireName || response.questionnaireTitle || 'Questionnaire';
  }

  getFormRecordType(response: FormRecord): string {
    if (this.isOpenEHRComposition(response)) {
      return 'openEHR';
    }
    return 'FHIR';
  }

  // Format response data for display
  getResponseSummary(response: FormRecord): string {
    if (this.isOpenEHRComposition(response)) {
      // Count fields in the composition
      const composition = response.composition;
      if (composition && typeof composition === 'object') {
        const keys = Object.keys(composition).filter(k => 
          k !== 'ctx' && composition[k] !== null && composition[k] !== undefined
        );
        return `${keys.length} field(s) completed`;
      }
      return 'openEHR Composition';
    }
    
    try {
      const completeData = (response as any)._completeData;
      if (completeData?.response) {
        const itemCount = this.countAnsweredItems(completeData.response);
        return `${itemCount} items answered`;
      }
      return 'Completed';
    } catch {
      return 'Completed';
    }
  }

  private countAnsweredItems(data: any): number {
    let count = 0;
    
    const countItems = (items: any[]) => {
      if (!items || !Array.isArray(items)) return;
      
      for (const item of items) {
        if (item.value !== undefined && item.value !== null && item.value !== '') {
          count++;
        }
        if (item.items && Array.isArray(item.items)) {
          countItems(item.items);
        }
      }
    };
    
    if (data.items) {
      countItems(data.items);
    }
    
    return count;
  }

  // Get readable question/answer pairs from response
  getQuestionAnswerPairs(response: FormRecord): Array<{
    question: string, 
    answer: string, 
    type: string,
    level: number,
    isSection: boolean,
    hasSubItems: boolean
  }> {
    const pairs: Array<{
      question: string, 
      answer: string, 
      type: string,
      level: number,
      isSection: boolean,
      hasSubItems: boolean
    }> = [];
    
    // Handle openEHR compositions
    if (this.isOpenEHRComposition(response)) {
      const composition = response.composition;
      if (composition && typeof composition === 'object') {
        // Extract fields from FLAT format composition
        Object.keys(composition).forEach(key => {
          if (key !== 'ctx' && composition[key] !== null && composition[key] !== undefined) {
            const value = composition[key];
            const fieldName = this.formatFieldName(key);
            const fieldValue = this.formatCompositionValue(value);
            
            pairs.push({
              question: fieldName,
              answer: fieldValue,
              type: typeof value === 'object' ? 'object' : typeof value,
              level: 0,
              isSection: false,
              hasSubItems: false
            });
          }
        });
      }
      return pairs;
    }
    
    // Handle FHIR QuestionnaireResponse
    try {
      const completeData = (response as any)._completeData;
      // Try different data locations
      let items = null;
      if (completeData?.response?.items) {
        items = completeData.response.items;
      } else if ((response as any).item) {
        items = (response as any).item;
      } else if ((response as any).items) {
        items = (response as any).items;
      }
      
      if (items) {
        this.extractQAPairs(items, pairs);
      }
    } catch (error) {
      console.error('Error extracting Q&A pairs:', error);
    }
    
    return pairs;
  }

  private formatFieldName(key: string): string {
    // Convert FLAT format path to readable name
    return key
      .replace(/\//g, ' / ')
      .replace(/\[at\d+\]/g, '')
      .replace(/\[0\]/g, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatCompositionValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => this.formatCompositionValue(v)).join(', ');
      }
      // Try to extract meaningful display value
      if (value.value !== undefined) {
        return String(value.value) + (value.unit ? ` ${value.unit}` : '');
      }
      if (value.text) {
        return value.text;
      }
      if (value.display) {
        return value.display;
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  private extractQAPairs(items: any[], pairs: Array<{
    question: string, 
    answer: string, 
    type: string,
    level: number,
    isSection: boolean,
    hasSubItems: boolean
  }>, level: number = 0): void {
    if (!items || !Array.isArray(items)) return;
    
    for (const item of items) {
      const hasSubItems = item.items && Array.isArray(item.items) && item.items.length > 0;
      const isSection = hasSubItems && (item.value === undefined || item.value === null || item.value === '');
      
      // Only add if there's a question
      if (item.question || item.text) {
        const questionText = item.question || item.text || 'Untitled';
        let answer = '';
        let type = 'text';
        
        // Extract answer based on type
        if (item.value !== undefined && item.value !== null && item.value !== '') {
          answer = this.formatAnswerValue(item.value, item);
          type = this.determineAnswerType(item.value, item);
        } else if (isSection) {
          // Section header
          answer = `Section with ${item.items.length} sub-item${item.items.length > 1 ? 's' : ''}`;
          type = 'section';
        }
        
        // Add the pair
        pairs.push({
          question: questionText,
          answer: answer,
          type: type,
          level: level,
          isSection: isSection,
          hasSubItems: hasSubItems
        });
      }
      
      // Recursively process nested items
      if (item.items && Array.isArray(item.items)) {
        this.extractQAPairs(item.items, pairs, level + 1);
      }
    }
  }

  private formatAnswerValue(value: any, item: any): string {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'object') {
      // Handle array values first
      if (Array.isArray(value)) {
        return value.map(v => this.formatAnswerValue(v, item)).join(', ');
      }
      
      // Handle simple objects with text/display property (e.g., { text: "femenino" })
      // Check this BEFORE checking for coding/code to prioritize simple text objects
      if (value.text && !value.code && !value.coding && !value.value) {
        return value.text;
      }
      
      if (value.display && !value.code && !value.coding && !value.value) {
        return value.display;
      }
      
      // Handle Coding/CodeableConcept
      if (value.coding || value.code) {
        const coding = Array.isArray(value.coding) ? value.coding[0] : value;
        const display = coding.display || coding.text || '';
        const code = coding.code || '';
        const system = coding.system || '';
        
        if (display && code) {
          const systemName = this.getSystemDisplayName(system);
          return `${display} [${code}${systemName ? ` - ${systemName}` : ''}]`;
        } else if (code) {
          return code;
        } else if (display) {
          return display;
        }
      }
      
      // Handle Quantity
      if (value.value !== undefined) {
        let result = value.value.toString();
        if (value.unit) {
          result += ' ' + value.unit;
        }
        return result;
      }
      
      // Fallback - try to extract any readable property
      // Check text/display even if there are other properties
      if (value.text) return value.text;
      if (value.display) return value.display;
      
      // Last resort: show as JSON but only if it's a simple object
      const keys = Object.keys(value);
      if (keys.length <= 3) {
        // For simple objects, try to show a readable format
        if (keys.length === 1 && keys[0] === 'text') {
          return value.text;
        }
        if (keys.length === 1 && keys[0] === 'display') {
          return value.display;
        }
        // If it's a simple object with text as one of the keys, prefer text
        if (keys.includes('text') && keys.length <= 2) {
          return value.text;
        }
      }
      
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  private determineAnswerType(value: any, item: any): string {
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    
    if (typeof value === 'number') {
      return 'number';
    }
    
    if (typeof value === 'object') {
      if (value.coding || value.code) {
        return 'choice';
      }
      if (value.value !== undefined) {
        return 'number';
      }
    }
    
    return 'text';
  }

  private getSystemDisplayName(system: string): string {
    const systemMap: { [key: string]: string } = {
      'http://snomed.info/sct': 'SNOMED CT',
      'http://hl7.org/fhir/sid/icf': 'ICF',
      'http://loinc.org': 'LOINC',
      'http://unitsofmeasure.org': 'UCUM'
    };
    return systemMap[system] || '';
  }

  formatAnswerForDisplay(answer: string): string {
    // Escape HTML and highlight codes/systems
    const escaped = answer
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Highlight codes in brackets [code]
    return escaped.replace(
      /\[([^\]]+)\]/g, 
      '<span class="code-highlight">[$1]</span>'
    );
  }

  formatJSON(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  copyToClipboard(response: FormRecord, event: Event): void {
    event.stopPropagation();
    
    try {
      const dataStr = JSON.stringify(response, null, 2);
      
      // Use the Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(dataStr).then(() => {
          this.snackBar.open(
            'JSON copied to clipboard successfully',
            'Close',
            {
              duration: 3000,
              panelClass: ['success-snackbar']
            }
          );
        }).catch((err) => {
          console.error('Error copying to clipboard:', err);
          this.fallbackCopyToClipboard(dataStr);
        });
      } else {
        // Fallback for older browsers
        this.fallbackCopyToClipboard(dataStr);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.snackBar.open(
        'Error copying to clipboard',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.snackBar.open(
          'JSON copied to clipboard successfully',
          'Close',
          {
            duration: 3000,
            panelClass: ['success-snackbar']
          }
        );
      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.snackBar.open(
        'Error copying to clipboard. Please copy manually.',
        'Close',
        {
          duration: 4000,
          panelClass: ['error-snackbar']
        }
      );
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
