import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import {
  ClinicalEventRule,
  CohortDefinition,
  CohortDefinitionStore,
  COHORT_DEFINITION_STORE_VERSION,
  CollapseStrategy,
  createDefaultClinicalEventRule,
  createDefaultCohortDefinition,
  createDefaultDemographicRule,
  DEFAULT_COLLAPSE_STRATEGY,
  DEFAULT_EXIT_STRATEGY,
  DEFAULT_OBSERVATION_CONSTRAINT,
  DemographicRule,
  EntryEvent,
  ExitStrategy,
  ObservationConstraint,
  Rule
} from '../cohort-definition/cohort-definition.model';
import {
  CohortDefinitionValidationResult,
  CohortDefinitionValidator
} from '../cohort-definition/cohort-definition-validator';
import { ConceptSetService } from './concept-set.service';

const STORAGE_KEY = 'cohort-definitions:v1';

@Injectable({
  providedIn: 'root'
})
export class CohortDefinitionService {
  private readonly validator = new CohortDefinitionValidator();
  private readonly definitionsSubject = new BehaviorSubject<CohortDefinition[]>([]);

  constructor(
    private storageService: StorageService,
    private conceptSetService: ConceptSetService
  ) {
    const definitions = this.loadDefinitions();
    this.definitionsSubject.next(definitions);
  }

  getDefinitions$(): Observable<CohortDefinition[]> {
    return this.definitionsSubject.asObservable();
  }

  listDefinitions(): CohortDefinition[] {
    return this.cloneDefinitions(this.definitionsSubject.value);
  }

  getDefinition(definitionId: string): CohortDefinition | undefined {
    const definition = this.definitionsSubject.value.find(item => item.id === definitionId);
    return definition ? this.cloneDefinition(definition) : undefined;
  }

  createDefinition(input?: Partial<CohortDefinition>): CohortDefinition {
    const definition = createDefaultCohortDefinition({
      ...input,
      id: this.generateId('cohort'),
      rules: input?.rules ?? []
    });

    return this.persistDefinitions([...this.definitionsSubject.value, definition]) as CohortDefinition;
  }

  updateDefinition(definition: CohortDefinition): CohortDefinition {
    const updated = this.prepareDefinitionForSave(definition, false);
    const definitions = this.definitionsSubject.value.map(item => (item.id === updated.id ? updated : item));
    return this.persistDefinitions(definitions, updated.id) as CohortDefinition;
  }

  patchDefinition(definitionId: string, patch: Partial<CohortDefinition>): CohortDefinition | undefined {
    const current = this.definitionsSubject.value.find(item => item.id === definitionId);
    if (!current) {
      return undefined;
    }

    return this.updateDefinition({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt
    });
  }

  deleteDefinition(definitionId: string): boolean {
    const before = this.definitionsSubject.value.length;
    const filtered = this.definitionsSubject.value.filter(item => item.id !== definitionId);
    if (filtered.length === before) {
      return false;
    }

    this.persistDefinitions(filtered);
    return true;
  }

  duplicateDefinition(definitionId: string, nameSuffix = 'Copy'): CohortDefinition | undefined {
    const source = this.getDefinition(definitionId);
    if (!source) {
      return undefined;
    }

    const clone = createDefaultCohortDefinition({
      ...source,
      id: this.generateId('cohort'),
      name: `${source.name} (${nameSuffix})`,
      rules: source.rules.map(rule => ({ ...rule }))
    });

    return this.persistDefinitions([...this.definitionsSubject.value, clone], clone.id);
  }

  validateDefinition(definition: CohortDefinition): CohortDefinitionValidationResult {
    return this.validator.validate(definition, this.conceptSetService.listConceptSets());
  }

