import { Scene } from 'phaser';

export class EclEditorScene extends Scene {
    private confirmButton!: Phaser.GameObjects.Rectangle;
    private closeButton!: Phaser.GameObjects.Rectangle;
    private inputBox!: Phaser.GameObjects.Rectangle;
    private overlay!: Phaser.GameObjects.Rectangle;
    private rules!: { ecl: string; doctorIndex: number }[];
    private updateCallback!: (updatedRules: { ecl: string; doctorIndex: number }[]) => void;
    private lineHeight = 25;
    private maxLines = 3;

    constructor() {
        super({ key: 'EclEditorScene' });
    }

    init(data: { rules: { ecl: string; doctorIndex: number }[]; callback: (updatedRules: { ecl: string; doctorIndex: number }[]) => void }) {
        console.log('EclEditorScene init', data);
        this.rules = data.rules;
        this.updateCallback = data.callback;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        console.log('EclEditorScene create', this.rules);
        const totalHeight = this.rules.length * 90 + 50;

        // 🛑 Dark overlay background
        this.overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5)
            .setDepth(100);

        // 📦 Input panel (Centered)
        this.inputBox = this.add.rectangle(centerX, centerY, 700, 500, 0x333333, 0.9)
            .setOrigin(0.5)
            .setDepth(101);

        // 📌 Display each rule with doctor index
        this.rules.forEach((rule, index) => {
            const yOffset = centerY - totalHeight / 2 + index * 90 + 40;

            // 🏥 Doctor Index (Display Only)
            this.add.text(centerX - 320, yOffset, `Doctor ${rule.doctorIndex}:`, {
                fontSize: '16px',
                color: '#ffcc00',
            }).setOrigin(0, 0.5).setDepth(102);

            // ✍️ Multi-line ECL Text (Read-Only, Only Editable by Paste)
            let eclText = this.add.text(centerX - 200, yOffset, rule.ecl, {
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 5, y: 5 },
                wordWrap: { width: 500 },
                fixedWidth: 500,
                fixedHeight: this.lineHeight * this.maxLines,
            }).setOrigin(0, 0.5).setDepth(102);

            // 📄 "Copy" Button (Left)
            const copyButton = this.add.rectangle(centerX + 145, yOffset + 15, 80, 30, 0x4444cc)
                .setOrigin(0.5)
                .setDepth(102)
                .setInteractive({ useHandCursor: true });

            let copyText = this.add.text(centerX + 145, yOffset + 15, 'Copy', { fontSize: '14px', color: '#ffffff' })
                .setOrigin(0.5)
                .setDepth(103);

            copyButton.on('pointerdown', () => {
                navigator.clipboard.writeText(rule.ecl).then(() => {
                    copyButton.setFillStyle(0x00cc00);
                    copyText.setText('Copied!');
                    this.time.delayedCall(1000, () => {
                        copyButton.setFillStyle(0x4444cc);
                        copyText.setText('Copy');
                    });
                });
            });

            // 📋 "Paste" Button (Center)
            const pasteButton = this.add.rectangle(centerX + 245, yOffset + 15, 80, 30, 0x007acc)
                .setOrigin(0.5)
                .setDepth(102)
                .setInteractive({ useHandCursor: true });

            this.add.text(centerX + 245, yOffset + 15, 'Paste', { fontSize: '14px', color: '#ffffff' })
                .setOrigin(0.5)
                .setDepth(103);

            pasteButton.on('pointerdown', () => {
                navigator.clipboard.readText().then((pastedText) => {
                    rule.ecl = pastedText;
                    eclText.setText(pastedText);
                });
            });
        });

        // ❌ Close "✕" Button
        this.closeButton = this.add.rectangle(735, 65, 30, 30, 0xff0000)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        this.add.text(735, 65, '✕', { fontSize: '18px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(103);

        this.closeButton.on('pointerdown', () => this.closeEclEditor());

        // ✅ Confirm Button (Bottom)
        this.confirmButton = this.add.rectangle(centerX, 520, 100, 30, 0x00ff00)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        this.add.text(centerX, 520, 'OK', { fontSize: '16px', color: '#000000' })
            .setOrigin(0.5)
            .setDepth(103);

        this.confirmButton.on('pointerdown', () => this.confirmEclChange());
    }

    private confirmEclChange() {
        this.updateCallback(this.rules);
        this.closeEclEditor();
    }

    private closeEclEditor() {
        this.scene.resume('CdstdScene');
        this.scene.stop();
    }
}
