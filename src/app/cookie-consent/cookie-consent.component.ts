import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-cookie-consent',
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.css'],
  standalone: false
})
export class CookieConsentComponent {
  constructor(public dialogRef: MatDialogRef<CookieConsentComponent>) {}

  accept(): void {
    this.dialogRef.close(true);
  }

  decline(): void {
    this.dialogRef.close(false);
  }
}

