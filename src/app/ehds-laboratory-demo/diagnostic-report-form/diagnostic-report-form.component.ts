import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { EhdsLaboratoryFhirService, FhirDiagnosticReport } from '../../services/ehds-laboratory-fhir.service';
import { SpecimenFormComponent, SpecimenData } from '../specimen-form/specimen-form.component';
import { ValuesetDialogComponent } from '../valueset-dialog/valueset-dialog.component';

export interface DiagnosticReportData {
  // Identification & Status
  status: string;
  language?: string;
  identifier?: string;
  
  // Categorization
  category: {
    studyType?: {
      code: string;
      system: string;
      display: string;
    };
    specialty?: string;
  };
  
  // Report Type
  code: {
    code: string;
    system: string;
    display: string;
  };
  
  // Subject (Patient reference)
  subject?: any;
  
  // Date/Time (used for both effective and issued)
  reportDateTime?: Date;
  
  // Personnel & Organization
  performer?: any;
  resultsInterpreter?: any;
  
  // Order/Request
  basedOn?: any;
  
  // Specimen
  specimen?: any[];
  
  // Results
  result?: any[];
  
  // Conclusion
  conclusion?: string;
  conclusionCode?: any[];
  
  // Document
  presentedForm?: any;
}

export interface DiagnosticReportSubmission {
  formData: DiagnosticReportData;
  fhirResource: FhirDiagnosticReport;
  fhirJson: string;
}

@Component({
  selector: 'app-diagnostic-report-form',
  templateUrl: './diagnostic-report-form.component.html',
  styleUrls: ['./diagnostic-report-form.component.css'],
  standalone: false
})
export class DiagnosticReportFormComponent implements OnInit {
  @Output() formSubmitted = new EventEmitter<DiagnosticReportSubmission>();
  @Output() formCancelled = new EventEmitter<void>();

  diagnosticReportForm: FormGroup;
  isFlipped = false;
  fhirJson = '';

  constructor(
    private fb: FormBuilder,
    private fhirService: EhdsLaboratoryFhirService,
    private dialog: MatDialog
  ) {
    this.diagnosticReportForm = this.createForm();
  }

  // Options for dropdowns
  statusOptions = [
    'registered',
    'partial',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'appended',
    'cancelled',
    'entered-in-error',
    'unknown'
  ];

  studyTypeOptions = [
    { code: '18717-9', system: 'http://loinc.org', display: 'Blood bank studies (set)' },
    { code: '18719-5', system: 'http://loinc.org', display: 'Chemistry studies (set)' },
    { code: '18722-9', system: 'http://loinc.org', display: 'Fertility studies (set)' },
    { code: '18723-7', system: 'http://loinc.org', display: 'Hematology studies (set)' },
    { code: '18725-2', system: 'http://loinc.org', display: 'Microbiology studies (set)' },
    { code: '18728-6', system: 'http://loinc.org', display: 'Toxicology studies (set)' },
    { code: '26436-6', system: 'http://loinc.org', display: 'Laboratory studies (set)' }
  ];

  specialtyOptions = [
    'Clinical Chemistry',
    'Hematology',
    'Microbiology',
    'Immunology',
    'Blood Bank',
    'Molecular Pathology',
    'Cytogenetics',
    'Other'
  ];

  languageOptions = [
    { code: 'en', display: 'English' },
    { code: 'es', display: 'Spanish' },
    { code: 'fr', display: 'French' },
    { code: 'de', display: 'German' },
    { code: 'it', display: 'Italian' },
    { code: 'pt', display: 'Portuguese' },
    { code: 'nl', display: 'Dutch' },
    { code: 'pl', display: 'Polish' }
  ];

  ngOnInit(): void {
    // Set default values
    this.diagnosticReportForm.patchValue({
      status: 'final',
      language: 'en',
      reportDateTime: new Date()
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      // Identification & Status
      status: ['final', Validators.required],
      language: ['en'],
      identifier: [''],
      
      // Categorization
      category: this.fb.group({
        studyType: [null],
        specialty: ['']
      }),
      
      // Report Type (fixed value)
      code: [{ 
        code: '11502-2', 
        system: 'http://loinc.org', 
        display: 'Laboratory report' 
      }],
      
      // Subject (will be handled via button)
      subject: [null],
      
      // Date/Time (used for both effective and issued)
      reportDateTime: [new Date()],
      
      // Personnel & Organization (will be handled via buttons)
      performer: [null],
      resultsInterpreter: [null],
      
      // Order/Request (will be handled via button)
      basedOn: [null],
      
      // Specimen (will be handled via button)
      specimen: [[]],
      
      // Results (will be handled via button)
      result: [[]],
      
      // Conclusion
      conclusion: [''],
      conclusionCode: [[]],
      
      // Document
      presentedForm: [null]
    });
  }


  onAddSubject(): void {
    // TODO: Implement subject selection dialog
    console.log('Add Subject clicked');
  }

  onAddPerformer(): void {
    // TODO: Implement performer selection dialog
    console.log('Add Performer clicked');
  }

  onAddResultsInterpreter(): void {
    // TODO: Implement results interpreter selection dialog
    console.log('Add Results Interpreter clicked');
  }

  onAddBasedOn(): void {
    // TODO: Implement ServiceRequest selection dialog
    console.log('Add Based On (ServiceRequest) clicked');
  }

