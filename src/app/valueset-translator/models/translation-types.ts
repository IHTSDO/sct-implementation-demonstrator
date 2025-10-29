export interface TranslationContext {
  edition: string;
  language: string;
  terminologyService: string;
}

export interface TranslationResult {
  original: Array<{code: string, display: string}>;
  translated: Array<{code: string, display: string}>;
  preview: PreviewData[];
  totalCount: number;
}

export interface PreviewData {
  code: string;
  originalDisplay: string;
  translatedDisplay: string;
}

export interface TranslationOptions {
  context: TranslationContext;
  maxResults?: number;
  includeInactive?: boolean;
}

export interface LanguageOption {
  code: string;
  display: string;
  isRefset?: boolean;
  isContext?: boolean;
}

export interface EditionOption {
  editionName: string;
  editions: Array<{
    resource: {
      version: string;
      url: string;
    };
  }>;
}
