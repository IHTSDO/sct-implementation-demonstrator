import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import {
  ConceptSet,
  ConceptSetItem,
  ConceptSetStore,
  CONCEPT_SET_STORE_VERSION,
  createDefaultConceptSet,
  createDefaultConceptSetItem
} from '../cohort-definition/cohort-definition.model';
import {
  CohortDefinitionValidationResult,
  CohortDefinitionValidator
} from '../cohort-definition/cohort-definition-validator';

const STORAGE_KEY = 'concept-sets:v1';

@Injectable({
  providedIn: 'root'
})
export class ConceptSetService {
  private readonly validator = new CohortDefinitionValidator();
  private readonly conceptSetsSubject = new BehaviorSubject<ConceptSet[]>([]);

  constructor(private storageService: StorageService) {
    this.conceptSetsSubject.next(this.loadConceptSets());
  }

  getConceptSets$(): Observable<ConceptSet[]> {
    return this.conceptSetsSubject.asObservable();
  }

  listConceptSets(): ConceptSet[] {
    return this.cloneConceptSets(this.conceptSetsSubject.value);
  }

  getConceptSet(conceptSetId: string): ConceptSet | undefined {
    const conceptSet = this.conceptSetsSubject.value.find(item => item.id === conceptSetId);
    return conceptSet ? this.cloneConceptSet(conceptSet) : undefined;
  }

  createConceptSet(input?: Partial<ConceptSet>): ConceptSet {
    const conceptSet = createDefaultConceptSet({
      ...input,
      id: this.generateId('concept-set')
    });

    return this.persistConceptSets([...this.conceptSetsSubject.value, conceptSet]) as ConceptSet;
  }

  updateConceptSet(conceptSet: ConceptSet): ConceptSet {
    const updated = this.prepareConceptSetForSave(conceptSet, false);
    const conceptSets = this.conceptSetsSubject.value.map(item => (item.id === updated.id ? updated : item));
    return this.persistConceptSets(conceptSets, updated.id) as ConceptSet;
  }

  patchConceptSet(conceptSetId: string, patch: Partial<ConceptSet>): ConceptSet | undefined {
    const current = this.conceptSetsSubject.value.find(item => item.id === conceptSetId);
    if (!current) {
      return undefined;
    }

    return this.updateConceptSet({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt
    });
  }

  deleteConceptSet(conceptSetId: string): boolean {
    const before = this.conceptSetsSubject.value.length;
    const filtered = this.conceptSetsSubject.value.filter(item => item.id !== conceptSetId);
    if (filtered.length === before) {
      return false;
    }

    this.persistConceptSets(filtered);
    return true;
  }

  duplicateConceptSet(conceptSetId: string, nameSuffix = 'Copy'): ConceptSet | undefined {
    const source = this.getConceptSet(conceptSetId);
    if (!source) {
      return undefined;
    }

    const clone = createDefaultConceptSet({
      ...source,
      id: this.generateId('concept-set'),
      name: `${source.name} (${nameSuffix})`,
      items: source.items.map(item => ({ ...item }))
    });

    return this.persistConceptSets([...this.conceptSetsSubject.value, clone], clone.id);
  }

  addConceptSetItem(conceptSetId: string, input?: Partial<ConceptSetItem>): ConceptSet | undefined {
    return this.updateNestedConceptSet(conceptSetId, conceptSet => {
      conceptSet.items = [...conceptSet.items, createDefaultConceptSetItem(input)];
    });
  }

  updateConceptSetItem(conceptSetId: string, itemIndex: number, item: ConceptSetItem): ConceptSet | undefined {
    return this.updateNestedConceptSet(conceptSetId, conceptSet => {
      conceptSet.items = conceptSet.items.map((currentItem, index) =>
        index === itemIndex ? createDefaultConceptSetItem(item) : currentItem
      );
    });
  }

  removeConceptSetItem(conceptSetId: string, itemIndex: number): ConceptSet | undefined {
    return this.updateNestedConceptSet(conceptSetId, conceptSet => {
      conceptSet.items = conceptSet.items.filter((_, index) => index !== itemIndex);
    });
  }

  validateConceptSet(conceptSet: ConceptSet): CohortDefinitionValidationResult {
    return this.validator.validateConceptSet(conceptSet);
  }

  private updateNestedConceptSet(
    conceptSetId: string,
    mutator: (conceptSet: ConceptSet) => void
  ): ConceptSet | undefined {
    const current = this.getConceptSet(conceptSetId);
    if (!current) {
      return undefined;
    }

    mutator(current);
    return this.updateConceptSet(current);
  }

  private loadConceptSets(): ConceptSet[] {
    if (!this.storageService.isLocalStorageSupported()) {
      return [];
    }

    const raw = this.storageService.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as ConceptSetStore;
      if (!Array.isArray(parsed.conceptSets)) {
        return [];
      }

      return parsed.conceptSets.map(conceptSet => this.prepareConceptSetForSave(conceptSet, true));
    } catch {
      return [];
    }
  }

  private persistConceptSets(conceptSets: ConceptSet[], targetId?: string): ConceptSet | undefined {
    const normalized = conceptSets.map(conceptSet => this.prepareConceptSetForSave(conceptSet, false));
    const payload: ConceptSetStore = {
      version: CONCEPT_SET_STORE_VERSION,
      conceptSets: normalized
    };

    if (this.storageService.isLocalStorageSupported()) {
      this.storageService.saveItem(STORAGE_KEY, JSON.stringify(payload));
    }

    this.conceptSetsSubject.next(normalized);

    const target = targetId ? normalized.find(item => item.id === targetId) : normalized[normalized.length - 1];
    return target ? this.cloneConceptSet(target) : undefined;
  }

  private prepareConceptSetForSave(conceptSet: ConceptSet, preserveUpdatedAt: boolean): ConceptSet {
    const normalized = createDefaultConceptSet({
      ...conceptSet,
      items: conceptSet.items.map(item => createDefaultConceptSetItem(item))
    });

    normalized.updatedAt = preserveUpdatedAt ? conceptSet.updatedAt : new Date().toISOString();
    normalized.createdAt = conceptSet.createdAt || new Date().toISOString();
    return normalized;
  }

  private cloneConceptSet(conceptSet: ConceptSet): ConceptSet {
    return JSON.parse(JSON.stringify(conceptSet)) as ConceptSet;
  }

  private cloneConceptSets(conceptSets: ConceptSet[]): ConceptSet[] {
    return conceptSets.map(conceptSet => this.cloneConceptSet(conceptSet));
  }

  private generateId(prefix: string): string {
    const idSource =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return `${prefix}-${idSource}`;
  }
}
