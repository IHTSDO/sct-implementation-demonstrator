import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BenefitsDemoComponent } from './benefits-demo.component';
import { SmartHealthLinksComponent } from './smart-health-links/smart-health-links.component';
import { BenefitsDemoModule } from './benefits-demo.module';

@NgModule({
  imports: [
    BenefitsDemoModule,
    RouterModule.forChild([
      { path: '', component: BenefitsDemoComponent },
      { path: 'analytics', component: BenefitsDemoComponent },
      { path: 'smart-health-links', component: SmartHealthLinksComponent },
    ]),
  ],
})
export class BenefitsDemoEntryModule {}
