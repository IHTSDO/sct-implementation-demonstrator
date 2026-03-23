import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MaturityAdminComponent } from './maturity-admin/maturity-admin.component';
import { MaturityDashboardComponent } from './maturity-dashboard/maturity-dashboard.component';
import { MaturityEditorComponent } from './maturity-editor/maturity-editor.component';
import { MaturityMainComponent } from './maturity-main/maturity-main.component';

const routes: Routes = [
  { path: '', component: MaturityMainComponent },
  { path: 'dashboard', component: MaturityDashboardComponent },
  { path: 'admin', component: MaturityAdminComponent },
  { path: 'editor', component: MaturityEditorComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MaturityRoutingModule {}
