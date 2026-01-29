import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';

import {MatToolbarModule} from '@angular/material/toolbar';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatRadioModule} from '@angular/material/radio';
import {MatDialogModule} from '@angular/material/dialog';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatListModule} from '@angular/material/list';
import {MatTreeModule} from '@angular/material/tree';
import {MatSortModule} from '@angular/material/sort';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSliderModule} from '@angular/material/slider';
import {MatChipsModule} from '@angular/material/chips';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { LoadingDialogComponent } from './alerts/loading-dialog.component';
import { AutocompleteBindingComponent } from './bindings/autocomplete-binding/autocomplete-binding.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AllergiesComponent } from './allergies/allergies.component';
import { AllergiesProblemListComponent } from './allergies/allergies-problem-list/allergies-problem-list.component';
import { AllergiesAllergyListComponent } from './allergies/allergies-allergy-list/allergies-allergy-list.component';

import { HighlightJsModule } from 'ngx-highlight-js';
import { AllergiesAllergyListReactionComponent } from './allergies/allergies-allergy-list/allergies-allergy-list-reaction/allergies-allergy-list-reaction.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';
import { DropdownBindingComponent } from './bindings/dropdown-binding/dropdown-binding.component';
import { RadiosBindingComponent } from './bindings/radios-binding/radios-binding.component';
import { TextBoxBindingComponent } from './bindings/textbox-binding/textbox-binding.component';
import { EclBuilderDialogComponent } from './bindings/ecl-builder-dialog/ecl-builder-dialog.component';
import { CheckBoxBindingComponent } from './bindings/checkbox-binding/checkbox-binding.component';
import { PrescriptionMainComponent } from './prescription/prescription-main/prescription-main.component';
import { QuestionnairesMainComponent } from './questionnaires/questionnaires-main/questionnaires-main.component';
import { SubsetValidatorComponent } from './implementation-course/subset-validator/subset-validator.component';
import { LoadQuestionnaireModalComponent } from './questionnaires/load-questionnaire-modal/load-questionnaire-modal.component';
import { FhirServerSettingsModalComponent } from './questionnaires/fhir-server-settings-modal/fhir-server-settings-modal.component';
import { ListQuestionnairesComponent } from './questionnaires/list-questionnaires/list-questionnaires.component';
import { ValidateQuestionnaireComponent } from './questionnaires/validate-questionnaire/validate-questionnaire.component';
import { CreateRootModuleComponent } from './questionnaires/create-root-module/create-root-module.component';
import { ConfirmationDialogComponent } from './questionnaires/confirmation-dialog/confirmation-dialog.component';
import { IntegerBindingComponent } from './bindings/integer-binding/integer-binding.component';
import { DecimalBindingComponent } from './bindings/decimal-binding/decimal-binding.component';
import { SnoguessMainComponent } from './game/snoguess-main/snoguess-main.component';
import { KeyboardComponent } from './game/keyboard/keyboard.component';
import { SituationMapComponent } from './context/situation-map/situation-map.component';
import { ContextMainComponent } from './context/context-main/context-main.component';
import { ElapsedTimePipe } from './pipes/elapsed-time.pipe';
import { QuestionnaireHistoryComponent } from './questionnaires/questionnaire-history/questionnaire-history.component';

