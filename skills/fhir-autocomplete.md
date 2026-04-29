# FHIR Autocomplete — Best Practices Skill

## Purpose

This skill captures the design patterns and implementation decisions for building an autocomplete
input that queries a FHIR **ValueSet/$expand** endpoint in real time. The patterns apply to any
platform or language (web, mobile, server-rendered). They were derived from production experience
building a SNOMED CT concept lookup component and refined through multiple iterations.

---

## Core Concepts

| Term | Meaning |
|------|---------|
| **ValueSet** | A curated set of clinical codes defined in FHIR. The autocomplete queries one to constrain valid selections. |
| **ECL** | SNOMED CT Expression Constraint Language. Defines the scope of a ValueSet (e.g. `<<195967001` = Asthma and all descendants). |
| **Expansion** | The materialized list of codes that satisfy a ValueSet definition, optionally filtered by a text term. Returned by `ValueSet/$expand`. |
| **Concept** | A single entry in an expansion: a `{ code, display }` pair. The autocomplete emits one of these on selection. |
| **Binding** | The association between a form field and a ValueSet — i.e. "this field must contain a code from ValueSet X". |

---

## User-Facing Behavior Contract

The component must guarantee these behaviors regardless of implementation:

1. User types in the input → after a short pause, a dropdown appears with matching concepts.
2. User selects a concept from the dropdown → the input shows the display name; the form receives `{ code, display }`.
3. User clears the input or dismisses the dropdown without selecting → no code is emitted; the form value is `null` / empty.
4. While results are loading → a loading indicator is visible.
5. On API error → the dropdown closes silently; a non-blocking error message is shown; the field remains editable.
6. Input is readonly/disabled → no API calls are made; no dropdown appears.
7. Field is required and left empty → a validation error is shown without breaking the UI.

---

## Search Pipeline

This is the core algorithm. Implement it as a reactive stream or equivalent async sequence.

```
INPUT STREAM
  ├─ source: text changes on the input element
  ├─ debounce(300ms)               // batch rapid keystrokes; 300ms balances UX vs server load
  ├─ distinct()                    // skip duplicate values (e.g. same term re-emitted)
  └─ gate: if term.length < 3      // minimum 3 chars; avoids overly broad or trivial queries
       → emit []
       → stop

BEFORE API CALL
  ├─ set loading = true
  └─ emit [] immediately           // clears stale dropdown results without waiting for API

API CALL
  ├─ GET {fhirBase}/ValueSet/$expand
  │     ?url={valueSetUrl}
  │     &filter={term}
  │     &count=50
  │     &offset=0
  │     (+ language headers if needed)
  └─ cancel this call if a newer term arrives before it resolves
       // use switchMap (RxJS), AbortController (Fetch API), or equivalent

ON RESPONSE
  ├─ extract expansion.contains → array of { code, display, ... }
  ├─ emit that array to the dropdown
  └─ set loading = false

ON ERROR
  ├─ emit []
  ├─ set loading = false
  └─ surface error via centralized handler (snack bar, toast, etc.)
       // do NOT rethrow; do NOT break the pipeline
```

### Why these numbers

- **300 ms debounce** — imperceptible delay for users; cuts API calls by ~10× during normal typing.
- **3-character gate** — single and two-character queries match thousands of concepts and are almost never useful; the gate prevents server hammering and meaningless results.
- **count=50** — large enough to cover common lookups; small enough to keep responses fast. Expose as a configurable input if the use case warrants pagination.

---

## Selection Contract

**The component must distinguish between "text in the input" and "a selected concept".**

```
State A — text present, no selection
  formValue = null (or empty)
  emit nothing to parent

State B — user picks an option from the dropdown
  formValue = { code: "195967001", display: "Asthma" }
  emit selectionChange event with the concept object

State C — user clears the input
  formValue = null
  emit selectionChange with null / empty
```

Never emit `{ code: undefined, display: "asthma" }` just because the user typed text. The code
must come from an explicit dropdown selection.

### Clearing

Provide an explicit clear action (button, keyboard shortcut). On clear:
1. Reset the input text to empty.
2. Reset the internal selected-concept state.
3. Emit null to the parent form.

---

## Error Handling

```
try:
  results = await expandValueSet(...)
catch error:
  log error (for diagnostics)
  results = []                   // fail open — show empty dropdown
  notify user via toast/snack    // non-blocking; centralized handler
finally:
  loading = false
```

**Do not:**
- Throw the error up to the parent component.
- Show an error inside the dropdown itself (use a separate UI surface).
- Leave loading = true on error.

---

## Fuzzy Matching Mode (Optional)

Some terminology servers support fuzzy matching — returning concepts whose display names are
similar to (not just prefixed by) the filter term. This is useful for handling spelling variation,
abbreviations, and clinical shorthand.

**Mechanism:** append a trailing `~` to the filter term before sending it to the server.

```
component input:
  fuzzyMatch?: boolean   // false by default

pipeline — filter term construction:
  effectiveTerm = fuzzyMatch ? term + "~" : term

API CALL:
  GET {fhirBase}/ValueSet/$expand?filter={effectiveTerm}&...
```

### Server compatibility

Not all FHIR servers honour the `~` suffix. Check before enabling:

| Server | Fuzzy support |
|--------|---------------|
| Snowstorm Lite | Yes — `~` enables fuzzy/approximate matching |
| Snowstorm | No — `~` is treated as a literal character |
| Ontoserver | No — `~` is treated as a literal character |
| Other servers | Verify in server documentation |

