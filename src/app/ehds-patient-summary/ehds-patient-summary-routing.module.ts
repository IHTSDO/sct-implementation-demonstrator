import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EhdsPatientSummaryComponent } from './ehds-patient-summary.component';

const routes: Routes = [{ path: '', component: EhdsPatientSummaryComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EhdsPatientSummaryRoutingModule {}
