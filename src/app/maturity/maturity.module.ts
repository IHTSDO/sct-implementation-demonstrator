import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@jsverse/transloco';
import { MaturityAdminComponent } from './maturity-admin/maturity-admin.component';
import { MaturityDashboardComponent } from './maturity-dashboard/maturity-dashboard.component';
import { MaturityEditorComponent } from './maturity-editor/maturity-editor.component';
import { MaturityMainComponent } from './maturity-main/maturity-main.component';
import { MaturityResultsDialogComponent } from './maturity-results-dialog';
import { MaturityResultsComponent } from './maturity-results/maturity-results.component';
import { MaturityRoutingModule } from './maturity-routing.module';
import { UiSharedModule } from '../shared/ui-shared.module';

@NgModule({
  declarations: [
    MaturityAdminComponent,
    MaturityDashboardComponent,
    MaturityEditorComponent,
    MaturityMainComponent,
    MaturityResultsDialogComponent,
    MaturityResultsComponent,
  ],
  imports: [UiSharedModule, MaturityRoutingModule, TranslocoModule],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'maturity' }],
})
export class MaturityModule {}
