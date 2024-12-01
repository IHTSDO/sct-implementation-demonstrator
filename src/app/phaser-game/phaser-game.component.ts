import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as Phaser from 'phaser';

@Component({
  selector: 'app-phaser-game',
  templateUrl: './phaser-game.component.html',
  styleUrls: ['./phaser-game.component.css']
})
export class PhaserGameComponent implements OnInit, OnDestroy {
  private game!: Phaser.Game;

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  ngOnInit() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: this.gameContainer.nativeElement,
      scene: [CdstdScene],
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

class CdstdScene extends Phaser.Scene {

  private path!: Phaser.Curves.Path;
  private queuePath!: Phaser.Curves.Path;
  private enterPath!: Phaser.Curves.Path;
  private patients!: Phaser.GameObjects.Group;
  private gatekeeper!: Character;
  private maxPatients: number = 5;
  private spawnedPatients: number = 0;
  private queue: Character[] = [];
  private deathCount: number = 0;
  private background!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  diagnosisData: any[] = [];
  private showPaths = true;

  constructor() {
    super({ key: 'CdstdScene' });
  }

  preload() {

    // Load diagnosis data
    this.load.json('diagnosisData', 'assets/cdstd/Data/dx_1.json');

    // Hospital image credits: https://cthulhuarchitect.com/maps/st-johns-hospital/
    this.load.image('hospitalFloor', 'assets/cdstd/Backgrounds/hospital-floor-day.png');
    
    // Characters assets attribution https://craftpix.net/freebies/city-man-pixel-art-character-sprite-sheets/
  
    // List of animation types
    const animations = ['idle', 'walk', 'dead', 'hurt'];
  
    // Loop through character sets
    for (let i = 1; i <= 3; i++) {
      animations.forEach((animation) => {
        this.load.spritesheet(
          `patient_${animation}_${i}`,
          `assets/cdstd/Characters/City_men_${i}/${animation.charAt(0).toUpperCase() + animation.slice(1)}.png`,
          {
            frameWidth: 128,
            frameHeight: 128,
          }
        );
      });
    }

    for (let i = 2; i <= 2; i++) {
      animations.forEach((animation) => {
        this.load.spritesheet(
          `gatekeeper_${animation}_${i}`,
          `assets/cdstd/Characters/Gangsters_${i}/${animation.charAt(0).toUpperCase() + animation.slice(1)}.png`,
          {
            frameWidth: 128,
            frameHeight: 128,
          }
        );
      });
    }
    
    // Load the CDS rule image as before
    // this.load.image('cdsRule', 'assets/cdsRule.png');
  }

