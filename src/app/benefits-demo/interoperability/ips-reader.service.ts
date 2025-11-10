import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  IPSBundle, 
  IPSResource, 
  Patient, 
  Condition, 
  Procedure, 
  MedicationStatement, 
  AllergyIntolerance,
  ProcessedPatientData 
} from './ips-interfaces';

@Injectable({
  providedIn: 'root'
})
export class IPSReaderService {

  constructor(private http: HttpClient) { }

  /**
   * Load and parse an IPS bundle from a JSON file
   */
  loadIPSBundle(filePath: string): Observable<ProcessedPatientData> {
    return this.http.get<IPSBundle>(filePath).pipe(
      map(bundle => {
        if (!bundle) {
          throw new Error('Bundle is null or undefined');
        }
        
        if (typeof bundle === 'string') {
          try {
            bundle = JSON.parse(bundle);
          } catch (parseError) {
            throw new Error('Invalid JSON response');
          }
        }
        
        return this.parseIPSBundle(bundle);
      }),
      catchError(error => {
        // Try to load a mock bundle for testing
        return this.loadMockIPSBundle();
      })
    );
  }

  /**
   * Process IPS bundle from object
   */
  public processIPSBundleFromObject(bundle: IPSBundle): Observable<ProcessedPatientData> {
    return new Observable(observer => {
      try {
        if (!bundle) {
          throw new Error('Bundle is null or undefined');
        }
        
        const processedData = this.parseIPSBundle(bundle);
        observer.next(processedData);
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Load mock IPS bundle data for testing
   */
  public loadMockIPSBundle(): Observable<ProcessedPatientData> {
    const mockBundle: IPSBundle = {
      resourceType: 'Bundle',
      id: 'mock-ips-bundle',
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: 'urn:uuid:mock-patient',
          resource: {
            resourceType: 'Patient',
            id: 'mock-patient',
            name: [
              {
                family: 'Smith',
                given: ['John']
              }
            ],
            gender: 'male',
            birthDate: '1980-01-01'
          } as Patient
        },
        {
          fullUrl: 'urn:uuid:mock-condition',
          resource: {
            resourceType: 'Condition',
            id: 'mock-condition',
            code: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '44054006',
                  display: 'Diabetes mellitus type 2'
                }
              ]
            },
            subject: {
              reference: 'Patient/mock-patient'
            },
            clinicalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                  code: 'active',
                  display: 'Active'
                }
              ]
            }
          } as Condition
        }
      ]
    };

    // console.log('Using mock IPS bundle:', mockBundle);
    return of(this.parseIPSBundle(mockBundle));
  }

  /**
   * Parse an IPS bundle and extract patient data
   */
  private parseIPSBundle(bundle: IPSBundle): ProcessedPatientData {
    const result: ProcessedPatientData = {
      patient: null,
      conditions: [],
      procedures: [],
      medications: [],
      allergies: []
    };

    if (!bundle) {
      return result;
    }

    if (!bundle.entry) {
      return result;
    }

    if (!Array.isArray(bundle.entry)) {
      return result;
    }

    // First, create a map of all Medication resources by their ID
    const medicationMap = new Map<string, any>();
    bundle.entry.forEach(entry => {
      if (entry?.resource?.resourceType === 'Medication') {
        const medication = entry.resource;
        medicationMap.set(medication.id, medication);
      }
    });

    // Process each entry in the bundle
    bundle.entry.forEach((entry, index) => {
      if (entry && entry.resource) {
        this.processResource(entry.resource, result, medicationMap);
      }
    });

    return result;
  }

  /**
   * Process individual resources and categorize them
   */
  private processResource(resource: IPSResource, result: ProcessedPatientData, medicationMap?: Map<string, any>): void {
    switch (resource.resourceType) {
      case 'Patient':
        result.patient = resource as Patient;
        break;
      case 'Condition':
        const condition = resource as Condition;
        
        // Filter out "absent or unknown" conditions (special IPS negation statements)
        const isAbsentCondition = condition.code?.coding?.some(coding => 
          coding.system === 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips'
        );
        
        if (!isAbsentCondition) {
          result.conditions.push(condition);
        }
        break;
      case 'Procedure':
        result.procedures.push(resource as Procedure);
        break;
      case 'MedicationStatement':
        const medicationStatement = resource as MedicationStatement;
        
        // Check for "absent or unknown" medication statements
        let isAbsentMedication = false;
        if (medicationStatement.medicationCodeableConcept?.coding) {
          isAbsentMedication = medicationStatement.medicationCodeableConcept.coding.some(coding => 
            coding.system === 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips'
          );
        }
        
        // Skip absent/unknown medications
        if (isAbsentMedication) {
          break;
        }
        
        // If the medication uses a reference, resolve it to get the actual medication data
        if (medicationStatement.medicationReference && medicationMap) {
          const medicationId = this.extractIdFromReference(medicationStatement.medicationReference.reference);
          const medication = medicationMap.get(medicationId);
          
          if (medication && medication.code) {
            // Check if the referenced medication is also an absent/unknown concept
            const isAbsentReferencedMed = medication.code?.coding?.some((coding: any) => 
              coding.system === 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips'
            );
            
            if (!isAbsentReferencedMed) {
              // Create a copy with medicationCodeableConcept for easier display
              const enhancedMedicationStatement = {
                ...medicationStatement,
                medicationCodeableConcept: medication.code
              };
              result.medications.push(enhancedMedicationStatement);
            }
          } else {
            result.medications.push(medicationStatement);
          }
        } else {
          result.medications.push(medicationStatement);
        }
        break;
      case 'AllergyIntolerance':
        const allergyIntolerance = resource as AllergyIntolerance;
        
        // Filter out "absent or unknown" allergies (special IPS negation statements)
        const isAbsentOrUnknown = allergyIntolerance.code?.coding?.some(coding => 
          coding.system === 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips'
        );
        
        if (!isAbsentOrUnknown) {
          result.allergies.push(allergyIntolerance);
        }
        break;
    }
  }

  /**
   * Extract ID from a FHIR reference (e.g., "Medication/123" -> "123")
   */
  private extractIdFromReference(reference: string | undefined): string {
    if (!reference) return '';
    const parts = reference.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : reference;
  }

  /**
   * Get patient's full name as a string
   */
  getPatientName(patient: Patient | null): string {
    if (!patient || !patient.name || patient.name.length === 0) {
      return 'Unknown Patient';
    }

    const name = patient.name[0];
    const given = name.given ? name.given.join(' ') : '';
    const family = name.family || '';
    
    return `${given} ${family}`.trim();
  }

  /**
   * Get patient's birth date formatted
   */
  getPatientBirthDate(patient: Patient | null): string {
    if (!patient || !patient.birthDate) {
      return 'Unknown';
    }
    
    try {
      const date = new Date(patient.birthDate);
      return date.toLocaleDateString();
    } catch {
      return patient.birthDate;
    }
  }

  /**
   * Get patient's gender
   */
  getPatientGender(patient: Patient | null): string {
    if (!patient || !patient.gender) {
      return 'Unknown';
    }
    
    return patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1);
  }

  /**
   * Get condition display text
   */
  getConditionDisplay(condition: Condition): string {
    if (condition.code.text) {
      return condition.code.text;
    }
    
    if (condition.code.coding && condition.code.coding.length > 0) {
      return condition.code.coding[0].display || condition.code.coding[0].code;
    }
    
    return 'Unknown Condition';
  }

  /**
   * Get condition status
   */
  getConditionStatus(condition: Condition): string {
    if (condition.clinicalStatus && condition.clinicalStatus.coding.length > 0) {
      return condition.clinicalStatus.coding[0].display || condition.clinicalStatus.coding[0].code;
    }
    return 'Unknown Status';
  }

  /**
   * Get procedure display text
   */
  getProcedureDisplay(procedure: Procedure): string {
    if (procedure.code.text) {
      return procedure.code.text;
    }
    
    if (procedure.code.coding && procedure.code.coding.length > 0) {
      return procedure.code.coding[0].display || procedure.code.coding[0].code;
    }
    
    return 'Unknown Procedure';
  }

  /**
   * Get procedure date
   */
  getProcedureDate(procedure: Procedure): string {
    if (procedure.performedDateTime) {
      try {
        return new Date(procedure.performedDateTime).toLocaleDateString();
      } catch {
        return procedure.performedDateTime;
      }
    }
    
    if (procedure.performedPeriod && procedure.performedPeriod.start) {
      try {
        return new Date(procedure.performedPeriod.start).toLocaleDateString();
      } catch {
        return procedure.performedPeriod.start;
      }
    }
    
    if (procedure.performedString) {
      return procedure.performedString;
    }
    
    return 'Unknown Date';
  }

  /**
   * Get medication display text
   */
  getMedicationDisplay(medication: MedicationStatement): string {
    if (medication.medicationCodeableConcept) {
      if (medication.medicationCodeableConcept.text) {
        return medication.medicationCodeableConcept.text;
      }
      
      if (medication.medicationCodeableConcept.coding && medication.medicationCodeableConcept.coding.length > 0) {
        return medication.medicationCodeableConcept.coding[0].display || medication.medicationCodeableConcept.coding[0].code;
      }
    }
    
    return 'Unknown Medication';
  }

  /**
   * Get medication status
   */
  getMedicationStatus(medication: MedicationStatement): string {
    return medication.status.charAt(0).toUpperCase() + medication.status.slice(1);
  }

  /**
   * Get medication effective period
   */
  getMedicationEffectivePeriod(medication: MedicationStatement): string {
    if (medication.effectiveDateTime) {
      try {
        return new Date(medication.effectiveDateTime).toLocaleDateString();
      } catch {
        return medication.effectiveDateTime;
      }
    }
    
    if (medication.effectivePeriod) {
      const start = medication.effectivePeriod.start ? new Date(medication.effectivePeriod.start).toLocaleDateString() : 'Unknown';
      const end = medication.effectivePeriod.end ? new Date(medication.effectivePeriod.end).toLocaleDateString() : 'Ongoing';
      return `${start} - ${end}`;
    }
    
    if (medication.effectiveString) {
      return medication.effectiveString;
    }
    
    return 'Unknown Period';
  }

  /**
   * Get allergy display text
   */
  getAllergyDisplay(allergy: AllergyIntolerance): string {
    if (allergy.code.text) {
      return allergy.code.text;
    }
    
    if (allergy.code.coding && allergy.code.coding.length > 0) {
      return allergy.code.coding[0].display || allergy.code.coding[0].code;
    }
    
    return 'Unknown Allergy';
  }

  /**
   * Get allergy severity
   */
  getAllergySeverity(allergy: AllergyIntolerance): string {
    if (allergy.criticality) {
      return allergy.criticality.charAt(0).toUpperCase() + allergy.criticality.slice(1);
    }
    
    if (allergy.reaction && allergy.reaction.length > 0 && allergy.reaction[0].severity) {
      return allergy.reaction[0].severity.charAt(0).toUpperCase() + allergy.reaction[0].severity.slice(1);
    }
    
    return 'Unknown';
  }

  /**
   * Get allergy reactions
   */
  getAllergyReactions(allergy: AllergyIntolerance): string[] {
    if (!allergy.reaction || allergy.reaction.length === 0) {
      return ['Unknown reaction'];
    }
    
    return allergy.reaction.map(reaction => {
      if (reaction.manifestation && reaction.manifestation.length > 0) {
        return reaction.manifestation[0].coding[0].display || reaction.manifestation[0].coding[0].code;
      }
      return 'Unknown reaction';
    });
  }

  /**
   * Return empty patient data structure
   */
  private getEmptyPatientData(): ProcessedPatientData {
    return {
      patient: null,
      conditions: [],
      procedures: [],
      medications: [],
      allergies: []
    };
  }
}
