import { NgModule } from '@angular/core';
import { ConceptLookupDialogComponent } from './concept-lookup-dialog/concept-lookup-dialog.component';
import { DiagnosticReportFormComponent } from './diagnostic-report-form/diagnostic-report-form.component';
import { DiagnosticReportPrintDialogComponent } from './diagnostic-report-print-dialog/diagnostic-report-print-dialog.component';
import { EhdsLaboratoryDemoComponent } from './ehds-laboratory-demo.component';
import { ObservationResultFormComponent } from './observation-result-form/observation-result-form.component';
import { ServiceRequestFormComponent } from './service-request-form/service-request-form.component';
import { SpecimenFormComponent } from './specimen-form/specimen-form.component';
import { ValuesetDialogComponent } from './valueset-dialog/valueset-dialog.component';
import { BindingsModule } from '../shared/bindings.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { EhdsLaboratoryDemoRoutingModule } from './ehds-laboratory-demo-routing.module';

@NgModule({
  declarations: [
    DiagnosticReportFormComponent,
    DiagnosticReportPrintDialogComponent,
    EhdsLaboratoryDemoComponent,
    ObservationResultFormComponent,
    ServiceRequestFormComponent,
    SpecimenFormComponent,
  ],
  imports: [
    BindingsModule,
    ConceptLookupDialogComponent,
    UiSharedModule,
    ValuesetDialogComponent,
    EhdsLaboratoryDemoRoutingModule,
  ],
})
export class EhdsLaboratoryDemoModule {}
