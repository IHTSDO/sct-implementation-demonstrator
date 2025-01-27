import Phaser, { Scene } from 'phaser';

export class Character extends Phaser.Physics.Arcade.Sprite {
  sceneRef!: Scene;
  spriteType: number;
  role: 'patient' | 'gatekeeper';
  inQueue: boolean = false;
  queuePosition: number = 0;
  queueStartTime: number = 0;
  hitPoints: number = 5;
  calloutText?: Phaser.GameObjects.Text;
  calloutLine?: Phaser.GameObjects.Line;
  previousX: number = 0;
  info: any = {};
  speed = 1;

  constructor(scene: Scene, x: number, y: number, role: 'patient' | 'gatekeeper', spriteType: number = 1) {
    super(scene, x, y, `${role}_idle_${spriteType}`);
    this.sceneRef = scene;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set any default properties for the character here
    this.setCollideWorldBounds(true);
    this.spriteType = spriteType;
    this.role = role;

    // Add the character to the scene
    scene.add.existing(this);
    this.setScale(0.5);
    this.idle();
  }

  // Animation methods
  walk() {
    this.anims.play(`${this.role}_walk_${this.spriteType}`);
  }

  idle() {
    this.anims.play(`${this.role}_idle_${this.spriteType}`);
  }

  dead() {
    this.anims.play(`patient_dead_${this.spriteType}`);
    // this.sceneRef.patientDied(this);
  }

  hurt() {
    this.anims.play(`patient_hurt_${this.spriteType}`);
    this.hitPoints--;

    // Add the damage pop-up text
    const damageText = this.scene.add.text(this.x, this.y - 10, '-1', {
      fontSize: '20px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Animate the text to float upward and fade out
    this.scene.tweens.add({
      targets: damageText,
      y: this.y - 100,
      alpha: 0,
      duration: 3500 / this.speed,
      ease: 'Power2',
      onComplete: () => damageText.destroy(),
    });

    // After hurt animation, revert to idle if still alive
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.hitPoints > 0) {
        this.idle();
      } else {
        this.dead();
      }
    });
  }

  say(message: string, duration: number = 2000) {
    // If a callout already exists, destroy it
    if (this.calloutText) {
      this.calloutText.destroy();
    }
    if (this.calloutLine) {
      this.calloutLine.destroy();
    }

    // Create a new callout text
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
      0x000000
    ).setLineWidth(1.5).setDepth(9);

    // Add a tween to fade out and destroy the text after the duration
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
