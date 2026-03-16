export type ClinicalDomain =
  | 'condition_occurrence'
  | 'drug_exposure'
  | 'procedure_occurrence'
  | 'measurement'
  | 'observation'
  | 'visit_occurrence';

export type IndexOccurrence = 'first' | 'all';
export type RuleType = 'clinical' | 'demographic';
export type PresenceRequirement = 'present' | 'absent';
export type TimeAnchor = 'indexStart' | 'indexEnd';
export type CountOperator = '=' | '>=' | '<=' | '>' | '<';
export type ExitStrategyType = 'fixedDays' | 'observationPeriodEnd' | 'indexEventEnd';
export type CollapseStrategyType = 'none' | 'mergeOverlapping' | 'eraPadding';
export type AdministrativeSex = 'male' | 'female' | 'other' | 'unknown';

export interface ConceptSetItem {
  conceptId: string;
  includeDescendants: boolean;
  includeMapped: boolean;
  exclude: boolean;
}

export interface ConceptSet {
  id: string;
  name: string;
  description?: string;
  items: ConceptSetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeWindow {
  anchor: TimeAnchor;
  startDay: number;
  endDay: number;
}

export interface CountConstraint {
  operator: CountOperator;
  value: number;
}

export interface EntryEvent {
  domain: ClinicalDomain;
  conceptSetId: string;
  occurrence: IndexOccurrence;
  timeWindow?: TimeWindow;
  restrictToObservationPeriod: boolean;
}

export interface ObservationConstraint {
  priorDays: number;
  postDays: number;
  requireContinuous: boolean;
}

export interface RuleBase {
  id: string;
  type: RuleType;
  name?: string;
}

export interface ClinicalEventRule extends RuleBase {
  type: 'clinical';
  domain: ClinicalDomain;
  conceptSetId: string;
  presence: PresenceRequirement;
  timeWindow: TimeWindow;
  count: CountConstraint;
}

export interface DemographicRule extends RuleBase {
  type: 'demographic';
  minAge?: number;
  maxAge?: number;
  sexes?: AdministrativeSex[];
}

export type Rule = ClinicalEventRule | DemographicRule;

export interface ExitStrategy {
  type: ExitStrategyType;
  daysAfterIndex?: number;
}

export interface CollapseStrategy {
  type: CollapseStrategyType;
  paddingDays: number;
}

export interface CohortDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  entryEvent: EntryEvent;
  observation: ObservationConstraint;
  rules: Rule[];
  exit: ExitStrategy;
  collapse: CollapseStrategy;
  createdAt: string;
  updatedAt: string;
}

export interface CohortDefinitionStore {
  version: string;
  definitions: CohortDefinition[];
}

export interface ConceptSetStore {
  version: string;
  conceptSets: ConceptSet[];
}

export const COHORT_DEFINITION_STORE_VERSION = '2';
export const CONCEPT_SET_STORE_VERSION = '1';

export const DEFAULT_TIME_WINDOW: TimeWindow = {
  anchor: 'indexStart',
  startDay: 0,
  endDay: 0
};

export const DEFAULT_COUNT_CONSTRAINT: CountConstraint = {
  operator: '>=',
  value: 1
};

export const DEFAULT_OBSERVATION_CONSTRAINT: ObservationConstraint = {
  priorDays: 0,
  postDays: 0,
  requireContinuous: true
};

export const DEFAULT_EXIT_STRATEGY: ExitStrategy = {
  type: 'observationPeriodEnd'
};

export const DEFAULT_COLLAPSE_STRATEGY: CollapseStrategy = {
  type: 'mergeOverlapping',
  paddingDays: 0
};

export const DEFAULT_ENTRY_EVENT: EntryEvent = {
  domain: 'condition_occurrence',
  conceptSetId: '',
  occurrence: 'first',
  restrictToObservationPeriod: true
};

export function createDefaultConceptSetItem(input?: Partial<ConceptSetItem>): ConceptSetItem {
  return {
    conceptId: input?.conceptId ?? '',
    includeDescendants: input?.includeDescendants ?? true,
    includeMapped: input?.includeMapped ?? false,
    exclude: input?.exclude ?? false
  };
}

export function createDefaultConceptSet(input?: Partial<ConceptSet>): ConceptSet {
  const now = new Date().toISOString();

  return {
    id: input?.id ?? '',
    name: input?.name ?? 'New concept set',
    description: input?.description,
    items: input?.items ? input.items.map(item => createDefaultConceptSetItem(item)) : [],
    createdAt: input?.createdAt ?? now,
    updatedAt: input?.updatedAt ?? now
  };
}

export function createDefaultClinicalEventRule(input?: Partial<ClinicalEventRule>): ClinicalEventRule {
  return {
    id: input?.id ?? '',
    type: 'clinical',
    name: input?.name,
    domain: input?.domain ?? 'condition_occurrence',
    conceptSetId: input?.conceptSetId ?? '',
    presence: input?.presence ?? 'present',
    timeWindow: input?.timeWindow ? { ...input.timeWindow } : { ...DEFAULT_TIME_WINDOW },
    count: input?.count ? { ...input.count } : { ...DEFAULT_COUNT_CONSTRAINT }
  };
}

export function createDefaultDemographicRule(input?: Partial<DemographicRule>): DemographicRule {
  return {
    id: input?.id ?? '',
    type: 'demographic',
    name: input?.name,
    minAge: input?.minAge,
    maxAge: input?.maxAge,
    sexes: input?.sexes ? [...input.sexes] : undefined
  };
}

export function createDefaultCohortDefinition(input?: Partial<CohortDefinition>): CohortDefinition {
  const now = new Date().toISOString();

  return {
    id: input?.id ?? '',
    name: input?.name ?? 'Untitled cohort definition',
    description: input?.description,
    version: input?.version ?? '1.0.0',
    entryEvent: input?.entryEvent ? { ...DEFAULT_ENTRY_EVENT, ...input.entryEvent } : { ...DEFAULT_ENTRY_EVENT },
    observation: input?.observation ? { ...DEFAULT_OBSERVATION_CONSTRAINT, ...input.observation } : { ...DEFAULT_OBSERVATION_CONSTRAINT },
    rules: input?.rules
      ? input.rules.map(rule => (rule.type === 'clinical' ? createDefaultClinicalEventRule(rule) : createDefaultDemographicRule(rule)))
      : [],
    exit: input?.exit ? { ...DEFAULT_EXIT_STRATEGY, ...input.exit } : { ...DEFAULT_EXIT_STRATEGY },
    collapse: input?.collapse ? { ...DEFAULT_COLLAPSE_STRATEGY, ...input.collapse } : { ...DEFAULT_COLLAPSE_STRATEGY },
    createdAt: input?.createdAt ?? now,
    updatedAt: input?.updatedAt ?? now
  };
}
