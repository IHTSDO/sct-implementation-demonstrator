import { NgModule } from '@angular/core';
import { LoincGrouperResolutionDialogComponent } from '../loinc/loinc-grouper-resolution-dialog/loinc-grouper-resolution-dialog.component';
import { LoincMainComponent } from '../loinc/loinc-main/loinc-main.component';
import { LoincOrderComponent } from '../loinc/loinc-order/loinc-order.component';
import { LoincOrderSearchPanelComponent } from '../loinc/loinc-order-search-panel/loinc-order-search-panel.component';
import { LoincResultEditorComponent } from '../loinc/loinc-result-editor/loinc-result-editor.component';
import { LoincResultLoaderDialogComponent } from '../loinc/loinc-result-loader-dialog/loinc-result-loader-dialog.component';
import { LoincResultsComponent } from '../loinc/loinc-results/loinc-results.component';
import { LoincTreeBrowserComponent } from '../loinc/loinc-tree-browser/loinc-tree-browser.component';
import { AppMaterialModule } from './app-material.module';
import { BindingsModule } from './bindings.module';

const DECLARATIONS = [
  LoincGrouperResolutionDialogComponent,
  LoincMainComponent,
  LoincOrderComponent,
  LoincOrderSearchPanelComponent,
  LoincResultEditorComponent,
  LoincResultLoaderDialogComponent,
  LoincResultsComponent,
  LoincTreeBrowserComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule, BindingsModule],
  exports: DECLARATIONS,
})
export class LoincModule {}
