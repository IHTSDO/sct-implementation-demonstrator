import { Character } from "./character";
import { Patient } from "./patient";
import { GameService } from "./gameService";


export class TriageRobot extends Character {

    public triageEcl: string = '';
    private gameService!: GameService;

    constructor(scene: Phaser.Scene, x: number, y: number, triageEcl: string, gameService: GameService) {
        super(scene, x, y, 'gatekeeper', 2);
        this.triageEcl = triageEcl;
        this.gameService = gameService;
        this.setInteractive({ useHandCursor: true });
    }

    setTriageEcl(ecl: string) {
        this.triageEcl = ecl;
    }

    triagePatient(patient: Patient): Promise<boolean> {
      return new Promise((resolve) => {
          this.gameService.checkPatientDiagnosisVsEcl(patient, this.triageEcl).then((result) => {
              if (result.length > 0) {
                  resolve(true);
              } else {
                  resolve(false);
              }
          });
      });
    }

}
