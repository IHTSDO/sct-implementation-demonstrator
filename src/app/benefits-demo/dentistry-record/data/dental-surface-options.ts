import { SnomedConceptOption } from '../models/tooth.model';

export const DENTAL_SURFACE_OPTIONS: SnomedConceptOption[] = [
  { code: '302214001', display: 'Entire tooth', scope: 'tooth' },
  { code: '8483002', display: 'Structure of mesial surface of tooth', scope: 'surface' },
  { code: '90933009', display: 'Structure of distal surface of tooth', scope: 'surface' },
  { code: '83473006', display: 'Structure of occlusal surface of tooth', scope: 'surface' },
  { code: '72203008', display: 'Structure of lingual surface of tooth', scope: 'surface' },
  { code: '62579006', display: 'Structure of vestibular surface of tooth', scope: 'surface' },
  { code: '8711009', display: 'Periodontal tissues', scope: 'periodontalSite' }
];
