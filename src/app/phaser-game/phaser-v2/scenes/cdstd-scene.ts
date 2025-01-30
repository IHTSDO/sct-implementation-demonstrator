import { TerminologyService } from "src/app/services/terminology.service";
import { Patient } from "../characters/patient";
import { TriageRobot } from "../characters/triage-robot";
import { Doctor } from "../characters/doctor";
import { Character } from "../characters/character";
import { GameService } from "../characters/gameService";

export class CdstdScene extends Phaser.Scene {

  private patients!: Phaser.GameObjects.Group; 
  private gatekeeper!: TriageRobot;
  private internalTriageDoctor!: TriageRobot;
  private maxPatients: number = 10;
  private spawnedPatients: number = 0;
  private patientsInQueue: number = 0;
  private outsideQueue: Patient[] = [];
  private insideQueue: Patient[] = [];
  private goodTriage: number = 0;
  private badTriage: number = 0;
  private background!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  public diagnosisData: any[] = [];
  private admitting: boolean = false;
  private lastTriageTime: number = 0;
  private speedMultiplier: number = 1; // Default speed (1x)
  private wall!: Phaser.GameObjects.Line;

  private gameService!: GameService;
  
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
    this.gameService = new GameService(terminologyService);
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
  }

  create() {
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.internalTriage();
    });

    this.input?.keyboard?.on('keydown-A', () => {
      this.testNextPatientForAdmission();
    });

    // Retrieve the JSON data
    this.diagnosisData = this.cache.json.get('diagnosisData');

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
    this.addDoctors();

    // Create the Gatekeeper
    this.gatekeeper = new TriageRobot(this, 315, 190, [{ ecl: this.admissionEcl }], this.gameService);
    this.gatekeeper.setInteractive({ useHandCursor: true });

    // 🎮 Open the ECL editor when clicking on Gatekeeper
    this.gatekeeper.on('pointerdown', () => {
        this.openEclEditor();
    });

    this.add.existing(this.gatekeeper);

    // Create the wall at y: 480, from x: 250 to x: 550
    this.wall = this.add.line(0, 0, 270, 480, 650, 480, 0xffffff)
        .setLineWidth(10) // Thickness of the wall
        .setOrigin(0, 0);

    // Enable physics for the wall
    this.physics.add.existing(this.wall, true); // 'true' makes it static (immovable)
    
    this.spawnPatient();
    this.scheduleRandomPatientSpawn();
  }

  override update() {
    // Iterate over each patient
    this.patients.getChildren().forEach((patientObj) => {
      const patient = patientObj as Patient;
      // Skip inactive patients (those already in the queue)
      if (!patient.active) {
        return;
      }
      const currentX = patient.x;
      const previousX = patient.previousX;
      if (currentX < previousX) {
        // Moving left
      } else if (currentX > previousX) {
        // Moving right
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
      this.attendingDoctors.every(doctor => !doctor.character.busy) &&
      currentTime - this.lastTriageTime >= 2000
    ) {
      this.lastTriageTime = Date.now(); // Update the last triage time
      this.time.delayedCall(1000, () => {
        // Disabling internal triage for now
        // this.internalTriage();
      });
    }
  }

  private openEclEditor() {
    // 🛑 Pause the game
    this.scene.pause();

    // 🎮 Start the `EclEditorScene`
    this.scene.launch('EclEditorScene', {
        ecl: this.gatekeeper.triageRules[0].ecl,
        callback: (newEcl: string) => {
            this.gatekeeper.setTriageRules([ { ecl: newEcl } ]);
        }
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
    this.internalTriageDoctor = new TriageRobot(this, 270, 350, this.internalTriageRules, this.gameService);
    this.attendingDoctors.forEach((doctor) => {
      const specialist = new Doctor(this, doctor.x, doctor.y, doctor.ecl, this.gameService);
      specialist.setTitle(doctor.title);
      specialist.setBusy(false);
      doctor.character = specialist;
    });
  }

  spawnPatient() {
    // Dynamically set the position using the starting point
    const patient = new Patient(this, 80, 10, Phaser.Math.Between(1, 3));
    this.outsideQueue.push(patient);
    patient.queuePosition = this.outsideQueue.length;

    let path = [
      { x: 80, y: 533, duration: 500 },
      { x: 330 + (30 * patient.queuePosition), y: 533, duration: 500 },
    ];

    this.walkTo(patient, path, () => {
      this.patientsInQueue++;
      this.time.delayedCall(100, () => {
      });
      if (this.patientsInQueue === this.maxPatients) {
        this.queueComplete();
      }
    });
  
    // Ensure patient is active and visible initially
    patient.setActive(true).setVisible(true);
  
    this.patients.add(patient);
    this.spawnedPatients++;

    // 🛑 Add collider for newly spawned patient
    this.physics.add.collider(patient, this.wall);
  }

  queueComplete() {
    // Add the gatekeeper to the scene
    // this.gatekeeper = new TriageRobot(this, 315, 190, this.admissionEcl, this.gameService);

    let path = [
      { x: 315, y: 350, duration: 200 },
      { x: 240, y: 350, duration: 200 },
      { x: 240, y: 533, duration: 200 },
      { x: 310, y: 533, duration: 200 }
    ];

    this.walkTo(this.gatekeeper, path, () => {
      this.gatekeeper.say('We will start soon', 1100);
    });
  }

  testNextPatientForAdmission() {
    if (this.outsideQueue.length === 0) {
      return;
    }
    const patient = this.outsideQueue.shift();
    if (patient) {
      this.admitting = false;
      // Gatekeeper starts by asking a question
      this.gatekeeper.say('How do you feel?', 1000);
    
      // Wait for the gatekeeper to finish speaking before the patient speaks
      this.time.delayedCall(1500, () => {
        let message = `I have been feeling with:\n`; // `Age: ${patient.clinicalData.age}\n`;
        message += patient.clinicalData.diagnosis.map((dx: any) => dx.display).join('\n');
        patient.say(message, 1800);
    
        // Wait for the patient to finish speaking before evaluating
        this.time.delayedCall(2000, () => {
          this.gatekeeper.triagePatient(patient, this.gatekeeper.triageRules[0].ecl).then((result) => {
            if (result) {
              this.gatekeeper.say('Go in...', 1500);
              // Wait for the gatekeeper's response before taking action
              this.time.delayedCall(1500, () => {
                this.enterHospital(patient);
                this.advanceQueue(this.outsideQueue);
                this.time.delayedCall(1000, () => {
                  // this.admitting = true;
                });
              });
            } else {
              this.gatekeeper.say('Go home...', 1500);
              // Wait for the gatekeeper's response before taking action
              this.time.delayedCall(500, () => {
                this.walkAway(patient);
                this.advanceQueue(this.outsideQueue);
                this.time.delayedCall(1000, () => {
                  // this.admitting = true;
                });
              });
            }
          });
        }); // Time for the patient to finish speaking
      }); // Time for the gatekeeper to finish asking
    }
    
  }

  walkToInternalTriage(patient: Patient) {
    let path = [
      { x: 310, y: 350, duration: 500 }
    ];
    this.walkTo(patient, path, () => {
      // this.time.delayedCall(100, () => {
      //   patient.flipX = true;
      // });
    });
  }

  enterHospital(patient: Patient) {
    this.insideQueue.push(patient);
    patient.queuePosition = this.insideQueue.length;
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
      });
    });
  }

  walkAway(patient: Patient) {
    let path = [];
    if (patient.y < 500) {
      path.push({ x: 240, y: patient.y, duration: 500 });
      path.push({ x: 240, y: 560, duration: 500 });
    }
    // Throw a coin and set x to 0 or 800
    let coin = Phaser.Math.Between(0, 1);
    path.push({ x: coin * 800, y: 560, duration: 1000 });
    this.walkTo(patient, path, () => {
      this.time.delayedCall(100, () => {
        patient.destroy();
      });
    });
  }
  
  advanceQueue(queue: Patient[]) {
    if (queue.length === 0) {
      return;
    }
    // console.log(queue)
    const queueStart = queue[0].x - 60;
    // Move the remaining patients in the queue
    queue.forEach((patient, index) => {
      patient.queuePosition = index + 1; // Update the queue position based on the index
      let path = [
        { x: queueStart + (30 * patient.queuePosition), y: patient.y, duration: 500 },
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
    let wasAssigned = false;
    if (patient) {
      this.walkToInternalTriage(patient);
      for (let rule of this.internalTriageRules) {
        const doctor: Doctor = this.attendingDoctors[rule.doctorIndex].character;
  
        // Skip busy doctors
        if (doctor.busy) {
          continue;
        }

        let boolResult = false;
        boolResult = await this.internalTriageDoctor.triagePatient(patient, rule.ecl);
        if (boolResult) {
          wasAssigned = true;
          this.internalTriageDoctor.say(`Go to the ${doctor?.title}`, 1000);
          this.time.delayedCall(1000, () => {
  
            const path = [
              { x: 240, y: patient.y, duration: 200 },
              { x: 240, y: doctor.y, duration: 300 },
              { x: doctor.x + 30, y: doctor.y, duration: 300 },
            ];
            doctor.busy = true; // Mark doctor as busy
            this.walkTo(patient, path, () => {
              this.attendPatient(patient, doctor);
            });
          });
          break; // Exit the loop after assigning the patient
        }
  
      }
      if (!wasAssigned) {
        this.internalTriageDoctor.say("We can't help you...", 1000);
        this.time.delayedCall(1000, () => {
          this.walkAway(patient);
        });
      }
  
      // If no doctor can attend, re-add the patient to the queue
      if (!patient.active) {
        this.addToInsideQueue(patient);
      }
    }
  }

  addToInsideQueue(patient: Patient) {
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
    });
  
    console.log(`Patient re-added to insideQueue at position ${patient.queuePosition}`);
  }
  

  attendPatient(patient: Patient, doctor: Doctor) {
    doctor.busy = true; // Set busy when starting to attend
    this.time.delayedCall(1000, () => {
      this.checkPatientDiagnosisVsEcl(patient, doctor.specialityEcl).then((result) => {
        if (result.length > 0) {
          patient.clinicalData.diagnosis.forEach((dx: any) => {
            if (result.find((r: any) => r.code === dx.code)) {
              dx.status = "treated";
            }
          });
  
          if (patient.clinicalData.diagnosis.find((dx: any) => dx.status === "admitted")) {
            doctor.say(`${doctor.title}\nGo to the next doctor`, 1000);
            this.time.delayedCall(1000, () => {
              this.enterHospital(patient);
              doctor.busy = false; // Only reset when done
            });
          } else {
            doctor.say(`${doctor.title}\nHave a nice day`, 1000);
            this.time.delayedCall(1000, () => {
              this.goodTriage++;
              this.walkAway(patient);
              doctor.busy = false; // Only reset when done
            });
          }
        } else {
          if (patient.clinicalData.diagnosis.find((dx: any) => dx.status === "admitted")) {
            doctor.say(`${doctor.title}\nI can't help with this, but go to the next doctor`, 1000);
            this.time.delayedCall(1000, () => {
              this.enterHospital(patient);
              doctor.busy = false; // Only reset when done
            });
          } else {
            doctor.say(`${doctor.title}\nI can't help you...`, 1000);
            this.time.delayedCall(1000, () => {
              this.badTriage++;
              this.walkAway(patient);
              doctor.busy = false; // Only reset when done
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
    const createTween = (index: number) => {
      if (index >= points.length) {
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

  checkPatientDiagnosisVsEcl(patient: Patient, ecl: string): Promise<any[]> {
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