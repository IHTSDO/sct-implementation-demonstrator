import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import * as Phaser from 'phaser';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-phaser-game',
  templateUrl: './phaser-game.component.html',
  styleUrls: ['./phaser-game.component.css']
})
export class PhaserGameComponent implements OnInit, OnDestroy {
  private game!: Phaser.Game;

  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  constructor(private terminologyService: TerminologyService) {}

  ngOnInit() {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: this.gameContainer.nativeElement,
      scene: new CdstdScene(this.terminologyService),
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

  private patients!: Phaser.GameObjects.Group;
  private gatekeeper!: Character;
  private internalTriageDoctor!: Character;
  private maxPatients: number = 10;
  private spawnedPatients: number = 0;
  private patientsInQueue: number = 0;
  private queue: Character[] = [];
  private deathCount: number = 0;
  private background!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  diagnosisData: any[] = [];
  private showPaths = true;

  admissionEcl = "( (<< 386661006) OR (<< 29857009) )";
  internalTriageRules = [
    { ecl: "<< 386661006", x: 160, y: 207, message: 'Go to Office 1' },
    { ecl: "<< 29857009", x: 160, y: 140, message: 'Go to Office 2' },
  ];

  constructor(private terminologyService: TerminologyService) {
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

    // Initialize the patients group
    this.patients = this.physics.add.group();
    this.spawnPatient();
    this.scheduleRandomPatientSpawn();
    this.addDoctors();
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
      const randomDelay = Phaser.Math.Between(2, 5);
  
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

  addDoctors() {
    this.internalTriageDoctor = new Character(this, 270, 350, 'gatekeeper', 2);
    this.internalTriageDoctor.flipX = true;
    this.internalTriageDoctor.idle();
    const specialist1 = new Character(this, 130, 207, 'gatekeeper', 2);
    specialist1.idle();
    const specialist2 = new Character(this, 130, 140, 'gatekeeper', 2);
    specialist2.idle();
  }

  spawnPatient() {
    // Dynamically set the position using the starting point
    const patient = new Character(this, 80, 10, 'patient', Phaser.Math.Between(1, 3));
    this.queue.push(patient);
    patient.queuePosition = this.queue.length;
    patient.setScale(0.5);
    // Move to 80, 533 wieh tweens
    this.tweens.add({
      targets: patient,
      x: 80,
      y: 533,
      duration: 7, //7000,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: patient,
          x: 330 + (20 * patient.queuePosition),
          y: 533,
          duration: 3000, // 5000,
          ease: 'Linear',
          onComplete: () => {
            patient.idle();
            patient.flipX = true;
            this.patientsInQueue++;
            if (this.patientsInQueue === this.maxPatients) {
              this.queueComplete();
            }
          },
        });
      },
    });
  
    // Ensure patient is active and visible initially
    patient.setActive(true).setVisible(true);
  
