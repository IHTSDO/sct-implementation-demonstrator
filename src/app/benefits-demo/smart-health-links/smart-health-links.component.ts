import { Component, OnInit } from '@angular/core';
import QRCode from 'qrcode';

interface SmartHealthLinkItem {
  id: string;
  label: string;
  sourceFile: string;
  manifestFile: string;
  shlink: string;
  qrPreviewDataUrl?: string;
}

type QrFormat = 'svg' | 'png';

@Component({
  selector: 'app-smart-health-links',
  templateUrl: './smart-health-links.component.html',
  styleUrls: ['./smart-health-links.component.css'],
  standalone: false
})
export class SmartHealthLinksComponent implements OnInit {
  readonly links: SmartHealthLinkItem[];

  constructor() {
    this.links = [
      this.buildLinkItem(
        'ips-example-active-penicillin',
        'IPS Example Active Penicillin',
        'assets/data/ips-example-active-penicillin.json',
        'assets/shl/ips-example-active-penicillin/manifest.json',
        'RfauHCPL59FysuVS0nmEpawm_VhF4z1P8Z-w_gtZqII'
      )
    ];
  }

  ngOnInit(): void {
    void this.generateQrPreviews();
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
    const fileName = `${item.id}-qr.${format}`;

    try {
      if (format === 'svg') {
        const svg = await QRCode.toString(item.shlink, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 300
        });
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(svgBlob);
        this.downloadBlobUrl(blobUrl, fileName);
        URL.revokeObjectURL(blobUrl);
        return;
      }

      const pngDataUrl = await QRCode.toDataURL(item.shlink, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300
      });
      const blobUrl = await this.dataUrlToBlobUrl(pngDataUrl);
      this.downloadBlobUrl(blobUrl, fileName);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('QR download failed:', error);
      alert('Unable to generate QR code locally.');
    }
  }

  private buildLinkItem(
    id: string,
    label: string,
    sourceFile: string,
    manifestPath: string,
    key: string
  ): SmartHealthLinkItem {
    const manifestUrl = this.getAbsoluteUrl(manifestPath);
    const payload = {
      url: manifestUrl,
      key,
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

  private encodeBase64Url(input: string): string {
    const bytes = new TextEncoder().encode(input);
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

  private async generateQrPreviews(): Promise<void> {
    await Promise.all(
      this.links.map(async item => {
        try {
          const svg = await QRCode.toString(item.shlink, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 180
          });
          item.qrPreviewDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        } catch (error) {
          console.error(`Failed to generate QR preview for ${item.id}:`, error);
          item.qrPreviewDataUrl = '';
        }
      })
    );
  }

  private async dataUrlToBlobUrl(dataUrl: string): Promise<string> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}
