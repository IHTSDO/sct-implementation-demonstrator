import { Injectable } from '@angular/core';
import { EpsSectionMeta } from './spec/eps-sections.model';

/** A coded value captured by a SNOMED autocomplete or a fixed dropdown. */
export interface EpsCodedValue {
  code: string;
  system: string;
  display: string;
}

/** One captured entry of a section: field key -> value (coded, date string or free text). */
export interface EpsEntry {
  id: string;
  values: Record<string, any>;
}

export interface EpsPatient {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
}

export interface EpsSectionEntries {
  section: EpsSectionMeta;
  entries: EpsEntry[];
  /** Free-text content for narrative sections (kind === 'narrative'). */
  narrative?: string;
}

const SCT = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';

@Injectable({ providedIn: 'root' })
export class EpsFhirService {
  private cc(v?: EpsCodedValue) {
    if (!v || !v.code) return undefined;
    return { coding: [{ system: v.system, code: v.code, display: v.display }], text: v.display };
  }

  private reference(patient: EpsPatient) {
    return { reference: `urn:uuid:${patient.id}`, display: patient.name };
  }

  /** Build a FHIR Narrative from free text, as escaped XHTML. */
  private narrative(text: string) {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    return {
      status: 'additional',
      div: `<div xmlns="http://www.w3.org/1999/xhtml">${escaped}</div>`,
    };
  }

  /**
   * Build the FHIR resource(s) for a single entry of a section. Returns an array
   * whose FIRST element is the resource the Composition section references; any
   * further elements are supporting resources (e.g. a Device backing a
   * DeviceUseStatement).
   */
  buildResource(section: EpsSectionMeta, entry: EpsEntry, patient: EpsPatient): any[] {
    const v = entry.values;
    const subject = this.reference(patient);
    switch (section.resourceType) {
      case 'Condition':
        return [this.prune({
          resourceType: 'Condition',
          id: entry.id,
          meta: { profile: [section.profile] },
          clinicalStatus: this.cc(v['clinicalStatus']),
          category: [
            { coding: [{ system: SCT, code: '55607006', display: 'Problem' }] },
          ],
          severity: this.cc(v['severity']),
          code: this.cc(v['code']),
          subject,
          onsetDateTime: v['onset'] || undefined,
        })];
      case 'AllergyIntolerance':
        return [this.prune({
          resourceType: 'AllergyIntolerance',
          id: entry.id,
          meta: { profile: [section.profile] },
          clinicalStatus: this.cc(v['clinicalStatus']),
          type: v['type']?.code || undefined,
          code: this.cc(v['code']),
          patient: subject,
          onsetDateTime: v['onset'] || undefined,
          reaction: v['manifestation']?.code
            ? [
                this.prune({
                  manifestation: [this.cc(v['manifestation'])],
                  severity: v['reactionSeverity']?.code || undefined,
                }),
              ]
            : undefined,
        })];
      case 'MedicationStatement':
        return [this.prune({
          resourceType: 'MedicationStatement',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'active',
          medicationCodeableConcept: this.cc(v['medication']),
          subject,
          effectiveDateTime: v['effective'] || undefined,
          dosage: v['dosageText'] ? [{ text: v['dosageText'] }] : undefined,
        })];
      case 'Immunization':
        return [this.prune({
          resourceType: 'Immunization',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'completed',
          vaccineCode: this.cc(v['vaccineCode']),
          patient: subject,
          occurrenceDateTime: v['occurrence'] || undefined,
          site: this.cc(v['site']),
        })];
      case 'Procedure':
        return [this.prune({
          resourceType: 'Procedure',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'completed',
          code: this.cc(v['code']),
          subject,
          performedDateTime: v['performed'] || undefined,
          bodySite: v['bodySite']?.code ? [this.cc(v['bodySite'])] : undefined,
        })];
      case 'Flag':
        return [this.prune({
          resourceType: 'Flag',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'active',
          category: v['category']?.code ? [this.cc(v['category'])] : undefined,
          code: this.cc(v['code']),
          subject,
        })];
      case 'Observation':
        // Travel History: code is fixed to LOINC 94651-7, value is the country visited.
        return [this.prune({
          resourceType: 'Observation',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'final',
          code: { coding: [{ system: LOINC, code: '94651-7', display: 'Country of travel' }] },
          subject,
          effectiveDateTime: v['effective'] || undefined,
          valueCodeableConcept: this.cc(v['country']),
        })];
      case 'DeviceUseStatement': {
        const deviceId = this.uuid();
        const device = this.prune({
          resourceType: 'Device',
          id: deviceId,
          meta: { profile: ['http://hl7.eu/fhir/eps/StructureDefinition/device-eu-eps'] },
          type: this.cc(v['deviceType']),
          patient: subject,
        });
        const statement = this.prune({
          resourceType: 'DeviceUseStatement',
          id: entry.id,
          meta: { profile: [section.profile] },
          status: v['status']?.code || 'active',
          subject,
          timingDateTime: v['timing'] || undefined,
          device: { reference: `urn:uuid:${deviceId}` },
          bodySite: this.cc(v['bodySite']),
        });
        return [statement, device];
      }
      default:
        return [];
    }
  }

