# EHDS Patient Summary — spec layer

The EPS demonstrator is generated from published specifications rather than
hand-coded. This folder holds the vendored sources, the curated overlay, the
scripts that turn them into `eps-sections.generated.ts`, and this runbook for
refreshing everything when the sources change.

## The dependency chain

```
Xt-EHR logical model      →  HL7 Europe FHIR profile   →  Value set binding          →  Terminology
(what the EHDS requires)     (how it is exchanged)         (which codes are allowed)      (SNOMED CT, ECL)
EHDSCondition.problem        Condition.code (EPS)          problems-uv-ips (+ eHDSI)      << 404684003
```

- The generator needs the **FHIR profile**: the logical model has no FHIR paths,
  resource boundaries or computable value sets.
- No package carries a computable link between the profiles and the Xt-EHR models.
  The guides publish the mapping as hand-written XHTML tables, which we parse.

## Sources

| Source | What we use | Where it lives | Refreshed by |
|---|---|---|---|
| HL7 EU EPS (`hl7.fhir.eu.eps`) | StructureDefinitions of the demo profiles: cardinality, obligations, docs, bindings, `additional-binding` | `eps-package/` (subset) | manual copy (step 1) |
| IPS, HL7 EU Base, MyHealth@EU MVC (`hl7.fhir.uv.ips`, `hl7.fhir.eu.base`, `myhealth.eu.fhir.mvc-package`) | Summaries of the value sets referenced by additional bindings | `eps-package/valueset-summaries.json` | `extract-valueset-summaries.mjs` (step 2) |
| Xt-EHR models (`xtehr.eu.ehds.models`) | Patient Summary sections, entry models, element short/cardinality/descriptive binding | `xtehr-package/` (subset) | manual copy (step 3) |
| EPS + EU Base mapping tables (GitHub `hl7-eu/eps`, `hl7-eu/base`, `input/pagecontent/map-ehds*.xml`) | Element-level EHDS → FHIR mappings with ConceptMap relationship codes | `ehds-mappings.json` | `extract-ehds-mappings.mjs`, pinned commit SHAs (step 4) |

Current versions: EPS `1.0.0-ballot`, EU Base `2.0.0` (mappings at a later
`master` commit), IPS `2.0.0`, MVC `9.1.0`, Xt-EHR `1.0.0`. Check each
`package.json` and the `SOURCES` SHAs for the exact pins.

Always take specs from the FHIR package registry (`https://packages.fhir.org/<name>/<version>`)
and read the JSON. Do not scrape IG web pages.

## Refresh runbook

Run everything from the repo root. Download packages into a scratch folder,
never into the repo.

1. **EPS profiles.** Download the new `hl7.fhir.eu.eps` package and copy over the
   files that already exist in `eps-package/` (same names), plus `package.json`.
   A profile that was renamed or removed makes the generator fail. Update
   `profileFile` / `profile` in `eps-sections.config.ts` to match.
2. **Value set summaries.** Download the IPS, EU Base and MVC versions the new EPS
   depends on (see its `package.json`), then run:
   `node src/app/ehds/patient-summary/spec/extract-valueset-summaries.mjs <ips-dir> <eu-base-dir> <mvc-dir>`.
   The script reports any additional-binding value set it could not find.
3. **Xt-EHR models.** Download the new `xtehr.eu.ehds.models` package and copy over
   the files in `xtehr-package/`, plus `package.json`. If a section's entries start
   using a new model, the generator fails with `xtehr-package is missing <Model>`:
   copy that file too.
4. **Mapping tables.** Update the SHAs in `SOURCES` (`extract-ehds-mappings.mjs`)
   to the commits that match the published versions, then run:
   `node src/app/ehds/patient-summary/spec/extract-ehds-mappings.mjs`.
5. **Generate.** `node src/app/ehds/patient-summary/spec/generate-eps-sections.mjs`,
   then read `git diff eps-sections.generated.ts`. That diff is the review of what
   changed in the specs.
6. **Validate.** `CI=1 npx ng build --progress=false`, then open
   `/ehds-patient-summary` and check the badges (EHDS, FHIR, BINDING) in every section.

## Curated parts to review on every refresh

The parts below are written by hand. A source update can make them stale
without any error.

- **`eps-sections.config.ts`**
  - Field selection and labels (SNOMED-coded fields plus a few clarifying ones).
  - `binding.ecl`: the ECL behind each SNOMED CT search. Check it still matches
    the bound value set.
  - `options` of dropdowns (status codes, severity, countries).
  - `ehdsSection`: EPS section → `EHDSPatientSummary.<section>`, or `null` when
    the model has none (today `patientHistory`).
  - `alignmentNote`: hand-written gaps between the EHDS model and the EPS. Today
    these are the missing Orphacode and ICD-O bindings on `Condition.code`. Re-check
    whether the gaps still exist, and update or remove the note as they are fixed.
- **`generate-eps-sections.mjs`**
  - `valueSetPageUrl()`: canonical → human page URL patterns. Core FHIR value
    sets are pinned to `/R4/`.
  - `isEmbeddable()`: hosts that refuse iframes (today `fhir.ehdsi.eu`); their
    pages open in a new tab.
  - `SYSTEM_NAMES`: code system URI → display name.
  - `XTEHR_PAGE`: Xt-EHR model page URL pattern.
- **`extract-ehds-mappings.mjs`**: the table parser assumes the current layout:
  - a `<title>` of the form "Model → Profile";
  - `<tbody>` rows of Element / Relation / Resource / Element / Notes;
  - `〔R4〕`/`〔R5〕` markers in the target cell.

  If the guides change the layout, or publish real ConceptMaps / `element.mapping`
  (which we have asked for), switch the source.
- **Home page** (`src/app/ehds/ehds-home/`): the chain examples in `chainSteps`
  and the Orphacode / ICD-O sentence in the `chain.note` translations.

## What to look for in the review

- New `additional-binding`s, or changed binding strengths and value sets.
- Fields whose EHDS badge turns grey (no longer mapped) or whose relationship changes.
- New or resolved `no-map` elements in the section popovers.
- The Orphacode and ICD-O gaps: does `eHDSIIllnessandDisorder`, or a new binding
  (e.g. `eHDSIRareDisease`, `eHDSIOncologyDisease`), now cover them?
- EPS sections still pending in the demo (Results, Vital Signs, Social History,
  Functional Status, Pregnancy History, Advance Directives, Plan of Care).
