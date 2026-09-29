import { AfterViewInit, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { MaturityScoringService } from '../maturity-scoring.service';

interface GaugePoint { x: number; y: number; }
interface GaugeSegment { path: string; color: string; label: string; labelX: number; labelY: number; labelAnchor: string; }
interface GaugeBoundary { x1: number; y1: number; x2: number; y2: number; }

/**
 * Car-dashboard style maturity gauge (custom inline SVG).
 *
 * Renders the 0–5 maturity scale as a semicircular dial with one coloured
 * segment per level (always fully visible), divider ticks at every segment
 * limit, level labels centred on each segment, and a needle pointing at the
 * current score. Levels/order come from the shared MaturityScoringService so
 * the dial stays consistent with the results page and the summary table.
 *
 * The geometry is recomputed only when the score (or language) changes and is
 * stored in fields — never behind template getters — to avoid recreating the
 * SVG views on every change-detection pass.
 */
@Component({
  selector: 'app-maturity-gauge',
  templateUrl: './maturity-gauge.component.html',
  styleUrls: ['./maturity-gauge.component.css'],
  standalone: false
})
export class MaturityGaugeComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  /** Maturity score on a 0–5 scale. */
  @Input() score = 0;

  private scoring = inject(MaturityScoringService);
  private translocoService = inject(TranslocoService);
  private cdr = inject(ChangeDetectorRef);
  private langSub?: Subscription;
  private readonly translationScope = 'maturity';
  private translationsReady = false;

  // Geometry (SVG user units; see viewBox in the template).
  readonly cx = 110;
  readonly cy = 110;
  readonly rOuter = 95;
  readonly thickness = 24;
  private readonly rCenter = this.rOuter - this.thickness / 2; // band centre-line
  private readonly rInner = this.rOuter - this.thickness;

  // Vivid band colours, one per level (Basic → Optimizing) from the shared service.
  private readonly bandColors = this.scoring.levelColors;

  // Precomputed view state.
  segments: GaugeSegment[] = [];
  boundaries: GaugeBoundary[] = [];
  /** Static needle shape, pointing straight up; rotated via needleAngle. */
  needleShape = '';
  /**
   * Needle rotation in degrees (0 = pointing up, animated via CSS).
   * Starts at -90° (the "zero" end) so the first render sweeps up from zero.
   */
  needleAngle = -90;
  private targetNeedleAngle = -90;
  private viewReady = false;
  scoreColor = '#333333';
  levelLabel = '';

  ngOnInit(): void {
    this.langSub = this.translocoService.langChanges$.pipe(
      distinctUntilChanged(),
      tap(() => { this.translationsReady = false; }),
      switchMap(lang => this.translocoService.load(`${this.translationScope}/${lang}`))
    ).subscribe(() => {
      this.translationsReady = true;
      this.recompute();
      this.cdr.markForCheck();
    });
    this.recompute();
  }

  ngAfterViewInit(): void {
    // Defer to the next frame so the browser paints the needle at the "zero"
    // position first, then animates the sweep up to the actual score.
    requestAnimationFrame(() => {
      this.viewReady = true;
      this.needleAngle = this.targetNeedleAngle;
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['score']) {
      this.recompute();
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private recompute(): void {
    const scale = this.scoring.resultsScale;
    const n = scale.length;
    const maxScore = scale[n - 1].value;
    const fraction = Math.min(1, Math.max(0, this.score / maxScore));

    this.segments = scale.map((level, i) => {
      const midFraction = (i + 0.5) / n;
      const labelPos = this.pointOnArc(midFraction, this.rOuter + 16);
      // End labels are anchored outward so their text does not extend back over
      // the arc; middle labels stay centred.
      let labelAnchor = 'middle';
      if (midFraction < 0.2) labelAnchor = 'end';
      else if (midFraction > 0.8) labelAnchor = 'start';
      return {
        path: this.arcPath(i / n, (i + 1) / n, this.rCenter),
        color: this.bandColors[i] ?? '#cccccc',
        label: this.label('level' + level.label, level.label),
        labelX: labelPos.x,
        labelY: labelPos.y,
        labelAnchor
      };
    });

    this.boundaries = [];
    for (let i = 0; i <= n; i++) {
      const inner = this.pointOnArc(i / n, this.rInner - 2);
      const outer = this.pointOnArc(i / n, this.rOuter + 2);
      this.boundaries.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y });
    }

    // Needle points up by default; rotate it to the value so CSS can animate.
    const tipY = this.cy - (this.rOuter - 8);
    const half = 5;
    this.needleShape = `${this.cx},${tipY} ${this.cx - half},${this.cy} ${this.cx + half},${this.cy}`;
    this.targetNeedleAngle = (fraction - 0.5) * 180;
    // Before the first paint we keep the needle at zero (-90°) so the intro
    // sweep runs; afterwards, follow the value (animating from the current pos).
    if (this.viewReady) {
      this.needleAngle = this.targetNeedleAngle;
    }

    const level = this.scoring.getLevel(this.score);
    this.scoreColor = this.scoring.getLevelColor(this.score);
    this.levelLabel = this.label(level.key, level.label);
  }

  private label(key: string, fallback: string): string {
    if (!this.translationsReady) return fallback;
    const translated = this.translocoService.translate(`maturity.results.${key}`);
    return translated && !translated.startsWith('maturity.') ? translated : fallback;
  }

  private pointOnArc(fraction: number, radius: number): GaugePoint {
    const angle = Math.PI * (1 - fraction); // fraction 0 → π (left), 1 → 0 (right)
    return { x: this.cx + radius * Math.cos(angle), y: this.cy - radius * Math.sin(angle) };
  }

  private arcPath(f0: number, f1: number, radius: number): string {
    const p0 = this.pointOnArc(f0, radius);
    const p1 = this.pointOnArc(f1, radius);
    // Each band spans <180°, drawn clockwise (left → right over the top).
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
}
