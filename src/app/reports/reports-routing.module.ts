import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FsnChangesComponent } from './fsn-changes/fsn-changes.component';
import { InactivationsReportComponent } from './inactivations/inactivations-report.component';
import { NewConceptsReportComponent } from './new-concepts/new-concepts-report.component';
import { ReportsMainComponent } from './reports-main/reports-main.component';

const routes: Routes = [
  { path: '', component: ReportsMainComponent },
  { path: 'fsn', component: FsnChangesComponent },
  { path: 'inactivations', component: InactivationsReportComponent },
  { path: 'new-concepts', component: NewConceptsReportComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsRoutingModule {}
