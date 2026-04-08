import { NgModule } from '@angular/core';
import { LoincMainComponent } from '../loinc/loinc-main/loinc-main.component';
import { LoincOrderComponent } from '../loinc/loinc-order/loinc-order.component';
import { LoincOrderSearchPanelComponent } from '../loinc/loinc-order-search-panel/loinc-order-search-panel.component';
import { LoincResultLoaderDialogComponent } from '../loinc/loinc-result-loader-dialog/loinc-result-loader-dialog.component';
import { LoincResultsComponent } from '../loinc/loinc-results/loinc-results.component';
import { AppMaterialModule } from './app-material.module';
import { BindingsModule } from './bindings.module';

const DECLARATIONS = [
  LoincMainComponent,
  LoincOrderComponent,
  LoincOrderSearchPanelComponent,
  LoincResultLoaderDialogComponent,
  LoincResultsComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule, BindingsModule],
  exports: DECLARATIONS,
})
export class LoincModule {}
