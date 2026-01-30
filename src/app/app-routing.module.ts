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
import { MaturityAdminComponent } from './maturity/maturity-admin/maturity-admin.component';
import { MaturityEditorComponent } from './maturity/maturity-editor/maturity-editor.component';
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
import { PlotlyTreemapChartComponent } from './descriptive-statistics/plotly-treemap-chart/plotly-treemap-chart.component';
import { BenefitsDemoComponent } from './benefits-demo/benefits-demo.component';
import { ClinicalRecordComponent } from './benefits-demo/clinical-record/clinical-record.component';
import { CreatePatientComponent } from './benefits-demo/create-patient/create-patient.component';
import { EncounterRecordComponent } from './benefits-demo/encounter-record/encounter-record.component';
import { InteroperabilityComponent } from './benefits-demo/interoperability/interoperability.component';
import { ExpoQuiz2025Component } from './expo-quiz-2025/expo-quiz-2025.component';
import { PhaserGameComponent } from './phaser-game/phaser-v1/phaser-game.component';
import { EhdsLaboratoryDemoComponent } from './ehds-laboratory-demo/ehds-laboratory-demo.component';
import { MdrsViewerComponent } from './mdrs-viewer/mdrs-viewer.component';
import { CrsBatchGeneratorComponent } from './crs-batch-generator/crs-batch-generator.component';
import { DrugStrengthRoundingComponent } from './drug-strength-rounding/drug-strength-rounding.component';
import { ExtensionsSearchComponent } from './extensions-search/extensions-search.component';

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
  { path: 'maturity/admin', component: MaturityAdminComponent},
  { path: 'maturity/editor', component: MaturityEditorComponent},
  { path: 'ncpt', component: NcptComponent },
  { path: 'phaser', component: PhaserGameComponent },
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
  { path: 'descriptive-analytics', component: PlotlyTreemapChartComponent },
  { path: 'ehr-lab', component: BenefitsDemoComponent },
  { path: 'ehr-lab/analytics', component: PlotlyTreemapChartComponent },
  { path: 'clinical-record', component: ClinicalRecordComponent },
  { path: 'clinical-record/:patientId', component: ClinicalRecordComponent },
  { path: 'create-patient', component: CreatePatientComponent },
  { path: 'encounter-record', component: EncounterRecordComponent },
  { path: 'interoperability', component: InteroperabilityComponent },
  { path: 'expo-quiz-2025', component: ExpoQuiz2025Component },
  { path: 'ehds-laboratory-demo', component: EhdsLaboratoryDemoComponent },
  { path: 'mdrs-viewer', component: MdrsViewerComponent },
  { path: 'crs-batch-generator', component: CrsBatchGeneratorComponent },
  { path: 'drug-strength-rounding', component: DrugStrengthRoundingComponent },
  { path: 'extensions-search', component: ExtensionsSearchComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
