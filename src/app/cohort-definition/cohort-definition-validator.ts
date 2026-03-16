import {
  ClinicalEventRule,
  CohortDefinition,
  CollapseStrategy,
  ConceptSet,
  CountConstraint,
  DemographicRule,
  EntryEvent,
  ExitStrategy,
  Rule,
  TimeWindow
} from './cohort-definition.model';

export interface CohortDefinitionValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface CohortDefinitionValidationResult {
  valid: boolean;
  issues: CohortDefinitionValidationIssue[];
}

export class CohortDefinitionValidator {
  validate(definition: CohortDefinition, conceptSets: ConceptSet[]): CohortDefinitionValidationResult {
    const issues: CohortDefinitionValidationIssue[] = [];

    this.validateDefinition(definition, issues);
    this.validateEntryEvent(definition.entryEvent, conceptSets, issues);
    this.validateRules(definition.rules, conceptSets, issues);
    this.validateExit(definition.exit, issues);
    this.validateCollapse(definition.collapse, issues);

    return {
      valid: !issues.some(issue => issue.severity === 'error'),
      issues
    };
  }

  validateConceptSet(conceptSet: ConceptSet): CohortDefinitionValidationResult {
    const issues: CohortDefinitionValidationIssue[] = [];
    const basePath = 'conceptSet';

    if (!conceptSet.id?.trim()) {
      issues.push({ severity: 'error', path: `${basePath}.id`, message: 'Concept set id is required.' });
    }

    if (!conceptSet.name?.trim()) {
      issues.push({ severity: 'error', path: `${basePath}.name`, message: 'Concept set name is required.' });
    }

    if (!conceptSet.items.length) {
      issues.push({ severity: 'warning', path: `${basePath}.items`, message: 'Concept set has no items.' });
    }

    conceptSet.items.forEach((item, index) => {
      if (!item.conceptId?.trim()) {
        issues.push({
          severity: 'error',
          path: `${basePath}.items[${index}].conceptId`,
          message: 'Concept set item conceptId is required.'
        });
      }
    });

    return {
      valid: !issues.some(issue => issue.severity === 'error'),
      issues
    };
  }

  private validateDefinition(definition: CohortDefinition, issues: CohortDefinitionValidationIssue[]): void {
    if (!definition.id) {
      issues.push({ severity: 'error', path: 'id', message: 'Definition id is required.' });
    }

    if (!definition.name?.trim()) {
      issues.push({ severity: 'error', path: 'name', message: 'Definition name is required.' });
    }

    if (!definition.entryEvent) {
      issues.push({ severity: 'error', path: 'entryEvent', message: 'Entry event is required.' });
    }

    if (!definition.exit) {
      issues.push({ severity: 'error', path: 'exit', message: 'Exit strategy is required.' });
    }
  }

  private validateEntryEvent(entryEvent: EntryEvent, conceptSets: ConceptSet[], issues: CohortDefinitionValidationIssue[]): void {
    if (!entryEvent.domain) {
      issues.push({ severity: 'error', path: 'entryEvent.domain', message: 'Entry event domain is required.' });
    }

    if (!entryEvent.conceptSetId?.trim()) {
      issues.push({ severity: 'error', path: 'entryEvent.conceptSetId', message: 'Entry event concept set is required.' });
    } else if (!conceptSets.some(set => set.id === entryEvent.conceptSetId)) {
      issues.push({
        severity: 'error',
        path: 'entryEvent.conceptSetId',
        message: 'Entry event concept set must reference an existing concept set.'
      });
    }

    if (entryEvent.timeWindow) {
      this.validateTimeWindow(entryEvent.timeWindow, 'entryEvent.timeWindow', issues);
    }
  }

  private validateRules(rules: Rule[], conceptSets: ConceptSet[], issues: CohortDefinitionValidationIssue[]): void {
    rules.forEach((rule, index) => {
      const basePath = `rules[${index}]`;

      if (!rule.id?.trim()) {
        issues.push({ severity: 'error', path: `${basePath}.id`, message: 'Rule id is required.' });
      }

      if (rule.type === 'clinical') {
        this.validateClinicalRule(rule, conceptSets, basePath, issues);
      } else {
        this.validateDemographicRule(rule, basePath, issues);
      }
    });
  }