  setEntryEvent(definitionId: string, entryEvent: EntryEvent): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.entryEvent = { ...entryEvent };
    });
  }

  setObservation(definitionId: string, observation: Partial<ObservationConstraint>): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.observation = { ...definition.observation, ...observation };
    });
  }

  addClinicalRule(definitionId: string, input?: Partial<ClinicalEventRule>): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.rules = [
        ...definition.rules,
        createDefaultClinicalEventRule({
          ...input,
          id: input?.id ?? this.generateId('rule')
        })
      ];
    });
  }

  addDemographicRule(definitionId: string, input?: Partial<DemographicRule>): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.rules = [
        ...definition.rules,
        createDefaultDemographicRule({
          ...input,
          id: input?.id ?? this.generateId('rule')
        })
      ];
    });
  }

  updateRule(definitionId: string, rule: Rule): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.rules = definition.rules.map(currentRule => {
        if (currentRule.id !== rule.id) {
          return currentRule;
        }

        return rule.type === 'clinical'
          ? createDefaultClinicalEventRule(rule)
          : createDefaultDemographicRule(rule);
      });
    });
  }

  removeRule(definitionId: string, ruleId: string): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.rules = definition.rules.filter(rule => rule.id !== ruleId);
    });
  }

  setExitStrategy(definitionId: string, exit: ExitStrategy): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.exit = { ...DEFAULT_EXIT_STRATEGY, ...exit };
    });
  }

  setCollapseStrategy(definitionId: string, collapse: Partial<CollapseStrategy>): CohortDefinition | undefined {
    return this.updateNestedDefinition(definitionId, definition => {
      definition.collapse = { ...definition.collapse, ...collapse };
    });
  }

  resetDefinition(definitionId: string): CohortDefinition | undefined {
    const existing = this.definitionsSubject.value.find(item => item.id === definitionId);
    if (!existing) {
      return undefined;
    }

    const reset = createDefaultCohortDefinition({
      id: existing.id,
      createdAt: existing.createdAt,
      name: existing.name
    });

    return this.persistDefinitions(
      this.definitionsSubject.value.map(item => (item.id === definitionId ? reset : item)),
      definitionId
    ) as CohortDefinition;
  }

  isConceptSetReferenced(conceptSetId: string, excludingDefinitionId?: string): boolean {
    return this.definitionsSubject.value.some(definition => {
      if (excludingDefinitionId && definition.id === excludingDefinitionId) {
        return false;
      }

      if (definition.entryEvent.conceptSetId === conceptSetId) {
        return true;
      }

      return definition.rules.some(rule => rule.type === 'clinical' && rule.conceptSetId === conceptSetId);
    });
  }

  countConceptSetUsage(conceptSetId: string): number {
    return this.definitionsSubject.value.reduce((count, definition) => {
      let usage = 0;
      if (definition.entryEvent.conceptSetId === conceptSetId) {
        usage += 1;
      }
      usage += definition.rules.filter(rule => rule.type === 'clinical' && rule.conceptSetId === conceptSetId).length;
      return count + usage;
    }, 0);
  }

  private updateNestedDefinition(
    definitionId: string,
    mutator: (definition: CohortDefinition) => void
  ): CohortDefinition | undefined {
    const current = this.getDefinition(definitionId);
    if (!current) {
      return undefined;
    }

    mutator(current);
    return this.updateDefinition(current);
  }

  private loadDefinitions(): CohortDefinition[] {
    if (!this.storageService.isLocalStorageSupported()) {
      return [];
    }

    const raw = this.storageService.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as CohortDefinitionStore;
      if (!Array.isArray(parsed.definitions)) {
        return [];
      }

      return parsed.definitions.map(definition => this.prepareDefinitionForSave(definition, true));
    } catch {
      return [];
    }
  }

  private persistDefinitions(definitions: CohortDefinition[], targetId?: string): CohortDefinition | undefined {
    const normalized = definitions.map(definition => this.prepareDefinitionForSave(definition, false));
    const payload: CohortDefinitionStore = {
      version: COHORT_DEFINITION_STORE_VERSION,
      definitions: normalized
    };

    if (this.storageService.isLocalStorageSupported()) {
      this.storageService.saveItem(STORAGE_KEY, JSON.stringify(payload));
    }

    this.definitionsSubject.next(normalized);

    const target = targetId ? normalized.find(item => item.id === targetId) : normalized[normalized.length - 1];
    return target ? this.cloneDefinition(target) : undefined;
  }

  private prepareDefinitionForSave(definition: CohortDefinition, preserveUpdatedAt: boolean): CohortDefinition {
    const normalized = createDefaultCohortDefinition({
      ...definition,
      rules: definition.rules.map(rule =>
        rule.type === 'clinical' ? createDefaultClinicalEventRule(rule) : createDefaultDemographicRule(rule)
      ),
      observation: { ...DEFAULT_OBSERVATION_CONSTRAINT, ...definition.observation },
      exit: { ...DEFAULT_EXIT_STRATEGY, ...definition.exit },
      collapse: { ...DEFAULT_COLLAPSE_STRATEGY, ...definition.collapse }
    });

    normalized.updatedAt = preserveUpdatedAt ? definition.updatedAt : new Date().toISOString();
    normalized.createdAt = definition.createdAt || new Date().toISOString();
    return normalized;
  }

  private cloneDefinition(definition: CohortDefinition): CohortDefinition {
    return JSON.parse(JSON.stringify(definition)) as CohortDefinition;
  }

  private cloneDefinitions(definitions: CohortDefinition[]): CohortDefinition[] {
    return definitions.map(definition => this.cloneDefinition(definition));
  }

  private generateId(prefix: string): string {
    const idSource =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return `${prefix}-${idSource}`;
  }
}
