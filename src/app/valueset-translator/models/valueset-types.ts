export interface ValueSetMetadata {
  uri: string;
  name: string;
  version: string;
  sourceSystemUri?: string;
  description?: string;
  title?: string;
}

export interface TerminologyContext {
  fhirUrlParam: string;
  language: string;
  editionName: string;
}

export interface FHIRValueSet {
  resourceType: 'ValueSet';
  id?: string;
  url: string;
  name: string;
  version?: string;
  status: string;
  experimental?: boolean;
  compose?: {
    include: Array<{
      system: string;
      version?: string;
      concept: Array<{
        code: string;
        display?: string;
      }>;
    }>;
  };
  expansion?: {
    total: number;
    contains: Array<{
      code: string;
      display?: string;
      system?: string;
      version?: string;
    }>;
  };
  title?: string;
  description?: string;
}

export interface FHIRParameters {
  resourceType: 'Parameters';
  parameter: Array<{
    name: string;
    resource: FHIRValueSet;
  }>;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  url: string;
  name: string;
  version?: string;
  status: string;
  content?: string;
  concept?: Array<{code: string, display: string}>;
  compose?: {
    include: Array<{
      system: string,
      concept: Array<{code: string, display: string}>
    }>
  };
  sourceUri?: string;
  targetUri?: string;
  group?: Array<{
    source: string;
    target: string;
    element: Array<{
      code: string;
      display: string;
      target: Array<{
        code: string;
        display: string;
        equivalence: string;
      }>;
    }>;
  }>;
}

export interface FHIRPackage {
  manifest: {
    name: string;
    version: string;
    fhirVersion: string;
    resources: Array<{type: string, reference: string}>;
  };
  index: {
    'index-version': number;
    files: Array<{
      filename: string;
      resourceType: string;
      id: string;
      url: string;
    }>;
  };
  resources: {
    codeSystem: FHIRResource;
    valueSet: FHIRResource;
    snomedValueSet: FHIRResource;
    conceptMap: FHIRResource;
  };
}
