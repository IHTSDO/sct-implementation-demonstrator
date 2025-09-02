import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface HierarchyNode {
  parents: string[];
  code: string;
  term: string;
}

export interface PartialHierarchyRequest {
  system: string;
  includeTerms: boolean;
  codes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DataAnalyticsService {
  private readonly analyticsServerUrl = 'https://snowstorm-lite.nw.r.appspot.com';
  private readonly enableExternalService = true; // Set to false to disable external calls (disabled due to CORS)

  constructor(private http: HttpClient) { }

  /**
   * Get partial hierarchy for SNOMED CT codes
   * @param codes Array of SNOMED CT concept codes
   * @param includeTerms Whether to include term descriptions (default: true)
   * @returns Observable<HierarchyNode[]>
   */
  getPartialHierarchy(codes: string[], includeTerms: boolean = true): Observable<HierarchyNode[]> {
    const url = `${this.analyticsServerUrl}/fhir/partial-hierarchy`;
    
    // Request details logged for debugging
    
    if (!this.enableExternalService) {
      // Return empty result to trigger fallback
      return new Observable(observer => {
        observer.error(new Error('External analytics service disabled'));
      });
    }
    
    const requestBody: PartialHierarchyRequest = {
      system: 'http://snomed.info/sct',
      includeTerms: includeTerms,
      codes: codes
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<HierarchyNode[]>(url, requestBody, { headers }).pipe(
      map(response => {
        // Raw response processed successfully
        return response;
      })
    );
  }

  /**
   * Extract unique codes from patient clinical data
   * @param conditions Array of conditions
   * @param procedures Array of procedures  
   * @param medications Array of medications
   * @returns Array of unique SNOMED CT codes
   */
  extractClinicalCodes(conditions: any[], procedures: any[], medications: any[]): string[] {
    const codes = new Set<string>();

    // Extract codes from conditions
    conditions.forEach(condition => {
      if (condition.code?.coding && condition.code.coding.length > 0) {
        const code = condition.code.coding[0].code;
        if (code) {
          codes.add(code);
        }
      }
    });

    // Extract codes from procedures
    procedures.forEach(procedure => {
      if (procedure.code?.coding && procedure.code.coding.length > 0) {
        const code = procedure.code.coding[0].code;
        if (code) {
          codes.add(code);
        }
      }
    });

    // Extract codes from medications
    medications.forEach(medication => {
      if (medication.medicationCodeableConcept?.coding && medication.medicationCodeableConcept.coding.length > 0) {
        const code = medication.medicationCodeableConcept.coding[0].code;
        if (code) {
          codes.add(code);
        }
      }
    });

    return Array.from(codes);
  }

  /**
   * Build hierarchical tree structure with SNOMED CT multiple parent support
   * This creates duplicate nodes for concepts with multiple parents (like CSV format)
   * @param hierarchyData Array of hierarchy nodes with counts
   * @returns Hierarchical tree structure for Plotly with multiple parent support
   */
  buildHierarchicalTree(hierarchyData: any[]): any[] {
    // Debug target medication codes specifically
    const targetMedCodes1 = ['318420003', '1332437002', '374627000'];
    const targetMedNodes = hierarchyData.filter(n => targetMedCodes1.includes(n.code));
    
    // Target medications analysis completed

    const allNodes: any[] = [];
    const codeCounters = new Map<string, number>(); // Track suffix numbers for each code
    const codeToNodesMap = new Map<string, any[]>(); // Map codes to all their node instances

    // First pass: Create all nodes with proper suffixes (like CSV format)
    hierarchyData.forEach(node => {
      if (!node.parents || node.parents.length === 0) {
        // Root node - create once with _1 suffix
        const rootNode = {
          id: `${node.code}_1`,
          label: node.term || node.code,
          parent: '',
          value: node.patientCount || 0,
          patientCount: node.patientCount || 0,
          code: node.code,
          term: node.term,
          originalParent: '',
          allParents: []
        };
        allNodes.push(rootNode);
        
        // Track this node
        if (!codeToNodesMap.has(node.code)) {
          codeToNodesMap.set(node.code, []);
        }
        codeToNodesMap.get(node.code)!.push(rootNode);
        codeCounters.set(node.code, 1);
      } else {
        // Create a separate node instance for each parent relationship
        let counter = codeCounters.get(node.code) || 0;
        
        node.parents.forEach((parentCode: string) => {
          counter++;
          const duplicateNode = {
            id: `${node.code}_${counter}`,
            label: node.term || node.code,
            parent: '', // Will be set in second pass
            value: node.patientCount || 0,
            patientCount: node.patientCount || 0,
            code: node.code,
            term: node.term,
            originalParent: parentCode,
            allParents: node.parents || []
          };
          allNodes.push(duplicateNode);
          
          // Track this node
          if (!codeToNodesMap.has(node.code)) {
            codeToNodesMap.set(node.code, []);
          }
          codeToNodesMap.get(node.code)!.push(duplicateNode);
        });
        
        codeCounters.set(node.code, counter);
      }
    });

    // Second pass: Set parent relationships (like CSV format)
    allNodes.forEach(node => {
      if (node.originalParent) {
        // Find the first node instance with the matching parent code
        const parentNodes = codeToNodesMap.get(node.originalParent);
        if (parentNodes && parentNodes.length > 0) {
          // Use the first instance of the parent (like CSV format: parentCode_1)
          node.parent = parentNodes[0].id;
        } else {
          // If parent not found in expanded nodes, it might be a root or external reference
          console.warn(`⚠️ Parent ${node.originalParent} not found for node ${node.code}`);
        }
      }
    });

    // Debug the structure to match CSV format
    const rootNodes = allNodes.filter(n => !n.parent || n.parent === '');
    const childNodes = allNodes.filter(n => n.parent && n.parent !== '');
    
    // Debug target medications in the expanded tree
    const targetMedCodes2 = ['318420003', '1332437002', '374627000'];
    const targetMedExpandedNodes = allNodes.filter(n => targetMedCodes2.includes(n.code));
    
    // Target medications expanded tree analysis completed

    // Removed detailed statistics logging

    return allNodes;
  }

  /**
   * Assign hierarchical counts to the tree structure
   * @param hierarchyTree The hierarchical tree structure
   * @param conditions Array of conditions to count
   * @param procedures Array of procedures to count
   * @param medications Array of medications to count
   * @returns Tree with assigned counts
   */
  assignHierarchicalCounts(hierarchyTree: any[], conditions: any[], procedures: any[], medications: any[]): any[] {
    // Create maps for both event counts and patient counts
    const eventCounts = this.createEventCountMap(conditions, procedures, medications);
    const patientCounts = this.createPatientCountMap(conditions, procedures, medications);
    const patientSets = this.createPatientSetsMap(conditions, procedures, medications);

    // Process each root node and its descendants
    const processedTree = hierarchyTree.map(rootNode => 
      this.processNodeWithCounts(rootNode, eventCounts, patientCounts, patientSets)
    );

    return processedTree;
  }

  /**
   * Create a map of concept codes to their occurrence counts in events
   * @param conditions Array of conditions
   * @param procedures Array of procedures
   * @param medications Array of medications
   * @returns Map of concept code to count
   */
  private createEventCountMap(conditions: any[], procedures: any[], medications: any[]): Map<string, number> {
    const countMap = new Map<string, number>();

    // Count conditions
    conditions.forEach(condition => {
      const code = this.extractCodeFromResource(condition);
      if (code) {
        countMap.set(code, (countMap.get(code) || 0) + 1);
      }
    });

    // Count procedures
    procedures.forEach(procedure => {
      const code = this.extractCodeFromResource(procedure);
      if (code) {
        countMap.set(code, (countMap.get(code) || 0) + 1);
      }
    });

    // Count medications
    medications.forEach(medication => {
      const code = this.extractCodeFromResource(medication);
      if (code) {
        countMap.set(code, (countMap.get(code) || 0) + 1);
      }
    });

    return countMap;
  }

  /**
   * Create a map of concept codes to unique patient counts
   * @param conditions Array of conditions
   * @param procedures Array of procedures
   * @param medications Array of medications
   * @returns Map of concept code to unique patient count
   */
  private createPatientCountMap(conditions: any[], procedures: any[], medications: any[]): Map<string, number> {
    const patientSets = this.createPatientSetsMap(conditions, procedures, medications);
    
    // Convert Sets to counts
    const patientCountMap = new Map<string, number>();
    patientSets.forEach((patientSet, code) => {
      patientCountMap.set(code, patientSet.size);
    });

    return patientCountMap;
  }

  /**
   * Create a map of concept codes to unique patient ID sets
   * @param conditions Array of conditions
   * @param procedures Array of procedures
   * @param medications Array of medications
   * @returns Map of concept code to patient ID sets
   */
  private createPatientSetsMap(conditions: any[], procedures: any[], medications: any[]): Map<string, Set<string>> {
    const patientMap = new Map<string, Set<string>>();

    // Count unique patients for conditions
    conditions.forEach(condition => {
      const code = this.extractCodeFromResource(condition);
      const patientId = condition.subject?.reference?.replace('Patient/', '') || condition.patientId;
      if (code && patientId) {
        if (!patientMap.has(code)) {
          patientMap.set(code, new Set());
        }
        patientMap.get(code)!.add(patientId);
      }
    });

    // Count unique patients for procedures
    procedures.forEach(procedure => {
      const code = this.extractCodeFromResource(procedure);
      const patientId = procedure.subject?.reference?.replace('Patient/', '') || procedure.patientId;
      if (code && patientId) {
        if (!patientMap.has(code)) {
          patientMap.set(code, new Set());
        }
        patientMap.get(code)!.add(patientId);
      }
    });

    // Count unique patients for medications
    medications.forEach(medication => {
      const code = this.extractCodeFromResource(medication);
      const patientId = medication.subject?.reference?.replace('Patient/', '') || medication.patientId;
      if (code && patientId) {
        if (!patientMap.has(code)) {
          patientMap.set(code, new Set());
        }
        patientMap.get(code)!.add(patientId);
      }
    });

    return patientMap;
  }

  /**
   * Extract SNOMED CT code from a clinical resource
   * @param resource Clinical resource (condition, procedure, medication)
   * @returns SNOMED CT code or null
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
   * Recursively process a node and assign counts
   * @param node The current node to process
   * @param eventCounts Map of concept codes to their event counts
   * @param patientCounts Map of concept codes to their unique patient counts
   * @param allPatientsByCode Map of concept codes to their unique patient ID sets
   * @returns Node with assigned counts
   */
  private processNodeWithCounts(node: any, eventCounts: Map<string, number>, patientCounts: Map<string, number>, allPatientsByCode?: Map<string, Set<string>>): any {
    // Process children first (bottom-up approach)
    const processedChildren = node.children.map((child: any) => 
      this.processNodeWithCounts(child, eventCounts, patientCounts, allPatientsByCode)
    );

    // Calculate event counts from children
    const childrenEventCount = processedChildren.reduce((sum: number, child: any) => sum + (child.eventCount || 0), 0);

    // Calculate unique patient count from children
    const allChildPatients = new Set<string>();
    processedChildren.forEach((child: any) => {
      if (child.uniquePatients) {
        child.uniquePatients.forEach((patientId: string) => allChildPatients.add(patientId));
      }
    });
    const childrenPatientCount = allChildPatients.size;

    // Get direct counts for this concept
    const directEventCount = eventCounts.get(node.code) || 0;
    const directPatientCount = patientCounts.get(node.code) || 0;
    const directPatients = allPatientsByCode?.get(node.code) || new Set<string>();

    // Combine unique patients from children and direct
    const allUniquePatients = new Set<string>([...allChildPatients, ...directPatients]);
    const totalPatientCount = allUniquePatients.size;

    // Total event count = children events + direct events
    const totalEventCount = childrenEventCount + directEventCount;

    return {
      ...node,
      eventCount: totalEventCount,
      patientCount: totalPatientCount,
      uniquePatients: allUniquePatients,
      childrenEventCount: childrenEventCount,
      childrenPatientCount: childrenPatientCount,
      directEventCount: directEventCount,
      directPatientCount: directPatientCount,
      children: processedChildren
    };
  }

  /**
   * Get analytics server URL for debugging/testing
   * @returns Analytics server base URL
   */
  getAnalyticsServerUrl(): string {
    return this.analyticsServerUrl;
  }
}
