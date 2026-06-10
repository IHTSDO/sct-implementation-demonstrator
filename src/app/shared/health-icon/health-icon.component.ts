import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

/**
 * Renders a Health Icons SVG inline so it can be coloured via CSS `color`.
 *
 * Usage:
 *   <app-health-icon category="body" name="lungs" />
 *   <app-health-icon category="conditions" name="stomach_cancer" variant="filled" [size]="32" />
 *
 * Icons are served from assets/healthicons/{variant}/{category}/{name}.svg
 * Source: https://healthicons.org  (CC0 licence)
 */
@Component({
  selector: 'app-health-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="health-icon-wrap"
          [style.width.px]="size"
          [style.height.px]="size"
          [style.display]="'inline-flex'"
          [style.align-items]="'center'"
          [style.justify-content]="'center'"
          [innerHTML]="svg">
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .health-icon-wrap ::ng-deep svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  `]
})
export class HealthIconComponent implements OnChanges {
  @Input() category!: string;
  @Input() name!: string;
  @Input() variant: 'filled' | 'outline' = 'outline';
  @Input() size: number = 24;

  svg: SafeHtml = '';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['category'] || changes['name'] || changes['variant']) {
      this.load();
    }
  }

  private load() {
    if (!this.category || !this.name) return;
    const url = `assets/healthicons/svg/${this.variant}/${this.category}/${this.name}.svg`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: raw => {
        this.svg = this.sanitizer.bypassSecurityTrustHtml(raw);
      },
      error: () => {
        this.svg = '';
      }
    });
  }
}
