import { NgModule } from '@angular/core';
import { CohortDefinitionEditorComponent } from './cohort-definition-editor/cohort-definition-editor.component';
import { CohortWorkspaceComponent } from './cohort-workspace/cohort-workspace.component';
import { ConceptSetEditorComponent } from './concept-set-editor/concept-set-editor.component';
import { ConceptSetItemTableComponent } from './concept-set-item-table/concept-set-item-table.component';
import { ConceptSetLookupPanelComponent } from './concept-set-lookup-panel/concept-set-lookup-panel.component';
import { ConceptSetSelectComponent } from './concept-set-select/concept-set-select.component';
import { CountConstraintEditorComponent } from './count-constraint-editor/count-constraint-editor.component';
import { TimeWindowEditorComponent } from './time-window-editor/time-window-editor.component';
import { ValidationSummaryComponent } from './validation-summary/validation-summary.component';
import { BindingsModule } from '../shared/bindings.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { CohortDefinitionRoutingModule } from './cohort-definition-routing.module';

@NgModule({
  declarations: [
    CohortDefinitionEditorComponent,
    CohortWorkspaceComponent,
    ConceptSetEditorComponent,
    ConceptSetItemTableComponent,
    ConceptSetLookupPanelComponent,
    ConceptSetSelectComponent,
    CountConstraintEditorComponent,
    TimeWindowEditorComponent,
    ValidationSummaryComponent,
  ],
  imports: [BindingsModule, UiSharedModule, CohortDefinitionRoutingModule],
})
export class CohortDefinitionModule {}
