import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TerminologyService } from '../../services/terminology.service';
import { 
  TranslationResult, 
  TranslationOptions, 
  PreviewData, 
  CodeItem, 
  FHIRValueSet,
  FHIRParameters
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {

  constructor(private terminologyService: TerminologyService) {}

  translateConcepts(
    codes: CodeItem[], 
    context: { edition: string; language: string; terminologyService: string }
  ): Observable<TranslationResult> {
    return new Observable(observer => {
      // Create a ValueSet from the codes
      const valueSet = this.createValueSetFromCodes(codes, context);
      
      // Expand the ValueSet to get translations
      this.terminologyService.expandInlineValueSet(valueSet).subscribe({
        next: (expandedValueSet) => {
          const result = this.processTranslationResult(codes, expandedValueSet);
          observer.next(result);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  generatePreview(
    originalCodes: CodeItem[], 
    translatedCodes: CodeItem[]
  ): PreviewData[] {
    const translationMap = new Map<string, string>();
    
    translatedCodes.forEach(concept => {
      if (concept.code && concept.display) {
        translationMap.set(concept.code.trim(), concept.display);
      }
    });

    return originalCodes.map(codeItem => ({
      code: codeItem.code,
      originalDisplay: codeItem.display || 'N/A',
      translatedDisplay: translationMap.get(codeItem.code) || 'Not found'
    }));
  }

  async translateMapFile(
    data: any[], 
    context: { edition: string; language: string; terminologyService: string }
  ): Promise<any[]> {
    const headers = Object.keys(data[0]);
    
    // Find target columns
    const targetCodeCol = headers.find(h => h.toLowerCase().includes('target code'))!;
    const targetDisplayCol = headers.find(h => h.toLowerCase().includes('target display'))!;

    // Extract target codes
    const targetCodes = data
      .map(row => ({
        code: String(row[targetCodeCol] || '').trim(),
        display: String(row[targetDisplayCol] || '').trim()
      }))
      .filter(item => this.isValidConcept(item));

    if (targetCodes.length === 0) {
      throw new Error('No valid target codes found in the file');
    }

    // Create ValueSet and expand it
    const sourceValueSet = this.terminologyService.getValueSetFromCodes(targetCodes);
    const expandedValueSet = await this.terminologyService.expandInlineValueSet(sourceValueSet).toPromise();
    
    // Create translation map
    const translationMap = new Map<string, string>();
    if (expandedValueSet?.expansion?.contains) {
      expandedValueSet.expansion.contains.forEach((concept: any) => {
        if (concept.code && concept.display) {
          translationMap.set(concept.code.trim(), concept.display);
        }
      });
    }

    // Apply translations to the data
    return data.map(row => {
      const newRow = { ...row };
      const code = String(row[targetCodeCol] || '').trim();
      if (code && translationMap.has(code)) {
        newRow[targetDisplayCol] = translationMap.get(code);
      }
      return newRow;
    });
  }

  private createValueSetFromCodes(
    codes: CodeItem[], 
    context: { edition: string; language: string; terminologyService: string }
  ): FHIRParameters {
    return {
      resourceType: 'Parameters',
      parameter: [{
        name: 'valueSet',
        resource: {
          resourceType: 'ValueSet',
          url: 'http://snomed.info/sct/valueset/translation-temp',
          name: 'TranslationValueSet',
          status: 'draft',
          experimental: true,
          compose: {
            include: [{
              system: 'http://snomed.info/sct',
              version: context.terminologyService,
              concept: codes
            }]
          }
        }
      }]
    };
  }

  private processTranslationResult(originalCodes: CodeItem[], expandedValueSet: FHIRValueSet): TranslationResult {
    const translatedCodes = expandedValueSet.expansion?.contains?.map(concept => ({
      code: concept.code,
      display: concept.display || ''
    })) || [];

    const preview = this.generatePreview(originalCodes, translatedCodes);

    return {
      original: originalCodes.map(item => ({
        code: item.code,
        display: item.display || ''
      })),
      translated: translatedCodes,
      preview,
      totalCount: expandedValueSet.expansion?.total || 0
    };
  }

  private isValidConcept(concept: { code: string; display: string }): boolean {
    return !!concept.code && 
           concept.code !== 'undefined' && 
           concept.code !== 'null' && 
           concept.code !== '' &&
           !!concept.display && 
           concept.display !== 'undefined' && 
           concept.display !== 'null' && 
           concept.display !== '';
  }
}
