import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { TerminologyService } from '../../services/terminology.service';
import { 
  FHIRValueSet, 
  FHIRParameters, 
  ValueSetMetadata, 
  CodeItem, 
  TerminologyContext,
  FHIRPackage,
  FHIRResource
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ValueSetService {

  constructor(private terminologyService: TerminologyService) {}

  createValueSet(codes: CodeItem[], metadata: ValueSetMetadata, context: TerminologyContext): FHIRParameters {
    const valueSet: FHIRValueSet = {
      resourceType: 'ValueSet',
      url: metadata.uri,
      name: metadata.name,
      version: metadata.version,
      status: 'draft',
      experimental: true,
      compose: {
        include: [{
          system: 'http://snomed.info/sct',
          version: context.fhirUrlParam,
          concept: codes
        }]
      }
    };

    return {
      resourceType: 'Parameters',
      parameter: [{
        name: 'valueSet',
        resource: valueSet
      }]
    };
  }

  expandValueSet(valueSet: FHIRParameters): Observable<FHIRValueSet> {
    return this.terminologyService.expandInlineValueSet(valueSet);
  }

  expandValueSetFromEcl(eclExpression: string, context: TerminologyContext): Observable<FHIRValueSet> {
    return this.terminologyService.expandValueSet(eclExpression, '', 0, 1000);
  }

  generateFHIRPackage(
    sourceConcepts: CodeItem[], 
    snomedConcepts: CodeItem[], 
    metadata: ValueSetMetadata,
    mapBetweenValueSets: boolean = false
  ): FHIRPackage {
    this.validateConceptsForPackage(sourceConcepts, snomedConcepts);

    // Use sourceSystemUri if provided, otherwise derive from base URI
    const codeSystemUrl = metadata.sourceSystemUri || `${metadata.uri}/CodeSystem/${metadata.name}`;
    const valueSetUrl = `${metadata.uri}/ValueSet/${metadata.name}`;
    const snomedValueSetUrl = `${metadata.uri}/ValueSet/${metadata.name}-snomed`;
    const conceptMapUrl = `${metadata.uri}/ConceptMap/${metadata.name}-to-snomed`;

    const codeSystem = this.createCodeSystem(sourceConcepts, codeSystemUrl, metadata);
    const valueSet = this.createValueSetResource(sourceConcepts, valueSetUrl, codeSystemUrl, metadata);
    const snomedValueSet = this.createValueSetResource(snomedConcepts, snomedValueSetUrl, 'http://snomed.info/sct', metadata);
    const conceptMap = this.createConceptMap(
      sourceConcepts, 
      snomedConcepts, 
      conceptMapUrl, 
      codeSystemUrl, 
      metadata, 
      mapBetweenValueSets, 
      valueSetUrl, 
      snomedValueSetUrl
    );

    return {
      manifest: {
        name: `${metadata.name}.codesystem.package`,
        version: metadata.version,
        fhirVersion: '4.0.1',
        resources: [
          { type: 'CodeSystem', reference: `CodeSystem/${codeSystem.name}` },
          { type: 'ValueSet', reference: `ValueSet/${valueSet.name}` },
          { type: 'ValueSet', reference: `ValueSet/${snomedValueSet.name}` },
          { type: 'ConceptMap', reference: `ConceptMap/${conceptMap.name}` }
        ]
      },
      index: {
        'index-version': 1,
        files: [
          { filename: `CodeSystem/${codeSystem.name}.json`, resourceType: 'CodeSystem', id: codeSystem.id, url: codeSystem.url },
          { filename: `ValueSet/${valueSet.name}.json`, resourceType: 'ValueSet', id: valueSet.id, url: valueSet.url },
          { filename: `ValueSet/${snomedValueSet.name}.json`, resourceType: 'ValueSet', id: snomedValueSet.id, url: snomedValueSet.url },
          { filename: `ConceptMap/${conceptMap.name}.json`, resourceType: 'ConceptMap', id: conceptMap.id, url: conceptMap.url }
        ]
      },
      resources: { codeSystem, valueSet, snomedValueSet, conceptMap }
    };
  }

  async createTarGz(packageData: FHIRPackage): Promise<Blob> {
    const zip = new JSZip();
    
    const packageFolder = zip.folder('package');
    if (!packageFolder) throw new Error('Failed to create package folder');
    
    const codeSystemFolder = packageFolder.folder('CodeSystem');
    const valueSetFolder = packageFolder.folder('ValueSet');
    const conceptMapFolder = packageFolder.folder('ConceptMap');
    
    if (!codeSystemFolder || !valueSetFolder || !conceptMapFolder) {
      throw new Error('Failed to create resource folders');
    }

    // Add resources with proper formatting
    codeSystemFolder.file(
      `${packageData.resources.codeSystem.name}.json`,
      JSON.stringify(packageData.resources.codeSystem, null, 2)
    );
    
    valueSetFolder.file(
      `${packageData.resources.valueSet.name}.json`,
      JSON.stringify(packageData.resources.valueSet, null, 2)
    );
    
    valueSetFolder.file(
      `${packageData.resources.snomedValueSet.name}.json`,
      JSON.stringify(packageData.resources.snomedValueSet, null, 2)
    );

    conceptMapFolder.file(
      `${packageData.resources.conceptMap.name}.json`,
      JSON.stringify(packageData.resources.conceptMap, null, 2)
    );
    
    packageFolder.file('package.json', JSON.stringify(packageData.manifest, null, 2));
    packageFolder.file('.index.json', JSON.stringify(packageData.index, null, 2));
    
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      }
    });
  }

  downloadValueSet(valueSet: FHIRValueSet | FHIRParameters, filename: string): void {
    const valueSetString = JSON.stringify(valueSet, null, 2);
    const blob = new Blob([valueSetString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async downloadFHIRPackage(packageData: FHIRPackage, filename: string): Promise<void> {
    const tarBlob = await this.createTarGz(packageData);
    saveAs(tarBlob, filename);
  }

  private validateConceptsForPackage(sourceConcepts: CodeItem[], snomedConcepts: CodeItem[]): void {
    if (!sourceConcepts || !snomedConcepts || sourceConcepts.length === 0 || snomedConcepts.length === 0) {
      throw new Error('Invalid input: concepts arrays cannot be empty or undefined');
    }

    if (sourceConcepts.length !== snomedConcepts.length) {
      throw new Error('Invalid input: source and SNOMED concept arrays must have the same length');
    }

    const validSourceConcepts = sourceConcepts.filter(c => c && c.code && c.display);
    const validSnomedConcepts = snomedConcepts.filter(c => c && c.code && c.display);

    if (validSourceConcepts.length === 0 || validSnomedConcepts.length === 0) {
      throw new Error('No valid concepts found after filtering');
    }
  }

  private createCodeSystem(concepts: CodeItem[], url: string, metadata: ValueSetMetadata): FHIRResource {
    return {
      resourceType: 'CodeSystem',
      id: uuidv4(),
      url,
      name: `${metadata.name}CodeSystem`,
      version: metadata.version,
      status: 'active',
      content: 'complete',
      concept: concepts
    };
  }

  private createValueSetResource(concepts: CodeItem[], url: string, system: string, metadata: ValueSetMetadata): FHIRResource {
    return {
      resourceType: 'ValueSet',
      id: uuidv4(),
      url,
      name: `${metadata.name}ValueSet`,
      version: metadata.version,
      status: 'active',
      compose: {
        include: [{
          system,
          concept: concepts
        }]
      }
    };
  }

  private createConceptMap(
    sourceConcepts: CodeItem[], 
    snomedConcepts: CodeItem[], 
    url: string, 
    codeSystemUrl: string, 
    metadata: ValueSetMetadata,
    mapBetweenValueSets: boolean = false,
    valueSetUrl?: string,
    snomedValueSetUrl?: string
  ): FHIRResource {
    // Determine source and target URIs based on mapping mode
    const sourceUri = mapBetweenValueSets && valueSetUrl ? valueSetUrl : codeSystemUrl;
    const targetUri = mapBetweenValueSets && snomedValueSetUrl ? snomedValueSetUrl : 'http://snomed.info/sct';

    return {
      resourceType: 'ConceptMap',
      id: uuidv4(),
      url,
      name: `${metadata.name}ToSnomedMap`,
      version: metadata.version,
      status: 'active',
      sourceUri,
      targetUri,
      group: [{
        source: sourceUri,
        target: targetUri,
        element: sourceConcepts.map((concept, index) => {
          const snomedConcept = snomedConcepts[index];
          if (!snomedConcept) {
            throw new Error(`No matching SNOMED concept found for source concept ${concept.code}`);
          }
          return {
            code: concept.code,
            display: concept.display,
            target: [{
              code: snomedConcept.code,
              display: snomedConcept.display,
              equivalence: 'equivalent'
            }]
          };
        })
      }]
    };
  }
}
