import { NgModule } from '@angular/core';
import { BindingsModule } from '../shared/bindings.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { IcdLoadingDialogComponent } from './loading-dialog/loading-dialog.component';
import { IcdMapComponent } from './icd-map/icd-map.component';
import { IcdMappingsRoutingModule } from './icd-mappings-routing.module';
import { IcdSimpleMapComponent } from './simple-map/simple-map.component';

@NgModule({
  declarations: [IcdMapComponent, IcdSimpleMapComponent, IcdLoadingDialogComponent],
  imports: [BindingsModule, UiSharedModule, IcdMappingsRoutingModule],
})
export class IcdMappingsModule {}
