import Phaser from 'phaser';
import { CdstdScene } from '../scenes/cdstd-scene';

export class Character extends Phaser.Physics.Arcade.Sprite {
  private sceneRef: CdstdScene;
  role: 'patient' | 'gatekeeper';

  constructor(scene: CdstdScene, x: number, y: number, role: 'patient' | 'gatekeeper', spriteType: number = 1) {
    super(scene, x, y, `${role}_idle_${spriteType}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.sceneRef = scene;
    this.role = role;
    this.setScale(0.5);

    if (role === 'patient') {
      this.anims.play(`${role}_walk_${spriteType}`);
    } else {
      this.anims.play(`${role}_idle_${spriteType}`);
    }
  }

  updateMovement() {
    if (this.body && this.body.velocity) {
        if (this.body.velocity.x < 0) {
            this.flipX = true;
        } else if (this.body.velocity.x > 0) {
            this.flipX = false;
        }
    }
  }

  say(message: string, duration: number = 2000) {
    const text = this.sceneRef.add.text(this.x, this.y - 50, message, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(10);

    this.sceneRef.tweens.add({
      targets: text,
      alpha: 0,
      duration: duration,
      onComplete: () => text.destroy(),
    });
  }
}
