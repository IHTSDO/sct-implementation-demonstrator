import { SnomedStructureConcept } from '../models/tooth.model';

export const FDI_TO_SNOMED_STRUCTURE_MAP: Record<string, SnomedStructureConcept> = {
  '11': { code: '422653006', display: 'Structure of permanent maxillary right central incisor tooth' },
  '12': { code: '424877001', display: 'Structure of permanent maxillary right lateral incisor tooth' },
  '13': { code: '860767006', display: 'Structure of permanent maxillary right canine tooth' },
  '14': { code: '57826002', display: 'Structure of permanent maxillary right first premolar tooth' },
  '15': { code: '36492000', display: 'Structure of permanent maxillary right second premolar tooth' },
  '16': { code: '865995000', display: 'Structure of permanent maxillary right first molar tooth' },
  '17': { code: '863902006', display: 'Structure of permanent maxillary right second molar tooth' },
  '18': { code: '68085002', display: 'Structure of permanent maxillary right third molar tooth' },

  '21': { code: '424399000', display: 'Structure of permanent maxillary left central incisor tooth' },
  '22': { code: '423185002', display: 'Structure of permanent maxillary left lateral incisor tooth' },
  '23': { code: '860780009', display: 'Structure of permanent maxillary left canine tooth' },
  '24': { code: '61897005', display: 'Structure of permanent maxillary left first premolar tooth' },
  '25': { code: '23226009', display: 'Structure of permanent maxillary left second premolar tooth' },
  '26': { code: '865988009', display: 'Structure of permanent maxillary left first molar tooth' },
  '27': { code: '863901004', display: 'Structure of permanent maxillary left second molar tooth' },
  '28': { code: '87704003', display: 'Structure of permanent maxillary left third molar tooth' },

  '31': { code: '425106001', display: 'Structure of permanent mandibular left central incisor tooth' },
  '32': { code: '423331005', display: 'Structure of permanent mandibular left lateral incisor tooth' },
  '33': { code: '860782001', display: 'Structure of permanent mandibular left canine tooth' },
  '34': { code: '2400006', display: 'Structure of permanent mandibular left first premolar tooth' },
  '35': { code: '24573005', display: 'Structure of permanent mandibular left second premolar tooth' },
  '36': { code: '866006002', display: 'Structure of permanent mandibular left first molar tooth' },
  '37': { code: '863898000', display: 'Structure of permanent mandibular left second molar tooth' },
  '38': { code: '74344005', display: 'Structure of permanent mandibular left third molar tooth' },

  '41': { code: '424575004', display: 'Structure of permanent mandibular right central incisor tooth' },
  '42': { code: '423937004', display: 'Structure of permanent mandibular right lateral incisor tooth' },
  '43': { code: '860785004', display: 'Structure of permanent mandibular right canine tooth' },
  '44': { code: '80140008', display: 'Structure of permanent mandibular right first premolar tooth' },
  '45': { code: '8873007', display: 'Structure of permanent mandibular right second premolar tooth' },
  '46': { code: '866005003', display: 'Structure of permanent mandibular right first molar tooth' },
  '47': { code: '863899008', display: 'Structure of permanent mandibular right second molar tooth' },
  '48': { code: '38994002', display: 'Structure of permanent mandibular right third molar tooth' }
};
