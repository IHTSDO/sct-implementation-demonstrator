import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
  private pauseButton!: Phaser.GameObjects.Image;
  private gamePaused: boolean = false;
  private speedButtons: Phaser.GameObjects.Text[] = [];
  private speedLevels: number[] = [1, 2, 4, 16]; // Speed levels
  private activeSpeedIndex: number = 0; // Default speed index (1x)

  constructor() {
    super({ key: 'UIScene', active: true });
  }

  preload() {
    this.load.image('pauseButton', 'assets/cdstd/Objects/Buttons/button_pause.png');
    this.load.image('unpauseButton', 'assets/cdstd/Objects/Buttons/button_unpause.png');
  }

  create() {
    this.pauseButton = this.add.image(75, 50, 'pauseButton').setInteractive();
    this.pauseButton.on('pointerdown', () => this.togglePause());

    this.speedLevels.forEach((speed, index) => {
      const button = this.add.text(150 + index * 60, 35, `${speed}x`, {
        fontSize: '18px',
        color: index === this.activeSpeedIndex ? '#ff0' : '#fff',
        backgroundColor: '#000',
        padding: { x: 10, y: 5 },
      })
      .setInteractive()
      .on('pointerdown', () => this.setSpeed(index));

      this.speedButtons.push(button);
    });
  }

  private togglePause() {
    const cdstdScene = this.scene.get('CdstdScene');
    if (!this.gamePaused) {
      cdstdScene.scene.pause();
      this.gamePaused = true;
      this.pauseButton.setTexture('unpauseButton');
    } else {
      cdstdScene.scene.resume();
      this.gamePaused = false;
      this.pauseButton.setTexture('pauseButton');
    }
  }

  private setSpeed(index: number) {
    this.activeSpeedIndex = index;
    this.speedButtons.forEach((button, i) => {
      button.setStyle({ color: i === this.activeSpeedIndex ? '#ff0' : '#fff' });
    });

    const cdstdScene = this.scene.get('CdstdScene') as any;
    if (cdstdScene) {
      cdstdScene.setSpeedMultiplier(this.speedLevels[this.activeSpeedIndex]);
    }
  }
}
