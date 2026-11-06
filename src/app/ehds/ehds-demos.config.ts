/**
 * Interactive demonstrators listed on the EHDS home page (/ehds).
 *
 * To add a new EHDS demonstrator, append an entry here and add its
 * `demos.<key>.title` / `demos.<key>.description` translations to
 * src/assets/i18n/ehds/ehds-{lang}.json.
 */
export interface EhdsDemo {
  /** Translation key under `demos.` and stable identifier. */
  key: string;
  /** In-app route of the demonstrator. */
  route: string;
  /** Material icon name. */
  icon: string;
  /** Specifications the demo is built on (proper names, not translated). */
  specs: string[];
}

export const EHDS_DEMOS: EhdsDemo[] = [
  {
    key: 'patientSummary',
    route: '/ehds-patient-summary',
    icon: 'summarize',
    specs: ['HL7 Europe Patient Summary', 'FHIR R4'],
  },
  {
    key: 'laboratory',
    route: '/ehds-laboratory-demo',
    icon: 'biotech',
    specs: ['MyHealth@EU Laboratory', 'FHIR R4'],
  },
];