import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../environments/firebase.config';
import { ScoreboardComponent } from './game/scoreboard/scoreboard.component';
import { SafeTextPipe } from './pipes/safe-text.pipe';
import { AddToHomeComponent } from './game/add-to-home/add-to-home.component';
import { MaturityMainComponent } from './maturity/maturity-main/maturity-main.component';
import { MatPaginatorModule } from '@angular/material/paginator';
import { CheckBoxMultipleBindingComponent } from './bindings/checkbox-multiple-binding/checkbox-multiple-binding.component';
import { HomeComponent } from './home/home.component';
import { BindingsViewerComponent } from './bindings-sandbox/bindings-viewer/bindings-viewer.component';
import { NcptComponent } from './ncpt/ncpt.component';
import { MaturityResultsComponent } from './maturity/maturity-results/maturity-results.component';
import { MaturityResultsDialogComponent } from './maturity/maturity-results-dialog';
import { FsnChangesComponent } from './reports/fsn-changes/fsn-changes.component';
import { InactivationsReportComponent } from './reports/inactivations/inactivations-report.component';
import { ReportsMainComponent } from './reports/reports-main/reports-main.component';
import { NewConceptsReportComponent } from './reports/new-concepts/new-concepts-report.component';
import { TriageGameComponent } from './phaser-game/phaser-v2/triage-game.component';
import { LoincMainComponent } from './loinc/loinc-main/loinc-main.component';
import { LoincOrderComponent } from './loinc/loinc-order/loinc-order.component';
import { LoincResultsComponent } from './loinc/loinc-results/loinc-results.component';
import { LanguageConfigComponent } from './util/language-config/language-config.component';
import { FlipCardComponent } from './util/flip-card/flip-card.component';
import { RefsetViewerComponent } from './util/refset-viewer/refset-viewer.component';
import { MaturityDashboardComponent } from './maturity/maturity-dashboard/maturity-dashboard.component';
import { MaturityAdminComponent } from './maturity/maturity-admin/maturity-admin.component';
import { MaturityEditorComponent } from './maturity/maturity-editor/maturity-editor.component';
import { NgxGaugeModule } from 'ngx-gauge';
import { SvDemoComponent } from './sv-demo/sv-demo.component';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { SnomedHubComponent } from './snomed-hub/snomed-hub.component';
import { MatRippleModule } from '@angular/material/core';
import { ValuesetTranslatorComponent } from './valueset-translator/valueset-translator.component';
import { SunburstChartComponent } from './descriptive-statistics/sunburst-chart/sunburst-chart.component';
import { D3SunburstChartComponent } from './descriptive-statistics/d3-sunburst-chart/d3-sunburst-chart.component';
import { PlotlyTreemapChartComponent } from './descriptive-statistics/plotly-treemap-chart/plotly-treemap-chart.component';
import { BenefitsDemoComponent } from './benefits-demo/benefits-demo.component';
import { ClinicalRecordComponent } from './benefits-demo/clinical-record/clinical-record.component';
import { ClinicalFormsComponent } from './benefits-demo/clinical-forms/clinical-forms.component';
import { AdverseReactionFormComponent } from './benefits-demo/clinical-forms/adverse-reaction-form/adverse-reaction-form.component';
import { CreatePatientComponent } from './benefits-demo/create-patient/create-patient.component';
import { ClinicalEntryComponent } from './benefits-demo/clinical-entry/clinical-entry.component';
import { ClinicalTimelineComponent } from './benefits-demo/clinical-timeline/clinical-timeline.component';
import { EncounterRecordComponent } from './benefits-demo/encounter-record/encounter-record.component';
import { InteroperabilityComponent } from './benefits-demo/interoperability/interoperability.component';
import { QuestionnaireFormComponent } from './benefits-demo/questionnaire-form/questionnaire-form.component';
import { OpenehrFormComponent } from './benefits-demo/openehr-form/openehr-form.component';
import { AiAssistedEntryComponent } from './benefits-demo/ai-assisted-entry/ai-assisted-entry.component';
import { ExpoQuiz2025Component } from './expo-quiz-2025/expo-quiz-2025.component';
import { BatchPatientDialogComponent } from './benefits-demo/batch-patient-dialog/batch-patient-dialog.component';
import { LicenseAgreementComponent } from './license-agreement/license-agreement.component';
import { CookieConsentComponent } from './cookie-consent/cookie-consent.component';
import { FormRecordsComponent } from './benefits-demo/form-records/form-records.component';
import { CdsPanelComponent } from './benefits-demo/cds-panel/cds-panel.component';
import { EhdsLaboratoryDemoComponent } from './ehds-laboratory-demo/ehds-laboratory-demo.component';
import { DiagnosticReportFormComponent } from './ehds-laboratory-demo/diagnostic-report-form/diagnostic-report-form.component';
import { DiagnosticReportPrintDialogComponent } from './ehds-laboratory-demo/diagnostic-report-print-dialog/diagnostic-report-print-dialog.component';
import { SpecimenFormComponent } from './ehds-laboratory-demo/specimen-form/specimen-form.component';
import { ServiceRequestFormComponent } from './ehds-laboratory-demo/service-request-form/service-request-form.component';
import { ObservationResultFormComponent } from './ehds-laboratory-demo/observation-result-form/observation-result-form.component';
import { MdrsViewerComponent } from './mdrs-viewer/mdrs-viewer.component';
import { CrsBatchGeneratorComponent } from './crs-batch-generator/crs-batch-generator.component';
import { DrugStrengthRoundingComponent } from './drug-strength-rounding/drug-strength-rounding.component';

