import { NgModule } from '@angular/core';
import { AiAssistedEntryComponent } from './ai-assisted-entry/ai-assisted-entry.component';
import { AllergyFormDialogComponent } from './allergy-form-dialog/allergy-form-dialog.component';
import { BatchPatientDialogComponent } from './batch-patient-dialog/batch-patient-dialog.component';
import { BenefitsDemoComponent } from './benefits-demo.component';
import { CdsPanelComponent } from './cds-panel/cds-panel.component';
import { ClinicalEntryComponent } from './clinical-entry/clinical-entry.component';
import { AdverseReactionFormComponent } from './clinical-forms/adverse-reaction-form/adverse-reaction-form.component';
import { ClinicalFormsComponent } from './clinical-forms/clinical-forms.component';
import { ClinicalRecordComponent } from './clinical-record/clinical-record.component';
import { ClinicalTimelineComponent } from './clinical-timeline/clinical-timeline.component';
import { CreatePatientComponent } from './create-patient/create-patient.component';
import { DeathRegistrationDialogComponent } from './death-registration-dialog/death-registration-dialog.component';
import { DentistryAllFindingsListComponent } from './dentistry-record/dentistry-all-findings-list/dentistry-all-findings-list.component';
import { DentistryDataEntryPanelComponent } from './dentistry-record/dentistry-data-entry-panel/dentistry-data-entry-panel.component';
import { DentistryFhirDialogComponent } from './dentistry-record/dentistry-fhir-dialog/dentistry-fhir-dialog.component';
import { DentistryOdontogramAnatomicComponent } from './dentistry-record/dentistry-odontogram-anatomic/dentistry-odontogram-anatomic.component';
import { DentistryOdontogramRootSurfaceComponent } from './dentistry-record/dentistry-odontogram-root-surface/dentistry-odontogram-root-surface.component';
import { DentistryRecordItemComponent } from './dentistry-record/dentistry-record-item/dentistry-record-item.component';
import { DentistryRecordComponent } from './dentistry-record/dentistry-record.component';
import { EncounterRecordComponent } from './encounter-record/encounter-record.component';
import { FhirDataComponent } from './fhir-data/fhir-data.component';
import { FormRecordsComponent } from './form-records/form-records.component';
import { ConceptValidationDialogComponent } from './interoperability/concept-validation-dialog/concept-validation-dialog.component';
import { InteroperabilityComponent } from './interoperability/interoperability.component';
import { NursingNutritionalCareplanComponent } from './nursing-record/nursing-nutritional-careplan/nursing-nutritional-careplan.component';
import { NursingRecordComponent } from './nursing-record/nursing-record.component';
import { NursingVitalCardComponent } from './nursing-record/nursing-vital-card/nursing-vital-card.component';
import { NursingVitalSignsComponent } from './nursing-record/nursing-vital-signs/nursing-vital-signs.component';
import { OpenehrFormComponent } from './openehr-form/openehr-form.component';
import { ProblemsListSimplifiedComponent } from './problems-list-simplified/problems-list-simplified.component';
import { QuestionnaireFormComponent } from './questionnaire-form/questionnaire-form.component';
import { SmartHealthLinksComponent } from './smart-health-links/smart-health-links.component';
import { AllergiesModule } from '../shared/allergies.module';
import { AppMaterialModule } from '../shared/app-material.module';
import { BindingsModule } from '../shared/bindings.module';
import { LoincModule } from '../shared/loinc.module';
import { QuestionnairesSharedModule } from '../shared/questionnaires-shared.module';
import { UiSharedModule } from '../shared/ui-shared.module';
import { DescriptiveStatisticsModule } from '../descriptive-statistics/descriptive-statistics.module';

@NgModule({
  declarations: [
    AiAssistedEntryComponent,
    AllergyFormDialogComponent,
    BatchPatientDialogComponent,
    BenefitsDemoComponent,
    CdsPanelComponent,
    ClinicalEntryComponent,
    AdverseReactionFormComponent,
    ClinicalFormsComponent,
    ClinicalRecordComponent,
    ClinicalTimelineComponent,
    CreatePatientComponent,
    DeathRegistrationDialogComponent,
    DentistryAllFindingsListComponent,
    DentistryDataEntryPanelComponent,
    DentistryFhirDialogComponent,
    DentistryOdontogramAnatomicComponent,
    DentistryOdontogramRootSurfaceComponent,
    DentistryRecordComponent,
    DentistryRecordItemComponent,
    EncounterRecordComponent,
    FhirDataComponent,
    FormRecordsComponent,
    ConceptValidationDialogComponent,
    InteroperabilityComponent,
    NursingNutritionalCareplanComponent,
    NursingRecordComponent,
    NursingVitalCardComponent,
    NursingVitalSignsComponent,
    OpenehrFormComponent,
    ProblemsListSimplifiedComponent,
    QuestionnaireFormComponent,
    SmartHealthLinksComponent,
  ],
  imports: [
    AllergiesModule,
    AppMaterialModule,
    BindingsModule,
    DescriptiveStatisticsModule,
    LoincModule,
    QuestionnairesSharedModule,
    UiSharedModule,
  ],
  exports: [
    BenefitsDemoComponent,
    ClinicalRecordComponent,
    CreatePatientComponent,
    EncounterRecordComponent,
    InteroperabilityComponent,
    SmartHealthLinksComponent,
  ],
})
export class BenefitsDemoModule {}
