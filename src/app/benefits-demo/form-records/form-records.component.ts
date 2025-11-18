import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PatientService, QuestionnaireResponse } from '../../services/patient.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-form-records',
  templateUrl: './form-records.component.html',
  styleUrls: ['./form-records.component.css'],
  standalone: false
})
export class FormRecordsComponent implements OnChanges {
  @Input() patientId: string | null = null;
  
  questionnaireResponses: QuestionnaireResponse[] = [];
  isLoading: boolean = false;
  selectedResponse: QuestionnaireResponse | null = null;
  isFlipped: boolean = false;

  constructor(
    private patientService: PatientService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] && this.patientId) {
      this.loadQuestionnaireResponses();
    }
  }

  // Public method to refresh the list (can be called from parent)
  refresh(): void {
    this.loadQuestionnaireResponses();
  }

  loadQuestionnaireResponses(): void {
    if (!this.patientId) {
      this.questionnaireResponses = [];
      return;
    }

    this.isLoading = true;
    try {
      this.questionnaireResponses = this.patientService.getPatientQuestionnaireResponses(this.patientId);
      // Sort by date, most recent first
      this.questionnaireResponses.sort((a, b) => {
        const dateA = new Date(a.authored || 0).getTime();
        const dateB = new Date(b.authored || 0).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error loading questionnaire responses:', error);
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

  viewResponse(response: QuestionnaireResponse): void {
    this.selectedResponse = response;
    this.isFlipped = false; // Reset to front view when opening
  }

  closeViewer(): void {
    this.selectedResponse = null;
    this.isFlipped = false;
  }

  flipCard(): void {
    this.isFlipped = !this.isFlipped;
  }

  deleteResponse(response: QuestionnaireResponse, event: Event): void {
    event.stopPropagation();
    
    if (!this.patientId) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete this "${response.questionnaireName || 'questionnaire'}" response?`
    );

    if (confirmDelete) {
      this.patientService.deletePatientQuestionnaireResponse(this.patientId, response.id);
      this.loadQuestionnaireResponses();
      
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

  exportResponse(response: QuestionnaireResponse, event: Event): void {
    event.stopPropagation();
    
    try {
      const dataStr = JSON.stringify(response, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `questionnaire-response-${response.id}.json`;
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

  getFormTypeIcon(response: QuestionnaireResponse): string {
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

  getFormTypeColor(response: QuestionnaireResponse): string {
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

  // Format response data for display
  getResponseSummary(response: QuestionnaireResponse): string {
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
  getQuestionAnswerPairs(response: QuestionnaireResponse): Array<{
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

  copyToClipboard(response: QuestionnaireResponse, event: Event): void {
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
