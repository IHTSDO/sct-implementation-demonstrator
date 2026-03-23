import { NgModule } from '@angular/core';
import { PhaserGameComponent } from './phaser-v1/phaser-game.component';
import { TriageGameComponent } from './phaser-v2/triage-game.component';
import { AppMaterialModule } from '../shared/app-material.module';

@NgModule({
  declarations: [PhaserGameComponent, TriageGameComponent],
  imports: [AppMaterialModule],
  exports: [PhaserGameComponent, TriageGameComponent],
})
export class PhaserGameModule {}
