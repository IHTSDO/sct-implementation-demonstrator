import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PhaserGameComponent } from './phaser-v1/phaser-game.component';
import { PhaserGameModule } from './phaser-game.module';

@NgModule({
  imports: [
    PhaserGameModule,
    RouterModule.forChild([{ path: '', component: PhaserGameComponent }]),
  ],
})
export class PhaserV1EntryModule {}