  /** Assemble a full EPS document Bundle from the captured sections. */
  buildBundle(patient: EpsPatient, sectionEntries: EpsSectionEntries[]): any {
    const now = new Date().toISOString();
    const patientResource = {
      resourceType: 'Patient',
      id: patient.id,
      name: [{ text: patient.name }],
      gender: patient.gender,
      birthDate: patient.birthDate,
    };

    const compositionId = this.uuid();
    const entryResources: any[] = [];
    const sections: any[] = [];

    for (const se of sectionEntries) {
      const code = { coding: [{ system: LOINC, code: se.section.loincCode, display: se.section.title }] };

      // Narrative section: a single free-text block, no entry resources.
      if (se.section.kind === 'narrative') {
        const text = (se.narrative || '').trim();
        if (!text) continue;
        sections.push({ title: se.section.title, code, text: this.narrative(text) });
        continue;
      }

      if (!se.entries.length) continue;
      const references: any[] = [];
      for (const entry of se.entries) {
        const resources = this.buildResource(se.section, entry, patient);
        if (!resources.length) continue;
        // First resource is the one the section references; the rest are supporting.
        references.push({ reference: `urn:uuid:${resources[0].id}` });
        for (const res of resources) entryResources.push(res);
      }
      sections.push({ title: se.section.title, code, entry: references });
    }

    const composition = {
      resourceType: 'Composition',
      id: compositionId,
      meta: { profile: ['http://hl7.eu/fhir/eps/StructureDefinition/composition-eu-eps'] },
      status: 'final',
      type: { coding: [{ system: LOINC, code: '60591-5', display: 'Patient summary Document' }] },
      subject: this.reference(patient),
      date: now,
      title: 'European Patient Summary',
      section: sections,
    };

    const bundleEntries = [
      { fullUrl: `urn:uuid:${compositionId}`, resource: composition },
      { fullUrl: `urn:uuid:${patient.id}`, resource: patientResource },
      ...entryResources.map((r) => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })),
    ];

    return {
      resourceType: 'Bundle',
      meta: { profile: ['http://hl7.eu/fhir/eps/StructureDefinition/bundle-eu-eps'] },
      type: 'document',
      timestamp: now,
      entry: bundleEntries,
    };
  }

  uuid(): string {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const val = c === 'x' ? r : (r & 0x3) | 0x8;
      return val.toString(16);
    });
  }

  /** Remove undefined / empty properties so the FHIR JSON stays clean. */
  private prune(obj: any): any {
    if (Array.isArray(obj)) {
      const arr = obj.map((o) => this.prune(o)).filter((o) => o !== undefined);
      return arr.length ? arr : undefined;
    }
    if (obj && typeof obj === 'object') {
      const out: any = {};
      for (const [k, val] of Object.entries(obj)) {
        const pv = this.prune(val);
        if (pv !== undefined) out[k] = pv;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return obj === '' ? undefined : obj;
  }
}
