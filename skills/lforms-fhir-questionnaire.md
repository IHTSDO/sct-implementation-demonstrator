# LForms FHIR Questionnaire Integration — Best Practices Skill

## Purpose

This skill captures the design patterns and implementation decisions for embedding NLM's LForms
library to render FHIR R4 Questionnaires and extract structured clinical results — including
QuestionnaireResponse and SDC (Structured Data Capture) observation extraction. The patterns apply
to any web framework. They were derived from production experience in a multi-questionnaire clinical
demonstrator and refined through multiple iterations.

---

## Core Concepts

| Term | Meaning |
|------|---------|
| **LForms** | NLM's open-source library that renders FHIR Questionnaires as interactive forms via a web component (`<wc-lhc-form>`) and a JavaScript utility API (`LForms.Util.*`). |
| **Questionnaire** | A FHIR R4 resource that defines form structure — groups, questions, answer options, and SDC extensions. |
| **QuestionnaireResponse** | A FHIR resource capturing a patient's answers. Produced by `LForms.Util.getFormFHIRData()`. |
| **SDC** | HL7 Structured Data Capture — a FHIR implementation guide that extends Questionnaire with extraction rules, enabling automatic creation of Observations and Conditions from answers. |
| **ObservationExtract** | An SDC extension (`sdc-questionnaire-observationExtract`) on a Questionnaire item that flags it for automatic extraction into an Observation resource. |
| **addFormToPage** | The primary LForms API call that injects a rendered form into a named DOM container. |

---

## Dependency Loading

LForms is **not distributed via npm**. Load it at runtime from the NLM CDN. This avoids bundling
a large library and allows version pinning without re-deploying the application.

### Two-stage sequential loading

LForms requires two scripts loaded in strict order:

```
Stage 1 — Web Component
  GET https://clinicaltables.nlm.nih.gov/lforms-versions/{VERSION}/webcomponent/lhc-forms.js
  → registers the <wc-lhc-form> custom element
  → exposes LForms.Util base API

Stage 2 — FHIR Utilities  (load ONLY after Stage 1 completes)
  GET https://clinicaltables.nlm.nih.gov/lforms-versions/{VERSION}/fhir/R4/lformsFHIR.min.js
  → extends LForms.Util with FHIR R4 methods (addFormToPage, getFormFHIRData, etc.)
```

Stage 2 must be initiated from Stage 1's `onload` callback, not in parallel. Loading them
simultaneously or in the wrong order causes `LForms.Util.getFormFHIRData` to be undefined.

```
loadLFormsLibrary():
  if LForms is already defined → return early   // guard against double-load

  script1 = createScriptElement(CDN_BASE + "webcomponent/lhc-forms.js")
  script1.onload = () =>
    script2 = createScriptElement(CDN_BASE + "fhir/R4/lformsFHIR.min.js")
    script2.onload = () → mark library as ready
    append script2 to document.head

  append script1 to document.head
```

### Version pinning

Pin the version explicitly in the CDN URL (e.g. `36.3.2`). Do not use a `latest` alias — LForms
introduces breaking changes between minor versions.

### When to trigger loading

