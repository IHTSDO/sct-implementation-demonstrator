import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllergiesComponent } from './allergies/allergies.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';
import { PrescriptionMainComponent } from './prescription/prescription-main/prescription-main.component';
import { QuestionnairesMainComponent } from './questionnaires/questionnaires-main/questionnaires-main.component';
import { SubsetValidatorComponent } from './implementation-course/subset-validator/subset-validator.component';
import { SnoguessMainComponent } from './game/snoguess-main/snoguess-main.component';

const routes: Routes = [
  { path: '', component: AllergiesComponent },
  { path: 'allergies', component: AllergiesComponent },
  { path: 'sandbox', component: BindingsSandboxComponent },
  { path: 'prescription', component: PrescriptionMainComponent},
  { path: 'questionnaires', component: QuestionnairesMainComponent},
  { path: 'implementation-course/subset-validator', component: SubsetValidatorComponent},
  { path: 'snoguess', component: SnoguessMainComponent},
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
