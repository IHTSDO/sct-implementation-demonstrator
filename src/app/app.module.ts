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
import {MatSortModule} from '@angular/material/sort';

import { HttpClientModule } from '@angular/common/http';
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

@NgModule({
  declarations: [
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
    ConfirmationDialogComponent
  ],
  imports: [
    HttpClientModule,
    BrowserModule,
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
    MatSortModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
