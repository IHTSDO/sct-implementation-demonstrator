import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportViewerComponent } from './report-viewer/report-viewer.component';
import { ReportsMainComponent } from './reports-main/reports-main.component';

const routes: Routes = [
  { path: '', component: ReportsMainComponent },
  { path: 'fsn', component: ReportViewerComponent, data: { reportUrl: 'assets/reports/fsn_changes_with_details.json' } },
  { path: 'inactivations', component: ReportViewerComponent, data: { reportUrl: 'assets/reports/detect_inactivations_by_reason.json' } },
  { path: 'new-concepts', component: ReportViewerComponent, data: { reportUrl: 'assets/reports/new_concepts_by_semantic_tag.json' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsRoutingModule {}
