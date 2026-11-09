import { NgModule } from '@angular/core';
import { UiSharedModule } from '../../shared/ui-shared.module';
import { BindingsModule } from '../../shared/bindings.module';
import { EhdsPatientSummaryRoutingModule } from './ehds-patient-summary-routing.module';
import { EhdsPatientSummaryComponent } from './ehds-patient-summary.component';
import { SectionFormComponent } from './section-form/section-form.component';
import { EpsDocumentDialogComponent } from './eps-document-dialog/eps-document-dialog.component';
import { FieldBadgesComponent } from './field-badges/field-badges.component';
import { FlipCardComponent } from './flip-card/flip-card.component';
import { JsonPanelComponent } from './json-panel/json-panel.component';
import { ValuesetDialogComponent } from '../laboratory-demo/valueset-dialog/valueset-dialog.component';
import { ExternalPageLinkDirective } from '../laboratory-demo/valueset-dialog/external-page-link.directive';

@NgModule({
  declarations: [
    EhdsPatientSummaryComponent,
    SectionFormComponent,
    EpsDocumentDialogComponent,
    FieldBadgesComponent,
    FlipCardComponent,
    JsonPanelComponent,
  ],
  imports: [UiSharedModule, BindingsModule, EhdsPatientSummaryRoutingModule, ValuesetDialogComponent, ExternalPageLinkDirective],
})
export class EhdsPatientSummaryModule {}
