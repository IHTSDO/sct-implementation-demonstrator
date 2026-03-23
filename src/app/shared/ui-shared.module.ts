import { NgModule } from '@angular/core';
import { CodingTabsComponent } from '../coding-tabs/coding-tabs.component';
import { ElapsedTimePipe } from '../pipes/elapsed-time.pipe';
import { SafeTextPipe } from '../pipes/safe-text.pipe';
import { FlipCardComponent } from '../util/flip-card/flip-card.component';
import { LanguageConfigComponent } from '../util/language-config/language-config.component';
import { RefsetViewerComponent } from '../util/refset-viewer/refset-viewer.component';
import { AppMaterialModule } from './app-material.module';
import { BindingsModule } from './bindings.module';

const DECLARATIONS = [
  CodingTabsComponent,
  ElapsedTimePipe,
  SafeTextPipe,
  FlipCardComponent,
  LanguageConfigComponent,
  RefsetViewerComponent,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [AppMaterialModule, BindingsModule],
  exports: [AppMaterialModule, BindingsModule, ...DECLARATIONS],
})
export class UiSharedModule {}
