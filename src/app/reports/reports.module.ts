import { NgModule } from '@angular/core';
import { ReportViewerComponent } from './report-viewer/report-viewer.component';
import { ReportsMainComponent } from './reports-main/reports-main.component';
import { ReportsRoutingModule } from './reports-routing.module';
import { UiSharedModule } from '../shared/ui-shared.module';

@NgModule({
  declarations: [
    ReportViewerComponent,
    ReportsMainComponent,
  ],
  imports: [UiSharedModule, ReportsRoutingModule],
})
export class ReportsModule {}
