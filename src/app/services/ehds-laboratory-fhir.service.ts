import { Injectable } from '@angular/core';
import { DiagnosticReportData } from '../ehds-laboratory-demo/diagnostic-report-form/diagnostic-report-form.component';
import { SpecimenData } from '../ehds-laboratory-demo/specimen-form/specimen-form.component';
import { ObservationResultData } from '../ehds-laboratory-demo/observation-result-form/observation-result-form.component';
import { ServiceRequestData } from '../ehds-laboratory-demo/service-request-form/service-request-form.component';

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
  } | {
    resourceType: 'ServiceRequest';
    id?: string;
    meta?: {
      profile?: string[];
    };
    identifier?: Array<{
      value?: string;
    }>;
    status?: string;
    intent?: string;
    priority?: string;
    code?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    subject?: {
      reference?: string;
      display?: string;
    };
    authoredOn?: string;
    requester?: {
      reference?: string;
      display?: string;
    };
    reasonCode?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    bodySite?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
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
  } | {
    resourceType: 'Observation';
    id?: string;
    meta?: {
      profile?: string[];
    };
    status?: string;
    code?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    subject?: {
      reference?: string;
      display?: string;
    };
    effectiveDateTime?: string;
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueString?: string;
    valueCodeableConcept?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
    interpretation?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    }>;
    referenceRange?: Array<{
      low?: {
        value?: number;
        unit?: string;
      };
      high?: {
        value?: number;
        unit?: string;
      };
      text?: string;
    }>;
    performer?: Array<{
      reference?: string;
      display?: string;
    }>;
    note?: Array<{
      text?: string;
    }>;
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
      // Check if basedOn has full data (from ServiceRequestFormComponent)
      // It can be stored as basedOn.data or directly as ServiceRequestData
      if (formData.basedOn.data) {
        diagnosticReport.basedOn = [this.generateServiceRequest(formData.basedOn.data, 0)];
      } else if (formData.basedOn.status && formData.basedOn.intent) {
        // Check if it's already a ServiceRequestData object
        diagnosticReport.basedOn = [this.generateServiceRequest(formData.basedOn as ServiceRequestData, 0)];
      } else {
        // Otherwise, create a simple reference
        diagnosticReport.basedOn = [this.createReference(formData.basedOn)];
      }
    }

    // Specimen (inline, not as references)
    // Store specimens with their generated IDs for reference by observations
    const specimenIdMap = new Map<number, string>();
    if (formData.specimen && formData.specimen.length > 0) {
      diagnosticReport.specimen = formData.specimen.map((spec, index) => {
        const generatedSpecimen = this.generateSpecimen(spec, index);
        const specimenId = generatedSpecimen.id || `specimen-${index + 1}`;
        specimenIdMap.set(index, specimenId);
        return generatedSpecimen;
      });
    }

    // Results (Observations)
    if (formData.result && formData.result.length > 0) {
      diagnosticReport.result = formData.result.map((res, index) => {
        // Check if res is a full ObservationResultData object
        if (res.status && res.code) {
          // Pass the specimenIdMap to generateObservation so it can create proper references
          return this.generateObservation(res, index, specimenIdMap);
        } else {
          // Otherwise, create a simple reference
          return this.createReference(res);
        }
      });
    }

    // Conclusion
    if (formData.conclusion) {
      diagnosticReport.conclusion = formData.conclusion;
    }

    // Conclusion Code
    if (formData.conclusionCode && formData.conclusionCode.length > 0) {
      diagnosticReport.conclusionCode = formData.conclusionCode
        .filter(code => code != null) // Filter out null/undefined values
        .map(code => {
          // If already a CodeableConcept with coding array
          if (typeof code === 'object' && code.coding && Array.isArray(code.coding)) {
            return code;
          }
          // If it's an object with code, system, display structure
          if (typeof code === 'object' && code.code) {
            const codeableConcept: any = {
              coding: [{
                system: code.system || 'http://snomed.info/sct',
                code: code.code,
                display: code.display || code.code
              }]
            };
            // Add text if display is available
            if (code.display) {
              codeableConcept.text = code.display;
            }
            return codeableConcept;
          }
          // Fallback: treat as string code
          return {
            coding: [{
              system: 'http://snomed.info/sct',
              code: String(code),
              display: String(code)
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

    // Identifier (Reference number)
    if (specimenData.referenceNumber) {
      specimen.identifier = [{
        value: specimenData.referenceNumber
      }];
    }

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
   * Generates a FHIR Observation resource from ObservationResultData
   * Following the EHDS Laboratory Observation profile specification
   */
  generateObservation(observationData: ObservationResultData, index: number, specimenIdMap?: Map<number, string>): any {
    const observation: any = {
      resourceType: 'Observation',
      id: `observation-${index + 1}`,
      meta: {
        profile: ['http://fhir.ehdsi.eu/laboratory/StructureDefinition/Observation-resultslab-lab-myhealtheu']
      }
    };

    // Status
    if (observationData.status) {
      observation.status = observationData.status;
    }

    // Code
    if (observationData.code) {
      // Determine the system - if not provided, default to SNOMED CT
      let codeSystem = observationData.code.system;
      if (!codeSystem || codeSystem === '') {
        // If system is missing, assume SNOMED CT (since LOINC codes would have the system set)
        codeSystem = 'http://snomed.info/sct';
      }
      
      const codings: any[] = [{
        system: codeSystem,
        code: observationData.code.code,
        display: observationData.code.display
      }];
      
      // Add LOINC code if available
      if (observationData.code.loincCode) {
        codings.push({
          system: 'http://loinc.org',
          code: observationData.code.loincCode,
          display: observationData.code.display
        });
      }
      
      observation.code = {
        coding: codings,
        text: observationData.code.display
      };
    }

    // Subject
    if (observationData.subject) {
      observation.subject = this.createReference(observationData.subject);
    }

    // Specimen
    if (observationData.specimen) {
      // If specimen has a data property, it's from the availableSpecimens array
      // We need to find the index of this specimen in the diagnostic report's specimen array
      if (observationData.specimen.data) {
        // Extract the specimen index from the reference (format: "specimen-{index+1}")
        let specimenId = `specimen-${index + 1}`; // Default fallback
        
        if (specimenIdMap && specimenIdMap.size > 0) {
          // Try to find the specimen index by matching the reference string
          const match = observationData.specimen.reference?.match(/specimen-(\d+)/);
          if (match) {
            const specimenIndex = parseInt(match[1]) - 1;
            const mappedId = specimenIdMap.get(specimenIndex);
            if (mappedId) {
              specimenId = mappedId;
            }
          }
        } else {
          // Fallback: use the reference from the specimen object
          const match = observationData.specimen.reference?.match(/specimen-(\d+)/);
          if (match) {
            specimenId = `specimen-${match[1]}`;
          }
        }
        
        // Use fragment reference format for inline specimens: #specimen-{id}
        observation.specimen = [{
          reference: `#${specimenId}`,
          display: observationData.specimen.display
        }];
      } else {
        // It's already a reference object
        observation.specimen = [this.createReference(observationData.specimen)];
      }
    }

    // Effective DateTime
    if (observationData.effectiveDateTime) {
      observation.effectiveDateTime = this.formatDateTime(observationData.effectiveDateTime);
    }

    // Value (Quantity, String, or CodeableConcept)
    if (observationData.valueQuantity) {
      observation.valueQuantity = {
        value: observationData.valueQuantity.value,
        unit: observationData.valueQuantity.unit,
        system: observationData.valueQuantity.system || 'http://unitsofmeasure.org',
        code: observationData.valueQuantity.code || observationData.valueQuantity.unit
      };
    } else if (observationData.valueString) {
      observation.valueString = observationData.valueString;
    } else if (observationData.valueCodeableConcept) {
      observation.valueCodeableConcept = {
        coding: [{
          system: observationData.valueCodeableConcept.system,
          code: observationData.valueCodeableConcept.code,
          display: observationData.valueCodeableConcept.display
        }],
        text: observationData.valueCodeableConcept.display
      };
    }

    // Interpretation
    if (observationData.interpretation) {
      observation.interpretation = [{
        coding: [{
          system: observationData.interpretation.system,
          code: observationData.interpretation.code,
          display: observationData.interpretation.display
        }],
        text: observationData.interpretation.display
      }];
    }

    // Method
    if (observationData.method) {
      observation.method = {
        coding: [{
          system: observationData.method.system,
          code: observationData.method.code,
          display: observationData.method.display
        }],
        text: observationData.method.display
      };
    }

    // Reference Range
    if (observationData.referenceRange) {
      const refRange: any = {};
      if (observationData.referenceRange.low) {
        refRange.low = {
          value: observationData.referenceRange.low.value,
          unit: observationData.referenceRange.low.unit,
          system: 'http://unitsofmeasure.org'
        };
      }
      if (observationData.referenceRange.high) {
        refRange.high = {
          value: observationData.referenceRange.high.value,
          unit: observationData.referenceRange.high.unit,
          system: 'http://unitsofmeasure.org'
        };
      }
      if (observationData.referenceRange.text) {
        refRange.text = observationData.referenceRange.text;
      }
      if (Object.keys(refRange).length > 0) {
        observation.referenceRange = [refRange];
      }
    }

    // Performer
    if (observationData.performer) {
      observation.performer = [this.createReference(observationData.performer)];
    }

    // Note
    if (observationData.note) {
      observation.note = [{
        text: observationData.note
      }];
    }

    return observation;
  }

  /**
   * Generates a FHIR ServiceRequest resource from ServiceRequestData
   * Following the EHDS Laboratory ServiceRequest profile specification
   */
  generateServiceRequest(serviceRequestData: ServiceRequestData, index: number): any {
    const serviceRequest: any = {
      resourceType: 'ServiceRequest',
      id: `servicerequest-${index + 1}`,
      meta: {
        profile: ['http://fhir.ehdsi.eu/laboratory/StructureDefinition/ServiceRequest-lab-myhealtheu']
      }
    };

    // Identifier
    if (serviceRequestData.identifier) {
      serviceRequest.identifier = [{
        value: serviceRequestData.identifier
      }];
    }

    // Status
    if (serviceRequestData.status) {
      serviceRequest.status = serviceRequestData.status;
    }

    // Intent
    if (serviceRequestData.intent) {
      serviceRequest.intent = serviceRequestData.intent;
    }

    // Priority
    if (serviceRequestData.priority) {
      serviceRequest.priority = serviceRequestData.priority;
    }

    // Code
    if (serviceRequestData.code) {
      serviceRequest.code = {
        coding: [{
          system: serviceRequestData.code.system,
          code: serviceRequestData.code.code,
          display: serviceRequestData.code.display
        }],
        text: serviceRequestData.code.display
      };
    }

    // Subject
    if (serviceRequestData.subject) {
      serviceRequest.subject = this.createReference(serviceRequestData.subject);
    }

    // Authored On
    if (serviceRequestData.authoredOn) {
      serviceRequest.authoredOn = this.formatDateTime(serviceRequestData.authoredOn);
    }

    // Requester
    if (serviceRequestData.requester) {
      serviceRequest.requester = this.createReference(serviceRequestData.requester);
    }

    // Reason Code
    if (serviceRequestData.reasonCode) {
      serviceRequest.reasonCode = [{
        coding: [{
          system: serviceRequestData.reasonCode.system,
          code: serviceRequestData.reasonCode.code,
          display: serviceRequestData.reasonCode.display
        }],
        text: serviceRequestData.reasonCode.display
      }];
    }

    return serviceRequest;
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