Load the scripts **as early as possible in the page lifecycle** (application init or the
component's constructor/created hook), not at form-render time. Script download takes hundreds of
milliseconds; triggering it on first user interaction causes a visible delay.

---

## Styles

### Global stylesheet

Load the LForms stylesheet **globally**, not scoped to a component:

```html
<link rel="stylesheet"
  href="https://clinicaltables.nlm.nih.gov/lforms-versions/{VERSION}/webcomponent/styles.css">
```

Place this in the document `<head>`. LForms injects DOM directly into a container div; styles must
be available at the document level or they will not reach the injected elements.

### Component-level container styling

Style the host container (not LForms internals):

```css
.lforms-container {
  margin: 24px;
  min-height: 200px;   /* prevents layout jump while form loads */
}

.lforms-container.loading {
  display: none;       /* hide container until form is ready */
}
```

### Framework scoping caveat

If your framework scopes component CSS (e.g. Angular's ViewEncapsulation.Emulated), LForms-injected
DOM will **not** receive those scoped styles. Use global styles or the framework's equivalent of
`::ng-deep` / `:global()` only when you need to override LForms defaults. Prefer wrapping
overrides in a container selector to limit blast radius.

---

## TypeScript / Type Declarations

LForms has no official type package. Declare it globally as `any`:

```typescript
declare var LForms: any;
```

Place this in a global typings file (e.g. `typings.d.ts`) so it's available project-wide.
All call sites must also guard against `undefined` at runtime (see below).

### Framework web component registration

Frameworks that validate HTML element names at compile time need to be told that `<wc-lhc-form>`
is a valid custom element:

- **Angular**: add `CUSTOM_ELEMENTS_SCHEMA` to the module's `schemas` array.
- **Vue / React**: no schema config needed; unknown elements are passed through by default.

---

## Rendering the Form

### Container pattern

Render each form into a dedicated DOM container identified by a unique ID. Never share a container
between two form instances — LForms does not clean up the previous form on its own.

```
containerId = "lforms-" + generateUniqueId()   // e.g. UUID or random suffix
```

If the same component can be instantiated multiple times on the same page (tabs, lists), generate
a new ID per instance in the constructor/created hook.

### Render sequence

```
renderForm(questionnaire, containerId):

  1. Guard checks (fail fast, no side effects):
     - if questionnaire is null/undefined → set formRendered = false; return
     - if LForms is undefined → set formRendered = false; return
     - container = document.getElementById(containerId)
     - if container is null → set formRendered = false; return

  2. Clear the container:
     container.innerHTML = ""
     // Required: LForms appends rather than replaces. Clearing prevents ghost elements
     // when the questionnaire prop changes.

  3. Yield to the browser paint cycle:
     await delay(~100ms)
     // Ensures the cleared container is committed to the DOM before LForms reads it.
     // Without this delay, LForms may inject into a stale DOM snapshot.

  4. Render:
     try:
       LForms.Util.addFormToPage(questionnaire, containerId)
       formRendered = true
     catch error:
       log error
       formRendered = false

  5. Trigger change detection if the framework requires it
     (e.g. Angular: cdr.detectChanges())
```

### Re-rendering on questionnaire change

If the questionnaire input can change after initial render (e.g. user selects a different form),
run the full render sequence again — clear, delay, addFormToPage. Do not assume the library
handles updates; treat every questionnaire change as a fresh render.

### Lazy rendering

If the form is inside a tab or collapsible panel, defer the render until the container becomes
visible. Rendering into a `display: none` element causes layout issues in some LForms versions.
Trigger `renderForm()` on tab activation, not on component initialization.

---

## Capturing Results

### QuestionnaireResponse extraction

```
getQuestionnaireResponse(containerId):
  if LForms is undefined → return null
  if formRendered is false → return null

  try:
    formData = LForms.Util.getFormFHIRData(
      "QuestionnaireResponse",   // resource type to extract
      "R4",                      // FHIR version
      containerId                // container where form was rendered
    )
    return formData              // FHIR R4 QuestionnaireResponse resource
  catch error:
    log error
    return null
```

`getFormFHIRData` returns a fully formed FHIR QuestionnaireResponse with `item` arrays. Call it
at submission time (button click, step navigation), not continuously.

### Response structure

```json
{
  "resourceType": "QuestionnaireResponse",
  "status": "completed",
  "item": [
    {
      "linkId": "vital-signs-group",
      "item": [
        {
          "linkId": "body-weight",
          "answer": [{ "valueQuantity": { "value": 72, "unit": "kg" } }]
        }
      ]
    }
  ]
}
```

Key notes:
- FHIR uses `item` (singular) at every level; LForms' internal format uses `items` (plural). After
  calling `getFormFHIRData` you receive standard FHIR structure (`item`).
- Unanswered items may be omitted or present with an empty `answer` array, depending on the
  Questionnaire's `required` flags and the LForms version. Handle both.
- `answer` is always an array even for single-answer questions.

---

## SDC Data Extraction

SDC's ObservationExtract profile allows Questionnaire items to be flagged for automatic extraction
into Observation (or Condition) resources. This is the recommended way to produce clinical data
from questionnaire answers.

### Detecting extractable items

Walk the QuestionnaireResponse items recursively. For each item, check the corresponding
Questionnaire item's extensions:

```
isExtractable(questionnaireItem):
  return questionnaireItem.extension contains:
    url == "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract"
    AND (valueBoolean == true OR valueCode is non-empty string)
```

### Extracting an Observation

For each extractable item with a numeric or coded answer:

```
createObservation(questionnaireItem, responseItem, patientReference):
  obs = {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [ questionnaireItem.code[0] ]   // LOINC or SNOMED code on the item
    },
    subject: patientReference,
    effectiveDateTime: now(),
    valueQuantity or valueCodeableConcept: extracted from responseItem.answer[0]
  }
  return obs
```

### Blood pressure / composite vital signs

Blood pressure is modelled as a composite Observation with `component` entries, not two separate
Observations. When two sibling items share the same parent group and one carries a systolic LOINC
code (8480-6) and the other a diastolic code (8462-4):

```
createBloodPressureObservation(systolicItem, diastolicItem, patientReference):
  obs = {
    resourceType: "Observation",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure" }] },
    subject: patientReference,
    effectiveDateTime: now(),
    component: [
      {
        code: { coding: [{ system: "http://loinc.org", code: "8480-6" }] },
        valueQuantity: { value: systolicValue, unit: "mmHg", system: "http://unitsofmeasure.org" }
      },
      {
        code: { coding: [{ system: "http://loinc.org", code: "8462-4" }] },
        valueQuantity: { value: diastolicValue, unit: "mmHg", system: "http://unitsofmeasure.org" }
      }
    ]
  }
```

Detect the pattern by inspecting item codes before extraction, not by item order or display text.

### Extracting Conditions

Items flagged for Condition extraction (e.g. risk factors, diagnoses) follow the same extension
detection pattern. Extract a FHIR Condition resource:

```
createCondition(questionnaireItem, responseItem, patientReference):
  coding = responseItem.answer[0].valueCoding
  condition = {
    resourceType: "Condition",
    clinicalStatus: { coding: [{ code: "active" }] },
    code: { coding: [coding] },
    subject: patientReference,
    recordedDate: now()
  }
  return condition
```

### Numeric value extraction

Questionnaire answers carry values in heterogeneous shapes. Normalize before arithmetic:

```
extractNumericValue(value):
  if value is a finite number → return value
  if value is a string → return parseFloat(value) if finite, else null
  if value is an array → return extractNumericValue(value[0])
  if value has .value property → return extractNumericValue(value.value)
  return null
```

---

## Error Handling

| Stage | What can fail | Recommended handling |
|-------|--------------|----------------------|
| Script loading | Network error, CDN unavailable | Show "form unavailable" state; retry or show static fallback |
| `addFormToPage` | Malformed questionnaire JSON, container missing | try/catch; set `formRendered = false`; log error |
| `getFormFHIRData` | LForms not loaded, container cleared prematurely | Guard with `typeof LForms !== 'undefined'` and `formRendered`; return null on failure |
| SDC extraction | Missing extension, unexpected value type | Skip the item; log a warning; never throw from the extraction loop |
| Saving to FHIR server | Network error | Show non-blocking error toast; do not discard the QuestionnaireResponse |

Never let an LForms error propagate to the top-level error handler uncaught — the library can
throw on edge-case Questionnaire structures. Wrap every `LForms.Util.*` call in try/catch.

---

## Multi-Instance Support

If multiple questionnaires can be rendered simultaneously (e.g. a wizard with several steps
visible at once, or a list of forms):

- Generate a unique container ID **per component instance** at construction time, not at render time.
- Store `containerId` as instance state, not a shared constant.
- When the component is destroyed, clear the container's `innerHTML` to release DOM references
  held by LForms.

```
onDestroy():
  container = document.getElementById(containerId)
  if container → container.innerHTML = ""
```

---

## Anti-Patterns

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| Loading Stage 2 script in parallel with Stage 1 | `LForms.Util.getFormFHIRData` is undefined | Chain Stage 2 inside Stage 1's `onload` |
| Triggering script load on first form render | Visible delay for the user | Load scripts at application/component init |
| Calling `addFormToPage` without clearing the container first | Ghost elements accumulate on re-render | `container.innerHTML = ""` before every `addFormToPage` call |
| Calling `addFormToPage` synchronously after clearing | LForms reads a stale/empty DOM snapshot | Add ~100ms delay between clear and render |
| Sharing a container ID across multiple instances | Forms overwrite each other silently | Generate a unique ID per instance |
| Calling `getFormFHIRData` before `formRendered` is true | Returns empty or throws | Guard with `formRendered` flag |
| Using `getFormData` instead of `getFormFHIRData` | Returns LForms internal format, not FHIR | Always use `getFormFHIRData("QuestionnaireResponse", "R4", id)` for FHIR output |
| Extracting SDC data by item position or display text | Brittle; breaks when questionnaire is reordered | Detect extractable items by their extension URL and item code |
| Scoping the LForms stylesheet to a component | Styles don't reach LForms-injected DOM | Load stylesheet globally |
| Rendering into a hidden / `display:none` container | Layout issues in some LForms versions | Defer render until the container is visible |

---

---

## SDC Pre-population (Questionnaire Population)

SDC Population is the reverse of extraction: pre-filling a rendered questionnaire with data already
in the patient record, so clinicians don't re-enter values that are already known.

### Pre-population API — CRITICAL

**Do NOT use the `fhirQuestionnaireResponse` option of `addFormToPage`:**

```
// ❌ WRONG — LForms silently ignores the option; answers never appear
LForms.Util.addFormToPage(questionnaire, containerId, { fhirQuestionnaireResponse: qr });
```

**Use the three-step merge instead:**

```
// ✅ CORRECT
lfData = LForms.Util.convertFHIRQuestionnaireToLForms(questionnaire, "R4")
merged = LForms.Util.mergeFHIRDataIntoLForms("QuestionnaireResponse", qr, lfData, "R4")
LForms.Util.addFormToPage(merged, containerId)
```

`mergeFHIRDataIntoLForms` requires a fully formed QuestionnaireResponse with `item` arrays.
Passing a partial QR (only the items that have answers) is sufficient — unanswered items are left
blank.

### setFHIRContext before merge

If you call `mergeFHIRDataIntoLForms` without first calling `setFHIRContext`, LForms logs:

```
Warning: FHIR resources might not be loaded, because loadFHIRResources() was called
before LForms.Util.setFHIRContext()
```

Fix: call `setFHIRContext` with the configured FHIR server base URL before the merge step:

```
if (typeof LForms.Util.setFHIRContext === "function") {
  LForms.Util.setFHIRContext({ baseUrl: fhirBaseUrl });
}
```

Only call it when you actually have a QR to merge; skip it on plain renders.

### Three population strategies

#### Strategy 1a — Observation lookup (`sdc-questionnaire-observationLinkPeriod`, non-choice items)

Items with this extension AND a `code` array are linked to recent Observations. Fetch by code,
filter to the declared time window, map the most recent value to a QR answer.

Extension URL: `http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationLinkPeriod`
Value type: `valueDuration` (fields: `value`, `code` — UCUM unit codes: `a`=year, `mo`=month,
`wk`=week, `d`=day)

```json
{
  "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationLinkPeriod",
  "valueDuration": { "value": 1, "unit": "year", "system": "http://unitsofmeasure.org", "code": "a" }
}
```

Observation → QR answer mapping:
| Observation field | QR answer field |
|---|---|
| `valueQuantity` | `valueQuantity` |
| `valueCodeableConcept.coding[0]` | `valueCoding` |
| `valueString` | `valueString` |
| `valueBoolean` | `valueBoolean` |
| `valueInteger` | `valueInteger` |
| `valueDecimal` | `valueDecimal` |

#### Strategy 1b — Condition lookup (`sdc-questionnaire-observationLinkPeriod`, choice items)

For `choice`-type items, the relevant clinical resource is **Condition**, not Observation (e.g.
risk factors, diagnoses extracted by SDC). Match against the item's `answerOption[].valueCoding`
codings, not the item's own code. Return all matching active conditions as a multi-select answer.

```
// For each condition in patient record:
//   coding = condition.code.coding[0]
//   match  = answerOption whose system+code equals coding.system+coding.code
//   if match → include { valueCoding: matchedAnswerOption } in QR answers
```

The `observationLinkPeriod` cutoff is applied using `condition.onsetDateTime ?? condition.recordedDate`.

#### Strategy 2 — Patient demographics (`sdc-questionnaire-initialExpression`)

Questionnaire must declare a Patient launch context at the root level:

```json
{
  "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-launchContext",
  "extension": [
    { "url": "name", "valueCoding": { "code": "patient" } },
    { "url": "type", "valueCode": "Patient" }
  ]
}
```

Items with `sdc-questionnaire-initialExpression` (FHIRPath, language `text/fhirpath`) are
evaluated against the Patient resource. Supported expressions:

| Expression | Maps to |
|---|---|
| `%patient.birthDate` | `Patient.birthDate` |
| `%patient.gender` | `Patient.gender` |
| `%patient.name.where(use='official').family` | official name family |
| `%patient.name.where(use='official').given.first()` | official given[0] |
| `%patient.identifier.where(system='<url>').value` | identifier value for system |

A full FHIRPath engine is not required; simple string matching on the expression handles all
common demographic cases.

#### Strategy 3 — Previous QuestionnaireResponse

If the questionnaire has a `url`, find the most recent QuestionnaireResponse for the same patient
and questionnaire URL. Use its items as initial answers (strategies 1 and 2 override on conflict).

Sort by `authored` descending; take the first match.

### Population priority (highest wins)

```
Strategy 1 (Observation / Condition lookup)   ← freshest clinical data
Strategy 2 (Patient demographics)
Strategy 3 (Previous QR)                      ← continuity fallback
```

### Fallback on merge failure

Wrap the entire merge+render block in try/catch. On failure, fall back to plain `addFormToPage`
without a QR so the form always renders:

```
try:
  lfData  = convertFHIRQuestionnaireToLForms(questionnaire, "R4")
  merged  = mergeFHIRDataIntoLForms("QuestionnaireResponse", qr, lfData, "R4")
  addFormToPage(merged, containerId)
catch:
  addFormToPage(questionnaire, containerId)   // plain render, no pre-population
```

### Storage-mode independence

Population reads should use the application's patient data abstraction (e.g. `PatientService`),
not raw FHIR HTTP calls. This ensures pre-population works in both localStorage mode and FHIR
server mode without extra guards.

---

## Summary: Decision Checklist

When integrating LForms into a new page or feature, verify:

- [ ] Both CDN scripts are listed and loaded sequentially (Stage 1 → Stage 2)
- [ ] Script loading is triggered at init time, not at first render
- [ ] A double-load guard is in place (`typeof LForms !== 'undefined'`)
- [ ] The LForms CSS is loaded globally (document `<head>`)
- [ ] `CUSTOM_ELEMENTS_SCHEMA` (or equivalent) is registered in the framework module
- [ ] `declare var LForms: any` is available globally
- [ ] Each form instance has a unique, stable container ID
- [ ] Container is cleared before each `addFormToPage` call
- [ ] A ~100ms delay separates the clear from the render call
- [ ] `formRendered` flag guards all `getFormFHIRData` calls
- [ ] Every `LForms.Util.*` call is wrapped in try/catch
- [ ] SDC extraction uses extension URL detection, not item position
- [ ] Composite vital signs (blood pressure) are aggregated into a single Observation with components
- [ ] Component cleanup clears the container on destroy
- [ ] Pre-population uses `convertFHIRQuestionnaireToLForms` + `mergeFHIRDataIntoLForms`, NOT `fhirQuestionnaireResponse` option
- [ ] `setFHIRContext` is called before `mergeFHIRDataIntoLForms` when a QR is being merged
- [ ] `choice` items with `observationLinkPeriod` look up **Conditions**, not Observations
- [ ] Population reads use the storage abstraction layer, not raw HTTP, to work in all persistence modes
