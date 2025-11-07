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
  getQuestionAnswerPairs(response: QuestionnaireResponse): Array<{question: string, answer: string, type: string}> {
    const pairs: Array<{question: string, answer: string, type: string}> = [];
    
    try {
      const completeData = (response as any)._completeData;
      if (completeData?.response?.items) {
        this.extractQAPairs(completeData.response.items, pairs);
      }
    } catch (error) {
      console.error('Error extracting Q&A pairs:', error);
    }
    
    return pairs;
  }

  private extractQAPairs(items: any[], pairs: Array<{question: string, answer: string, type: string}>, level: number = 0): void {
    if (!items || !Array.isArray(items)) return;
    
    for (const item of items) {
      // Only add if there's a question and an answer
      if (item.question) {
        let answer = '';
        let type = 'text';
        
        // Extract answer based on type
        if (item.value !== undefined && item.value !== null && item.value !== '') {
          if (typeof item.value === 'object') {
            // Handle coded values (Coding datatype)
            // Check for both 'display' and 'text' fields (different standards use different names)
            const displayText = item.value.display || item.value.text;
            
            if (item.value.code && displayText) {
              // Show both text/display and code for coded values
              answer = `${displayText} [${item.value.code}]`;
              type = 'choice';
            } else if (item.value.code) {
              // Only code available
              answer = item.value.code;
              type = 'choice';
            } else if (displayText) {
              // Only display/text available
              answer = displayText;
              type = 'choice';
            } else if (item.value.value !== undefined) {
              // Quantity datatype
              answer = item.value.value.toString();
              type = item.value.unit ? 'quantity' : 'text';
              if (item.value.unit) {
                answer += ' ' + item.value.unit;
              }
            } else {
              // Fallback for other object types
              answer = JSON.stringify(item.value);
            }
          } else if (typeof item.value === 'boolean') {
            answer = item.value ? 'Yes' : 'No';
            type = 'boolean';
          } else {
            // Simple text value - just show the value
            answer = item.value.toString();
            type = 'text';
          }
        } else if (item.items && item.items.length > 0) {
          // If no direct answer but has sub-items, it's a group
          type = 'group';
          answer = `(${item.items.length} sub-items)`;
        }
        
        // Add the pair if we have an answer
        if (answer) {
          pairs.push({
            question: item.question,
            answer: answer,
            type: type
          });
        }
      }
      
      // Recursively process nested items
      if (item.items && Array.isArray(item.items)) {
        this.extractQAPairs(item.items, pairs, level + 1);
      }
    }
  }
}
