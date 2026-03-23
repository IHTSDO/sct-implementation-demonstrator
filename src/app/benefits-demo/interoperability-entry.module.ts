import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { InteroperabilityComponent } from './interoperability/interoperability.component';
import { BenefitsDemoModule } from './benefits-demo.module';

@NgModule({
  imports: [
    BenefitsDemoModule,
    RouterModule.forChild([{ path: '', component: InteroperabilityComponent }]),
  ],
})
export class InteroperabilityEntryModule {}
