import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import Phaser from 'phaser';
import { TerminologyService } from '../services/terminology.service';
import { doc } from 'firebase/firestore';

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
    const uiScene: UIScene = new UIScene();
    const cdstdScene: CdstdScene = new CdstdScene(this.terminologyService);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: this.gameContainer.nativeElement,
      scene: [cdstdScene, uiScene],
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

class UIScene extends Phaser.Scene {
  private pauseButton!: Phaser.GameObjects.Image;
  private gamePaused: boolean = false;
  private speedButtons: Phaser.GameObjects.Text[] = [];
  private speedLevels: number[] = [1, 2, 4, 16]; // Speed levels
  private activeSpeedIndex: number = 0; // Default speed index (1x)

  constructor() {
    // Define the scene with a key and set it to start immediately
    super({ key: 'UIScene', active: true });
  }

  preload() {
    // Preload the pause and unpause button images
    this.load.image('pauseButton', 'assets/cdstd/Objects/Buttons/button_pause.png');
    this.load.image('unpauseButton', 'assets/cdstd/Objects/Buttons/button_unpause.png');
  }

  create() {
    // Add the pause button to the UI scene
    this.pauseButton = this.add.image(75, 50, 'pauseButton').setInteractive();

    // Add a click event listener for the pause button
    this.pauseButton.on('pointerdown', () => {
      const cdstdScene = this.scene.get('CdstdScene'); // Reference the CdstdScene by its key

      if (!this.gamePaused) {
        if (cdstdScene) {
          cdstdScene.scene.pause(); // Pause the CdstdScene
          this.gamePaused = true;
          this.pauseButton.setTexture('unpauseButton'); // Change to unpause button
        }
      } else {
        if (cdstdScene) {
          cdstdScene.scene.resume(); // Resume the CdstdScene
          this.gamePaused = false;
          this.pauseButton.setTexture('pauseButton'); // Change back to pause button
        }
      }
    });

    // Speed Control Buttons
    this.speedLevels.forEach((speed, index) => {
      const button = this.add.text(150 + index * 60, 35, `${speed}x`, {
        fontSize: '18px',
        color: index === this.activeSpeedIndex ? '#ff0' : '#fff', // Highlight active speed
        backgroundColor: '#000',
        padding: { x: 10, y: 5 },
      })
        .setInteractive()
        .on('pointerdown', () => {
          this.setSpeed(index);
        });

      this.speedButtons.push(button);
    });
  }

  private setSpeed(index: number) {
    this.activeSpeedIndex = index;

    // Update all button styles
    this.speedButtons.forEach((button, i) => {
      button.setStyle({
        color: i === this.activeSpeedIndex ? '#ff0' : '#fff',
      });
    });

    // Adjust the speed of the CdstdScene
    const cdstdScene = this.scene.get('CdstdScene') as CdstdScene;
    if (cdstdScene) {
      cdstdScene.time.timeScale = this.speedLevels[this.activeSpeedIndex];
      cdstdScene.setSpeedMultiplier(this.speedLevels[this.activeSpeedIndex]);
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
  private outsideQueue: Character[] = [];
  private insideQueue: Character[] = [];
  private goodTriage: number = 0;
  private badTriage: number = 0;
  private background!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  public diagnosisData: any[] = [];
  private admitting: boolean = false;
  private lastTriageTime: number = 0;
  private speedMultiplier: number = 1; // Default speed (1x)
  
  private admissionEcl = "( << 386661006 |Fever| OR << 22253000 |Pain (finding)| )";
  private internalTriageRules = [
    { ecl: "<< 386661006", doctorIndex: 1 },
    { ecl: "<< 22253000", doctorIndex: 0 },
  ];

  attendingDoctors: any[] = [
    { x: 130, y: 207, title: 'Cardiologist', ecl: '(<< 106063007 |Cardiovascular finding (finding)| OR << 29857009 |Chest pain (finding)|)' },
    { x: 130, y: 140, title: 'Infectologist', ecl: '<< 386661006 |Fever (finding)|' },
  ];

  constructor(private terminologyService: TerminologyService) {
    super({ key: 'CdstdScene' });
    this.terminologyService.setSnowstormFhirBase('https://snowstorm-lite.nw.r.appspot.com/fhir');
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  getSelectedSpeed() {
    return this.speedMultiplier;
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
    // this.load.image('pauseButton', 'assets/cdstd/Objects/Buttons/button_pause.png');
  }

  create() {
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.internalTriage();
    });

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
    this.outsideQueue = [];
    this.goodTriage = 0;
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
      if (currentX < previousX) {
        // Moving left
        patient.flipX = true;
      } else if (currentX > previousX) {
        // Moving right
        patient.flipX = false;
      }
      // Update previousX
      patient.previousX = currentX;
    });

