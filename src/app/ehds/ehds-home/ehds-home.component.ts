import { Component } from '@angular/core';
import { EHDS_DEMOS } from '../ehds-demos.config';

/**
 * EHDS home page: a short educational introduction to the European Health
 * Data Space, computable implementation guides and SNOMED CT terminology
 * bindings, plus the list of EHDS interactive demonstrators.
 */
@Component({
  selector: 'app-ehds-home',
  templateUrl: './ehds-home.component.html',
  styleUrls: ['./ehds-home.component.css'],
  standalone: false,
})
export class EhdsHomeComponent {
  readonly demos = EHDS_DEMOS;

  readonly aims = [
    { key: 'primary', icon: 'person' },
    { key: 'secondary', icon: 'insights' },
    { key: 'market', icon: 'storefront' },
  ];

  readonly milestones = [
    { year: '2025', key: 'entryIntoForce' },
    { year: '2027', key: 'implementingActs' },
    { year: '2029', key: 'application' },
    { year: '2031', key: 'additionalCategories' },
    { year: '2034', key: 'thirdCountries' },
  ];

  readonly categories = ['patientSummary', 'ePrescription', 'laboratory', 'imaging', 'discharge'];

  readonly buildSteps = ['read', 'generate', 'bind', 'produce'];

  readonly resources = [
    { key: 'regulation', url: 'https://eur-lex.europa.eu/eli/reg/2025/327/oj/eng' },
    { key: 'commission', url: 'https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en' },
    { key: 'epsIg', url: 'https://hl7.eu/fhir/eps/' },
    { key: 'labIg', url: 'https://fhir.ehdsi.eu/laboratory/' },
    { key: 'webinars', url: 'https://snomed.org/snomedct-web-series' },
  ];
}
