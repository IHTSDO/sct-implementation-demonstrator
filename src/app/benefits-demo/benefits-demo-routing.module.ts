import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BenefitsDemoComponent } from './benefits-demo.component';
import { ClinicalRecordComponent } from './clinical-record/clinical-record.component';
import { CreatePatientComponent } from './create-patient/create-patient.component';
import { EncounterRecordComponent } from './encounter-record/encounter-record.component';
import { InteroperabilityComponent } from './interoperability/interoperability.component';
import { SmartHealthLinksComponent } from './smart-health-links/smart-health-links.component';

const routes: Routes = [
  { path: 'ehr-lab', component: BenefitsDemoComponent },
  { path: 'ehr-lab/analytics', component: BenefitsDemoComponent },
  { path: 'clinical-record', component: ClinicalRecordComponent },
  { path: 'clinical-record/:patientId', component: ClinicalRecordComponent },
  { path: 'create-patient', component: CreatePatientComponent },
  { path: 'encounter-record', component: EncounterRecordComponent },
  { path: 'interoperability', component: InteroperabilityComponent },
  { path: 'ehr-lab/smart-health-links', component: SmartHealthLinksComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BenefitsDemoRoutingModule {}
