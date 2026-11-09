import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import Plotly from 'plotly.js-dist';
import { Subscription } from 'rxjs';
import { REPORT_FORMAT_VERSION, ReportColumn, ReportData } from './report-data.model';

type LoadPhase = 'downloading' | 'rendering' | 'ready' | 'error';

interface SelectedBar {
  title: string;
  rows: string[][];
}

/** Years up to this one are only reachable through Reset, as in the original reports. */
const FIRST_ZOOM_YEAR = 2022;

/**
 * Renders one SNOMED change report (new concepts, FSN changes, inactivations)
 * as a stacked bar chart with a details table for the clicked bar. Which report
 * to load comes from the route data (`reportUrl`).
 */
@Component({
  selector: 'app-report-viewer',
  templateUrl: './report-viewer.component.html',
  styleUrl: './report-viewer.component.css',
  standalone: false,
})
export class ReportViewerComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: true }) chartElement!: ElementRef<HTMLDivElement>;

  phase: LoadPhase = 'downloading';
  report: ReportData | null = null;
  columns: ReportColumn[] = [];
  years: string[] = [];
  selected: SelectedBar | null = null;

  private stackTotals: number[] = [];
  private subscription?: Subscription;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    const reportUrl: string = this.route.snapshot.data['reportUrl'];
    this.subscription = this.http.get<ReportData>(reportUrl).subscribe({
      next: (report) => this.onReportLoaded(report),
      error: (err) => {
        console.error(`Could not load report ${reportUrl}`, err);
        this.phase = 'error';
      },
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    Plotly.purge(this.chartElement.nativeElement);
  }

  zoomToYear(year: string): void {
    const report = this.report;
    if (!report) return;
    const indexes = report.x.map((x, i) => (x.startsWith(year) ? i : -1)).filter((i) => i >= 0);
    if (!indexes.length) return;
    const first = indexes[0];
    const last = indexes[indexes.length - 1];
    const maxY = Math.max(...this.stackTotals.slice(first, last + 1));
    Plotly.relayout(this.chartElement.nativeElement, {
      'xaxis.range': [first - 0.5, last + 0.5],
      'yaxis.range': [0, maxY * 1.1],
    });
  }

  resetZoom(): void {
    Plotly.relayout(this.chartElement.nativeElement, {
      'xaxis.autorange': true,
      'yaxis.autorange': true,
    });
  }

  private onReportLoaded(report: ReportData): void {
    if (report?.version !== REPORT_FORMAT_VERSION) {
      console.error(`Unsupported report format version ${report?.version}`);
      this.phase = 'error';
      return;
    }
    this.report = report;
    this.columns = report.columns;
    this.stackTotals = report.x.map((_, i) => report.series.reduce((sum, s) => sum + (s.y[i] ?? 0), 0));
    this.years = [...new Set(report.x.map((x) => x.substring(0, 4)))]
      .filter((year) => parseInt(year, 10) >= FIRST_ZOOM_YEAR)
      .sort();
    this.phase = 'rendering';
    // Let the "Preparing chart" state paint before Plotly blocks the main thread.
    setTimeout(() => this.renderChart(report), 50);
  }

  private renderChart(report: ReportData): void {
    const traces = report.series.map((series) => ({
      type: 'bar',
      name: series.name,
      x: report.x,
      y: series.y,
      customdata: this.stackTotals,
      hovertemplate:
        `<b>${report.seriesTitle}:</b> ${escapeHtml(series.name)}<br>` +
        '<b>Count:</b> %{y}<br>' +
        `<b>${report.xTitle}:</b> %{x}<br>` +
        '<b>Total Count:</b> %{customdata}<extra></extra>',
    }));
    const layout = {
      title: { text: report.title },
      colorway: report.colorway ?? undefined,
      barmode: 'stack',
      height: 600,
      xaxis: { title: { text: report.xTitle }, type: 'category', tickangle: 45 },
      yaxis: { title: { text: report.yTitle } },
      legend: { title: { text: report.seriesTitle } },
    };

    // Plotly augments the element with an event API (on/removeAllListeners).
    const element: any = this.chartElement.nativeElement;
    this.zone.runOutsideAngular(() => {
      Plotly.newPlot(element, traces, layout, { responsive: true }).then(() => {
        element.on('plotly_click', (event: any) => {
          const point = event?.points?.[0];
          if (point) this.zone.run(() => this.selectBar(point.curveNumber, point.pointIndex));
        });
        this.zone.run(() => (this.phase = 'ready'));
      });
    });
  }

  private selectBar(seriesIndex: number, xIndex: number): void {
    const report = this.report;
    const series = report?.series[seriesIndex];
    if (!report || !series) return;
    const count = series.y[xIndex];
    const scope = count > report.headsSize ? `first ${report.headsSize} rows of ${count}` : `all ${count} rows`;
    this.selected = {
      title: `Details for ${series.name.trim()} - ${report.x[xIndex]} (${scope})`,
      rows: series.rows[xIndex] ?? [],
    };
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
