import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TriageGameComponent } from './phaser-v2/triage-game.component';
import { PhaserGameModule } from './phaser-game.module';

@NgModule({
  imports: [
    PhaserGameModule,
    RouterModule.forChild([{ path: '', component: TriageGameComponent }]),
  ],
})
export class TriageEntryModule {}
