import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EhdsHomeComponent } from './ehds-home/ehds-home.component';

const routes: Routes = [{ path: '', component: EhdsHomeComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EhdsRoutingModule {}
