import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MdrsViewerComponent } from './mdrs-viewer.component';

const routes: Routes = [{ path: '', component: MdrsViewerComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MdrsViewerRoutingModule {}
