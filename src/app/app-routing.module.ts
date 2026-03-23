import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllergiesComponent } from './allergies/allergies.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';
import { ContextMainComponent } from './context/context-main/context-main.component';
import { CrsBatchGeneratorComponent } from './crs-batch-generator/crs-batch-generator.component';
import { DrugStrengthRoundingComponent } from './drug-strength-rounding/drug-strength-rounding.component';
import { ExpoQuiz2025Component } from './expo-quiz-2025/expo-quiz-2025.component';
import { ExtensionsSearchComponent } from './extensions-search/extensions-search.component';
import { AddToHomeComponent } from './game/add-to-home/add-to-home.component';
import { KeyboardComponent } from './game/keyboard/keyboard.component';
import { ScoreboardComponent } from './game/scoreboard/scoreboard.component';
import { SnoguessMainComponent } from './game/snoguess-main/snoguess-main.component';
import { HomeComponent } from './home/home.component';
import { SubsetValidatorComponent } from './implementation-course/subset-validator/subset-validator.component';
import { LoincMainComponent } from './loinc/loinc-main/loinc-main.component';
import { MedicinalProductClassesComponent } from './medicinal-product-classes/medicinal-product-classes.component';
import { NcptComponent } from './ncpt/ncpt.component';
import { PrescriptionMainComponent } from './prescription/prescription-main/prescription-main.component';
import { CreateRootModuleComponent } from './questionnaires/create-root-module/create-root-module.component';
import { FhirServerSettingsModalComponent } from './questionnaires/fhir-server-settings-modal/fhir-server-settings-modal.component';
import { ListQuestionnairesComponent } from './questionnaires/list-questionnaires/list-questionnaires.component';
import { LoadQuestionnaireModalComponent } from './questionnaires/load-questionnaire-modal/load-questionnaire-modal.component';
import { QuestionnaireHistoryComponent } from './questionnaires/questionnaire-history/questionnaire-history.component';
import { QuestionnairesMainComponent } from './questionnaires/questionnaires-main/questionnaires-main.component';
import { ValidateQuestionnaireComponent } from './questionnaires/validate-questionnaire/validate-questionnaire.component';
import { SnomedHubComponent } from './snomed-hub/snomed-hub.component';
import { SvDemoComponent } from './sv-demo/sv-demo.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'allergies', component: AllergiesComponent },
  { path: 'sandbox', component: BindingsSandboxComponent },
  { path: 'prescription', component: PrescriptionMainComponent },
  { path: 'questionnaires', component: QuestionnairesMainComponent },
  { path: 'questionnaires/create-root-module', component: CreateRootModuleComponent },
  { path: 'questionnaires/fhir-server-settings', component: FhirServerSettingsModalComponent },
  { path: 'questionnaires/list', component: ListQuestionnairesComponent },
  { path: 'questionnaires/load', component: LoadQuestionnaireModalComponent },
  { path: 'questionnaires/history', component: QuestionnaireHistoryComponent },
  { path: 'questionnaires/validate', component: ValidateQuestionnaireComponent },
  { path: 'implementation-course/subset-validator', component: SubsetValidatorComponent },
  { path: 'snoguess', component: SnoguessMainComponent },
  { path: 'snoguess/keyboard', component: KeyboardComponent },
  { path: 'snoguess/install', component: AddToHomeComponent },
  { path: 'snoguess/scoreboard', component: ScoreboardComponent },
  { path: 'context', component: ContextMainComponent },
  { path: 'ncpt', component: NcptComponent },
  { path: 'loinc', component: LoincMainComponent },
  { path: 'sv-demo', component: SvDemoComponent },
  { path: 'snomed-integrations', component: SnomedHubComponent },
  { path: 'expo-quiz-2025', component: ExpoQuiz2025Component },
  { path: 'crs-batch-generator', component: CrsBatchGeneratorComponent },
  { path: 'drug-strength-rounding', component: DrugStrengthRoundingComponent },
  { path: 'medicinal-product-classes', component: MedicinalProductClassesComponent },
  { path: 'extensions-search', component: ExtensionsSearchComponent },
  { path: 'sunburst-chart', loadChildren: () => import('./descriptive-statistics/sunburst-chart-entry.module').then((m) => m.SunburstChartEntryModule) },
  { path: 'd3-sunburst-chart', loadChildren: () => import('./descriptive-statistics/d3-sunburst-entry.module').then((m) => m.D3SunburstEntryModule) },
  { path: 'descriptive-analytics', loadChildren: () => import('./descriptive-statistics/plotly-treemap-entry.module').then((m) => m.PlotlyTreemapEntryModule) },
  { path: 'phaser', loadChildren: () => import('./phaser-game/phaser-v1-entry.module').then((m) => m.PhaserV1EntryModule) },
  { path: 'triage', loadChildren: () => import('./phaser-game/triage-entry.module').then((m) => m.TriageEntryModule) },
  { path: 'maturity', loadChildren: () => import('./maturity/maturity.module').then((m) => m.MaturityModule) },
  { path: 'fsn', redirectTo: 'reports/fsn', pathMatch: 'full' },
  { path: 'reports', loadChildren: () => import('./reports/reports.module').then((m) => m.ReportsModule) },
  { path: 'valueset-translator', loadChildren: () => import('./valueset-translator/valueset-translator.module').then((m) => m.ValuesetTranslatorModule) },
  { path: 'ehr-lab', loadChildren: () => import('./benefits-demo/benefits-demo-entry.module').then((m) => m.BenefitsDemoEntryModule) },
  { path: 'clinical-record', loadChildren: () => import('./benefits-demo/clinical-record-entry.module').then((m) => m.ClinicalRecordEntryModule) },
  { path: 'create-patient', loadChildren: () => import('./benefits-demo/create-patient-entry.module').then((m) => m.CreatePatientEntryModule) },
  { path: 'encounter-record', loadChildren: () => import('./benefits-demo/encounter-record-entry.module').then((m) => m.EncounterRecordEntryModule) },
  { path: 'interoperability', loadChildren: () => import('./benefits-demo/interoperability-entry.module').then((m) => m.InteroperabilityEntryModule) },
  { path: 'ehds-laboratory-demo', loadChildren: () => import('./ehds-laboratory-demo/ehds-laboratory-demo.module').then((m) => m.EhdsLaboratoryDemoModule) },
  { path: 'mdrs-viewer', loadChildren: () => import('./mdrs-viewer/mdrs-viewer.module').then((m) => m.MdrsViewerModule) },
  { path: 'cohort-workspace', loadChildren: () => import('./cohort-definition/cohort-definition.module').then((m) => m.CohortDefinitionModule) },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
