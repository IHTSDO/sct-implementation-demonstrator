import { NgModule } from '@angular/core';
import { UiSharedModule } from '../shared/ui-shared.module';
import { BindingsModule } from '../shared/bindings.module';
import { EhdsPatientSummaryRoutingModule } from './ehds-patient-summary-routing.module';
import { EhdsPatientSummaryComponent } from './ehds-patient-summary.component';
import { SectionFormComponent } from './section-form/section-form.component';
import { EpsDocumentDialogComponent } from './eps-document-dialog/eps-document-dialog.component';
import { FieldBadgesComponent } from './field-badges/field-badges.component';
import { ValuesetDialogComponent } from '../ehds-laboratory-demo/valueset-dialog/valueset-dialog.component';

@NgModule({
  declarations: [
    EhdsPatientSummaryComponent,
    SectionFormComponent,
    EpsDocumentDialogComponent,
    FieldBadgesComponent,
  ],
  imports: [UiSharedModule, BindingsModule, EhdsPatientSummaryRoutingModule, ValuesetDialogComponent],
})
export class EhdsPatientSummaryModule {}
