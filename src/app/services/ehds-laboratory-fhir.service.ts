import { Injectable } from '@angular/core';
import { DiagnosticReportData } from '../ehds-laboratory-demo/diagnostic-report-form/diagnostic-report-form.component';
import { SpecimenData } from '../ehds-laboratory-demo/specimen-form/specimen-form.component';

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  meta?: {
    profile?: string[];
    versionId?: string;
    lastUpdated?: string;
  };
  implicitRules?: string;
  language?: string;
  text?: {
    status: string;
    div: string;
  };
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    system?: string;
    value?: string;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  basedOn?: Array<{
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  }>;
  status: string;
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  };
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  issued?: string;
  performer?: Array<{
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  }>;
  resultsInterpreter?: Array<{
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  }>;
  specimen?: Array<{
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  } | {
    resourceType: 'Specimen';
    id?: string;
    meta?: {
      profile?: string[];
    };
    status?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    receivedTime?: string;
    collection?: {
      bodySite?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      method?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
      fastingStatus?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
    };
    processing?: Array<{
      procedure?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
    }>;
    container?: Array<{
      type?: {
        coding?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        text?: string;
      };
    }>;
    condition?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
  }>;
  result?: Array<{
    reference?: string;
    type?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
    display?: string;
  }>;
  conclusion?: string;
  conclusionCode?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  presentedForm?: Array<{
    contentType?: string;
    language?: string;
    data?: string;
    url?: string;
    size?: number;
    hash?: string;
    title?: string;
    creation?: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class EhdsLaboratoryFhirService {

  constructor() { }

  /**
   * Generates a FHIR DiagnosticReport resource from form data
   * Following the EHDS Laboratory Report profile specification
   */
  generateDiagnosticReport(formData: DiagnosticReportData): FhirDiagnosticReport {
    const diagnosticReport: FhirDiagnosticReport = {
      resourceType: 'DiagnosticReport',
      meta: {
        profile: ['http://fhir.ehdsi.eu/laboratory/StructureDefinition/DiagnosticReport-lab-myhealtheu']
      },
      status: formData.status,
      code: {
        coding: [{
          system: formData.code.system,
          code: formData.code.code,
          display: formData.code.display
        }],
        text: formData.code.display
      }
    };

    // Language
    if (formData.language) {
      diagnosticReport.language = formData.language;
    }

    // Identifier
    if (formData.identifier) {
      diagnosticReport.identifier = [{
        value: formData.identifier
      }];
    }

    // Category (Study Type and Specialty)
    const category: any[] = [];
    if (formData.category?.studyType) {
      category.push({
        coding: [{
          system: formData.category.studyType.system,
          code: formData.category.studyType.code,
          display: formData.category.studyType.display
        }],
        text: formData.category.studyType.display
      });
    }
    if (formData.category?.specialty) {
      // Add specialty category if needed
      category.push({
        coding: [{
          system: 'http://hl7.eu/fhir/laboratory/ValueSet/lab-specialty-eu-lab',
          code: formData.category.specialty,
          display: formData.category.specialty
        }],
        text: formData.category.specialty
      });
    }
    if (category.length > 0) {
      diagnosticReport.category = category;
    }

    // Subject (Patient)
    if (formData.subject) {
      diagnosticReport.subject = this.createReference(formData.subject);
    }

    // Effective DateTime (used for both effective and issued)
    if (formData.reportDateTime) {
      const dateTime = this.formatDateTime(formData.reportDateTime);
      diagnosticReport.effectiveDateTime = dateTime;
      diagnosticReport.issued = dateTime;
    }

    // Performer
    if (formData.performer) {
      diagnosticReport.performer = [this.createReference(formData.performer)];
    }

    // Results Interpreter
    if (formData.resultsInterpreter) {
      diagnosticReport.resultsInterpreter = [this.createReference(formData.resultsInterpreter)];
    }

    // Based On (ServiceRequest)
    if (formData.basedOn) {
      diagnosticReport.basedOn = [this.createReference(formData.basedOn)];
    }

    // Specimen (inline, not as references)
    if (formData.specimen && formData.specimen.length > 0) {
      diagnosticReport.specimen = formData.specimen.map((spec, index) => this.generateSpecimen(spec, index));
    }

    // Results (Observations)
    if (formData.result && formData.result.length > 0) {
      diagnosticReport.result = formData.result.map(res => this.createReference(res));
    }

    // Conclusion
    if (formData.conclusion) {
      diagnosticReport.conclusion = formData.conclusion;
    }

    // Conclusion Code
    if (formData.conclusionCode && formData.conclusionCode.length > 0) {
      diagnosticReport.conclusionCode = formData.conclusionCode.map(code => {
        if (typeof code === 'object' && code.coding) {
          return code;
        } else if (typeof code === 'object' && code.code) {
          return {
            coding: [{
              system: code.system || 'http://snomed.info/sct',
              code: code.code,
              display: code.display
            }],
            text: code.display
          };
        }
        return {
          coding: [{
            system: 'http://snomed.info/sct',
            code: code,
            display: code
          }]
        };
      });
    }

    // Presented Form (PDF)
    if (formData.presentedForm) {
      diagnosticReport.presentedForm = [this.createAttachment(formData.presentedForm)];
    }

    return diagnosticReport;
  }

  /**
   * Generates a FHIR Specimen resource from SpecimenData
   * Following the EHDS Laboratory Specimen profile specification
   */
  generateSpecimen(specimenData: SpecimenData, index: number): any {
    const specimen: any = {
      resourceType: 'Specimen',
      id: `specimen-${index + 1}`,
      meta: {
        profile: ['http://fhir.ehdsi.eu/laboratory/StructureDefinition/Specimen-lab-myhealtheu']
      }
    };

    // Status
    if (specimenData.status) {
      specimen.status = specimenData.status;
    }

    // Type
    if (specimenData.type) {
      specimen.type = {
        coding: [{
          system: specimenData.type.system,
          code: specimenData.type.code,
          display: specimenData.type.display
        }],
        text: specimenData.type.display
      };
    }

    // Received Time
    if (specimenData.receivedTime) {
      specimen.receivedTime = this.formatDateTime(specimenData.receivedTime);
    }

    // Collection
    const collection: any = {};
    let hasCollection = false;

    if (specimenData.collectionBodySite) {
      collection.bodySite = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: specimenData.collectionBodySite.code,
          display: specimenData.collectionBodySite.display
        }],
        text: specimenData.collectionBodySite.display
      };
      hasCollection = true;
    }

    if (specimenData.collectionMethod) {
      collection.method = {
        coding: [{
          system: specimenData.collectionMethod.system,
          code: specimenData.collectionMethod.code,
          display: specimenData.collectionMethod.display
        }],
        text: specimenData.collectionMethod.display
      };
      hasCollection = true;
    }

    if (specimenData.collectionFastingStatus) {
      collection.fastingStatus = {
        coding: [{
          system: specimenData.collectionFastingStatus.system,
          code: specimenData.collectionFastingStatus.code,
          display: specimenData.collectionFastingStatus.display
        }],
        text: specimenData.collectionFastingStatus.display
      };
      hasCollection = true;
    }

    if (hasCollection) {
      specimen.collection = collection;
    }

    // Processing
    if (specimenData.processingProcedure) {
      specimen.processing = [{
        procedure: {
          coding: [{
            system: specimenData.processingProcedure.system,
            code: specimenData.processingProcedure.code,
            display: specimenData.processingProcedure.display
          }],
          text: specimenData.processingProcedure.display
        }
      }];
    }

    // Container
    if (specimenData.containerType) {
      specimen.container = [{
        type: {
          coding: [{
            system: specimenData.containerType.system,
            code: specimenData.containerType.code,
            display: specimenData.containerType.display
          }],
          text: specimenData.containerType.display
        }
      }];
    }

    // Condition
    if (specimenData.condition) {
      specimen.condition = [{
        coding: [{
          system: specimenData.condition.system,
          code: specimenData.condition.code,
          display: specimenData.condition.display
        }],
        text: specimenData.condition.display
      }];
    }

    return specimen;
  }

  /**
   * Creates a FHIR Reference from a resource object
   */
  private createReference(resource: any): any {
    if (typeof resource === 'string') {
      return { reference: resource };
    }
    
    if (resource.reference) {
      return {
        reference: resource.reference,
        type: resource.type,
        identifier: resource.identifier,
        display: resource.display
      };
    }

    if (resource.id) {
      return {
        reference: `${resource.resourceType || 'Resource'}/${resource.id}`,
        display: resource.display || resource.text || resource.name
      };
    }

    return {
      reference: 'Resource/unknown',
      display: 'Unknown resource'
    };
  }

  /**
   * Creates a FHIR Attachment from a file/resource object
   */
  private createAttachment(attachment: any): any {
    if (typeof attachment === 'string') {
      return { url: attachment };
    }

    return {
      contentType: attachment.contentType || 'application/pdf',
      language: attachment.language,
      data: attachment.data,
      url: attachment.url,
      size: attachment.size,
      hash: attachment.hash,
      title: attachment.title,
      creation: attachment.creation ? this.formatDateTime(attachment.creation) : undefined
    };
  }

  /**
   * Formats a Date object to FHIR dateTime string (ISO 8601)
   */
  private formatDateTime(date: Date | string): string {
    if (typeof date === 'string') {
      return date;
    }
    return date.toISOString();
  }

  /**
   * Validates the generated DiagnosticReport against the EHDS profile
   */
  validateDiagnosticReport(report: FhirDiagnosticReport): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!report.resourceType || report.resourceType !== 'DiagnosticReport') {
      errors.push('Resource type must be DiagnosticReport');
    }

    if (!report.status) {
      errors.push('Status is required');
    }

    if (!report.code || !report.code.coding || report.code.coding.length === 0) {
      errors.push('Code is required');
    }

    // Validate status values
    const validStatuses = ['registered', 'partial', 'preliminary', 'final', 'amended', 
                          'corrected', 'appended', 'cancelled', 'entered-in-error', 'unknown'];
    if (report.status && !validStatuses.includes(report.status)) {
      errors.push(`Invalid status: ${report.status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate code system
    if (report.code?.coding?.[0]?.system !== 'http://loinc.org') {
      errors.push('Code system must be http://loinc.org for Laboratory Report');
    }

    // Validate code value
    if (report.code?.coding?.[0]?.code !== '11502-2') {
      errors.push('Code must be 11502-2 (Laboratory report)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Converts the DiagnosticReport to JSON string
   */
  toJson(report: FhirDiagnosticReport, pretty: boolean = true): string {
    return JSON.stringify(report, null, pretty ? 2 : 0);
  }
}

