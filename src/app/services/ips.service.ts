import { Injectable } from '@angular/core';
import type {
  AllergyIntolerance,
  Condition,
  Encounter,
  FhirObservation,
  MedicationStatement,
  Patient,
  Procedure,
  ServiceRequest,
} from '../model';

interface IpsBundleEntry {
  fullUrl: string;
  resource: any;
}

interface IpsSectionDefinition {
  key: keyof IpsSectionEntries;
  title: string;
  code: string;
  display: string;
  placeholder?: () => IpsBundleEntry;
}

interface IpsSectionEntries {
  conditions: Array<{ reference: string }>;
  allergies: Array<{ reference: string }>;
  medications: Array<{ reference: string }>;
  procedures: Array<{ reference: string }>;
  observations: Array<{ reference: string }>;
  encounters: Array<{ reference: string }>;
  serviceRequests: Array<{ reference: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class IpsService {
  private static readonly IPS_BUNDLE_PROFILE = 'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips';
  private static readonly IPS_ABSENT_UNKNOWN_SYSTEM = 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips';
  private static readonly NARRATIVE_LINK_URL = 'http://hl7.org/fhir/StructureDefinition/narrativeLink';

  generateIpsBundle(input: {
    patient: Patient;
    conditions: Condition[];
    procedures: Procedure[];
    medications: MedicationStatement[];
    allergies: AllergyIntolerance[];
    observations?: FhirObservation[];
    encounters?: Encounter[];
    serviceRequests?: ServiceRequest[];
  }): any {
    const generatedAt = new Date().toISOString();
    const bundleId = this.createUuid();
    const compositionId = this.createUuid();
    const compositionFullUrl = `urn:uuid:${compositionId}`;
    const organizationId = this.createUuid();
    const organizationFullUrl = `urn:uuid:${organizationId}`;
    const patientFullUrl = input.patient.id ? `Patient/${input.patient.id}` : `urn:uuid:${this.createUuid()}`;
    const displayDate = this.formatDisplayDate(generatedAt);

    const entries: IpsBundleEntry[] = [];
    const sectionEntries: IpsSectionEntries = {
      conditions: [] as Array<{ reference: string }>,
      allergies: [] as Array<{ reference: string }>,
      medications: [] as Array<{ reference: string }>,
      procedures: [] as Array<{ reference: string }>,
      observations: [] as Array<{ reference: string }>,
      encounters: [] as Array<{ reference: string }>,
      serviceRequests: [] as Array<{ reference: string }>,
    };

    entries.push({
      fullUrl: patientFullUrl,
      resource: input.patient
    });

    input.conditions
      .filter((condition) => condition.verificationStatus?.coding?.[0]?.code !== 'entered-in-error')
      .forEach((condition) => {
        const fullUrl = `urn:uuid:condition-${condition.id}`;
        entries.push({
          fullUrl,
          resource: this.withNarrativeLink(condition, compositionFullUrl, `Condition-${fullUrl}`)
        });
        sectionEntries.conditions.push({ reference: fullUrl });
      });

    input.allergies
      .filter((allergy) => allergy.verificationStatus?.coding?.[0]?.code !== 'entered-in-error')
      .forEach((allergy) => {
        const fullUrl = `urn:uuid:allergy-${allergy.id}`;
        entries.push({
          fullUrl,
          resource: this.withNarrativeLink(allergy, compositionFullUrl, `AllergyIntolerance-${fullUrl}`)
        });
        sectionEntries.allergies.push({ reference: fullUrl });
      });

    input.medications
      .filter((medication) => medication.status !== 'entered-in-error')
      .forEach((medication) => {
        const fullUrl = `urn:uuid:medication-${medication.id}`;
        entries.push({
          fullUrl,
          resource: this.withNarrativeLink(medication, compositionFullUrl, `MedicationStatement-${fullUrl}`)
        });
        sectionEntries.medications.push({ reference: fullUrl });
      });

    input.procedures
      .filter((procedure) => procedure.status !== 'entered-in-error')
      .forEach((procedure) => {
        const fullUrl = `urn:uuid:procedure-${procedure.id}`;
        entries.push({
          fullUrl,
          resource: this.withNarrativeLink(procedure, compositionFullUrl, `Procedure-${fullUrl}`)
        });
        sectionEntries.procedures.push({ reference: fullUrl });
      });

    (input.observations || []).forEach((observation) => {
      const fullUrl = `urn:uuid:observation-${observation.id}`;
      entries.push({
        fullUrl,
        resource: this.withNarrativeLink(observation, compositionFullUrl, `Observation-${fullUrl}`)
      });
      sectionEntries.observations.push({ reference: fullUrl });
    });

    (input.encounters || []).forEach((encounter) => {
      const fullUrl = `urn:uuid:encounter-${encounter.id}`;
      entries.push({
        fullUrl,
        resource: this.withNarrativeLink(encounter, compositionFullUrl, `Encounter-${fullUrl}`)
      });
      sectionEntries.encounters.push({ reference: fullUrl });
    });

    (input.serviceRequests || []).forEach((serviceRequest) => {
      const fullUrl = `urn:uuid:service-request-${serviceRequest.id}`;
      entries.push({
        fullUrl,
        resource: this.withNarrativeLink(serviceRequest, compositionFullUrl, `ServiceRequest-${fullUrl}`)
      });
      sectionEntries.serviceRequests.push({ reference: fullUrl });
    });

    const sectionDefinitions: IpsSectionDefinition[] = [
      {
        key: 'allergies',
        title: 'Allergies and Intolerances',
        code: '48765-2',
        display: 'Allergies and adverse reactions Document',
        placeholder: () => this.createNoAllergyInfoResource(patientFullUrl, compositionFullUrl),
      },
      {
        key: 'medications',
        title: 'Medication List',
        code: '10160-0',
        display: 'History of Medication use Narrative',
        placeholder: () => this.createNoMedicationInfoResource(patientFullUrl, compositionFullUrl),
      },
      {
        key: 'conditions',
        title: 'Problem List',
        code: '11450-4',
        display: 'Problem list - Reported',
      },
      {
        key: 'procedures',
        title: 'Procedures',
        code: '47519-4',
        display: 'History of Procedures Document',
      },
      {
        key: 'observations',
        title: 'Results',
        code: '30954-2',
        display: 'Relevant diagnostic tests and/or laboratory data',
      },
      {
        key: 'encounters',
        title: 'Encounters',
        code: '46240-8',
        display: 'Encounters',
      },
      {
        key: 'serviceRequests',
        title: 'Plan of care',
        code: '18776-5',
        display: 'Plan of care note',
      }
    ];

    sectionDefinitions.forEach((definition) => {
      const references = sectionEntries[definition.key];
      if (references.length === 0 && definition.placeholder) {
        const placeholderEntry = definition.placeholder();
        entries.push(placeholderEntry);
        references.push({ reference: placeholderEntry.fullUrl });
      }
    });

    const organization = {
      resourceType: 'Organization',
      id: organizationId,
      name: 'EHR Lab IPS Generator'
    };

    const sections = sectionDefinitions
      .map((definition) => this.buildSection(definition.title, definition.code, definition.display, sectionEntries[definition.key]))
      .filter(Boolean);

    const composition = {
      resourceType: 'Composition',
      id: compositionId,
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><h1>International Patient Summary Document</h1></div>'
      },
      status: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '60591-5',
            display: 'Patient summary Document'
          }
        ]
      },
      subject: {
        reference: patientFullUrl
      },
      date: generatedAt,
      author: [
        {
          reference: organizationFullUrl
        }
      ],
      title: `Patient Summary as of ${displayDate}`,
      confidentiality: 'N',
      section: sections
    };

    return {
      resourceType: 'Bundle',
      meta: {
        profile: [IpsService.IPS_BUNDLE_PROFILE]
      },
      identifier: {
        system: 'urn:ietf:rfc:4122',
        value: bundleId
      },
      type: 'document',
      timestamp: generatedAt,
      entry: [
        {
          fullUrl: compositionFullUrl,
          resource: composition
        },
        {
          fullUrl: organizationFullUrl,
          resource: organization
        },
        ...entries
      ]
    };
  }

  private buildSection(
    title: string,
    code: string,
    display: string,
    entries: Array<{ reference: string }>
  ): any | null {
    if (entries.length === 0) {
      return null;
    }

    return {
      title,
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code,
            display
          }
        ]
      },
      entry: entries
    };
  }

  private createNoAllergyInfoResource(patientReference: string, compositionReference: string): IpsBundleEntry {
    const fullUrl = `urn:uuid:${this.createUuid()}`;
    return {
      fullUrl,
      resource: this.withNarrativeLink({
        resourceType: 'AllergyIntolerance',
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: 'active'
            }
          ]
        },
        code: {
          coding: [
            {
              system: IpsService.IPS_ABSENT_UNKNOWN_SYSTEM,
              code: 'no-allergy-info',
              display: 'No information about allergies'
            }
          ]
        },
        patient: {
          reference: patientReference
        }
      }, compositionReference, `AllergyIntolerance-${fullUrl}`)
    };
  }

  private createNoMedicationInfoResource(patientReference: string, compositionReference: string): IpsBundleEntry {
    const fullUrl = `urn:uuid:${this.createUuid()}`;
    return {
      fullUrl,
      resource: this.withNarrativeLink({
        resourceType: 'MedicationStatement',
        status: 'unknown',
        medicationCodeableConcept: {
          coding: [
            {
              system: IpsService.IPS_ABSENT_UNKNOWN_SYSTEM,
              code: 'no-medication-info',
              display: 'No information about medications'
            }
          ]
        },
        subject: {
          reference: patientReference
        }
      }, compositionReference, `MedicationStatement-${fullUrl}`)
    };
  }

  private withNarrativeLink<T>(resource: T, compositionReference: string, anchorId: string): T {
    const resourceWithOptionalExtension = resource as T & { extension?: any[] };
    return {
      ...resourceWithOptionalExtension,
      extension: [
        ...(resourceWithOptionalExtension.extension || []),
        {
          url: IpsService.NARRATIVE_LINK_URL,
          valueUrl: `${compositionReference}#${anchorId}`
        }
      ]
    } as T;
  }

  private createUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      const value = char === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  private formatDisplayDate(dateIso: string): string {
    const date = new Date(dateIso);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
}
