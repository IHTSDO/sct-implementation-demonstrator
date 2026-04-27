import { FhirServer } from './fhir-server.interface';

export const environment = {
  production: true,
  fhirServers: [
    { name: 'SNOMED Dev IS',         url: 'https://dev-is-browser.ihtsdotools.org/fhir' },
    { name: 'SNOMED Public',         url: 'https://snowstorm.ihtsdotools.org/fhir' },
    { name: 'SNOMED Dev 2',          url: 'https://snowstorm-temp.kaicode.io/fhir' },
    { name: 'SNOMED Lite Demo',      url: 'https://implementation-demo.snomedtools.org/snowstorm-lite/fhir' },
    { name: 'LOINC Ontology Server', url: 'https://browser.loincsnomed.org/fhir' },
    { name: 'Ontoserver',            url: 'https://r4.ontoserver.csiro.au/fhir' },
    { name: 'SNOMED Dev 1',          url: 'https://dev-browser.ihtsdotools.org/fhir' },
    { name: 'Implementation Demo',   url: 'https://implementation-demo.snomedtools.org/fhir' },
  ] as FhirServer[],
  defaultFhirServerIndex: 1,
};
