import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IpsTerminologyComponent } from './ips-terminology.component';

const routes: Routes = [{ path: '', component: IpsTerminologyComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IpsTerminologyRoutingModule {}
