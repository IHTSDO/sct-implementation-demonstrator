import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EncounterRecordComponent } from './encounter-record/encounter-record.component';
import { BenefitsDemoModule } from './benefits-demo.module';

@NgModule({
  imports: [
    BenefitsDemoModule,
    RouterModule.forChild([{ path: '', component: EncounterRecordComponent }]),
  ],
})
export class EncounterRecordEntryModule {}
