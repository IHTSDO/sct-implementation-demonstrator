import { Component } from '@angular/core';

interface SmartHealthLinkItem {
  id: string;
  label: string;
  sourceFile: string;
  manifestFile: string;
  shlink: string;
}

type QrFormat = 'svg' | 'png';

@Component({
  selector: 'app-smart-health-links',
  templateUrl: './smart-health-links.component.html',
  styleUrls: ['./smart-health-links.component.css'],
  standalone: false
})
export class SmartHealthLinksComponent {
  readonly links: SmartHealthLinkItem[];

  constructor() {
    this.links = [
      this.buildLinkItem(
        'ips-example-active-penicillin',
        'IPS Example Active Penicillin',
        'assets/data/ips-example-active-penicillin.json',
        'assets/shl/ips-example-active-penicillin/manifest.json'
      )
    ];
  }

  async copyShLink(item: SmartHealthLinkItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.shlink);
      alert('SHLink copied to clipboard.');
    } catch (error) {
      console.error('Unable to copy SHLink:', error);
      alert('Could not copy SHLink to clipboard.');
    }
  }

  async downloadQr(item: SmartHealthLinkItem, format: QrFormat): Promise<void> {
    const qrUrl = this.getQrUrl(item.shlink, format);
    const fileName = `${item.id}-qr.${format}`;

    try {
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error(`QR generation failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.downloadBlobUrl(blobUrl, fileName);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('QR download failed. Falling back to direct URL:', error);
      this.openInNewTab(qrUrl);
    }
  }

  getQrPreviewUrl(item: SmartHealthLinkItem): string {
    return this.getQrUrl(item.shlink, 'svg');
  }

  private buildLinkItem(id: string, label: string, sourceFile: string, manifestPath: string): SmartHealthLinkItem {
    const manifestUrl = this.getAbsoluteUrl(manifestPath);
    const payload = {
      url: manifestUrl,
      key: this.generateDemoKey(),
      label
    };

    const shlink = `shlink:/${this.encodeBase64Url(JSON.stringify(payload))}`;

    return {
      id,
      label,
      sourceFile,
      manifestFile: manifestPath,
      shlink
    };
  }

  private getAbsoluteUrl(path: string): string {
    return new URL(path, document.baseURI).toString();
  }

  private getQrUrl(shlink: string, format: QrFormat): string {
    const encodedText = encodeURIComponent(shlink);
    const encodedFormat = encodeURIComponent(format);
    return `https://quickchart.io/qr?size=300&ecLevel=M&margin=2&format=${encodedFormat}&text=${encodedText}`;
  }

  private encodeBase64Url(input: string): string {
    const base64 = btoa(unescape(encodeURIComponent(input)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private generateDemoKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);

    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });

    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private downloadBlobUrl(blobUrl: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.click();
  }

  private openInNewTab(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
