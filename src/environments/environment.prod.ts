import { FhirServer } from './fhir-server.interface';

export const environment = {
  production: false,
  fhirServers: [
    { name: 'SNOMED Public Snowstorm',         url: 'https://snowstorm.ihtsdotools.org/fhir' },
    { name: 'Snowstorm Lite Demo',      url: 'https://implementation-demo.snomedtools.org/snowstorm-lite/fhir' },
    { name: 'LOINC Ontology Snowstorm', url: 'https://browser.loincsnomed.org/fhir' },
    { name: 'Ontoserver R4 Demo',            url: 'https://r4.ontoserver.csiro.au/fhir' },
    { name: 'Implementation Demo SnowstormX',   url: 'https://implementation-demo.snomedtools.org/fhir' },
  ] as FhirServer[],
  defaultFhirServerIndex: 0,
};
