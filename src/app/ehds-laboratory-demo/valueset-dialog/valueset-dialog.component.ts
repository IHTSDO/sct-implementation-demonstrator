import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-valueset-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './valueset-dialog.component.html',
  styleUrls: ['./valueset-dialog.component.css']
})
export class ValuesetDialogComponent {
  safeUrl: SafeResourceUrl;
  fieldName: string;
  dialogTitle: string;
  isLoading: boolean = true;
  url: string;
  hasError: boolean = false;
  errorMessage: string = '';
  openedInNewTab: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ValuesetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { url: string; fieldName: string; dialogTitle?: string },
    private sanitizer: DomSanitizer
  ) {
    // Convert HTTP URLs to HTTPS to avoid mixed content errors
    this.url = this.convertToHttps(data.url);
    
    // Check for domains that block iframe embedding (like Simplifier.net)
    // These should open directly in a new tab instead of attempting iframe load
    if (this.url.toLowerCase().includes('simplifier.net')) {
      // Simplifier.net blocks iframe embedding, open directly in new tab
      this.hasError = true;
      this.openedInNewTab = true;
      this.errorMessage = 'This content cannot be loaded in an iframe due to security restrictions. Opening in a new tab instead.';
      this.isLoading = false;
      // Open in new tab immediately
      setTimeout(() => {
        window.open(this.url, '_blank');
      }, 100);
      // Still set safeUrl for the iframe (even though it won't load)
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
      // Check for known problematic domains that redirect to HTTP
      this.checkForKnownIssues();
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    }
    
    this.fieldName = data.fieldName || 'Field';
    this.dialogTitle = data.dialogTitle || `Terminology binding for ${this.fieldName}`;
  }

  private checkForKnownIssues(): void {
    // Known domains that may redirect to HTTP or block iframe embedding
    const problematicDomains = ['hl7.eu', 'terminology.hl7.org', 'simplifier.net'];
    const urlLower = this.url.toLowerCase();
    
    for (const domain of problematicDomains) {
      if (urlLower.includes(domain)) {
        // Set up a delayed check to see if content loaded
        setTimeout(() => {
          this.verifyContentLoaded();
        }, 4000); // Check after 4 seconds
        break;
      }
    }
  }

  private verifyContentLoaded(): void {
    if (this.hasError || this.openedInNewTab) {
      return; // Already handled
    }

    const iframe = document.querySelector('.valueset-iframe') as HTMLIFrameElement;
    if (!iframe) {
      return;
    }

    let contentLoaded = false;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const body = iframeDoc.body;
        // Check if body exists and has content
        if (body && body.children.length > 0) {
          contentLoaded = true;
          return;
        }
      }
    } catch (e) {
      // CORS - can't access, which is normal for cross-origin
      // This doesn't necessarily mean content didn't load
    }

    // If we can't verify content and it's a problematic domain, 
    // check if iframe src was blocked (changed to about:blank)
    const currentSrc = iframe.src;
    if (currentSrc && currentSrc.startsWith('about:blank')) {
      this.handleLoadFailure();
    } else if (!contentLoaded) {
      // For problematic domains, if we can't verify content after delay, 
      // assume it might be blocked and check one more time
      setTimeout(() => {
        this.performFinalCheck();
      }, 2000);
    }
  }

  private performFinalCheck(): void {
    if (this.hasError || this.openedInNewTab) {
      return;
    }

    const iframe = document.querySelector('.valueset-iframe') as HTMLIFrameElement;
    if (!iframe) {
      return;
    }

    // Check if iframe is still blank or if src was changed
    const currentSrc = iframe.src;
    if (currentSrc && currentSrc.startsWith('about:blank')) {
      this.handleLoadFailure();
      return;
    }

    // Try one more time to check content
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const body = iframeDoc.body;
        if (body && body.children.length === 0 && (!body.textContent || body.textContent.trim().length === 0)) {
          // Body exists but is empty - might be blocked
          // Only handle as failure if it's a known problematic domain
          if (this.url.includes('hl7.eu') || this.url.includes('terminology.hl7.org') || this.url.includes('simplifier.net')) {
            this.handleLoadFailure();
          }
        }
      }
    } catch (e) {
      // CORS - can't verify, but that's normal
    }
  }

  private handleLoadFailure(): void {
    if (this.openedInNewTab) {
      return; // Already handled
    }

    this.openedInNewTab = true;
    this.hasError = true;
    this.errorMessage = 'The content could not be loaded in the iframe due to security restrictions (mixed content). It has been automatically opened in a new tab where it should work correctly.';
    
    // Open in new tab
    window.open(this.url, '_blank');
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
    // The load event fires even if content is blocked by mixed content policy
    // We need to check if content actually loaded after a delay
    setTimeout(() => {
      this.checkIframeContent();
    }, 2000); // Wait 2 seconds to see if content loads
    
    this.isLoading = false;
  }

  private checkIframeContent(): void {
    if (this.hasError || this.openedInNewTab) {
      return; // Already handled
    }

    const iframe = document.querySelector('.valueset-iframe') as HTMLIFrameElement;
    if (!iframe) {
      return;
    }

    // Check if iframe src was changed to about:blank (indicates blocking)
    const currentSrc = iframe.src;
    if (currentSrc && currentSrc.startsWith('about:blank')) {
      this.handleLoadFailure();
      return;
    }

    try {
      // Try to access iframe content - will throw if blocked by CORS/mixed content
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        // Check if document has meaningful content
        const body = iframeDoc.body;
        if (body && (body.children.length > 0 || (body.textContent && body.textContent.trim().length > 0))) {
          return; // Content loaded successfully
        } else {
          // Body exists but is empty - might be blocked
          // For problematic domains, this might indicate blocking
          if (this.url.includes('hl7.eu') || this.url.includes('terminology.hl7.org') || this.url.includes('simplifier.net')) {
            // Wait a bit more and check again
            setTimeout(() => {
              if (!this.hasError && !this.openedInNewTab) {
                this.checkIframeContent();
              }
            }, 2000);
          }
        }
      }
    } catch (e: any) {
      // CORS error is expected for cross-origin
      // This doesn't necessarily mean content didn't load
    }
  }
}