When `fuzzyMatch` is enabled against an incompatible server, the query may return unexpected
results or an error. Guard this at the service layer: only append `~` when the configured server
is known to support it, or expose it as a server-capability flag in configuration.

### UX consideration

Fuzzy results are broader and less precise. Consider surfacing a visual indicator (e.g. a tilde
icon in the search field) so users understand they are in fuzzy mode and results may be
approximate.

---

## Readonly / Disabled State

When the component is readonly or disabled:

1. The text input must not be editable.
2. No API calls must be triggered — short-circuit the pipeline before it reaches the API call step.
3. The clear button must not be visible.
4. The loading indicator must never appear.
5. Validation errors must still display if they exist (the field can be invalid even when readonly).

If readonly state can change at runtime, re-evaluate the pipeline subscription when it changes.

---

## Multi-Server Support

In multi-tenant or multi-edition deployments, different fields may need to query different FHIR
servers or terminology editions.

```
component inputs:
  terminologyServer?: string   // override base URL (falls back to global config)
  editionUri?: string          // override edition/module URI

service layer:
  if (terminologyServer):
    call expandValueSetFromServer(terminologyServer, editionUri, ecl, term, count)
  else:
    call expandValueSet(ecl, term, count)    // uses globally configured server
```

**Keep server resolution inside the service layer.** Components should not construct FHIR URLs
directly. This allows global config changes (e.g. switching from Snowstorm to Ontoserver) without
touching component code.

---

## Accessibility Checklist

- [ ] Input has a visible label (not just a placeholder).
- [ ] Input has `aria-label` or is associated with a `<label>` element.
- [ ] Clear button has `aria-label="Clear"` (icon buttons have no visible text).
- [ ] Loading state is communicated to screen readers (use `aria-busy` or a live region).
- [ ] After selection, the selected code is surfaced as a hint visible to screen readers.
- [ ] Keyboard users can navigate the dropdown with Arrow keys and select with Enter.
- [ ] Escape closes the dropdown without submitting a selection.
- [ ] Focus returns to the input after the dropdown closes.
- [ ] Error messages are associated with the input via `aria-describedby`.
- [ ] First dropdown option is auto-highlighted to reduce key presses.

---

## FHIR API Reference

### Endpoint

```
GET {fhirBase}/ValueSet/$expand
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | Canonical URL of the ValueSet. For SNOMED CT + ECL: `http://snomed.info/sct?fhir_vs=ecl/{ECL}` |
| `filter` | string | Free-text filter applied to concept display names |
| `count` | integer | Max results to return (default varies by server; recommend 50) |
| `offset` | integer | Pagination offset (default 0) |
| `displayLanguage` | string | BCP-47 language code for display names (e.g. `en`, `es`) |

### Response Shape

```json
{
  "resourceType": "ValueSet",
  "expansion": {
    "total": 142,
    "offset": 0,
    "contains": [
      { "system": "http://snomed.info/sct", "code": "195967001", "display": "Asthma" },
      { "system": "http://snomed.info/sct", "code": "233678006", "display": "Asthma-like disorder" }
    ]
  }
}
```

Extract: `response.expansion.contains ?? []`

### Language Handling

Servers differ in how they accept language preferences:

- **Snowstorm**: accepts `Accept-Language` header (e.g. `en-US;q=1, en;q=0.9`)
- **Ontoserver**: uses `displayLanguage` query parameter

Abstract language resolution into the service layer. The component should only declare which
language it needs (or inherit from global config), not construct headers manually.

---

## Anti-Patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Eager full expansion on component init | Loads thousands of codes into memory; slow initial render | Query on demand with a filter term |
| Emitting `{ code: undefined, display: "text" }` on blur | Propagates invalid data to the form | Only emit on explicit dropdown selection |
| Ignoring request cancellation | Slow query N+1 can overwrite fast query N (race condition) | Use switchMap / AbortController to cancel stale requests |
| Catching errors silently with no user feedback | User doesn't know the search failed | Always surface a non-blocking message |
| Constructing FHIR URLs in the component | Breaks when server changes; duplicates config | Delegate URL construction to the service layer |
| Directly binding input text to form value | Bypasses selection contract; saves arbitrary strings as codes | Maintain separate `inputText` and `selectedConcept` states |
| Skipping readonly propagation | Component makes API calls even when field is read-only | Check disabled/readonly state before triggering the pipeline |
| One-size debounce for all use cases | 300ms is too slow for fast typists on local data; too fast for expensive remote calls | Expose debounce window as a configurable input |
| No minimum character gate | Sends queries like "a" that return 10,000+ results | Gate at 3 characters (adjust for domain; 2 works for short codes) |
| Displaying the code in the input field | Codes like `195967001` are meaningless to users | Display the human-readable `display` string; show code as a secondary hint |

---

## Summary: Decision Checklist

When implementing a new FHIR autocomplete, verify:

- [ ] Search pipeline is debounced (300 ms default)
- [ ] Minimum character gate is enforced (3 chars default)
- [ ] In-flight requests are cancelled when a new term arrives
- [ ] Loading state is shown immediately, cleared on result or error
- [ ] Only explicit selection emits a concept to the parent
- [ ] Errors fail gracefully with user notification
- [ ] Readonly/disabled state suppresses all API activity
- [ ] Service layer owns all FHIR URL construction and language resolution
- [ ] Accessibility checklist is complete
- [ ] Fuzzy match mode is opt-in, off by default, and guarded by a server-capability check
