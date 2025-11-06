import { Component, Input, OnChanges, SimpleChanges, EventEmitter, Output, AfterViewInit, ChangeDetectorRef } from '@angular/core';

declare var LForms: any;

@Component({
  selector: 'app-questionnaire-form',
  templateUrl: './questionnaire-form.component.html',
  styleUrls: ['./questionnaire-form.component.css'],
  standalone: false
})
export class QuestionnaireFormComponent implements OnChanges, AfterViewInit {
  @Input() questionnaire: any = null;
  @Input() questionnaireId: string = '';
  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCancelled = new EventEmitter<void>();

  formRendered = false;
  formContainerId = '';
  private lformsLoaded = false;

  constructor(private cdr: ChangeDetectorRef) {
    // Generate unique container ID for this component instance
    this.formContainerId = `questionnaire-form-${Math.random().toString(36).substr(2, 9)}`;
    // Load LForms library if not already loaded
    this.loadLFormsLibrary();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionnaire'] && this.questionnaire) {
      // Use setTimeout to ensure DOM is ready, matching the pattern from questionnaires-main
      setTimeout(() => this.renderForm(), 300);
    }
  }

  ngAfterViewInit(): void {
    if (this.questionnaire) {
      setTimeout(() => this.renderForm(), 300);
    }
  }

  private loadLFormsLibrary(): void {
    // Check if LForms is already loaded
    if (typeof LForms !== 'undefined') {
      this.lformsLoaded = true;
      return;
    }

    // Load LForms library dynamically
    const script = document.createElement('script');
    script.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/36.3.2/webcomponent/lhc-forms.js';
    script.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://clinicaltables.nlm.nih.gov/lforms-versions/36.3.2/fhir/R4/lformsFHIR.min.js';
      script2.onload = () => {
        this.lformsLoaded = true;
        // Re-render if questionnaire is already available
        if (this.questionnaire) {
          setTimeout(() => this.renderForm(), 300);
        }
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script);
  }

  renderForm(): void {
    if (!this.questionnaire) {
      this.formRendered = false;
      return;
    }

    if (typeof LForms === 'undefined') {
      this.formRendered = false;
      return;
    }

    try {
      // Check if container exists
      const container = document.getElementById(this.formContainerId);
      if (!container) {
        this.formRendered = false;
        return;
      }
      
      // Clear any existing form first
      container.innerHTML = '';
      
      // Render the questionnaire using LForms
      // Use setTimeout to ensure the container is fully cleared
      setTimeout(() => {
        try {
          LForms.Util.addFormToPage(this.questionnaire, this.formContainerId);
          this.formRendered = true;
          // Trigger change detection to update the view
          this.cdr.detectChanges();
        } catch (innerError) {
          this.formRendered = false;
          this.cdr.detectChanges();
        }
      }, 100);
    } catch (error) {
      this.formRendered = false;
    }
  }

  submitForm(): void {
    if (this.formRendered && typeof LForms !== 'undefined') {
      try {
        // Get the form data as QuestionnaireResponse
        const formData = LForms.Util.getFormData(this.formContainerId, true, true, true);
        
        // Emit the completed QuestionnaireResponse
        this.formSubmitted.emit({
          type: 'questionnaire-response',
          questionnaire: this.questionnaire,
          response: formData,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting form data:', error);
      }
    }
  }

  cancel(): void {
    this.formCancelled.emit();
  }

  getFormContainerId(): string {
    return this.formContainerId;
  }
}
