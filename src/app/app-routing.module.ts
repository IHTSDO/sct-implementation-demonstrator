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
import { FsnChangesComponent } from './reports/fsn-changes/fsn-changes.component';
import { InactivationsReportComponent } from './reports/inactivations/inactivations-report.component';
import { ReportsMainComponent } from './reports/reports-main/reports-main.component';
import { NewConceptsReportComponent } from './reports/new-concepts/new-concepts-report.component';
import { TriageGameComponent } from './phaser-game/phaser-v2/triage-game.component';
import { LoincMainComponent } from './loinc/loinc-main/loinc-main.component';
import { MaturityDashboardComponent } from './maturity/maturity-dashboard/maturity-dashboard.component';
import { SvDemoComponent } from './sv-demo/sv-demo.component';
import { SnomedHubComponent } from './snomed-hub/snomed-hub.component';
import { ValuesetTranslatorComponent } from './valueset-translator/valueset-translator.component';
import { SunburstChartComponent } from './descriptive-statistics/sunburst-chart/sunburst-chart.component';
import { D3SunburstChartComponent } from './descriptive-statistics/d3-sunburst-chart/d3-sunburst-chart.component';

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
  { path: 'maturity/dashboard', component: MaturityDashboardComponent},
  { path: 'ncpt', component: NcptComponent },
  { path: 'triage', component: TriageGameComponent },
  { path: 'fsn', component: FsnChangesComponent },
  { path: 'reports/fsn', component: FsnChangesComponent },
  { path: 'reports/inactivations', component: InactivationsReportComponent },
  { path: 'reports/new-concepts', component: NewConceptsReportComponent },
  { path: 'reports', component: ReportsMainComponent },
  { path: 'loinc', component: LoincMainComponent },
  { path: 'sv-demo', component: SvDemoComponent },
  { path: 'snomed-integrations', component: SnomedHubComponent },
  { path: 'valueset-translator', component: ValuesetTranslatorComponent },
  { path: 'sunburst-chart', component: SunburstChartComponent },
  { path: 'd3-sunburst-chart', component: D3SunburstChartComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
