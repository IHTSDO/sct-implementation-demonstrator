export enum FileType {
  EXCEL = 'excel',
  CSV = 'csv',
  TSV = 'tsv',
  JSON = 'json',
  TXT = 'txt',
  UNKNOWN = 'unknown'
}

export interface FileMetadata {
  name: string;
  size: number;
  type: FileType;
  lastModified: Date;
}

export interface ColumnOption {
  header: string;
  index: number;
}

export interface FileProcessingResult {
  type: FileType;
  data: any[][];
  columns: ColumnOption[];
  metadata: FileMetadata;
  isMap: boolean;
  isRf2Refset: boolean;
  isValueSetFile: boolean;
  isEclResult: boolean;
}

export interface ColumnConfig {
  codeColumn: number | null;
  displayColumn: number | null;
  skipHeader: boolean;
}

export interface CodeItem {
  code: string;
  display?: string;
  system?: string;
}

export interface FileDetectionResult {
  isMap: boolean;
  isRf2Refset: boolean;
  isValueSetFile: boolean;
  suggestedColumns: Partial<ColumnConfig>;
}
