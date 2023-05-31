import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllergiesComponent } from './allergies/allergies.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';

const routes: Routes = [
  { path: '', component: AllergiesComponent },
  { path: 'allergies', component: AllergiesComponent },
  { path: 'sandbox', component: BindingsSandboxComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