  onAddSpecimen(): void {
    const dialogRef = this.dialog.open(SpecimenFormComponent, {
      width: '1200px',
      maxWidth: '95vw',
      disableClose: false,
      data: null
    });

    dialogRef.afterClosed().subscribe((result: SpecimenData | undefined) => {
      if (result) {
        const specimens = this.specimens;
        specimens.push(result);
        this.diagnosticReportForm.patchValue({ specimen: specimens });
      }
    });
  }

  editSpecimen(index: number): void {
    const specimen = this.specimens[index];
    const dialogRef = this.dialog.open(SpecimenFormComponent, {
      width: '1200px',
      maxWidth: '95vw',
      disableClose: false,
      data: specimen
    });

    dialogRef.afterClosed().subscribe((result: SpecimenData | undefined) => {
      if (result) {
        const specimens = this.specimens;
        specimens[index] = result;
        this.diagnosticReportForm.patchValue({ specimen: specimens });
      }
    });
  }

  onAddResult(): void {
    // TODO: Implement observation result selection/creation dialog
    console.log('Add Result (Observation) clicked');
  }

  onAddConclusionCode(): void {
    // TODO: Implement conclusion code selection dialog
    console.log('Add Conclusion Code clicked');
  }

  onUploadPresentedForm(): void {
    // TODO: Implement PDF upload
    console.log('Upload Presented Form (PDF) clicked');
  }

  onSubmit(): void {
    if (this.diagnosticReportForm.valid) {
      const formData = this.diagnosticReportForm.value as DiagnosticReportData;
      
      // Generate FHIR DiagnosticReport resource
      const fhirReport = this.fhirService.generateDiagnosticReport(formData);
      
      // Validate the generated resource
      const validation = this.fhirService.validateDiagnosticReport(fhirReport);
      
      if (validation.valid) {
        // Emit both the form data and the FHIR resource
        this.formSubmitted.emit({
          formData: formData,
          fhirResource: fhirReport,
          fhirJson: this.fhirService.toJson(fhirReport)
        });
      } else {
        console.error('Validation errors:', validation.errors);
        alert('Validation errors:\n' + validation.errors.join('\n'));
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.diagnosticReportForm.controls).forEach(key => {
        this.diagnosticReportForm.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.formCancelled.emit();
  }

  get hasSubject(): boolean {
    return !!this.diagnosticReportForm.get('subject')?.value;
  }

  get hasPerformer(): boolean {
    return !!this.diagnosticReportForm.get('performer')?.value;
  }

  get hasResultsInterpreter(): boolean {
    return !!this.diagnosticReportForm.get('resultsInterpreter')?.value;
  }

  get hasBasedOn(): boolean {
    return !!this.diagnosticReportForm.get('basedOn')?.value;
  }

  get specimens(): any[] {
    return this.diagnosticReportForm.get('specimen')?.value || [];
  }

  get results(): any[] {
    return this.diagnosticReportForm.get('result')?.value || [];
  }

  get conclusionCodes(): any[] {
    return this.diagnosticReportForm.get('conclusionCode')?.value || [];
  }

  removeSpecimen(index: number): void {
    const specimens = this.specimens;
    specimens.splice(index, 1);
    this.diagnosticReportForm.patchValue({ specimen: specimens });
  }

  getStatusDisplay(statusCode: string): string {
    const statusMap: { [key: string]: string } = {
      'available': 'Available',
      'unavailable': 'Unavailable',
      'unsatisfactory': 'Unsatisfactory',
      'entered-in-error': 'Entered in Error'
    };
    return statusMap[statusCode] || statusCode;
  }

  removeResult(index: number): void {
    const results = this.results;
    results.splice(index, 1);
    this.diagnosticReportForm.patchValue({ result: results });
  }

  removeConclusionCode(index: number): void {
    const codes = this.conclusionCodes;
    codes.splice(index, 1);
    this.diagnosticReportForm.patchValue({ conclusionCode: codes });
  }

  flipCard(): void {
    this.isFlipped = !this.isFlipped;
    
    // Generate FHIR JSON when flipping to back side
    if (this.isFlipped) {
      const formData = this.diagnosticReportForm.value as DiagnosticReportData;
      try {
        const fhirReport = this.fhirService.generateDiagnosticReport(formData);
        this.fhirJson = this.fhirService.toJson(fhirReport, true);
      } catch (error) {
        this.fhirJson = JSON.stringify({ error: 'Error generating FHIR resource: ' + (error as Error).message }, null, 2);
      }
    }
  }

  copyToClipboard(): void {
    if (this.fhirJson) {
      navigator.clipboard.writeText(this.fhirJson).then(() => {
        // Could show a snackbar here
        console.log('FHIR JSON copied to clipboard');
      });
    }
  }

  downloadFhirResource(): void {
    if (this.fhirJson) {
      const blob = new Blob([this.fhirJson], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diagnostic-report-' + new Date().getTime() + '.json';
      link.click();
      window.URL.revokeObjectURL(url);
    }
  }

  openValuesetDialog(valuesetUrl: string, fieldName: string, dialogTitle?: string): void {
    this.dialog.open(ValuesetDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '90vh',
      data: { url: valuesetUrl, fieldName: fieldName, dialogTitle: dialogTitle },
      panelClass: 'valueset-dialog-container'
    });
  }
}

