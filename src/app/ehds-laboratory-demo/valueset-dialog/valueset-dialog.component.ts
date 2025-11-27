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
    console.log('[ValuesetDialog] Received URL:', data.url);
    console.log('[ValuesetDialog] Field Name:', data.fieldName);
    console.log('[ValuesetDialog] Dialog Title:', data.dialogTitle);
    
    // Convert HTTP URLs to HTTPS to avoid mixed content errors
    this.url = this.convertToHttps(data.url);
    
    console.log('[ValuesetDialog] Converted URL:', this.url);
    console.log('[ValuesetDialog] URL starts with http://?', this.url.startsWith('http://'));
    console.log('[ValuesetDialog] URL starts with https://?', this.url.startsWith('https://'));
    
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    this.fieldName = data.fieldName || 'Field';
    this.dialogTitle = data.dialogTitle || `Terminology binding for ${this.fieldName}`;
  }

  private convertToHttps(url: string): string {
    console.log('[ValuesetDialog] convertToHttps - Input URL:', url);
    console.log('[ValuesetDialog] convertToHttps - URL type:', typeof url);
    console.log('[ValuesetDialog] convertToHttps - URL starts with http://?', url.startsWith('http://'));
    
    // Convert HTTP URLs to HTTPS to avoid mixed content errors when deployed over HTTPS
    if (url.startsWith('http://')) {
      const converted = url.replace('http://', 'https://');
      console.log('[ValuesetDialog] convertToHttps - Converted from HTTP to HTTPS:', converted);
      return converted;
    }
    
    console.log('[ValuesetDialog] convertToHttps - No conversion needed, returning:', url);
    return url;
  }

  openInNewTab(): void {
    window.open(this.url, '_blank');
  }

  onIframeLoad(): void {
    console.log('[ValuesetDialog] Iframe loaded - URL:', this.url);
    console.log('[ValuesetDialog] Iframe loaded - Safe URL:', this.safeUrl);
    this.isLoading = false;
  }
}