    this.patients.add(patient);
    this.spawnedPatients++;
    this.scoreText.setText(`Patients: ${this.spawnedPatients} Deaths: ${this.deathCount}`);
  }

  queueComplete() {
    // Add the gatekeeper to the scene
    this.gatekeeper = new Character(this, 315, 190, 'gatekeeper', 2);
    this.gatekeeper.setScale(0.5);
    this.gatekeeper.walk();
    this.tweens.add({
      targets: this.gatekeeper,
      x: 315,
      y: 350,
      duration: 2, //2000,
      ease: 'Linear',
      onComplete: () => {
        this.gatekeeper.flipX = true;
        this.tweens.add({
          targets: this.gatekeeper,
          x: 240,
          y: 350,
          duration: 2, //2000,
          ease: 'Linear',
          onComplete: () => {
            this.tweens.add({
              targets: this.gatekeeper,
              x: 240,
              y: 533,
              duration: 2, //2000,
              ease: 'Linear',
              onComplete: () => {
                this.gatekeeper.flipX = false;
                this.tweens.add({
                  targets: this.gatekeeper,
                  x: 310,
                  y: 533,
                  duration: 2, //2000,
                  ease: 'Linear',
                  onComplete: () => {
                    this.gatekeeper.idle();
                    this.gatekeeper.say('We will start soon', 3000);
                  }
                });
              }
            });
          },
        });
      },
    });
    // Register A key listener for admitting patients
    this.input?.keyboard?.on('keydown-A', this.testNextPatient, this);
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
    // form queue
  }

  testNextPatient() {
    if (this.queue.length === 0) {
      return;
    }
    
    
    const patient = this.queue.shift();
    if (patient) {
      let matchesCriteria = false;
    
      // Gatekeeper starts by asking a question
      this.gatekeeper.say('How do you feel?', 1500);
    
      // Wait for the gatekeeper to finish speaking before the patient speaks
      setTimeout(() => {
        let message = `I have been feeling with:\n`; // `Age: ${patient.clinicalData.age}\n`;
        message += patient.clinicalData.diagnosis.map((dx: any) => dx.display).join('\n');
        patient.say(message, 1800);
    
        // Wait for the patient to finish speaking before evaluating
        setTimeout(() => {
          let ecl = this.admissionEcl + ' AND (';
          patient?.clinicalData.diagnosis.forEach((dx: any, index: number) => {
            if (index > 0) {
              ecl = ecl + ` OR ${dx.code}`;
            } else {
              ecl = ecl + ` ${dx.code}`;
            }
          });
          ecl = ecl + ' )';
          this.terminologyService.expandValueSet(ecl, '').subscribe((data: any) => {
            if (data.expansion?.total > 0) {
              matchesCriteria = true;
            }
            // After evaluation, gatekeeper decides the outcome
            if (matchesCriteria) {
              this.gatekeeper.say('Go in...', 1500);
              
              // Wait for the gatekeeper's response before taking action
              setTimeout(() => {
                this.enterHospital(patient);
                this.advanceQueue();
              }, 1500);
            } else {
              this.gatekeeper.say('Go home...', 1500);
              
              // Wait for the gatekeeper's response before taking action
              setTimeout(() => {
                this.walkAway(patient);
                this.advanceQueue();
              }, 500);
            }
          });
        }, 2000); // Time for the patient to finish speaking
      }, 1500); // Time for the gatekeeper to finish asking
    }
    
  }

  enterHospital(patient: Character) {
    patient.walk();
    this.tweens.add({
      targets: patient,
      x: 240,
      y: 533,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: patient,
          x: 240,
          y: 350,
          duration: 500,
          ease: 'Linear',
          onComplete: () => {
            patient.idle();
            patient.flipX = false;
            this.internalTriage(patient);
          },
        });
      },
    });
  }

  walkAway(patient: Character) {
    patient.flipX = false;
    patient.walk();
    this.tweens.add({
      targets: patient,
      x: 800,
      y: 533,
      duration: 5000,
      ease: 'Linear',
      onComplete: () => {
        patient.destroy();
      },
    });
  }
  
  advanceQueue() {
    // Move the remaining patients in the queue
    this.queue.forEach((patient, index) => {
      patient.walk();
      patient.queuePosition = patient.queuePosition - 1;
      this.tweens.add({
        targets: patient,
        x: 330 + (20 * (index + 1)),
        y: 533,
        duration: 1000,
        ease: 'Linear',
        onComplete: () => {
          patient.idle();
        }
      });
    });
  }
  
  internalTriage(patient: Character) {
    if (patient) {
      for (let rule of this.internalTriageRules) {
        let matchesCriteria = false;
        let ecl = rule.ecl + ' AND (';
        patient?.clinicalData.diagnosis.forEach((dx: any, index: number) => {
          if (index > 0) {
            ecl = ecl + ` OR ${dx.code}`;
          } else {
            ecl = ecl + ` ${dx.code}`;
          }
        });
        ecl = ecl + ' )';
        this.terminologyService.expandValueSet(ecl, '').subscribe((data: any) => {
          if (data.expansion?.total > 0) {
            matchesCriteria = true;
          }
          if (matchesCriteria) {
            this.internalTriageDoctor.say(rule.message, 1000);
            setTimeout(() => {
              // walk to first to Y value, then to X value
              patient.flipX = true;
              patient.walk();
              this.tweens.add({
                targets: patient,
                y: rule.y,
                duration: 500,
                ease: 'Linear',
                onComplete: () => {
                  this.tweens.add({
                    targets: patient,
                    x: rule.x,
                    duration: 500,
                    ease: 'Linear',
                    onComplete: () => {
                      patient.idle();
                    },
                  });
                },
              });
            }, 1000);
          }
        });
        if (matchesCriteria) {
          break;
        }
      }
    }
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

class Character extends Phaser.Physics.Arcade.Sprite {
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

  constructor(scene: CdstdScene, x: number, y: number, role: 'patient' | 'gatekeeper', spriteType: number = 1) {
    super(scene, x, y, `${role}_idle_${spriteType}`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set any default properties for the character here
    this.setCollideWorldBounds(true);
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

