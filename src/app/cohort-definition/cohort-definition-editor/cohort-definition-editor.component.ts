import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ClinicalEventRule,
  CohortDefinition,
  ConceptSet,
  createDefaultClinicalEventRule,
  createDefaultDemographicRule,
  DEFAULT_TIME_WINDOW,
  DemographicRule,
  Rule
} from '../cohort-definition.model';
import { CohortDefinitionValidationIssue } from '../cohort-definition-validator';
import { CohortDefinitionService } from '../../services/cohort-definition.service';
import { ConceptSetService } from '../../services/concept-set.service';

@Component({
  selector: 'app-cohort-definition-editor',
  templateUrl: './cohort-definition-editor.component.html',
  styleUrls: ['./cohort-definition-editor.component.css'],
  standalone: false
})
export class CohortDefinitionEditorComponent implements OnInit, OnDestroy {
  definition: CohortDefinition | null = null;
  conceptSets: ConceptSet[] = [];
  issues: CohortDefinitionValidationIssue[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cohortDefinitionService: CohortDefinitionService,
    private conceptSetService: ConceptSetService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.conceptSetService.getConceptSets$().subscribe(conceptSets => {
        this.conceptSets = conceptSets;
        this.refreshValidation();
      })
    );

    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        const id = params.get('definitionId');
        this.definition = id ? this.cohortDefinitionService.getDefinition(id) ?? null : null;
        this.refreshValidation();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  updateField<K extends keyof CohortDefinition>(key: K, value: CohortDefinition[K]): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      [key]: value
    };
    this.refreshValidation();
  }

  updateEntryEvent(patch: Partial<CohortDefinition['entryEvent']>): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      entryEvent: {
        ...this.definition.entryEvent,
        ...patch
      }
    };
    this.refreshValidation();
  }

  updateObservation(patch: Partial<CohortDefinition['observation']>): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      observation: {
        ...this.definition.observation,
        ...patch
      }
    };
    this.refreshValidation();
  }

  updateExit(patch: Partial<CohortDefinition['exit']>): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      exit: {
        ...this.definition.exit,
        ...patch
      }
    };
    this.refreshValidation();
  }

  updateCollapse(patch: Partial<CohortDefinition['collapse']>): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      collapse: {
        ...this.definition.collapse,
        ...patch
      }
    };
    this.refreshValidation();
  }

  addClinicalRule(): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      rules: [
        ...this.definition.rules,
        createDefaultClinicalEventRule({
          id: this.generateLocalRuleId(),
          timeWindow: { ...DEFAULT_TIME_WINDOW }
        })
      ]
    };
    this.refreshValidation();
  }

  addDemographicRule(): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      rules: [
        ...this.definition.rules,
        createDefaultDemographicRule({
          id: this.generateLocalRuleId()
        })
      ]
    };
    this.refreshValidation();
  }

  updateRule(index: number, rule: Rule): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      rules: this.definition.rules.map((currentRule, currentIndex) => (currentIndex === index ? rule : currentRule))
    };
    this.refreshValidation();
  }

  removeRule(index: number): void {
    if (!this.definition) {
      return;
    }

    this.definition = {
      ...this.definition,
      rules: this.definition.rules.filter((_, ruleIndex) => ruleIndex !== index)
    };
    this.refreshValidation();
  }

  updateClinicalRule(index: number, patch: Partial<ClinicalEventRule>): void {
    const rule = this.definition?.rules[index];
    if (!this.definition || !rule || rule.type !== 'clinical') {
      return;
    }

    this.updateRule(index, {
      ...rule,
      ...patch
    });
  }

  updateDemographicRule(index: number, patch: Partial<DemographicRule>): void {
    const rule = this.definition?.rules[index];
    if (!this.definition || !rule || rule.type !== 'demographic') {
      return;
    }

    this.updateRule(index, {
      ...rule,
      ...patch
    });
  }

  save(): void {
    if (!this.definition) {
      return;
    }

    this.definition = this.cohortDefinitionService.updateDefinition(this.definition);
    this.refreshValidation();
  }

  duplicate(): void {
    if (!this.definition) {
      return;
    }

    const duplicate = this.cohortDefinitionService.duplicateDefinition(this.definition.id);
    if (duplicate) {
      this.router.navigate(['/cohort-workspace/definitions', duplicate.id]);
    }
  }

  delete(): void {
    if (!this.definition) {
      return;
    }

    this.cohortDefinitionService.deleteDefinition(this.definition.id);
    this.router.navigate(['/cohort-workspace']);
  }

  goBack(): void {
    this.router.navigate(['/cohort-workspace']);
  }

  getJsonPreview(): string {
    return this.definition ? JSON.stringify(this.definition, null, 2) : '';
  }

  private refreshValidation(): void {
    if (!this.definition) {
      this.issues = [];
      return;
    }

    this.issues = this.cohortDefinitionService.validateDefinition(this.definition).issues;
  }

  private generateLocalRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
