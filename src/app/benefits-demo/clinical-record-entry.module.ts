import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ClinicalRecordComponent } from './clinical-record/clinical-record.component';
import { BenefitsDemoModule } from './benefits-demo.module';

@NgModule({
  imports: [
    BenefitsDemoModule,
    RouterModule.forChild([
      { path: '', component: ClinicalRecordComponent },
      { path: ':patientId', component: ClinicalRecordComponent },
    ]),
  ],
})
export class ClinicalRecordEntryModule {}
