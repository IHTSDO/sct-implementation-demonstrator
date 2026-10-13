/** Placeholder replaced by the concept selected in the source field of a linked binding. */
export const LINKED_SOURCE_PLACEHOLDER = '{{source}}';

/** Answer types whose options can be derived from another field. */
export const LINKED_TARGET_TYPES = ['Autocomplete', 'Select (Single)', 'Select (Multiple)', 'Options'];

/** Answer types that yield a single SNOMED CT concept and can therefore act as a link source. */
export const LINKED_SOURCE_TYPES = ['Autocomplete', 'Select (Single)', 'Options'];

export type LinkedOperator = '<<' | '<' | '=';

export interface LinkedConcept {
  code: string;
  display: string;
}

export function isLinkedBinding(binding: any): boolean {
  return binding?.answerSource === 'linked' && !!binding?.eclTemplate;
}

export function canBeLinkSource(binding: any): boolean {
  return !!binding?.id &&
    LINKED_SOURCE_TYPES.includes(binding?.type) &&
    !binding?.repeatable &&
    !isLinkedBinding(binding);
}

export function createBindingId(): string {
  return `b-${Math.random().toString(36).slice(2, 10)}`;
}

/** Assigns a stable id to bindings that lack one (older saved forms, examples). */
export function ensureBindingIds(bindings: any[]): void {
  (bindings || []).forEach((binding) => {
    if (binding && !binding.id) {
      binding.id = createBindingId();
    }
  });
}

/** ECL template for the options: the attribute value(s) of the source concept, with the chosen operator. */
export function buildLinkedEclTemplate(operator: LinkedOperator, attribute: LinkedConcept): string {
  const dotted = `${LINKED_SOURCE_PLACEHOLDER}.${attribute.code} |${attribute.display}|`;
  return operator === '=' ? `(${dotted})` : `${operator} (${dotted})`;
}

export function resolveLinkedEcl(template: string, conceptId: string): string {
  return (template || '').split(LINKED_SOURCE_PLACEHOLDER).join(conceptId);
}

/** The default value is only valid when the attribute value itself is part of the options. */
export function linkedOperatorIncludesSelf(operator: LinkedOperator | undefined): boolean {
  return operator !== '<';
}

/** Normalizes a binding selection event into a single concept, or null when nothing is selected. */
export function toLinkedConcept(value: any): LinkedConcept | null {
  const item = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (item && typeof item === 'object' && item.code) {
    return { code: `${item.code}`, display: item.display ?? `${item.code}` };
  }
  return null;
}

/**
 * Focus concepts of an ECL expression, used as MRCM `parentIds`: the SCTIDs before any
 * refinement in each top-level `OR`/`AND` operand. Returns [] for expressions it cannot
 * read (member-of, wildcards), so callers fall back to a free attribute picker.
 */
export function extractFocusConceptIds(ecl: string): string[] {
  const withoutTerms = (ecl || '').replace(/\|[^|]*\|/g, ' ');
  if (!withoutTerms.trim() || withoutTerms.includes('^')) {
    return [];
  }
  const withoutExclusions = withoutTerms.split(/\bMINUS\b/i)[0];
  const ids = new Set<string>();
  withoutExclusions.split(/\b(?:OR|AND)\b/i).forEach((operand) => {
    const focus = operand.split(':')[0];
    (focus.match(/\d{6,18}/g) ?? []).forEach((id) => ids.add(id));
  });
  return Array.from(ids);
}
