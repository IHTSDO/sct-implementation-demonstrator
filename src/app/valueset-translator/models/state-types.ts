import { FileProcessingResult, ColumnConfig, CodeItem, ValueSetMetadata, FHIRValueSet, TranslationResult, PreviewData } from './index';

export interface FileState {
  file: File | null;
  processingResult: FileProcessingResult | null;
  columnConfig: ColumnConfig;
  isLoading: boolean;
  error: string | null;
}

export interface ProcessingState {
  isFileLoading: boolean;
  isTranslationLoading: boolean;
  isProcessing: boolean;
  isUploading: boolean;
  error: string | null;
  successMessage: string | null;
}

export interface ValueSetState {
  sourceValueSet: FHIRValueSet | null;
  targetValueSet: FHIRValueSet | null;
  metadata: ValueSetMetadata;
  generatedPackage: any | null;
}

export interface TranslationState {
  selectedAction: string | null;
  context: {
    edition: string;
    language: string;
    terminologyService: string;
  };
  result: TranslationResult | null;
  previewData: PreviewData[];
}

export interface UIState {
  showPreview: boolean;
  showEclInput: boolean;
  showIndicators: boolean;
  showFhirOptions: boolean;
  showValueSetMetadata: boolean;
  showFhirServerUpload: boolean;
  fhirServerUrl: string;
  instructionTab: string;
}

export interface ValueSetTranslatorState {
  file: FileState;
  processing: ProcessingState;
  valueSet: ValueSetState;
  translation: TranslationState;
  ui: UIState;
}

export const initialState: ValueSetTranslatorState = {
  file: {
    file: null,
    processingResult: null,
    columnConfig: {
      codeColumn: null,
      displayColumn: null,
      skipHeader: true
    },
    isLoading: false,
    error: null
  },
  processing: {
    isFileLoading: false,
    isTranslationLoading: false,
    isProcessing: false,
    isUploading: false,
    error: null,
    successMessage: null
  },
  valueSet: {
    sourceValueSet: null,
    targetValueSet: null,
    metadata: {
      uri: '',
      name: '',
      version: '1.0.0'
    },
    generatedPackage: null
  },
  translation: {
    selectedAction: null,
    context: {
      edition: '',
      language: '',
      terminologyService: ''
    },
    result: null,
    previewData: []
  },
  ui: {
    showPreview: false,
    showEclInput: false,
    showIndicators: true,
    showFhirOptions: false,
    showValueSetMetadata: true,
    showFhirServerUpload: false,
    fhirServerUrl: '',
    instructionTab: 'download'
  }
};
