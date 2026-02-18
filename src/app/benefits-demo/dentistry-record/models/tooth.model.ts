export type NotationSystem = 'FDI' | 'Universal' | 'Palmer';

export interface ToothNotations {
  fdi: string;
  universal: string;
  palmer: string;
}

export interface SnomedStructureConcept {
  code: string;
  display: string;
}

export interface SnomedConceptOption {
  code: string;
  display: string;
  entire?: boolean;
}

export interface ToothFindingEntry {
  surfaceCode?: string;
  findingCode?: string;
  observationId?: string;
}

export interface ToothBase {
  name: string;
  type: string;
  outlinePath: string;
  shadowPath: string;
  lineHighlightPath: string | string[];
}

export interface OdontogramTooth extends ToothBase {
  id: string;
  notations: ToothNotations;
  snomedStructure?: SnomedStructureConcept;
}
