import { GameService } from "../gameService";
import { Character } from "./character";
import { Patient } from "./patient";

export class Doctor extends Character {
    public specialityEcl: string = '';
    public title: string = '';
    public busy: boolean = false;
    private gameService!: GameService;

    constructor(scene: Phaser.Scene, x: number, y: number, specialityEcl: string, gameService: GameService) {
        super(scene, x, y, 2, 0x0000ff); // 🟦 Blue color
        this.setScale(0.5);
        this.specialityEcl = specialityEcl;
        this.gameService = gameService;
        this.setInteractive({ useHandCursor: true });
    }

    setSpecialityEcl(ecl: string) {
        this.specialityEcl = ecl;
    }

    setTitle(title: string) {
        this.title = title;
    }

    setBusy(busy: boolean) {
        this.busy = busy;
    }

    isBusy() {
        return this.busy;
    }

    attendPatient(patient: Patient): Promise<boolean> {
        return new Promise((resolve) => {
            this.gameService.checkPatientDiagnosisVsEcl(patient, this.specialityEcl).then((result) => {
                if (result.length > 0) {
                    // Mark diagnosis in ECL result as treated
                    patient.clinicalData.diagnosis.forEach((dx: any) => {
                        if (result.find((r: any) => r.code === dx.code)) {
                            dx.status = 'treated';
                        }
                    });
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }
}
