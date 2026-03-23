import { NgModule } from '@angular/core';
import { FhirServerDialogComponent } from './fhir-server-dialog/fhir-server-dialog.component';
import { ValuesetTranslatorComponent } from './valueset-translator.component';
import { BindingsModule } from '../shared/bindings.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { ValuesetTranslatorRoutingModule } from './valueset-translator-routing.module';

@NgModule({
  declarations: [ValuesetTranslatorComponent],
  imports: [
    BindingsModule,
    FhirServerDialogComponent,
    UiSharedModule,
    ValuesetTranslatorRoutingModule,
  ],
})
export class ValuesetTranslatorModule {}