const app = initializeApp(firebaseConfig);

@NgModule({ declarations: [
        AppComponent,
        LoadingDialogComponent,
        AutocompleteBindingComponent,
        AllergiesComponent,
        AllergiesProblemListComponent,
        AllergiesAllergyListComponent,
        AllergiesAllergyListReactionComponent,
        BindingsSandboxComponent,
        DropdownBindingComponent,
        RadiosBindingComponent,
        TextBoxBindingComponent,
        EclBuilderDialogComponent,
        CheckBoxBindingComponent,
        PrescriptionMainComponent,
        QuestionnairesMainComponent,
        SubsetValidatorComponent,
        LoadQuestionnaireModalComponent,
        FhirServerSettingsModalComponent,
        ListQuestionnairesComponent,
        ValidateQuestionnaireComponent,
        CreateRootModuleComponent,
        ConfirmationDialogComponent,
        IntegerBindingComponent,
        DecimalBindingComponent,
        SnoguessMainComponent,
        KeyboardComponent,
        SituationMapComponent,
        ContextMainComponent,
        ElapsedTimePipe,
        QuestionnaireHistoryComponent,
        ScoreboardComponent,
        SafeTextPipe,
        AddToHomeComponent,
        MaturityMainComponent,
        CheckBoxMultipleBindingComponent,
        HomeComponent,
        BindingsViewerComponent,
        NcptComponent,
        MaturityResultsComponent,
        MaturityResultsDialogComponent,
        FsnChangesComponent,
        InactivationsReportComponent,
        NewConceptsReportComponent,
        ReportsMainComponent,
        TriageGameComponent,
        LoincMainComponent,
        LoincOrderComponent,
        LoincResultsComponent,
        LanguageConfigComponent,
        FlipCardComponent,
        RefsetViewerComponent,
        MaturityDashboardComponent,
        MaturityAdminComponent,
        MaturityEditorComponent,
        SvDemoComponent,
        SnomedHubComponent,
        ValuesetTranslatorComponent,
        SunburstChartComponent,
        D3SunburstChartComponent,
        PlotlyTreemapChartComponent,
        BenefitsDemoComponent,
        ClinicalRecordComponent,
        ClinicalFormsComponent,
        AdverseReactionFormComponent,
        CreatePatientComponent,
        ClinicalEntryComponent,
        ClinicalTimelineComponent,
        EncounterRecordComponent,
        InteroperabilityComponent,
        QuestionnaireFormComponent,
        OpenehrFormComponent,
        AiAssistedEntryComponent,
        ExpoQuiz2025Component,
        BatchPatientDialogComponent,
        LicenseAgreementComponent,
        CookieConsentComponent,
        FormRecordsComponent,
        CdsPanelComponent,
        EhdsLaboratoryDemoComponent,
        DiagnosticReportFormComponent,
        DiagnosticReportPrintDialogComponent,
        SpecimenFormComponent,
        ServiceRequestFormComponent,
        ObservationResultFormComponent,
        MdrsViewerComponent,
        CrsBatchGeneratorComponent,
        DrugStrengthRoundingComponent
    ],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA], imports: [BrowserModule,
        HighlightJsModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        DragDropModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatSnackBarModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatAutocompleteModule,
        MatProgressSpinnerModule,
        MatInputModule,
        ReactiveFormsModule,
        MatTabsModule,
        MatCardModule,
        MatTableModule,
        MatSelectModule,
        FormsModule,
        MatTooltipModule,
        MatSlideToggleModule,
        MatExpansionModule,
        MatRadioModule,
        MatDialogModule,
        MatCheckboxModule,
        MatListModule,
        MatTreeModule,
        MatSortModule,
        FormsModule,
        MatSidenavModule,
        MatSliderModule,
        MatChipsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        NgxGaugeModule,
        NgxMatSelectSearchModule,
        MatRippleModule,
        MatPaginatorModule], providers: [provideHttpClient(withInterceptorsFromDi())] })

export class AppModule { }
