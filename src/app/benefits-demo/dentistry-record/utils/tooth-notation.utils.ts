import { NotationSystem, ToothNotations } from '../models/tooth.model';

const FDI_TO_UNIVERSAL_MAP: Record<string, number> = {
  '11': 8,
  '12': 7,
  '13': 6,
  '14': 5,
  '15': 4,
  '16': 3,
  '17': 2,
  '18': 1,
  '21': 9,
  '22': 10,
  '23': 11,
  '24': 12,
  '25': 13,
  '26': 14,
  '27': 15,
  '28': 16,
  '31': 24,
  '32': 23,
  '33': 22,
  '34': 21,
  '35': 20,
  '36': 19,
  '37': 18,
  '38': 17,
  '41': 25,
  '42': 26,
  '43': 27,
  '44': 28,
  '45': 29,
  '46': 30,
  '47': 31,
  '48': 32
};

const PALMER_QUADRANT_MAP: Record<string, string> = {
  '1': 'UR',
  '2': 'UL',
  '3': 'LL',
  '4': 'LR'
};

export function convertFDIToNotation(fdi: string, notation: NotationSystem): string {
  if (notation === 'FDI') {
    return fdi;
  }

  if (notation === 'Universal') {
    return String(FDI_TO_UNIVERSAL_MAP[fdi] ?? fdi);
  }

  const quadrant = PALMER_QUADRANT_MAP[fdi[0]] ?? '';
  return `${fdi[1]}${quadrant}`;
}

export function getToothNotations(toothId: string): ToothNotations {
  const fdi = toothId.replace('teeth-', '');

  return {
    fdi,
    universal: convertFDIToNotation(fdi, 'Universal'),
    palmer: convertFDIToNotation(fdi, 'Palmer')
  };
}
