import { NgModule } from '@angular/core';
import { FsnChangesComponent } from './fsn-changes/fsn-changes.component';
import { InactivationsReportComponent } from './inactivations/inactivations-report.component';
import { NewConceptsReportComponent } from './new-concepts/new-concepts-report.component';
import { ReportsMainComponent } from './reports-main/reports-main.component';
import { ReportsRoutingModule } from './reports-routing.module';
import { UiSharedModule } from '../shared/ui-shared.module';

@NgModule({
  declarations: [
    FsnChangesComponent,
    InactivationsReportComponent,
    NewConceptsReportComponent,
    ReportsMainComponent,
  ],
  imports: [UiSharedModule, ReportsRoutingModule],
})
export class ReportsModule {}
