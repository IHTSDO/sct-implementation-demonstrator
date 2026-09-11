/**
 * SWEC → FHIR transformation rules (structured, framework-agnostic).
 *
 * This is a machine-readable encoding of the transformation rules published in
 * the SNOMED CT Context Representation Implementation Guide:
 *   - §6.3.2 "Transformations between SWEC and FHIR" (the decision table)
 *   - "FHIR and SWEC Comparison" (the broader mapping table)
 *   https://docs.snomed.org/implementation-guides/context-representation-implementation-guide
 *
 * It is intended to be reusable: the data below (context concepts, attribute
 * codes and the rule table) is plain data with no Angular/FHIR-library
 * dependency, so other implementations can consume or port it directly. The
 * situation-map component is only one consumer.
 *
 * Provenance / fidelity:
 *   - `normative: true`  → the row reproduces the guide's §6.3.2 decision table
 *                          (context/subject/temporal → resource + presets) as
 *                          published.
 *   - `normative: false` → an illustrative extension consistent with the guide's
 *                          comparison table (procedures, family-member
 *                          procedures). The exact FHIR element presets and any
 *                          relaxed matching are a local implementation choice,
 *                          not published verbatim.
 *
 * The list is deliberately not exhaustive; the guide itself frames its table as
 * "an example of a set of transformation rules".
 */

export type ContextKey =
  | 'KnownPresent'
  | 'KnownAbsent'
  | 'KnownPossible'
  | 'SubjectOfRecord'
  | 'PersonInTheFamily'
  | 'InThePast'
  | 'CurrentOrSpecifiedTime'
  | 'Done'
  | 'NotDone';

/** Context axis values referenced by the rules, as SNOMED concepts. */
export const CONTEXT_CONCEPTS: Record<ContextKey, { code: string; display: string }> = {
  KnownPresent: { code: '410515003', display: 'Known present' },
  KnownAbsent: { code: '410516002', display: 'Known absent' },
  KnownPossible: { code: '410590009', display: 'Known possible' },
  SubjectOfRecord: { code: '410604004', display: 'Subject of record' },
  PersonInTheFamily: { code: '303071001', display: 'Person in the family' },
  InThePast: { code: '410513005', display: 'In the past' },
  CurrentOrSpecifiedTime: { code: '410512000', display: 'Current or specified time' },
  Done: { code: '385658003', display: 'Done' },
  NotDone: { code: '385660001', display: 'Not done' },
};

/** SNOMED CT concept-model attribute type codes used to read a situation's normal form. */
export const CONTEXT_ATTRIBUTES = {
  findingContext: '408729009',           // Finding context (attribute)
  procedureContext: '408730004',         // Procedure context (attribute)
  subjectRelationshipContext: '408732007', // Subject relationship context (attribute)
  temporalContext: '408731000',          // Temporal context (attribute)
  associatedFinding: '246090004',        // Associated finding (attribute)
  associatedProcedure: '363589002',      // Associated procedure (attribute)
} as const;

export type SituationDomain = 'finding' | 'procedure';

export type FhirResourceType = 'Condition' | 'Observation' | 'FamilyMemberHistory' | 'Procedure';

export interface ConceptRef {
  code: string;
  display?: string;
}

export interface TransformationRule {
  /** Stable identifier for the rule. */
  id: string;
  /** The parent Situation subhierarchy this row represents in the guide. */
  situation: ConceptRef;
  /** Which pair of attributes drives the mapping (finding vs procedure). */
  domain: SituationDomain;
  /**
   * Matching criteria. Each field names a key in CONTEXT_CONCEPTS that the
   * situation's context value must be subsumed by (self or descendant).
   * `null` means the axis is not constrained.
   */
  match: {
    context: ContextKey | null; // finding context or procedure context
    subject: ContextKey | null; // subject relationship context
    temporal: ContextKey | null; // temporal context
  };
  /** Target FHIR resource, or `null` when the guide maps this to no resource. */
  resource: FhirResourceType | null;
  /** FHIR element presets applied to the generated resource. */
  presets?: {
    clinicalStatus?: string;
    verificationStatus?: string;
    observationStatus?: string;
    procedureStatus?: string;
    familyHistoryStatus?: string;
  };
  /** Human-readable summary of the context combination. */
  contextSummary: string;
  /** Optional clarification shown alongside the rule. */
  note?: string;
  /** true = reproduces the guide's §6.3.2 decision table verbatim. */
  normative: boolean;
  /** Where in the guide the row comes from. */
  guideRef: string;
}

/**
 * Ordered rule table — evaluated top to bottom, first match wins. Order only
 * matters where two rows share every constrained axis but one; the constrained
 * axes below are mutually exclusive, so ordering is stable regardless.
 */
