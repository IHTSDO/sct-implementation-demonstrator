import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-license-agreement',
  templateUrl: './license-agreement.component.html',
  styleUrls: ['./license-agreement.component.css'],
  standalone: false
})
export class LicenseAgreementComponent {

  constructor(
    public dialogRef: MatDialogRef<LicenseAgreementComponent>
  ) {}

  onAccept(): void {
    this.dialogRef.close(true);
  }

  onDecline(): void {
    this.dialogRef.close(false);
  }
}

