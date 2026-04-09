export interface DentalFindingListItem {
  entryType: 'finding' | 'procedure';
  conditionId?: string;
  procedureId?: string;
  toothId: string;
  toothFdi: string;
  toothUniversal: string;
  siteCodes: string[];
  surfaceCode: string;
  surfaceDisplay: string;
  findingCode: string;
  findingDisplay: string;
  clinicalStatusCode: string;
  clinicalStatusDisplay: string;
  isResolved: boolean;
  recordedDateTime: string;
}
