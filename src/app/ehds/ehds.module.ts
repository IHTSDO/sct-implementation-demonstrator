import { NgModule } from '@angular/core';
import { TRANSLOCO_SCOPE, TranslocoModule } from '@jsverse/transloco';
import { UiSharedModule } from '../shared/ui-shared.module';
import { EhdsRoutingModule } from './ehds-routing.module';
import { EhdsHomeComponent } from './ehds-home/ehds-home.component';

/** EHDS home page (/ehds): educational introduction + EHDS demonstrators. */
@NgModule({
  declarations: [EhdsHomeComponent],
  imports: [UiSharedModule, TranslocoModule, EhdsRoutingModule],
  providers: [{ provide: TRANSLOCO_SCOPE, useValue: 'ehds' }],
})
export class EhdsModule {}
