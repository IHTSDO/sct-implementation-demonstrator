import { NgModule } from '@angular/core';
import { MdrsViewerComponent } from './mdrs-viewer.component';
import { BindingsModule } from '../shared/bindings.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { MdrsViewerRoutingModule } from './mdrs-viewer-routing.module';

@NgModule({
  declarations: [MdrsViewerComponent],
  imports: [BindingsModule, UiSharedModule, MdrsViewerRoutingModule],
})
export class MdrsViewerModule {}