export const TRANSFORMATION_RULES: TransformationRule[] = [
  // ----- Findings → Condition / Observation / FamilyMemberHistory -----
  {
    id: 'history-of-finding',
    situation: { code: '417662000', display: 'History of clinical finding in subject' },
    domain: 'finding',
    match: { context: 'KnownPresent', subject: 'SubjectOfRecord', temporal: 'InThePast' },
    resource: 'Condition',
    presets: { clinicalStatus: 'inactive' },
    contextSummary: 'Known present · Subject of record · In the past',
    normative: true,
    guideRef: '§6.3.2',
  },
  {
    id: 'finding-present',
    situation: { code: '373573001', display: 'Clinical finding present' },
    domain: 'finding',
    match: { context: 'KnownPresent', subject: 'SubjectOfRecord', temporal: 'CurrentOrSpecifiedTime' },
    resource: 'Condition',
    presets: { clinicalStatus: 'active', verificationStatus: 'confirmed' },
    contextSummary: 'Known present · Subject of record · Current',
    normative: true,
    guideRef: '§6.3.2',
  },
  {
    id: 'possible-finding',
    situation: { code: '443859009', display: 'Possible clinical finding' },
    domain: 'finding',
    match: { context: 'KnownPossible', subject: 'SubjectOfRecord', temporal: 'CurrentOrSpecifiedTime' },
    resource: 'Condition',
    presets: { clinicalStatus: 'active', verificationStatus: 'unconfirmed' },
    contextSummary: 'Known possible · Subject of record · Current',
    normative: true,
    guideRef: '§6.3.2',
  },
  {
    id: 'finding-absent',
    situation: { code: '373572006', display: 'Clinical finding absent' },
    domain: 'finding',
    match: { context: 'KnownAbsent', subject: 'SubjectOfRecord', temporal: 'CurrentOrSpecifiedTime' },
    resource: 'Observation',
    presets: { observationStatus: 'registered' },
    contextSummary: 'Known absent · Subject of record · Current',
    normative: true,
    guideRef: '§6.3.2',
  },
  {
    id: 'family-history-of-finding',
    situation: { code: '416471007', display: 'Family history of clinical finding' },
    domain: 'finding',
    match: { context: 'KnownPresent', subject: 'PersonInTheFamily', temporal: null },
    resource: 'FamilyMemberHistory',
    presets: { familyHistoryStatus: 'completed' },
    contextSummary: 'Known present · Person in the family',
    normative: true,
    guideRef: '§6.3.2',
  },
  {
    id: 'no-family-history-of-finding',
    situation: { code: '160266009', display: 'No family history of clinical finding' },
    domain: 'finding',
    match: { context: 'KnownAbsent', subject: 'PersonInTheFamily', temporal: null },
    resource: null,
    contextSummary: 'Known absent · Person in the family',
    note: 'The guide maps a negative family history to no FHIR resource.',
    normative: true,
    guideRef: 'FHIR & SWEC comparison',
  },
  // ----- Procedures → Procedure -----
  {
    id: 'procedure-done',
    situation: { code: '443938003', display: 'Procedure carried out on subject' },
    domain: 'procedure',
    match: { context: 'Done', subject: 'SubjectOfRecord', temporal: null },
    resource: 'Procedure',
    presets: { procedureStatus: 'completed' },
    contextSummary: 'Done · Subject of record',
    note: 'The comparison table lists temporal "Current or specified time"; matching is relaxed to any temporal so historical procedures also map.',
    normative: false,
    guideRef: 'FHIR & SWEC comparison',
  },
  {
    id: 'procedure-not-done',
    situation: { code: '416237000', display: 'Procedure not done' },
    domain: 'procedure',
    match: { context: 'NotDone', subject: 'SubjectOfRecord', temporal: null },
    resource: 'Procedure',
    presets: { procedureStatus: 'not-done' },
    contextSummary: 'Not done · Subject of record',
    normative: false,
    guideRef: 'FHIR & SWEC comparison',
  },
  {
    id: 'procedure-on-family-member',
    situation: { code: '439763000', display: 'Procedure on family member' },
    domain: 'procedure',
    match: { context: null, subject: 'PersonInTheFamily', temporal: null },
    resource: 'Procedure',
    presets: { procedureStatus: 'completed' },
    contextSummary: 'Person in the family',
    note: 'FHIR element presets for a family-member procedure are an implementation choice.',
    normative: false,
    guideRef: 'FHIR & SWEC comparison',
  },
];

const SCT_SYSTEM = 'http://snomed.info/sct';

function sctCoding(concept: ConceptRef) {
  return { system: SCT_SYSTEM, code: concept.code, display: concept.display };
}

/**
 * Build the FHIR resource for a matched rule from the parsed situation.
 * Pure function — no Angular or FHIR-library dependency. Returns `null` when the
 * rule maps to no resource.
 */
export function buildFhirResource(
  rule: TransformationRule,
  input: { associated: ConceptRef; subject?: ConceptRef; patientReference?: string }
): any | null {
  if (!rule.resource) {
    return null;
  }
  const patientReference = input.patientReference ?? 'Patient/1234';

  switch (rule.resource) {
    case 'Condition': {
      const condition: any = {
        resourceType: 'Condition',
        subject: { reference: patientReference },
      };
      if (rule.presets?.clinicalStatus) {
        condition.clinicalStatus = {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: rule.presets.clinicalStatus }],
        };
      }
      if (rule.presets?.verificationStatus) {
        condition.verificationStatus = {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: rule.presets.verificationStatus }],
        };
      }
      condition.code = { coding: [sctCoding(input.associated)] };
      return condition;
    }
    case 'Observation': {
      return {
        resourceType: 'Observation',
        subject: { reference: patientReference },
        status: rule.presets?.observationStatus ?? 'registered',
        code: { coding: [sctCoding(input.associated)] },
        valueCodeableConcept: {
          coding: [sctCoding(CONTEXT_CONCEPTS.KnownAbsent)],
        },
      };
    }
    case 'FamilyMemberHistory': {
      const familyMemberHistory: any = {
        resourceType: 'FamilyMemberHistory',
        status: rule.presets?.familyHistoryStatus ?? 'completed',
        patient: { reference: patientReference },
      };
      if (input.subject) {
        familyMemberHistory.relationship = { coding: [sctCoding(input.subject)] };
      }
      familyMemberHistory.condition = [{ code: { coding: [sctCoding(input.associated)] } }];
      return familyMemberHistory;
    }
    case 'Procedure': {
      return {
        resourceType: 'Procedure',
        subject: { reference: patientReference },
        status: rule.presets?.procedureStatus ?? 'completed',
        code: { coding: [sctCoding(input.associated)] },
      };
    }
  }
  return null;
}
