/**
 * Shared metadata model for the spec-driven EHDS Patient Summary demonstrator.
 *
 * A section's *structure* (which elements are must-support/obligation, their
 * cardinality and type) is extracted from the HL7 EU EPS FHIR package. A curated
 * config overlay (eps-sections.config.ts) decides which fields to actually show —
 * we deliberately focus on the SNOMED-coded fields plus a few clarifying ones,
 * not every optional element — and supplies the ECL bindings that live in the
 * base EU Core profiles rather than in the EPS obligation profiles.
 *
 * The generator (generate-eps-sections.mjs) merges the two into
 * eps-sections.generated.ts, which the render engine consumes.
 */

export type EpsControlType =
  | 'snomed'    // SNOMED CT autocomplete (app-autocomplete-binding, driven by `binding.ecl`)
  | 'text'      // single-line free text
  | 'textarea'  // multi-line free text
  | 'date'      // date / dateTime picker
  | 'dropdown'; // fixed coded list (FHIR code systems, e.g. clinicalStatus)

export interface EpsCoding {
  code: string;
  system: string;
  display: string;
}

export interface EpsSnomedBinding {
  ecl: string;
  title: string;
  note?: string;
}

/**
 * FHIR element documentation, extracted from the EPS StructureDefinition snapshot.
 * Drives the "FHIR" / "SNOMED" badge popover — the generated equivalent of the
 * hand-written element-definition menus in the Laboratory demo.
 */
export interface EpsElementDoc {
  short?: string;
  definition?: string;
  comment?: string;
  control: string; // cardinality, e.g. "1..1"
  types: string[]; // FHIR type codes
  isModifier: boolean;
  isSummary: boolean;
  invariants: string[]; // constraint keys, e.g. "ele-1"
  bindingText?: string; // human sentence describing the binding
  /** Link to the element's page in the IG definitions. */
  definitionUrl: string;
}

/**
 * Terminology binding, extracted from the snapshot. Drives the "BINDING" /
 * "BINDING (SCT)" badge, which opens the value set page in an embedded dialog.
 */
export interface EpsBindingMeta {
  strength: string; // required | extensible | preferred | example
  valueSet: string; // canonical (version stripped)
  /** Human-facing IG page for the value set (embedded in the dialog). */
  pageUrl: string;
  /** True when the bound value set is SNOMED CT based → "BINDING (SCT)". */
  isSct: boolean;
}

export interface EpsFieldMeta {
  /** Form control key, e.g. `code`, `clinicalStatus`, `onset`. */
  key: string;
  /** FHIR element path this field maps to, e.g. `Condition.code`. */
  path: string;
  /** Human-readable label shown in the form. */
  label: string;
  control: EpsControlType;
  /** Minimum cardinality, taken from the spec when available (drives `required`). */
  min: number;
  /** Maximum cardinality from the spec (`1`, `*`, …). */
  max: string;
  /** True when the EPS profile marks the element must-support / obligation. */
  mustSupport: boolean;
  /** SNOMED ECL binding (control === 'snomed'). */
  binding?: EpsSnomedBinding;
  /** Fixed options (control === 'dropdown'). */
  options?: EpsCoding[];
  /** Default terminology system for coded values (used when writing FHIR). */
  system?: string;
  /** Optional helper text under the field. */
  hint?: string;
  /** FHIR element documentation from the spec (drives the FHIR/SNOMED badge popover). */
  doc?: EpsElementDoc;
  /** Terminology binding from the spec (drives the BINDING / BINDING (SCT) badge). */
  bindingMeta?: EpsBindingMeta;
}

export interface EpsSectionMeta {
  /** Stable key, e.g. `problems`. */
  key: string;
  /**
   * How the section is captured:
   *  - 'resource' (default): repeated coded entries, each producing a FHIR resource.
   *  - 'narrative': a single free-text block stored as the Composition section narrative.
   */
  kind: 'resource' | 'narrative';
  title: string;
  /** LOINC code of the Composition section slice. */
  loincCode: string;
  /** FHIR resource type each entry of this section produces. */
  resourceType: string;
  /** Canonical URL of the EPS profile the entries claim conformance to. */
  profile: string;
  /** Human-facing IG page for the section's profile (embedded in the FHIR dialog). */
  profilePageUrl: string;
  /** Material icon name for the section header. */
  icon: string;
  /** Short description of what the section captures. */
  description: string;
  fields: EpsFieldMeta[];
}
