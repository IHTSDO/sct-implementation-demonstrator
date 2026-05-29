import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IcdMapComponent } from './icd-map/icd-map.component';

const routes: Routes = [{ path: '', component: IcdMapComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IcdMappingsRoutingModule {}
