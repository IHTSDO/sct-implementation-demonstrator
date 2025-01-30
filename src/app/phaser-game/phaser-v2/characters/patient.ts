import { Character } from "./character";

export class Patient extends Character {
    private diagnosisText?: Phaser.GameObjects.Text;
    public clinicalData: any = {};
    private dxOptions: any[] = [];

    constructor(scene: Phaser.Scene, x: number, y: number, spriteType: number = 1, dxList: any[] = []) {
        super(scene, x, y, spriteType, 0xff0000); // 🔴 Red color for Patients
        this.setScale(0.5);

        // Load 'assets/cdstd/Data/dx_1.json' in dxOptions
        this.dxOptions = scene.cache.json.get('diagnosisData');
        this.clinicalData.age = Phaser.Math.Between(18, 100);
        this.clinicalData.diagnosis = [];

        if (dxList && dxList.length > 0) {
            this.clinicalData.diagnosis = dxList;
        } else {
            // Populate with 1 to 5 diagnosis from the list, no repetitions
            const diagnosisCount = Phaser.Math.Between(1, 2);
            for (let i = 0; i < diagnosisCount; i++) {
                const diagnosis = Phaser.Utils.Array.GetRandom(this.dxOptions);
                diagnosis.status = "none";
                if (!this.clinicalData.diagnosis.includes(diagnosis)) {
                    this.clinicalData.diagnosis.push(diagnosis);
                }
            }
        }

        this.setInteractive({ useHandCursor: true });
        this.on('pointerover', () => this.showDiagnosis());
        this.on('pointerout', () => this.hideDiagnosis());
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
}
