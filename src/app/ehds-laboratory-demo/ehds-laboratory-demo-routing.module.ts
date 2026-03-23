import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EhdsLaboratoryDemoComponent } from './ehds-laboratory-demo.component';

const routes: Routes = [{ path: '', component: EhdsLaboratoryDemoComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EhdsLaboratoryDemoRoutingModule {}
