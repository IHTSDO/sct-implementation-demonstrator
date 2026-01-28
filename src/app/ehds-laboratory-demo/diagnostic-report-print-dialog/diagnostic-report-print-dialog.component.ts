import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FhirDiagnosticReport } from '../../services/ehds-laboratory-fhir.service';
import { PATIENT_EXAMPLES } from '../diagnostic-report-form/diagnostic-report-examples.data';

@Component({
  selector: 'app-diagnostic-report-print-dialog',
  templateUrl: './diagnostic-report-print-dialog.component.html',
  styleUrls: ['./diagnostic-report-print-dialog.component.css'],
  standalone: false
})
export class DiagnosticReportPrintDialogComponent {
  diagnosticReport: FhirDiagnosticReport;
  patientData: any = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { diagnosticReport: FhirDiagnosticReport; patientData?: any },
    private dialogRef: MatDialogRef<DiagnosticReportPrintDialogComponent>
  ) {
    this.diagnosticReport = data.diagnosticReport;
    this.patientData = data.patientData || this.extractPatientFromReference();
  }

  private extractPatientFromReference(): any {
    // Try to find patient from examples if we have a reference
    if (this.diagnosticReport.subject?.reference) {
      const patientRef = this.diagnosticReport.subject.reference;
      const patientExample = PATIENT_EXAMPLES.find(p => p.reference === patientRef);
      if (patientExample) {
        return {
          name: this.extractNameFromDisplay(patientExample.display),
          identifier: patientExample.identifier,
          display: patientExample.display
        };
      }
    }
    return null;
  }

  private extractNameFromDisplay(display: string): string {
    // Extract name from display like "John Doe (M, 45 years)"
    const match = display.match(/^([^(]+)/);
    return match ? match[1].trim() : display;
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return dateString;
    }
  }

  getPatientName(): string {
    if (this.patientData?.name) {
      return this.patientData.name;
    }
    if (this.patientData?.display) {
      return this.extractNameFromDisplay(this.patientData.display);
    }
    return this.diagnosticReport.subject?.display || 'Unknown Patient';
  }

  getPatientMRN(): string {
    if (this.patientData?.identifier?.value) {
      return this.patientData.identifier.value;
    }
    if (this.diagnosticReport.subject?.identifier?.value) {
      return this.diagnosticReport.subject.identifier.value;
    }
    return 'N/A';
  }

  getPatientAddress(): string {
    // Placeholder - would need full patient resource for real address
    return 'Address not available';
  }

  getPatientContact(): string {
    // Placeholder - would need full patient resource for real contact
    return 'Contact not available';
  }

  getReportCodeDisplay(): string {
    return this.diagnosticReport.code?.text || 
           this.diagnosticReport.code?.coding?.[0]?.display || 
           'Laboratory Report';
  }

  getStatusDisplay(): string {
    return this.diagnosticReport.status || 'Unknown';
  }

  getPerformerDisplay(): string {
    if (this.diagnosticReport.performer && this.diagnosticReport.performer.length > 0) {
      return this.diagnosticReport.performer[0].display || this.diagnosticReport.performer[0].reference || 'N/A';
    }
    return 'N/A';
  }

  getResultsInterpreterDisplay(): string {
    if (this.diagnosticReport.resultsInterpreter && this.diagnosticReport.resultsInterpreter.length > 0) {
      return this.diagnosticReport.resultsInterpreter[0].display || this.diagnosticReport.resultsInterpreter[0].reference || 'N/A';
    }
    return 'N/A';
  }

  getSpecimens(): any[] {
    if (!this.diagnosticReport.specimen) return [];
    return this.diagnosticReport.specimen.map((spec: any) => {
      if (spec.resourceType === 'Specimen') {
        return {
          display: spec.type?.text || spec.type?.coding?.[0]?.display || 'Unknown Specimen',
          type: spec.type
        };
      }
      return {
        display: spec.display || spec.reference || 'Unknown Specimen'
      };
    });
  }

  getResults(): any[] {
    if (!this.diagnosticReport.result) return [];
    return this.diagnosticReport.result.map((result: any) => {
      if (result.resourceType === 'Observation') {
        let valueDisplay = 'N/A';
        if (result.valueQuantity) {
          valueDisplay = `${result.valueQuantity.value || ''} ${result.valueQuantity.unit || ''}`.trim();
        } else if (result.valueString) {
          valueDisplay = result.valueString;
        } else if (result.valueCodeableConcept) {
          valueDisplay = result.valueCodeableConcept.text || result.valueCodeableConcept.coding?.[0]?.display || 'N/A';
        }

        let interpretationDisplay = '';
        if (result.interpretation && result.interpretation.length > 0) {
          interpretationDisplay = result.interpretation[0].text || result.interpretation[0].coding?.[0]?.display || '';
        }

        // Format reference range
        let referenceRangeDisplay = '';
        if (result.referenceRange && result.referenceRange.length > 0) {
          const range = result.referenceRange[0];
          if (range.low && range.high) {
            const lowValue = range.low.value || '';
            const lowUnit = range.low.unit || '';
            const highValue = range.high.value || '';
            const highUnit = range.high.unit || '';
            referenceRangeDisplay = `${lowValue}${lowUnit ? ' ' + lowUnit : ''} - ${highValue}${highUnit ? ' ' + highUnit : ''}`.trim();
          } else if (range.text) {
            referenceRangeDisplay = range.text;
          }
        }

        return {
          display: result.code?.text || result.code?.coding?.[0]?.display || 'Unknown Test',
          value: valueDisplay,
          interpretation: interpretationDisplay,
          referenceRange: referenceRangeDisplay,
          effectiveDateTime: result.effectiveDateTime
        };
      }
      return {
        display: result.display || result.reference || 'Unknown Result',
        value: '',
        interpretation: '',
        referenceRange: ''
      };
    });
  }

  getConclusion(): string {
    return this.diagnosticReport.conclusion || '';
  }

  getConclusionCodes(): any[] {
    return this.diagnosticReport.conclusionCode || [];
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  printReport(): void {
    window.print();
  }
}