    this.scoreText.setText(`Patients: ${this.spawnedPatients} Effectiveness: ${((this.spawnedPatients - this.badTriage) / this.spawnedPatients) * 100}%`);
    if (this.admitting) {
      this.testNextPatientForAdmission();
    }

    const currentTime = Date.now();
    if (
      this.insideQueue.length > 0 &&
      this.attendingDoctors.every(doctor => !doctor.character.info.busy) &&
      currentTime - this.lastTriageTime >= 2000
    ) {
      this.lastTriageTime = Date.now(); // Update the last triage time
      this.time.delayedCall(1000, () => {
        // Disabling internal triage for now
        // this.internalTriage();
      });
    }
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
    this.internalTriageDoctor.flipX = false;
    this.internalTriageDoctor.idle();
    this.attendingDoctors.forEach((doctor) => {
      const specialist = new Character(this, doctor.x, doctor.y, 'gatekeeper', 2);
      specialist.info.ecl = doctor.ecl;
      specialist.info.title = doctor.title;
      specialist.info.busy = false;
      specialist.idle();
      doctor.character = specialist;
    });
  }

  spawnPatient() {
    // Dynamically set the position using the starting point
    const patient = new Character(this, 80, 10, 'patient', Phaser.Math.Between(1, 3));
    this.outsideQueue.push(patient);
    patient.queuePosition = this.outsideQueue.length;
    patient.setScale(0.5);

    let path = [
      { x: 80, y: 533, duration: 500 },
      { x: 330 + (20 * patient.queuePosition), y: 533, duration: 500 },
    ];

    this.walkTo(patient, path, () => {
      this.patientsInQueue++;
      this.time.delayedCall(100, () => {
        patient.flipX = true;
      });
      if (this.patientsInQueue === this.maxPatients) {
        this.queueComplete();
      }
    });
  
    // Ensure patient is active and visible initially
    patient.setActive(true).setVisible(true);
  
    this.patients.add(patient);
    this.spawnedPatients++;
  }

  queueComplete() {
    // Add the gatekeeper to the scene
    this.gatekeeper = new Character(this, 315, 190, 'gatekeeper', 2);
    this.gatekeeper.setScale(0.5);

    let path = [
      { x: 315, y: 350, duration: 200 },
      { x: 240, y: 350, duration: 200 },
      { x: 240, y: 533, duration: 200 },
      { x: 310, y: 533, duration: 200 }
    ];

    this.walkTo(this.gatekeeper, path, () => {
      this.gatekeeper.say('We will start soon', 1000);
      this.time.delayedCall(1000, () => {
        this.admitting = true;
      });
    });
    // Register A key listener for admitting patients
    // this.input?.keyboard?.on('keydown-A', this.testNextPatient, this);
  }

  patientDied(patient: Character) {
    // this.deathCount++;
    // this.scoreText.setText(`Patients: ${this.spawnedPatients} Deaths: ${this.deathCount}`);
    // // Check for Game Over
    // if (this.deathCount >= this.maxPatients) {
    //   this.gameOver();
    // }
  }

  testNextPatientForAdmission() {
    if (this.outsideQueue.length === 0) {
      return;
    }
    const patient = this.outsideQueue.shift();
    if (patient) {
      this.admitting = false;
      // Gatekeeper starts by asking a question
      this.gatekeeper.say('How do you feel?', 1500);
    
      // Wait for the gatekeeper to finish speaking before the patient speaks
      this.time.delayedCall(1500, () => {
        let message = `I have been feeling with:\n`; // `Age: ${patient.clinicalData.age}\n`;
        message += patient.clinicalData.diagnosis.map((dx: any) => dx.display).join('\n');
        patient.say(message, 1800);
    
        // Wait for the patient to finish speaking before evaluating
        this.time.delayedCall(2000, () => {
          this.checkPatientDiagnosisVsEcl(patient, this.admissionEcl).then((result) => {
            // After evaluation, gatekeeper decides the outcome
            if (result.length > 0) {
              this.gatekeeper.say('Go in...', 1500);
              patient.clinicalData.diagnosis.forEach((dx: any) => {
                if (result.find((r: any) => r.code === dx.code)) {
                  dx.status = "admitted";
                }
              });
              // Wait for the gatekeeper's response before taking action
              this.time.delayedCall(1500, () => {
                this.enterHospital(patient);
                this.advanceQueue(this.outsideQueue);
                this.time.delayedCall(1000, () => {
                  this.admitting = true;
                });
              });
            } else {
              this.gatekeeper.say('Go home...', 1500);
              
              // Wait for the gatekeeper's response before taking action
              this.time.delayedCall(500, () => {
                this.walkAway(patient);
                this.advanceQueue(this.outsideQueue);
                this.time.delayedCall(1000, () => {
                  this.admitting = true;
                });
              });
            }
          });
        }); // Time for the patient to finish speaking
      }); // Time for the gatekeeper to finish asking
    }
    
  }

  walkToInternalTriage(patient: Character) {
    patient.walk();
    let path = [
      { x: 290, y: 350, duration: 500 }
    ];
    this.walkTo(patient, path, () => {
      // this.time.delayedCall(100, () => {
      //   patient.flipX = true;
      // });
    });
  }

  enterHospital(patient: Character) {
    this.insideQueue.push(patient);
    patient.queuePosition = this.insideQueue.length;
    patient.walk();
    // generate random waiting spot
    let x = Phaser.Math.Between(350, 500);
    let y = Phaser.Math.Between(330, 380);
    let path = [
      { x: 240, y: patient.y, duration: 500 },
      { x: 240, y: 350, duration: 500 },
      { x: x, y: y, duration: 500 },
    ];
    this.walkTo(patient, path, () => {
      this.time.delayedCall(100, () => {
        patient.flipX = true;
      });
    });
  }

  walkAway(patient: Character) {
    patient.flipX = false;
    patient.walk();
    let path = [];
    if (patient.y < 500) {
      path.push({ x: 240, y: patient.y, duration: 500 });
      path.push({ x: 240, y: 533, duration: 500 });
    }
    // Throw a coin and set x to 0 or 800
    let coin = Phaser.Math.Between(0, 1);
    path.push({ x: coin * 800, y: 533, duration: 1000 });
    this.walkTo(patient, path, () => {
      this.time.delayedCall(100, () => {
        patient.destroy();
      });
    });
  }
  
  advanceQueue(queue: Character[]) {
    if (queue.length === 0) {
      return;
    }
    // console.log(queue)
    const queueStart = queue[0].x - 40;
    // Move the remaining patients in the queue
    queue.forEach((patient, index) => {
      patient.walk();
      patient.queuePosition = index + 1; // Update the queue position based on the index
      let path = [
        { x: queueStart + (20 * patient.queuePosition), y: patient.y, duration: 500 },
      ];
      this.walkTo(patient, path, () => {
        // Nothing
      });
    });
  }
  
  async internalTriage() {
    if (this.insideQueue.length === 0) {
      return;
    }
    const patient = this.insideQueue.shift();
    if (patient) {
      this.walkToInternalTriage(patient);
      for (let rule of this.internalTriageRules) {
        const doctor: Character = this.attendingDoctors[rule.doctorIndex].character;
  
        // Skip busy doctors
        if (doctor.info.busy) {
          continue;
        }
  
        const result = await this.checkPatientDiagnosisVsEcl(patient, rule.ecl);
        if (result.length > 0) {
          // console.log(`${doctor.info.title} is available and will attend to the patient.`);
          this.internalTriageDoctor.say(`Go to the ${doctor?.info?.title}`, 1000);
  
          this.time.delayedCall(1000, () => {
            patient.flipX = true;
  
            const path = [
              { x: 240, y: patient.y, duration: 200 },
              { x: 240, y: doctor.y, duration: 300 },
              { x: doctor.x + 30, y: doctor.y, duration: 300 },
            ];
            doctor.info.busy = true; // Mark doctor as busy
            this.walkTo(patient, path, () => {
              patient.idle();
              this.attendPatient(patient, doctor);
            });
          });
  
          break; // Exit the loop after assigning the patient
        }
      }
  
      // If no doctor can attend, re-add the patient to the queue
      if (!patient.active) {
        this.addToInsideQueue(patient);
      }
    }
  }

  addToInsideQueue(patient: Character) {
    // Add the patient to the end of the insideQueue
    this.insideQueue.push(patient);
  
    // Update the queue position to the new end of the queue
    patient.queuePosition = this.insideQueue.length;
  
    // Calculate the new position based on the queue layout
    const newX = 280 + (20 * patient.queuePosition); // X position at the end of the queue
    const newY = 350; // Fixed Y position for the inside queue
  
    // Move the patient to the end of the queue visually
    const path = [
      { x: newX, y: newY, duration: 500 / this.speedMultiplier },
    ];
  
    this.walkTo(patient, path, () => {
      patient.idle(); // Set to idle after moving to the correct position
    });
  
    console.log(`Patient re-added to insideQueue at position ${patient.queuePosition}`);
  }
  

  attendPatient(patient: Character, doctor: Character) {
    doctor.info.busy = true; // Set busy when starting to attend
    this.time.delayedCall(1000, () => {
      this.checkPatientDiagnosisVsEcl(patient, doctor.info.ecl).then((result) => {
        if (result.length > 0) {
          patient.clinicalData.diagnosis.forEach((dx: any) => {
            if (result.find((r: any) => r.code === dx.code)) {
              dx.status = "treated";
            }
          });
  
          if (patient.clinicalData.diagnosis.find((dx: any) => dx.status === "admitted")) {
            doctor.say(`${doctor.info.title}\nGo to the next doctor`, 1000);
            this.time.delayedCall(1000, () => {
              this.enterHospital(patient);
              doctor.info.busy = false; // Only reset when done
            });
          } else {
            doctor.say(`${doctor.info.title}\nHave a nice day`, 1000);
            this.time.delayedCall(1000, () => {
              this.goodTriage++;
              this.walkAway(patient);
              doctor.info.busy = false; // Only reset when done
            });
          }
        } else {
          if (patient.clinicalData.diagnosis.find((dx: any) => dx.status === "admitted")) {
            doctor.say(`${doctor.info.title}\nI can't help with this, but go to the next doctor`, 1000);
            this.time.delayedCall(1000, () => {
              this.enterHospital(patient);
              doctor.info.busy = false; // Only reset when done
            });
          } else {
            doctor.say(`${doctor.info.title}\nI can't help you...`, 1000);
            this.time.delayedCall(1000, () => {
              this.badTriage++;
              this.walkAway(patient);
              doctor.info.busy = false; // Only reset when done
            });
          }
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

  private walkTo(character: Character, points: { x: number, y: number, duration: number }[], onComplete: () => void): void {
    if (points.length === 0) {
      onComplete();
      return;
    }
    character.walk();
    const createTween = (index: number) => {
      if (index >= points.length) {
        character.idle();
        onComplete();
        return;
      }
  
      const point = points[index];
      this.tweens.add({
        targets: character,
        x: point.x,
        y: point.y,
        duration: point.duration / this.speedMultiplier,
        ease: 'Linear',
        onComplete: () => {
          createTween(index + 1);
        },
      });
    };
  
    createTween(0);
  }

  checkPatientDiagnosisVsEcl(patient: Character, ecl: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      let untreatedDx = 0;
      let eclAppendix = '';
  
      patient?.clinicalData.diagnosis.forEach((dx: any, index: number) => {
        if (dx.status !== "treated") {
          untreatedDx++;
          if (untreatedDx > 1) {
            eclAppendix += ` OR ${dx.code}`;
          } else {
            eclAppendix += ` ${dx.code}`;
          }
        }
      });
  
      if (untreatedDx === 0) {
        resolve([]);
        return;
      } else {
        ecl = ecl + ' AND (' + eclAppendix + ' )';
        this.terminologyService.expandValueSetUsingCache(ecl, '').subscribe(
          (data: any) => {
            if (data.expansion?.total > 0) {
              resolve(data.expansion.contains);
            } else {
              resolve([]);
            }
          },
          (error: any) => {
            reject(error);
          }
        );
      }
    });
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
  private diagnosisText?: Phaser.GameObjects.Text;
  previousX: number = 0;
  clinicalData: any = {};
  info: any = {};

  constructor(scene: CdstdScene, x: number, y: number, role: 'patient' | 'gatekeeper', spriteType: number = 1, dxList: any[] = []) {
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
      if (dxList && dxList.length > 0) {
        this.clinicalData.diagnosis = dxList;
      } else {
        // Populate with 1 to 5 diagnosis from the list, no repetitions
        const diagnosisCount = Phaser.Math.Between(1, 5);
        for (let i = 0; i < diagnosisCount; i++) {
          const diagnosis = Phaser.Utils.Array.GetRandom(scene.diagnosisData);
          diagnosis.status = "none";
          if (!this.clinicalData.diagnosis.includes(diagnosis)) {
            this.clinicalData.diagnosis.push(diagnosis);
          }
        }
      }
      this.setInteractive({ useHandCursor: true });
      this.on('pointerover', () => this.showDiagnosis());
      this.on('pointerout', () => this.hideDiagnosis());
      
    } else {
      this.idle(); // Gatekeeper starts idle
    }
  }

  showDiagnosis() {
    if (this.diagnosisText) {
      this.diagnosisText.destroy();
    }

    let diagnosisList = this.clinicalData.diagnosis.map((dx: any) => dx.display).join('\n');
    if (!diagnosisList) {
      diagnosisList = "No diagnosis available";
    }

    this.diagnosisText = this.sceneRef.add.text(this.x, this.y - 50, diagnosisList, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 2 },
      align: 'center',
    }).setOrigin(0.5).setDepth(10);
  }

  hideDiagnosis() {
    this.diagnosisText?.destroy();
    this.diagnosisText = undefined;
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
      duration: 3500 / this.sceneRef.getSelectedSpeed(),
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
      duration: 500 / this.sceneRef.getSelectedSpeed(),
      delay: duration,
      onComplete: () => {
        this.calloutText?.destroy();
        this.calloutText = undefined;
        this.calloutLine?.destroy();
      },
    });
  }
}