  create() {
    // Retrieve the JSON data
    this.diagnosisData = this.cache.json.get('diagnosisData');

    this.defineAnimations();
    this.background = this.add.image(400, 300, 'hospitalFloor');

    // Scale the background if needed (optional)
    this.background.setScale(1); // Adjust scale if your canvas size differs

    // Initialize the patient count text
    this.scoreText = this.add.text(750, 10, `Patients: ${this.spawnedPatients}`, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(1, 0); // Align top-right corner

    // Enable input events
    this.input.enabled = true;

    // Reset queueCount on scene start
    this.queue = [];
    this.deathCount = 0;
    this.spawnedPatients = 0;

    // Define the path
    this.path = this.add.path(80, 0);
    this.path.lineTo(80, 533);
    this.path.lineTo(350, 533);

    // Optionally, visualize the path
    const graphics = this.add.graphics();
    graphics.lineStyle(3, 0xffffff, 1);
    if (this.showPaths) {
      this.path.draw(graphics);
    }

    // Define the queue path
    this.queuePath = this.add.path(350, 533); // Start at the end of the main path
    // Add points to the queue path for each queue position
    for (let i = 1; i <= 15; i++) {
      this.queuePath.lineTo(350 + (i * 20), 533);
    }
    graphics.lineStyle(3, 0xff0000, 1);
    if (this.showPaths) {
      this.queuePath.draw(graphics);
    }

    this.enterPath = this.add.path(350, 538);
    this.enterPath.lineTo(245, 538);
    this.enterPath.lineTo(245, 370);
    graphics.lineStyle(3, 0x0000ff, 1);
    if (this.showPaths) {
      this.enterPath.draw(graphics);
    }

    // Initialize the patients group
    this.patients = this.physics.add.group();
    this.spawnPatient();
    this.scheduleRandomPatientSpawn();

    // Add gatekeeper doctor using the new Gatekeeper class
    const placeholderPath = new Phaser.Curves.Path(320, 533);
    this.gatekeeper = new Character(this, placeholderPath, 320, 533, 'gatekeeper', 2);
  }

  override update() {
    // Iterate over each patient
    this.patients.getChildren().forEach((patientObj) => {
      const patient = patientObj as Character;
  
      // Skip inactive patients (those already in the queue)
      if (!patient.active) {
        return;
      }
  
      const currentX = patient.x;
      const previousX = patient.previousX;
  
      // if (currentX < previousX) {
      //   // Moving left
      //   patient.flipX = true;
      // } else if (currentX > previousX) {
      //   // Moving right
      //   patient.flipX = false;
      // }
  
      // Update previousX
      patient.previousX = currentX;
    });
  }

  characterAnimations = [
    {
      name: 'patient',
      variants: [
        {
          id: 1,
          animations: {
            idle: { start: 0, end: 5, frameRate: 6, repeat: -1 },
            walk: { start: 0, end: 9, frameRate: 10, repeat: -1 },
            dead: { start: 0, end: 3, frameRate: 4, repeat: 0 },
            hurt: { start: 0, end: 2, frameRate: 3, repeat: 0 },
          },
        },
        {
          id: 2,
          animations: {
            idle: { start: 0, end: 5, frameRate: 6, repeat: -1 },
            walk: { start: 0, end: 9, frameRate: 10, repeat: -1 },
            dead: { start: 0, end: 3, frameRate: 4, repeat: 0 },
            hurt: { start: 0, end: 2, frameRate: 3, repeat: 0 },
          },
        },
        {
          id: 3,
          animations: {
            idle: { start: 0, end: 4, frameRate: 6, repeat: -1 },
            walk: { start: 0, end: 9, frameRate: 9, repeat: -1 },
            dead: { start: 0, end: 4, frameRate: 5, repeat: 0 },
            hurt: { start: 0, end: 2, frameRate: 3, repeat: 0 },
          },
        },
      ],
    },
    {
      name: 'gatekeeper',
      variants: [
        {
          id: 2,
          animations: {
            idle: { start: 0, end: 5, frameRate: 6, repeat: -1 },
            walk: { start: 0, end: 9, frameRate: 10, repeat: -1 },
            dead: { start: 0, end: 4, frameRate: 5, repeat: 0 },
            hurt: { start: 0, end: 2, frameRate: 3, repeat: 0 },
          },
        },
      ],
    },
  ];

  defineAnimations() {
    this.characterAnimations.forEach(({ name, variants }) => {
      variants.forEach(({ id, animations }) => {
        Object.entries(animations).forEach(([key, { start, end, frameRate, repeat }]) => {
          const animationKey = `${name}_${key}_${id}`;
          if (!this.anims.exists(animationKey)) {
            this.anims.create({
              key: animationKey,
              frames: this.anims.generateFrameNumbers(`${name}_${key}_${id}`, { start, end }),
              frameRate,
              repeat,
            });
          }
        });
      });
    });
  }
  
  scheduleRandomPatientSpawn() {
    if (this.spawnedPatients < this.maxPatients) {
      // Generate a random delay between 1000ms and 3000ms
      const randomDelay = Phaser.Math.Between(2000, 5000);
  
      // Schedule the next spawn
      this.time.addEvent({
        delay: randomDelay,
        callback: () => {
          this.spawnPatient();   // Spawn a patient
          this.scheduleRandomPatientSpawn(); // Schedule the next spawn if limit not reached
        },
        callbackScope: this,
      });
    }
  }
  

  spawnPatient() {
    // Get the starting point of the path (t = 0)
    const startPoint = this.path.getPoint(0);

    // Dynamically set the position using the starting point
    const patient = new Character(this, this.path, startPoint.x, startPoint.y, 'patient', Phaser.Math.Between(1, 3));
    patient.setScale(0.5);
    patient.startFollow({
      duration: 10000,
      rotateToPath: false,
      onComplete: () => {
        this.patientReachedEnd(patient);
      },
    });
  
    // Ensure patient is active and visible initially
    patient.setActive(true).setVisible(true);
  
    this.patients.add(patient);
    this.spawnedPatients++;
    this.scoreText.setText(`Patients: ${this.spawnedPatients} Deaths: ${this.deathCount}`);
  }

  patientDied(patient: Character) {
    this.deathCount++;
    this.scoreText.setText(`Patients: ${this.spawnedPatients} Deaths: ${this.deathCount}`);
    // Check for Game Over
    if (this.deathCount >= this.maxPatients) {
      this.gameOver();
    }
  }

  patientReachedEnd(patient: Character) {
    // Stop following the main path
    patient.stopFollow();
  
    // Assign the queue path to the patient
    patient.path = this.queuePath;
  
    // Calculate the `to` parameter based on the queue position
    const queueSegment = 1 / 15; // Divide the path into 15 segments
    patient.queuePosition = queueSegment * this.queue.length;
    this.queue.push(patient);

    // Start following the queue path
    patient.startFollow({
      duration: 400 * (this.queue.length), // Adjust duration as needed
      from: 0,
      to: patient.queuePosition,
      rotateToPath: false, // No rotation needed for queue
      onComplete: () => {
        patient.stopFollow();
        // Flip the patient to face left
        patient.flipX = true;
  
        // Play the idle animation
        patient.idle();
  
        // Mark the patient as being in the queue
        patient.startWaiting();

        if (this.queue.length == 1) {
          const admitKey = this.input?.keyboard?.addKey('A');
          if (admitKey) {
            admitKey.addListener('down', () => {
              this.admitPatient();
            });
          } else {
            console.error('Keyboard input is not available.');
          }
        }
      },
    });
  }

  admitPatient() {
    this.gatekeeper.say('Go in...', 2500);
    const patient = this.queue.shift();
  
    if (patient) {
      patient.walk();
      patient.path = this.enterPath;
  
      patient.startFollow({
        duration: 2000,
        rotateToPath: false,
        onComplete: () => {
          patient.stopFollow();
          patient.idle();
          this.spawnedPatients--;
          this.scoreText.setText(`Patients: ${this.spawnedPatients} Deaths: ${this.deathCount}`);
          this.patients.remove(patient);
          this.gatekeeper.say('Next!', 2500);
        },
      });
    }
  
    // Move the remaining patients in the queue
    this.queue.forEach((patient, index) => {
      console.log('Index: ' + index);
      console.log('Queue position: ' + patient.queuePosition);
  
      // Calculate new position incrementally along the path
      const queueSegment = 1 / (this.queue.length + 1); // Divide path based on queue size
      const newPosition = queueSegment * (index + 1);
      console.log('New position (fraction along path): ' + newPosition);
  
      // Get the actual point on the path for the calculated position
      const newPoint = this.queuePath.getPoint(newPosition);
      console.log('New point coordinates: ' + newPoint.x, newPoint.y);
  
      // Use a tween to manually move the patient to the new point
      patient.stopFollow(); // Stop any current following to avoid conflict
      this.tweens.add({
        targets: patient,
        x: newPoint.x,
        y: newPoint.y,
        duration: 400,
        ease: 'Power1',
        onComplete: () => {
          console.log(`Patient ${index} reached new position`);
          patient.queuePosition = newPosition; // Update the queue position after movement
          patient.idle(); // Set patient to idle after reaching position
        }
      });
    });
  }
  
  
  

  gameOver() {
    // Display "Game Over" text
    this.add.text(400, 350, 'Game Over', {
      fontSize: '48px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
  
    // Display restart instructions
    this.add.text(400, 400, 'Press R to Restart', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
  
    // Stop the physics world
    this.physics.pause();
    
  
    // Safely add restart key listener
    const restartKey = this.input?.keyboard?.addKey('R');
    if (restartKey) {
      restartKey.once('down', () => {
        this.time.removeAllEvents();
        this.tweens.killAll();
        this.scene.restart(); // Restart the scene
      });
    } else {
      console.error('Keyboard input is not available.');
    }
  }
  
  
}

class Character extends Phaser.GameObjects.PathFollower {
  private sceneRef: CdstdScene;
  spriteType: number;
  role: 'patient' | 'gatekeeper';
  inQueue: boolean = false;
  queuePosition: number = 0;
  queueStartTime: number = 0;
  hitPoints: number = 5;
  private calloutText?: Phaser.GameObjects.Text;
  private calloutLine?: Phaser.GameObjects.Line;
  previousX: number = 0;
  clinicalData: any = {};

  constructor(scene: CdstdScene, path: Phaser.Curves.Path, x: number, y: number, role: 'patient' | 'gatekeeper', spriteType: number = 1) {
    super(scene, path, x, y, `${role}_idle_${spriteType}`);
    this.sceneRef = scene; // Reference to the scene
    this.spriteType = spriteType;
    this.role = role;

    // Add the character to the scene
    scene.add.existing(this);
    this.setScale(0.5);

    if (role === 'patient') {
      this.walk();
      this.clinicalData.age = Phaser.Math.Between(18, 100);
      this.clinicalData.diagnosis = [];
      // Populate with 1 to 5 diagnosis from the list, no repetitions
      const diagnosisCount = Phaser.Math.Between(1, 5);
      for (let i = 0; i < diagnosisCount; i++) {
        const diagnosis = Phaser.Utils.Array.GetRandom(scene.diagnosisData);
        if (!this.clinicalData.diagnosis.includes(diagnosis)) {
          this.clinicalData.diagnosis.push(diagnosis);
        }
      }
    } else {
      this.idle(); // Gatekeeper starts idle
    }
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
    this.sceneRef.patientDied(this);
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
      duration: 3500,
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

  // Patient-specific logic
  startWaiting() {
    if (this.role === 'patient') {
      this.inQueue = true;
      this.queueStartTime = this.scene.time.now;

      // Schedule periodic damage
      // this.scene.time.addEvent({
      //   delay: 5000,
      //   callback: this.hurt,
      //   callbackScope: this,
      //   repeat: this.hitPoints - 1,
      // });
      // build messages with diagnosis display terms
      // let message = `Age: ${this.clinicalData.age}\n`;
      // message += this.clinicalData.diagnosis.map((dx: any) => dx.display).join('\n');
      // this.say(message, 1000);
    }
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
      duration: 500,
      delay: duration,
      onComplete: () => {
        this.calloutText?.destroy();
        this.calloutText = undefined;
        this.calloutLine?.destroy();
      },
    });
  }
}

