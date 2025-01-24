import Phaser from 'phaser';
import { Character } from '../characters/character';
import { TerminologyService } from '../../services/terminology.service';

export class CdstdScene extends Phaser.Scene {
  private patients!: Phaser.GameObjects.Group;
  private gatekeeper!: Character;
  private speedMultiplier: number = 1;
  
  constructor(private terminologyService: TerminologyService) {
    super({ key: 'CdstdScene' });
  }

  preload() {
    this.load.json('diagnosisData', 'assets/cdstd/Data/dx_1.json');
    this.load.image('hospitalFloor', 'assets/cdstd/Backgrounds/hospital-floor-day.png');
    this.load.image('pauseButton', 'assets/cdstd/Objects/Buttons/button_pause.png');
  }

  create() {
    this.add.image(400, 300, 'hospitalFloor');
    this.patients = this.physics.add.group();
    this.spawnPatient();
  }

  override update() {
    this.patients.getChildren().forEach((patientObj) => {
      const patient = patientObj as Character;
      patient.updateMovement();
    });
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  private spawnPatient() {
    const patient = new Character(this, 80, 10, 'patient', Phaser.Math.Between(1, 3));
    this.patients.add(patient);
  }
}
