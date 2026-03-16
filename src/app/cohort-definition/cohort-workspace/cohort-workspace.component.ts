import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CohortDefinition } from '../cohort-definition.model';
import { ConceptSet } from '../cohort-definition.model';
import { CohortDefinitionService } from '../../services/cohort-definition.service';
import { ConceptSetService } from '../../services/concept-set.service';

@Component({
  selector: 'app-cohort-workspace',
  templateUrl: './cohort-workspace.component.html',
  styleUrls: ['./cohort-workspace.component.css'],
  standalone: false
})
export class CohortWorkspaceComponent implements OnInit, OnDestroy {
  cohortDefinitions: CohortDefinition[] = [];
  conceptSets: ConceptSet[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private cohortDefinitionService: CohortDefinitionService,
    private conceptSetService: ConceptSetService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.cohortDefinitionService.getDefinitions$().subscribe(definitions => {
        this.cohortDefinitions = definitions;
      })
    );

    this.subscriptions.push(
      this.conceptSetService.getConceptSets$().subscribe(conceptSets => {
        this.conceptSets = conceptSets;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  createDefinition(): void {
    const definition = this.cohortDefinitionService.createDefinition();
    this.router.navigate(['/cohort-workspace/definitions', definition.id]);
  }

  createConceptSet(): void {
    const conceptSet = this.conceptSetService.createConceptSet();
    this.router.navigate(['/cohort-workspace/concept-sets', conceptSet.id]);
  }

  editDefinition(definition: CohortDefinition): void {
    this.router.navigate(['/cohort-workspace/definitions', definition.id]);
  }

  editConceptSet(conceptSet: ConceptSet): void {
    this.router.navigate(['/cohort-workspace/concept-sets', conceptSet.id]);
  }

  duplicateDefinition(definition: CohortDefinition): void {
    const duplicate = this.cohortDefinitionService.duplicateDefinition(definition.id);
    if (duplicate) {
      this.router.navigate(['/cohort-workspace/definitions', duplicate.id]);
    }
  }

  duplicateConceptSet(conceptSet: ConceptSet): void {
    const duplicate = this.conceptSetService.duplicateConceptSet(conceptSet.id);
    if (duplicate) {
      this.router.navigate(['/cohort-workspace/concept-sets', duplicate.id]);
    }
  }

  deleteDefinition(definition: CohortDefinition, event: Event): void {
    event.stopPropagation();
    this.cohortDefinitionService.deleteDefinition(definition.id);
  }

  deleteConceptSet(conceptSet: ConceptSet, event: Event): void {
    event.stopPropagation();
    if (this.cohortDefinitionService.isConceptSetReferenced(conceptSet.id)) {
      return;
    }

    this.conceptSetService.deleteConceptSet(conceptSet.id);
  }

  getConceptSetUsage(conceptSetId: string): number {
    return this.cohortDefinitionService.countConceptSetUsage(conceptSetId);
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
