import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConceptSet } from '../cohort-definition.model';
import { CohortDefinitionValidationIssue } from '../cohort-definition-validator';
import { ConceptSetService } from '../../services/concept-set.service';
import { CohortDefinitionService } from '../../services/cohort-definition.service';

@Component({
  selector: 'app-concept-set-editor',
  templateUrl: './concept-set-editor.component.html',
  styleUrls: ['./concept-set-editor.component.css'],
  standalone: false
})
export class ConceptSetEditorComponent implements OnInit, OnDestroy {
  conceptSet: ConceptSet | null = null;
  issues: CohortDefinitionValidationIssue[] = [];
  usageCount = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conceptSetService: ConceptSetService,
    private cohortDefinitionService: CohortDefinitionService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        const id = params.get('conceptSetId');
        this.conceptSet = id ? this.conceptSetService.getConceptSet(id) ?? null : null;
        this.refreshValidation();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  updateName(value: string): void {
    if (!this.conceptSet) {
      return;
    }

    this.conceptSet = { ...this.conceptSet, name: value };
    this.refreshValidation();
  }

  updateDescription(value: string): void {
    if (!this.conceptSet) {
      return;
    }

    this.conceptSet = { ...this.conceptSet, description: value };
  }

  updateItems(items: ConceptSet['items']): void {
    if (!this.conceptSet) {
      return;
    }

    this.conceptSet = { ...this.conceptSet, items };
    this.refreshValidation();
  }

  save(): void {
    if (!this.conceptSet) {
      return;
    }

    this.conceptSet = this.conceptSetService.updateConceptSet(this.conceptSet);
    this.refreshValidation();
  }

  duplicate(): void {
    if (!this.conceptSet) {
      return;
    }

    const duplicate = this.conceptSetService.duplicateConceptSet(this.conceptSet.id);
    if (duplicate) {
      this.router.navigate(['/cohort-workspace/concept-sets', duplicate.id]);
    }
  }

  delete(): void {
    if (!this.conceptSet) {
      return;
    }

    if (this.usageCount > 0) {
      return;
    }

    this.conceptSetService.deleteConceptSet(this.conceptSet.id);
    this.router.navigate(['/cohort-workspace']);
  }

  goBack(): void {
    this.router.navigate(['/cohort-workspace']);
  }

  private refreshValidation(): void {
    if (!this.conceptSet) {
      this.issues = [];
      this.usageCount = 0;
      return;
    }

    this.issues = this.conceptSetService.validateConceptSet(this.conceptSet).issues;
    this.usageCount = this.cohortDefinitionService.countConceptSetUsage(this.conceptSet.id);
  }
}
