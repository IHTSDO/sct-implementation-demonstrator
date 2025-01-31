import Phaser, { Scene } from 'phaser';

export class Character extends Phaser.GameObjects.Rectangle {
  sceneRef!: Scene;
  spriteType: number;
  inQueue: boolean = false;
  queuePosition: number = 0;
  queueStartTime: number = 0;
  hitPoints: number = 5;
  calloutText?: Phaser.GameObjects.Text;
  calloutLine?: Phaser.GameObjects.Line;
  previousX: number = 0;
  info: any = {};
  speed = 1;
  moveTween?: Phaser.Tweens.Tween; // Store movement tween

  constructor(scene: Scene, x: number, y: number, spriteType: number = 1, color: number = 0x00ff00) {
    super(scene, x, y, 40, 40, color);
    this.sceneRef = scene;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Enable physics
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    (this.body as Phaser.Physics.Arcade.Body).setImmovable(false);

    this.spriteType = spriteType;
  }

  /**
   * Moves the character along a path of points.
   * @param points An array of points { x, y, duration } to move along.
   * @param onComplete A callback function to execute after the movement finishes.
   */
  walkTo(points: { x: number; y: number; duration: number }[], onComplete: () => void): void {
    if (points.length === 0) {
      onComplete();
      return;
    }

    const moveCharacter = (index: number) => {
      if (index >= points.length) {
        onComplete();
        return;
      }
      const point = points[index];

      this.sceneRef.tweens.add({
        targets: this,
        x: point.x,
        y: point.y,
        duration: point.duration / this.speed,
        ease: 'Linear',
        onUpdate: () => {
        },
        onComplete: () => {
          moveCharacter(index + 1);
        },
      });

      // Extra squish animation while moving
      this.sceneRef.tweens.add({
        targets: this,
        yoyo: true,
        repeat: point.duration / 150, // Slight bobbing motion
        duration: 150,
        onComplete: () => {
        },
      });
    };

    moveCharacter(0);
  }

  hurt() {
    this.hitPoints--;

    // Add damage pop-up text
    const damageText = this.sceneRef.add.text(this.x, this.y - 10, '-1', {
      fontSize: '20px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Animate the text to float upward and fade out
    this.sceneRef.tweens.add({
      targets: damageText,
      y: this.y - 100,
      alpha: 0,
      duration: 3500 / this.speed,
      ease: 'Power2',
      onComplete: () => damageText.destroy(),
    });

    if (this.hitPoints <= 0) {
      this.destroy(); // Remove the character if they "die"
    }
  }

  say(message: string, duration: number = 2000) {
    if (this.calloutText) {
      this.calloutText.destroy();
    }
    if (this.calloutLine) {
      this.calloutLine.destroy();
    }

    this.calloutText = this.sceneRef.add.text(this.x, this.y - 50, message, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 2 },
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    this.calloutLine = this.sceneRef.add.line(
      this.x + 5,
      this.y + 10,
      0,
      0,
      +10,
      -35,
      0xffffff
    ).setLineWidth(1.5).setDepth(9);

    this.sceneRef.tweens.add({
      targets: [this.calloutText, this.calloutLine],
      alpha: 0,
      duration: 500 / this.speed,
      delay: duration,
      onComplete: () => {
        this.calloutText?.destroy();
        this.calloutText = undefined;
        this.calloutLine?.destroy();
      },
    });
  }
}
