import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CreatePatientComponent } from './create-patient/create-patient.component';
import { BenefitsDemoModule } from './benefits-demo.module';

@NgModule({
  imports: [
    BenefitsDemoModule,
    RouterModule.forChild([{ path: '', component: CreatePatientComponent }]),
  ],
})
export class CreatePatientEntryModule {}
