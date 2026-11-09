/**
 * Compact report payload written by python/reports-updater/report_json.py.
 * See that module for the full description of the format.
 */
export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSeries {
  name: string;
  /** Bar height for each entry of ReportData.x. */
  y: number[];
  /** For each entry of ReportData.x, the first `headsSize` detail rows; cells follow ReportData.columns. */
  rows: string[][][];
}

export interface ReportData {
  version: number;
  title: string;
  xTitle: string;
  yTitle: string;
  seriesTitle: string;
  headsSize: number;
  colorway: string[] | null;
  columns: ReportColumn[];
  x: string[];
  series: ReportSeries[];
}

export const REPORT_FORMAT_VERSION = 1;
