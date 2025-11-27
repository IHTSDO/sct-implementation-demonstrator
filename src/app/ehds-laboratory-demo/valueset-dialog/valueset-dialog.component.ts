import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-valueset-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './valueset-dialog.component.html',
  styleUrls: ['./valueset-dialog.component.css']
})
export class ValuesetDialogComponent {
  safeUrl: SafeResourceUrl;
  fieldName: string;
  dialogTitle: string;
  isLoading: boolean = true;
  url: string;

  constructor(
    public dialogRef: MatDialogRef<ValuesetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { url: string; fieldName: string; dialogTitle?: string },
    private sanitizer: DomSanitizer
  ) {
    // Convert HTTP URLs to HTTPS to avoid mixed content errors
    this.url = this.convertToHttps(data.url);
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    this.fieldName = data.fieldName || 'Field';
    this.dialogTitle = data.dialogTitle || `Terminology binding for ${this.fieldName}`;
  }

  private convertToHttps(url: string): string {
    // Convert HTTP URLs to HTTPS to avoid mixed content errors when deployed over HTTPS
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  }

  openInNewTab(): void {
    window.open(this.url, '_blank');
  }

  onIframeLoad(): void {
    this.isLoading = false;
  }
}

