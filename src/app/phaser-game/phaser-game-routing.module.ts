import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PhaserGameComponent } from './phaser-v1/phaser-game.component';
import { TriageGameComponent } from './phaser-v2/triage-game.component';

const routes: Routes = [
  { path: 'phaser', component: PhaserGameComponent },
  { path: 'triage', component: TriageGameComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PhaserGameRoutingModule {}
