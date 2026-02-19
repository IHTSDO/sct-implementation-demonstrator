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
  scope: FindingScope;
}

// FindingScope describes the level at which a finding applies
export type FindingScope =
  | 'surface'          // Level 2 - tooth surfaces (M/D/O/V/L)
  | 'tooth'            // Level 1 - whole tooth
  | 'periodontalSite'  // Periodontal chart sites (MB/B/DB/ML/L/DL)
  | 'global';          // Not part of the per-tooth odontogram

export interface ToothFindingEntry {
  siteCodes?: string[];
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
