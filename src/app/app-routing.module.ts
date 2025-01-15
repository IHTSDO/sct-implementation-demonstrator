import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllergiesComponent } from './allergies/allergies.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';
import { PrescriptionMainComponent } from './prescription/prescription-main/prescription-main.component';
import { QuestionnairesMainComponent } from './questionnaires/questionnaires-main/questionnaires-main.component';
import { SubsetValidatorComponent } from './implementation-course/subset-validator/subset-validator.component';
import { SnoguessMainComponent } from './game/snoguess-main/snoguess-main.component';
import { ContextMainComponent } from './context/context-main/context-main.component';
import { ScoreboardComponent } from './game/scoreboard/scoreboard.component';
import { MaturityMainComponent } from './maturity/maturity-main/maturity-main.component';
import { HomeComponent } from './home/home.component';
import { NcptComponent } from './ncpt/ncpt.component';
import { PhaserGameComponent } from './phaser-game/phaser-game.component';
import { FsnChangesComponent } from './reports/fsn-changes/fsn-changes.component';
import { InactivationsReportComponent } from './reports/inactivations/inactivations-report.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'allergies', component: AllergiesComponent },
  { path: 'sandbox', component: BindingsSandboxComponent },
  { path: 'prescription', component: PrescriptionMainComponent},
  { path: 'questionnaires', component: QuestionnairesMainComponent},
  { path: 'implementation-course/subset-validator', component: SubsetValidatorComponent},
  { path: 'snoguess', component: SnoguessMainComponent},
  { path: 'snoguess/scoreboard', component: ScoreboardComponent},
  { path: 'context', component: ContextMainComponent},
  { path: 'maturity', component: MaturityMainComponent},
  { path: 'ncpt', component: NcptComponent },
  { path: 'phaser', component: PhaserGameComponent },
  { path: 'fsn', component: FsnChangesComponent },
  { path: 'reports/fsn', component: FsnChangesComponent },
  { path: 'reports/inactivations', component: InactivationsReportComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
