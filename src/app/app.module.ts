import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { initializeApp } from 'firebase/app';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LoadingDialogComponent } from './alerts/loading-dialog.component';
import { BindingsSandboxComponent } from './bindings-sandbox/bindings-sandbox.component';
import { ContextMainComponent } from './context/context-main/context-main.component';
import { SituationMapComponent } from './context/situation-map/situation-map.component';
import { CrsBatchGeneratorComponent } from './crs-batch-generator/crs-batch-generator.component';
import { CookieConsentComponent } from './cookie-consent/cookie-consent.component';
import { DrugStrengthRoundingComponent } from './drug-strength-rounding/drug-strength-rounding.component';
import { ExpoQuiz2025Component } from './expo-quiz-2025/expo-quiz-2025.component';
import { ExtensionsSearchComponent } from './extensions-search/extensions-search.component';
import { FhirInternationalizerComponent } from './fhir-internationalizer/fhir-internationalizer.component';
import { AddToHomeComponent } from './game/add-to-home/add-to-home.component';
import { KeyboardComponent } from './game/keyboard/keyboard.component';
import { ScoreboardComponent } from './game/scoreboard/scoreboard.component';
import { SnoguessMainComponent } from './game/snoguess-main/snoguess-main.component';
import { HomeComponent } from './home/home.component';
import { SubsetValidatorComponent } from './implementation-course/subset-validator/subset-validator.component';
import { LicenseAgreementComponent } from './license-agreement/license-agreement.component';
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
import { firebaseConfig } from '../environments/firebase.config';
import { AllergiesModule } from './shared/allergies.module';
import { AppMaterialModule } from './shared/app-material.module';
import { BindingsModule } from './shared/bindings.module';
import { LoincModule } from './shared/loinc.module';
import { QuestionnairesSharedModule } from './shared/questionnaires-shared.module';
import { UiSharedModule } from './shared/ui-shared.module';
import { FhirRateLimitInterceptor } from './interceptors/fhir-rate-limit.interceptor';

initializeApp(firebaseConfig);

@NgModule({
  declarations: [
    AppComponent,
    LoadingDialogComponent,
    BindingsSandboxComponent,
    ContextMainComponent,
    SituationMapComponent,
    CrsBatchGeneratorComponent,
    CookieConsentComponent,
    DrugStrengthRoundingComponent,
    ExpoQuiz2025Component,
    ExtensionsSearchComponent,
    FhirInternationalizerComponent,
    AddToHomeComponent,
    KeyboardComponent,
    ScoreboardComponent,
    SnoguessMainComponent,
    HomeComponent,
    SubsetValidatorComponent,
    LicenseAgreementComponent,
    MedicinalProductClassesComponent,
    NcptComponent,
    PrescriptionMainComponent,
    CreateRootModuleComponent,
    FhirServerSettingsModalComponent,
    ListQuestionnairesComponent,
    LoadQuestionnaireModalComponent,
    QuestionnaireHistoryComponent,
    QuestionnairesMainComponent,
    ValidateQuestionnaireComponent,
    SnomedHubComponent,
    SvDemoComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppMaterialModule,
    AppRoutingModule,
    AllergiesModule,
    BindingsModule,
    LoincModule,
    QuestionnairesSharedModule,
    UiSharedModule,
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: FhirRateLimitInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
