import { Injectable } from '@angular/core';
import { PatientService, Patient, Condition, Procedure, MedicationRequest } from './patient.service';
import { DataAnalyticsService } from './data-analytics.service';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface TransformedPatient {
  id: string;
  gender: string;
  dobYear: number;
  dataset: string;
  events: TransformedPatientEvent[];
}

export interface TransformedPatientEvent {
  conceptId: number;
  conceptTerm: string;
  date: string;
  dateLong: number;
}

export interface TransformedPatientResponse {
  content: TransformedPatient[];
  pageable: any;
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: any;
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface HierarchyDataItem {
  id: string;
  label: string;
  parent: string;
  value: number;
  patientCount?: number;
  labelCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PatientDataTransformerService {

  constructor(
    private patientService: PatientService,
    private dataAnalyticsService: DataAnalyticsService
  ) { }

  /**
   * Transform benefits-demo patient data to match mock_patients_5000.json structure
   */
  transformPatientsToMockFormat(): TransformedPatientResponse {
    // Get current patients from the service
    let patients: Patient[] = [];
    this.patientService.getPatients().subscribe(currentPatients => {
      patients = currentPatients;
    }).unsubscribe();

    const transformedPatients: TransformedPatient[] = patients.map(patient => {
      // Get all clinical data for this patient
      const conditions = this.patientService.getPatientConditions(patient.id);
      const procedures = this.patientService.getPatientProcedures(patient.id);
      const medications = this.patientService.getPatientMedications(patient.id);

      // Transform clinical data to events
      const events: TransformedPatientEvent[] = [];

      // Add condition events
      conditions.forEach(condition => {
        const code = this.extractCodeFromResource(condition);
        if (code) {
          events.push({
            conceptId: parseInt(code, 10),
            conceptTerm: condition.code.text,
            date: condition.onsetDateTime || condition.recordedDate || new Date().toISOString().split('T')[0],
            dateLong: new Date(condition.onsetDateTime || condition.recordedDate || new Date()).getTime()
          });
        }
      });

      // Add procedure events
      procedures.forEach(procedure => {
        const code = this.extractCodeFromResource(procedure);
        if (code) {
          events.push({
            conceptId: parseInt(code, 10),
            conceptTerm: procedure.code.text,
            date: procedure.performedDateTime || new Date().toISOString().split('T')[0],
            dateLong: new Date(procedure.performedDateTime || new Date()).getTime()
          });
        }
      });

      // Add medication events
      medications.forEach(medication => {
        const code = this.extractCodeFromResource(medication);
        if (code) {
          events.push({
            conceptId: parseInt(code, 10),
            conceptTerm: medication.medicationCodeableConcept?.text || 'Unknown medication',
            date: medication.authoredOn || new Date().toISOString().split('T')[0],
            dateLong: new Date(medication.authoredOn || new Date()).getTime()
          });
        }
      });

      // Transform patient data
      const transformedPatient: TransformedPatient = {
        id: patient.id,
        gender: this.mapGenderToMockFormat(patient.gender),
        dobYear: this.extractBirthYear(patient.birthDate),
        dataset: 'BrowserStorage',
        events: events
      };

      return transformedPatient;
    });

    return {
      content: transformedPatients,
      pageable: {
        sort: { sorted: false, unsorted: true, empty: true },
        pageNumber: 0,
        pageSize: transformedPatients.length,
        offset: 0,
        paged: false,
        unpaged: true
      },
      totalElements: transformedPatients.length,
      totalPages: 1,
      last: true,
      size: transformedPatients.length,
      number: 0,
      sort: { sorted: false, unsorted: true, empty: true },
      first: true,
      numberOfElements: transformedPatients.length,
      empty: transformedPatients.length === 0
    };
  }

  /**
   * Transform benefits-demo patient data to hierarchy format (test5.csv structure)
   */
  transformPatientsToHierarchyFormat(): Observable<HierarchyDataItem[]> {
    // Get current patients from the service
    let patients: Patient[] = [];
    this.patientService.getPatients().subscribe(currentPatients => {
      patients = currentPatients;
    }).unsubscribe();

    if (patients.length === 0) {
      return of([]);
    }

    // Collect all clinical data
    const allConditions: Condition[] = [];
    const allProcedures: Procedure[] = [];
    const allMedications: MedicationRequest[] = [];

    patients.forEach(patient => {
      allConditions.push(...this.patientService.getPatientConditions(patient.id));
      allProcedures.push(...this.patientService.getPatientProcedures(patient.id));
      allMedications.push(...this.patientService.getPatientMedications(patient.id));
    });

    // Extract unique codes
    const codes = this.dataAnalyticsService.extractClinicalCodes(allConditions, allProcedures, allMedications);

    if (codes.length === 0) {
      return of([]);
    }

    // Get hierarchy from external service
    return this.dataAnalyticsService.getPartialHierarchy(codes, true).pipe(
      map(hierarchyData => {
        // Build hierarchical tree
        const hierarchyTree = this.dataAnalyticsService.buildHierarchicalTree(hierarchyData);
        
        // Assign counts
        const treeWithCounts = this.dataAnalyticsService.assignHierarchicalCounts(
          hierarchyTree, 
          allConditions, 
          allProcedures, 
          allMedications
        );
        
        // Convert to flat structure for CSV format
        const flatHierarchy = this.flattenHierarchyTree(treeWithCounts);
        
        return flatHierarchy;
      }),
      catchError(error => {
        // Fallback: create simple hierarchy from available codes
        return of(this.createSimpleHierarchy(allConditions, allProcedures, allMedications));
      })
    );
  }

  /**
   * Extract SNOMED CT code from a clinical resource
   */
  private extractCodeFromResource(resource: any): string | null {
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].code;
    }
    return null;
  }

