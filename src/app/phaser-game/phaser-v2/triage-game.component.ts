import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import Phaser from 'phaser';
import { TerminologyService } from '../../services/terminology.service';
import { doc } from 'firebase/firestore';
import { CdstdScene } from './scenes/cdstd-scene';
import { UIScene } from './scenes/ui-scene';
import { EclEditorScene } from './scenes/ecl-editor-scene';

@Component({
    selector: 'app-triage-game',
    templateUrl: './triage-game.component.html',
    styleUrls: ['./triage-game.component.css'],
    standalone: false
})
export class TriageGameComponent implements OnInit, OnDestroy {
  private game!: Phaser.Game;

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit() {
    const uiScene: UIScene = new UIScene();
    const eclEditorScene: EclEditorScene = new EclEditorScene();
    const cdstdScene: CdstdScene = new CdstdScene(this.terminologyService);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: this.gameContainer.nativeElement,
      scene: [cdstdScene, uiScene, eclEditorScene],
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
        },
      },
    };

    this.game = new Phaser.Game(config);
  }

  ngOnDestroy() {
    if (this.game) {
      this.game.destroy(true);
    }
  }
}
