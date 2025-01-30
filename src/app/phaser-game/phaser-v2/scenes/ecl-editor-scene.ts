import { Scene } from 'phaser';

export class EclEditorScene extends Scene {
    private eclText!: Phaser.GameObjects.Text;
    private confirmButton!: Phaser.GameObjects.Rectangle;
    private closeButton!: Phaser.GameObjects.Rectangle;
    private pasteButton!: Phaser.GameObjects.Rectangle;
    private copyButton!: Phaser.GameObjects.Rectangle;
    private inputBox!: Phaser.GameObjects.Rectangle;
    private overlay!: Phaser.GameObjects.Rectangle;
    private currentEcl!: string;
    private updateCallback!: (newEcl: string) => void;
    private maxLines = 3;
    private lineHeight = 24;

    constructor() {
        super({ key: 'EclEditorScene' });
    }

    init(data: { ecl: string; callback: (newEcl: string) => void }) {
        this.currentEcl = data.ecl;
        this.updateCallback = data.callback;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // 🛑 Dark overlay background
        this.overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5)
            .setDepth(100);

        // 📦 Input panel (Centered)
        this.inputBox = this.add.rectangle(centerX, centerY, 700, 200, 0x333333, 0.9)
            .setOrigin(0.5)
            .setDepth(101);

        // ✍️ Multi-line ECL Text (Read-Only, Only Editable by Paste)
        this.eclText = this.add.text(centerX - 330, centerY - 60, this.currentEcl, {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 },
            wordWrap: { width: 650 },
            lineSpacing: 6,
            fixedWidth: 650,
            fixedHeight: this.lineHeight * this.maxLines,
        })
        .setOrigin(0, 0)
        .setDepth(102)
        .setInteractive();

        // ❌ Close "✕" Button
        this.closeButton = this.add.rectangle(centerX + 325, centerY - 95, 30, 30, 0xff0000)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        this.add.text(centerX + 325, centerY - 95, '✕', { fontSize: '18px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(103);

        this.closeButton.on('pointerdown', () => this.closeEclEditor());

        // 📄 "Copy" Button (Left)
        this.copyButton = this.add.rectangle(centerX - 100, centerY + 90, 100, 30, 0x4444cc)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        let copyText = this.add.text(centerX - 100, centerY + 90, 'Copy', { fontSize: '16px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(103);

        // 🔄 Copy Button Functionality
        this.copyButton.on('pointerdown', () => {
            navigator.clipboard.writeText(this.eclText.text).then(() => {
                // Briefly change button color to indicate success
                this.copyButton.setFillStyle(0x00cc00);
                copyText.setText('Copied!');
                this.time.delayedCall(1000, () => {
                    this.copyButton.setFillStyle(0x4444cc);
                    copyText.setText('Copy');
                });
            });
        });

        // 📋 "Paste" Button (Center)
        this.pasteButton = this.add.rectangle(centerX, centerY + 90, 100, 30, 0x007acc)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        this.add.text(centerX, centerY + 90, 'Paste', { fontSize: '16px', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(103);

        // 🔄 Paste Button Functionality
        this.pasteButton.on('pointerdown', () => {
            navigator.clipboard.readText().then((pastedText) => {
                this.eclText.setText(pastedText);
            });
        });

        // ✅ Confirm Button (Right)
        this.confirmButton = this.add.rectangle(centerX + 100, centerY + 90, 100, 30, 0x00ff00)
            .setOrigin(0.5)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        this.add.text(centerX + 100, centerY + 90, 'OK', { fontSize: '16px', color: '#000000' })
            .setOrigin(0.5)
            .setDepth(103);

        this.confirmButton.on('pointerdown', () => this.confirmEclChange());
    }

    private confirmEclChange() {
        this.updateCallback(this.eclText.text);
        this.closeEclEditor();
    }

    private closeEclEditor() {
        this.scene.resume('CdstdScene');
        this.scene.stop();
    }
}