  /**
   * Map FHIR gender to mock format
   */
  private mapGenderToMockFormat(gender?: string): string {
    switch (gender?.toLowerCase()) {
      case 'male':
        return 'MALE';
      case 'female':
        return 'FEMALE';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Extract birth year from FHIR birth date
   */
  private extractBirthYear(birthDate?: string): number {
    if (!birthDate) {
      return 1990; // Default year
    }
    
    const year = new Date(birthDate).getFullYear();
    return isNaN(year) ? 1990 : year;
  }

  /**
   * Flatten hierarchical tree to CSV format
   */
  private flattenHierarchyTree(tree: any[], parentId: string = ''): HierarchyDataItem[] {
    const result: HierarchyDataItem[] = [];
    
    tree.forEach(node => {
      const item: HierarchyDataItem = {
        id: node.id,
        label: node.label,
        parent: parentId,
        value: node.patientCount || 0,
        patientCount: node.patientCount || 0,
        labelCount: node.eventCount || 0
      };
      
      result.push(item);
      
      // Recursively add children
      if (node.children && node.children.length > 0) {
        result.push(...this.flattenHierarchyTree(node.children, node.id));
      }
    });
    
    return result;
  }

  /**
   * Create simple hierarchy when external service is unavailable
   */
  private createSimpleHierarchy(conditions: Condition[], procedures: Procedure[], medications: MedicationRequest[]): HierarchyDataItem[] {
    const codeCounts = new Map<string, { count: number, term: string, patients: Set<string> }>();
    
    // Count codes from all clinical data
    [...conditions, ...procedures, ...medications].forEach(resource => {
      const code = this.extractCodeFromResource(resource);
      if (code) {
        const term = this.getTermFromResource(resource);
        const patientId = this.getPatientIdFromResource(resource);
        
        if (!codeCounts.has(code)) {
          codeCounts.set(code, { count: 0, term, patients: new Set() });
        }
        
        const entry = codeCounts.get(code)!;
        entry.count++;
        if (patientId) {
          entry.patients.add(patientId);
        }
      }
    });
    
    // Create simple hierarchy items
    const hierarchyItems: HierarchyDataItem[] = [];
    let index = 1;
    
    codeCounts.forEach((data, code) => {
      hierarchyItems.push({
        id: `${code}_${index}`,
        label: data.term,
        parent: '', // All at root level for simplicity
        value: data.patients.size,
        patientCount: data.patients.size,
        labelCount: data.count
      });
      index++;
    });
    
    return hierarchyItems;
  }

  /**
   * Get term from clinical resource
   */
  private getTermFromResource(resource: any): string {
    if (resource.code?.text) {
      return resource.code.text;
    }
    if (resource.medicationCodeableConcept?.text) {
      return resource.medicationCodeableConcept.text;
    }
    if (resource.code?.coding && resource.code.coding.length > 0) {
      return resource.code.coding[0].display || resource.code.coding[0].code;
    }
    if (resource.medicationCodeableConcept?.coding && resource.medicationCodeableConcept.coding.length > 0) {
      return resource.medicationCodeableConcept.coding[0].display || resource.medicationCodeableConcept.coding[0].code;
    }
    return 'Unknown';
  }

  /**
   * Get patient ID from clinical resource
   */
  private getPatientIdFromResource(resource: any): string | null {
    if (resource.subject?.reference) {
      return resource.subject.reference.replace('Patient/', '');
    }
    return null;
  }

  /**
   * Check if there is any patient data available
   */
  hasPatientData(): boolean {
    // Get current patients from the service
    let patients: Patient[] = [];
    this.patientService.getPatients().subscribe(currentPatients => {
      patients = currentPatients;
    }).unsubscribe();
    
    if (patients.length === 0) {
      return false;
    }
    
    // Check if any patient has clinical data
    return patients.some((patient: Patient) => {
      const conditions = this.patientService.getPatientConditions(patient.id);
      const procedures = this.patientService.getPatientProcedures(patient.id);
      const medications = this.patientService.getPatientMedications(patient.id);
      return conditions.length > 0 || procedures.length > 0 || medications.length > 0;
    });
  }

  /**
   * Get summary of available data
   */
  getDataSummary(): { patients: number, conditions: number, procedures: number, medications: number } {
    // Get current patients from the service
    let patients: Patient[] = [];
    this.patientService.getPatients().subscribe(currentPatients => {
      patients = currentPatients;
    }).unsubscribe();
    
    let totalConditions = 0;
    let totalProcedures = 0;
    let totalMedications = 0;
    
    patients.forEach((patient: Patient) => {
      totalConditions += this.patientService.getPatientConditions(patient.id).length;
      totalProcedures += this.patientService.getPatientProcedures(patient.id).length;
      totalMedications += this.patientService.getPatientMedications(patient.id).length;
    });
    
    return {
      patients: patients.length,
      conditions: totalConditions,
      procedures: totalProcedures,
      medications: totalMedications
    };
  }
}
