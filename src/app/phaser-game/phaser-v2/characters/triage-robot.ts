import { Character } from "./character";
import { Patient } from "./patient";
import { GameService } from "./gameService";

export class TriageRobot extends Character {
    public triageRules: any[] = [];
    private gameService!: GameService;

    constructor(scene: Phaser.Scene, x: number, y: number, triageRules: any[], gameService: GameService) {
        super(scene, x, y, 2, 0xffff00); // 🟡 Yellow color for Triage Robots
        this.setScale(0.5);
        this.triageRules = triageRules;
        this.gameService = gameService;
        this.setInteractive({ useHandCursor: true });
    }

    setTriageRules(rules: any[]) {
        this.triageRules = rules;
    }

    triagePatient(patient: Patient, ecl: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.gameService.checkPatientDiagnosisVsEcl(patient, ecl).then((result) => {
                resolve(result.length > 0);
            });
        });
    }
}
