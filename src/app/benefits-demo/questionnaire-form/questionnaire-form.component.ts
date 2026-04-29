import { Component, Input, OnChanges, SimpleChanges, EventEmitter, Output, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { SdcPopulationService } from '../../services/sdc-population.service';
import { FhirService } from '../../services/fhir.service';

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
  @Input() patientId: string | null = null;
  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCancelled = new EventEmitter<void>();

  formRendered = false;
  isPrePopulated = false;
  formContainerId = '';
  private lformsLoaded = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private sdcPopulationService: SdcPopulationService,
    private fhirService: FhirService
  ) {
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

  async renderForm(): Promise<void> {
    if (!this.questionnaire) {
      this.formRendered = false;
      return;
    }

    if (typeof LForms === 'undefined') {
      this.formRendered = false;
      return;
    }

    try {
      const container = document.getElementById(this.formContainerId);
      if (!container) {
        this.formRendered = false;
        return;
      }

      container.innerHTML = '';

      let populatedQR: any = null;
      if (this.patientId) {
        try {
          populatedQR = this.sdcPopulationService.populate(this.questionnaire, this.patientId);
        } catch {
          // Pre-population failure must never block form rendering
        }
      }

      setTimeout(() => {
        try {
          if (populatedQR) {
            // Merge approach: convert questionnaire to LForms internal format first,
            // then merge the QR into it before rendering. This is the correct LForms
            // API for pre-population — addFormToPage options do not apply QR answers.
            if (typeof LForms.Util.setFHIRContext === 'function') {
              LForms.Util.setFHIRContext({ baseUrl: this.fhirService.getBaseUrl() });
            }
            const lfData = LForms.Util.convertFHIRQuestionnaireToLForms(this.questionnaire, 'R4');
            const merged = LForms.Util.mergeFHIRDataIntoLForms('QuestionnaireResponse', populatedQR, lfData, 'R4');
            LForms.Util.addFormToPage(merged, this.formContainerId);
          } else {
            LForms.Util.addFormToPage(this.questionnaire, this.formContainerId);
          }
          this.formRendered = true;
          this.isPrePopulated = !!populatedQR;
          this.cdr.detectChanges();
        } catch (innerError) {
          // If merge/render fails, fall back to plain render without pre-population
          try {
            LForms.Util.addFormToPage(this.questionnaire, this.formContainerId);
            this.formRendered = true;
          } catch {
            this.formRendered = false;
          }
          this.isPrePopulated = false;
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
