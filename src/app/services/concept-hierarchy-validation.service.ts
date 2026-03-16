import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TerminologyService } from './terminology.service';

export type HierarchyRelation = 'exact-match' | 'candidate-is-ancestor' | 'candidate-is-descendant';

export interface RecordConcept {
  code: string;
  label?: string;
  sourceId?: string;
  section?: string;
}

export interface HierarchyMatch {
  existing: RecordConcept;
  relation: HierarchyRelation;
}

export interface HierarchyValidationResult {
  candidate: RecordConcept;
  matches: HierarchyMatch[];
  hasConflict: boolean;
}

export interface HierarchyValidationProgress {
  current: number;
  total: number;
  message: string;
  currentCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConceptHierarchyValidationService {
  private ancestorsCache = new Map<string, Promise<Set<string>>>();
  private ancestorFetchQueue: Promise<void> = Promise.resolve();

  constructor(private terminologyService: TerminologyService) {}

  async getAncestors(conceptId: string): Promise<Set<string>> {
    if (!conceptId) {
      return new Set<string>();
    }

    const cachedPromise = this.ancestorsCache.get(conceptId);
    if (cachedPromise) {
      return cachedPromise;
    }

    const requestPromise = this.enqueueAncestorFetch(async () => {
      const response = await firstValueFrom(this.terminologyService.getAncestors(conceptId));
      const ancestorIds = this.extractConceptIdsFromExpansion(response);
      return new Set<string>(ancestorIds);
    });

    this.ancestorsCache.set(conceptId, requestPromise);

    try {
      return await requestPromise;
    } catch (error) {
      this.ancestorsCache.delete(conceptId);
      throw error;
    }
  }

  async validateCandidateAgainstRecord(
    candidate: RecordConcept,
    existingConcepts: RecordConcept[],
    onProgress?: (progress: HierarchyValidationProgress) => void
  ): Promise<HierarchyValidationResult> {
    const recordConcepts = existingConcepts.filter(concept => !!concept.code);
    const total = recordConcepts.length + 1;

    onProgress?.({
      current: 0,
      total,
      currentCode: candidate.code,
      message: 'Checking selected concept hierarchy...'
    });

    const candidateAncestors = candidate.code ? await this.getAncestors(candidate.code) : new Set<string>();

    onProgress?.({
      current: 1,
      total,
      currentCode: candidate.code,
      message: `Checked selected concept ${candidate.code}.`
    });

    const matches: HierarchyMatch[] = [];

    for (let index = 0; index < recordConcepts.length; index += 1) {
      const existing = recordConcepts[index];
      const existingAncestors = await this.getAncestors(existing.code);

      let relation: HierarchyRelation | null = null;
      if (existing.code === candidate.code) {
        relation = 'exact-match';
      } else if (existingAncestors.has(candidate.code)) {
        relation = 'candidate-is-ancestor';
      } else if (candidateAncestors.has(existing.code)) {
        relation = 'candidate-is-descendant';
      }

      if (relation) {
        matches.push({ existing, relation });
      }

      onProgress?.({
        current: index + 2,
        total,
        currentCode: existing.code,
        message: `Checked record concept ${index + 1} of ${recordConcepts.length}.`
      });
    }

    return {
      candidate,
      matches,
      hasConflict: matches.length > 0
    };
  }

  private enqueueAncestorFetch<T>(task: () => Promise<T>): Promise<T> {
    const runTask = this.ancestorFetchQueue.then(async () => {
      await this.delay(120);
      return task();
    });

    this.ancestorFetchQueue = runTask.then(() => undefined, () => undefined);
    return runTask;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractConceptIdsFromExpansion(response: any): string[] {
    const conceptIds: string[] = [];

    if (response?.expansion?.contains) {
      response.expansion.contains.forEach((concept: any) => {
        if (concept.code) {
          conceptIds.push(concept.code);
        }
      });
    }

    return conceptIds;
  }
}