  private validateClinicalRule(
    rule: ClinicalEventRule,
    conceptSets: ConceptSet[],
    basePath: string,
    issues: CohortDefinitionValidationIssue[]
  ): void {
    if (!rule.domain) {
      issues.push({ severity: 'error', path: `${basePath}.domain`, message: 'Clinical rule domain is required.' });
    }

    if (!rule.conceptSetId?.trim()) {
      issues.push({ severity: 'error', path: `${basePath}.conceptSetId`, message: 'Clinical rule concept set is required.' });
    } else if (!conceptSets.some(set => set.id === rule.conceptSetId)) {
      issues.push({
        severity: 'error',
        path: `${basePath}.conceptSetId`,
        message: 'Clinical rule concept set must reference an existing concept set.'
      });
    }

    this.validateTimeWindow(rule.timeWindow, `${basePath}.timeWindow`, issues);
    this.validateCountConstraint(rule.count, `${basePath}.count`, issues);
  }

  private validateDemographicRule(
    rule: DemographicRule,
    basePath: string,
    issues: CohortDefinitionValidationIssue[]
  ): void {
    if (
      typeof rule.minAge !== 'number' &&
      typeof rule.maxAge !== 'number' &&
      (!rule.sexes || rule.sexes.length === 0)
    ) {
      issues.push({
        severity: 'error',
        path: basePath,
        message: 'Demographic rule must specify minAge, maxAge, or sexes.'
      });
    }

    if (typeof rule.minAge === 'number' && rule.minAge < 0) {
      issues.push({ severity: 'error', path: `${basePath}.minAge`, message: 'minAge cannot be negative.' });
    }

    if (typeof rule.maxAge === 'number' && rule.maxAge < 0) {
      issues.push({ severity: 'error', path: `${basePath}.maxAge`, message: 'maxAge cannot be negative.' });
    }

    if (
      typeof rule.minAge === 'number' &&
      typeof rule.maxAge === 'number' &&
      rule.minAge > rule.maxAge
    ) {
      issues.push({
        severity: 'error',
        path: basePath,
        message: 'minAge cannot be greater than maxAge.'
      });
    }
  }

  private validateTimeWindow(
    timeWindow: TimeWindow | undefined,
    path: string,
    issues: CohortDefinitionValidationIssue[]
  ): void {
    if (!timeWindow) {
      issues.push({ severity: 'error', path, message: 'Time window is required.' });
      return;
    }

    if (!timeWindow.anchor) {
      issues.push({ severity: 'error', path: `${path}.anchor`, message: 'Time window anchor is required.' });
    }

    if (timeWindow.startDay > timeWindow.endDay) {
      issues.push({
        severity: 'error',
        path,
        message: 'Time window startDay cannot be greater than endDay.'
      });
    }
  }

  private validateCountConstraint(
    count: CountConstraint | undefined,
    path: string,
    issues: CohortDefinitionValidationIssue[]
  ): void {
    if (!count) {
      issues.push({ severity: 'error', path, message: 'Count constraint is required.' });
      return;
    }

    if (count.value < 0) {
      issues.push({ severity: 'error', path: `${path}.value`, message: 'Count value cannot be negative.' });
    }
  }

  private validateExit(exit: ExitStrategy, issues: CohortDefinitionValidationIssue[]): void {
    if (!exit.type) {
      issues.push({ severity: 'error', path: 'exit.type', message: 'Exit strategy type is required.' });
    }

    if (exit.type === 'fixedDays') {
      if (typeof exit.daysAfterIndex !== 'number') {
        issues.push({
          severity: 'error',
          path: 'exit.daysAfterIndex',
          message: 'daysAfterIndex is required for fixedDays exit strategy.'
        });
      } else if (exit.daysAfterIndex < 0) {
        issues.push({
          severity: 'error',
          path: 'exit.daysAfterIndex',
          message: 'daysAfterIndex cannot be negative.'
        });
      }
    }
  }

  private validateCollapse(collapse: CollapseStrategy, issues: CohortDefinitionValidationIssue[]): void {
    if (!collapse.type) {
      issues.push({ severity: 'error', path: 'collapse.type', message: 'Collapse strategy type is required.' });
    }

    if (collapse.paddingDays < 0) {
      issues.push({ severity: 'error', path: 'collapse.paddingDays', message: 'paddingDays cannot be negative.' });
    }

    if (collapse.type !== 'eraPadding' && collapse.paddingDays > 0) {
      issues.push({
        severity: 'warning',
        path: 'collapse.paddingDays',
        message: 'paddingDays is ignored unless collapse.type is eraPadding.'
      });
    }
  }
}
