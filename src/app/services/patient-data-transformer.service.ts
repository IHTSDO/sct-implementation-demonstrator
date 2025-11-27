import { Injectable } from '@angular/core';
import { PatientService, Patient, Condition, Procedure, MedicationStatement } from './patient.service';
import { DataAnalyticsService } from './data-analytics.service';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface TransformedPatient {
  id: string;
  gender: string;
  dobYear: number;
  dataset: string;
  events: TransformedPatientEvent[];
  name?: string;
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
  transformPatientsToMockFormat(useIcd10Filtering: boolean = false): TransformedPatientResponse {
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
      const conditionsToProcess = useIcd10Filtering 
        ? conditions.filter(condition => 
            (condition as any).icd10Code && (condition as any).icd10Code.trim() !== ''
          )
        : conditions;
      
      conditionsToProcess.forEach(condition => {
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
            date: medication.effectiveDateTime || new Date().toISOString().split('T')[0],
            dateLong: new Date(medication.effectiveDateTime || new Date()).getTime()
          });
        }
      });

      // Transform patient data
      const transformedPatient: TransformedPatient = {
        id: patient.id,
        gender: this.mapGenderToMockFormat(patient.gender),
        dobYear: this.extractBirthYear(patient.birthDate),
        dataset: 'BrowserStorage',
        events: events,
        name: this.extractPatientName(patient)
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

  computePatientCountsByBaseCode(
    conditions: any[],
    procedures: any[],
    medications: any[],
    children: Map<string, Set<string>>
  ): Map<string, number> {
    // 1) Direct patients per code (from real data)
    const patientsByCode = new Map<string, Set<string>>();
  
    const add = (code: string | null, patientId: string | null) => {
      if (!code || !patientId) return;
      if (!patientsByCode.has(code)) patientsByCode.set(code, new Set());
      patientsByCode.get(code)!.add(patientId);
    };
  
    const all = [...conditions, ...procedures, ...medications];
    for (const r of all) {
      const code = this.extractCodeFromResource(r);      // e.g., "373134008"
      const pid  = this.getPatientIdFromResource(r);     // e.g., "123"
      add(code, pid);
    }
  
    // 2) Aggregate recursively: self ∪ descendants
    const memo = new Map<string, Set<string>>();
    const visiting = new Set<string>(); // cycle guard (shouldn’t happen in IS-A, but safe)
  
    const agg = (code: string): Set<string> => {
      if (memo.has(code)) return memo.get(code)!;
      if (visiting.has(code)) return patientsByCode.get(code) ?? new Set(); // break potential cycle
  
      visiting.add(code);
      // start with self
      const acc = new Set<string>(patientsByCode.get(code) ?? []);
      // union children
      const kids = children.get(code);
      if (kids) {
        for (const child of kids) {
          for (const p of agg(child)) acc.add(p);
        }
      }
      visiting.delete(code);
      memo.set(code, acc);
      return acc;
    };
  
    // 3) Produce counts for every code we’ve seen in data or as a parent/child
    const universe = new Set<string>([
      ...patientsByCode.keys(),
      ...Array.from(children.keys()),
      ...Array.from(children.values()).flatMap(s => Array.from(s))
    ]);
  
    const counts = new Map<string, number>();
    for (const code of universe) {
      counts.set(code, agg(code).size);
    }
    return counts;
  }

  /**
   * Transform benefits-demo patient data to hierarchy format (test5.csv structure)
   * Always uses SNOMED CT multiple inheritance support for proper analytics
   */
  transformPatientsToHierarchyFormat(useIcd10Filtering: boolean = false): Observable<HierarchyDataItem[]> {
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
    const allMedications: MedicationStatement[] = [];

    patients.forEach(patient => {
      const patientConditions = this.patientService.getPatientConditions(patient.id);
      
      if (useIcd10Filtering) {
        // Filter conditions to only include those with ICD-10 codes
        const conditionsWithIcd10 = patientConditions.filter(condition => 
          (condition as any).icd10Code && (condition as any).icd10Code.trim() !== ''
        );
        allConditions.push(...conditionsWithIcd10);
      } else {
        // Include all conditions
        allConditions.push(...patientConditions);
      }
      
      allProcedures.push(...this.patientService.getPatientProcedures(patient.id));
      allMedications.push(...this.patientService.getPatientMedications(patient.id));
    });

    // Extract unique codes
    const codes = this.dataAnalyticsService.extractClinicalCodes(allConditions, allProcedures, allMedications);

    // Clinical codes extracted successfully

    if (codes.length === 0) {
      console.warn('⚠️ [transformPatientsToHierarchyFormat] No clinical codes found!');
      return of([]);
    }

    // Get hierarchy from external service
    return this.dataAnalyticsService.getPartialHierarchy(codes, true).pipe(
      map(hierarchyData => {
        // Hierarchy data processed successfully
        // Always use multiple parent support for proper SNOMED CT analytics
        type MultiNode = { code: string; term: string; parents: string[] };

        interface HierarchyDataItem {
          id: string;        // code or code_suffix
          label: string;     // term
          parent: string | null;
          value: number;     // fill later with counts; 0 by default
          patientCount?: number;
          labelCount?: number;
          code?: string;     // base SNOMED code (no suffix)
        }

        /** Build: parentCode -> Set(childCode) and code->node map */
        function buildChildIndex(data: MultiNode[]) {
          const byCode = new Map<string, MultiNode>();
          const children = new Map<string, Set<string>>();

          for (const n of data) {
            byCode.set(n.code, n);
          }
          for (const n of data) {
            const ps = n.parents ?? [];
            if (ps.length === 0) continue;
            for (const p of ps) {
              if (!children.has(p)) children.set(p, new Set());
              children.get(p)!.add(n.code);
            }
          }
          return { byCode, children };
        }

        /** Pick roots: prefer SNOMED root 138875005, otherwise anything with no parents or missing parents */
        function pickRoots(data: MultiNode[], byCode: Map<string, MultiNode>) {
          const rootCode = "138875005";
          const hasRoot = byCode.has(rootCode);
          if (hasRoot) return [rootCode];

          const codes = new Set(data.map(d => d.code));
          const roots: string[] = [];
          for (const n of data) {
            const ps = n.parents ?? [];
            if (ps.length === 0 || ps.every(p => !codes.has(p))) {
              roots.push(n.code);
            }
          }
          return Array.from(new Set(roots));
        }

        /** Helper: create stable instance ids per code */
        function makeInstanceAllocator() {
          const counters = new Map<string, number>();
          return (code: string): { id: string; n: number } => {
            const next = (counters.get(code) ?? 0) + 1;
            counters.set(code, next);
            // First placement keeps the plain code; subsequent get _2, _3, ...
            return { id: next === 1 ? code : `${code}_${next}`, n: next };
          };
        }

        /** Build mono forest (flat array) duplicating nodes per parent, suffixing deterministically */
        function buildMonoHierarchy(data: MultiNode[]): HierarchyDataItem[] {
          const { byCode, children } = buildChildIndex(data);
          const roots = pickRoots(data, byCode);
          const alloc = makeInstanceAllocator();

          const out: HierarchyDataItem[] = [];
          const seenInstance = new Set<string>(); // guard against accidental re-add

          type StackItem = { code: string; parentId: string | null };
          const pushNode = (code: string, parentId: string | null) => {
            const node = byCode.get(code);
            if (!node) return null;
            const { id } = alloc(code);
            const item: HierarchyDataItem = {
              id,
              label: node.term,
              parent: parentId,
              value: 0,
              patientCount: 0,
              labelCount: 0,
              code
            };
            if (!seenInstance.has(id)) {
              out.push(item);
              seenInstance.add(id);
            }
            return item;
          };

          const stack: StackItem[] = [];
          // Start all roots as top-level
          for (const r of roots) stack.push({ code: r, parentId: null });

          while (stack.length) {
            const { code, parentId } = stack.pop()!;
            const created = pushNode(code, parentId);
            if (!created) continue;

            const kids = Array.from(children.get(code) ?? []);
            // Optional: sort for deterministic layout (A–Z by term)
            kids.sort((a, b) => (byCode.get(a)?.term || a).localeCompare(byCode.get(b)?.term || b));

            for (const childCode of kids) {
              // IMPORTANT: parentId for the child must be the *instance id* we just created
              stack.push({ code: childCode, parentId: created.id });
            }
          }

          // Include any isolated subgraphs not reachable from chosen roots
          const placedBaseCodes = new Set(out.map(n => n.code));
          const missing = data.filter(d => !placedBaseCodes.has(d.code));
          for (const d of missing) {
            const orphan = pushNode(d.code, null);
            if (!orphan) continue;
            const kids = Array.from(children.get(d.code) ?? []);
            for (const c of kids) {
              stack.push({ code: c, parentId: orphan.id });
            }
            // drain recursively
            while (stack.length) {
              const { code, parentId } = stack.pop()!;
              const created = pushNode(code, parentId);
              if (!created) continue;
              const kk = Array.from(children.get(code) ?? []);
              for (const childCode of kk) stack.push({ code: childCode, parentId: created.id });
            }
          }

          return out;
        }

        const monoFlat: HierarchyDataItem[] = buildMonoHierarchy(hierarchyData);

        // 1) Build parent->children index from the multi-hierarchy (by *base* codes)
        const { children } = (function buildChildIndex(data: { code: string; term: string; parents: string[] }[]) {
          const kids = new Map<string, Set<string>>();
          for (const n of data) for (const p of (n.parents ?? [])) {
            if (!kids.has(p)) kids.set(p, new Set());
            kids.get(p)!.add(n.code);
          }
          return { children: kids }; // Map<parentCode, Set<childCode>>
        })(hierarchyData);

        // 2) Compute unique-patient sets per base code, aggregated over descendants
        const countsByBase = this.computePatientCountsByBaseCode(
          allConditions,
          allProcedures,
          allMedications,
          children
        );

        // 3) Attach counts to each mono node instance (by its *base* code)
        const monoWithCounts = monoFlat.map(n => {
          const count = countsByBase.get(n.code!) ?? 0;
          return {
            ...n,
            parent: n.parent || '', // Ensure parent is never null for the exported interface
            patientCount: count,
            value: count
          };
        });

        return monoWithCounts;
      }),
      catchError(error => {
        // Fallback: create simple hierarchy from available codes
        return of(this.createSimpleHierarchy(allConditions, allProcedures, allMedications));
      })
    );
  }

  /**
   * Assign patient counts to flat tree structure (for multiple parent support)
   */
  private assignPatientCountsToFlatTree(
    flatTree: any[],
    _allConditions: any[] = [],
    _allProcedures: any[] = [],
    _allMedications: any[] = []
  ): HierarchyDataItem[] {
    return flatTree.map((n: any) => ({
      id: n.id,
      label: n.label,
      parent: n.parent ?? '', // Ensure parent is never null for the exported interface
      value: 1,
      patientCount: 1,
      // keep any existing labelCount if present
      labelCount: n.labelCount ?? n.label_count,
      // keep code if your UI/tooltips use it
      code: n.code
    }));
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
   * Extract patient name from FHIR Patient resource
   */
  private extractPatientName(patient: Patient): string | undefined {
    if (!patient.name || patient.name.length === 0) {
      return undefined;
    }

    // Prefer 'official' name, then 'usual', then first available
    const officialName = patient.name.find(n => n.use === 'official');
    const usualName = patient.name.find(n => n.use === 'usual');
    const nameToUse = officialName || usualName || patient.name[0];

    // Build name from family and given names
    if (nameToUse.text) {
      return nameToUse.text;
    }

    const parts: string[] = [];
    if (nameToUse.family) {
      parts.push(nameToUse.family);
    }
    if (nameToUse.given && nameToUse.given.length > 0) {
      parts.push(...nameToUse.given);
    }

    return parts.length > 0 ? parts.join(' ') : undefined;
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
  private createSimpleHierarchy(conditions: Condition[], procedures: Procedure[], medications: MedicationStatement[]): HierarchyDataItem[] {
    const codeCounts = new Map<string, { count: number, term: string, patients: Set<string> }>();

    // Count codes from all clinical data (conditions are already filtered for ICD-10 codes)
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
  hasPatientData(useIcd10Filtering: boolean = false): boolean {
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
      
      if (useIcd10Filtering) {
        // Only count conditions with ICD-10 codes
        const conditionsWithIcd10 = conditions.filter(condition => 
          (condition as any).icd10Code && (condition as any).icd10Code.trim() !== ''
        );
        return conditionsWithIcd10.length > 0 || procedures.length > 0 || medications.length > 0;
      } else {
        // Count all conditions
        return conditions.length > 0 || procedures.length > 0 || medications.length > 0;
      }
    });
  }

  /**
   * Get summary of available data
   */
  getDataSummary(useIcd10Filtering: boolean = false): { patients: number, conditions: number, procedures: number, medications: number } {
    // Get current patients from the service
    let patients: Patient[] = [];
    this.patientService.getPatients().subscribe(currentPatients => {
      patients = currentPatients;
    }).unsubscribe();

    let totalConditions = 0;
    let totalProcedures = 0;
    let totalMedications = 0;

    patients.forEach((patient: Patient) => {
      const conditions = this.patientService.getPatientConditions(patient.id);
      
      if (useIcd10Filtering) {
        // Only count conditions with ICD-10 codes
        const conditionsWithIcd10 = conditions.filter(condition => 
          (condition as any).icd10Code && (condition as any).icd10Code.trim() !== ''
        );
        totalConditions += conditionsWithIcd10.length;
      } else {
        // Count all conditions
        totalConditions += conditions.length;
      }
      
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
