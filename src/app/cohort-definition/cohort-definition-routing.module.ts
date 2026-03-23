import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CohortDefinitionEditorComponent } from './cohort-definition-editor/cohort-definition-editor.component';
import { CohortWorkspaceComponent } from './cohort-workspace/cohort-workspace.component';
import { ConceptSetEditorComponent } from './concept-set-editor/concept-set-editor.component';

const routes: Routes = [
  { path: '', component: CohortWorkspaceComponent },
  { path: 'concept-sets/:conceptSetId', component: ConceptSetEditorComponent },
  { path: 'definitions/:definitionId', component: CohortDefinitionEditorComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CohortDefinitionRoutingModule {}
