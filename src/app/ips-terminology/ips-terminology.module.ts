import { NgModule } from '@angular/core';
import { UiSharedModule } from '../shared/ui-shared.module';
import { IpsTerminologyComponent } from './ips-terminology.component';
import { IpsTerminologyRoutingModule } from './ips-terminology-routing.module';

@NgModule({
  declarations: [IpsTerminologyComponent],
  imports: [UiSharedModule, IpsTerminologyRoutingModule],
})
export class IpsTerminologyModule {}
