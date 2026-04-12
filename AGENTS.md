# Project Conventions

## Language

- Project artifacts should be written in English.
- Use English for source code, identifiers, comments, Git comments, commit messages, docs, and user-facing UI copy unless a specific feature explicitly requires another language.
- It is fine to collaborate in Spanish while developing, but changes committed to the repository should remain in English by default.

## Angular Modularization

- Keep the root shell small.
- `AppModule` should contain only the shell, global navigation, home, truly global services, and lightweight shared UI.
- Do not add new heavy feature components directly to `AppModule`.
- Prefer putting reusable Angular Material, forms, and common UI dependencies in shared modules under `src/app/shared`.

## Lazy Loading

- New feature areas should be loaded lazily by default.
- Register heavy features from `src/app/app-routing.module.ts` with `loadChildren`.
- Feature routing modules used behind `loadChildren` must define child paths relative to the lazy root:
  use `''`, `'dashboard'`, `'editor'`, `'definitions/:id'`
  do not repeat the full parent path like `'maturity/dashboard'` or `'cohort-workspace/definitions/:id'`.
- If multiple top-level URLs point into the same heavy feature area, prefer small entry modules that import the shared feature module and expose one route each.

## Feature Module Pattern

- For a substantial feature, create:
  a feature module, e.g. `feature.module.ts`
  a feature routing module when the feature owns several child paths
  small entry modules when separate top-level lazy entry points are needed
- Put reusable declarations for that domain in the feature module.
- Entry modules should stay thin and only connect route-to-component wiring.

## Heavy Libraries

- Treat these libraries as expensive and keep them out of the initial bundle whenever possible:
  `plotly.js-dist`
  `d3`
  `phaser`
  `leaflet`
  `xlsx`
  `jszip`
  `@viz-js/viz`
  `firebase`
  `html2canvas`
  `jspdf`
- Features that depend on those libraries should stay lazy-loaded.
- Avoid importing heavy-library-dependent components into the root shell.

## URL-Driven Screens

- If a component supports multiple modes such as `list` vs `analytics`, the visible mode must be derived from the URL or route state.
- Do not rely only on in-memory booleans set from button clicks.
- Direct navigation and refresh must render the same view as in-app navigation.

## Performance Guardrails

- Production bundle size is the source of truth, not `ng serve` raw output.
- Use `CI=1 npx ng build --progress=false` to validate the current production split.
- Treat warnings in `angular.json` as active signals, not placeholders to silence.
- When adding a new feature, ask:
  should this be lazy?
  does this pull in a heavy library?
  should this live in a shared module or a feature module?

## Angular Dependency Alignment

- Keep Angular packages within the same minor line, e.g. `21.2.x`.
- Do not force every `@angular/*` package to the exact same patch version if the published ecosystem does not line up that way.
- Prefer the most secure and build-stable combination over patch uniformity.
- It is acceptable for `@angular/core` packages, `@angular/cli`, `@angular-devkit/build-angular`, and `@angular/material`/`@angular/cdk` to differ by patch as long as they remain in the same supported minor line and `npm audit` stays clean.
- When updating Angular dependencies, validate with both `npm audit` and `CI=1 npx ng build --progress=false`.

## Practical Rule

- If a new screen is not needed for the first paint of `home`, it should usually not be part of the initial bundle.

## UI Consistency

- Prefer Angular Material components for new UI work unless there is a clear reason not to.
- Reuse the project's Material theme and palette tokens instead of introducing ad hoc colors.
- Prefer `color="primary"`, `color="accent"`, and `color="warn"` on Material components before adding custom button or status colors.
- Prefer Material form controls, dialogs, menus, tables, cards, tabs, and navigation patterns over custom-built equivalents.
- Only introduce custom UI primitives when Material cannot cover the interaction or when there is a strong product reason.
- Keep spacing, elevation, and interaction states consistent with Angular Material defaults unless a feature has an intentional design exception.

## Shared Bindings

- Reuse the shared bindings components before creating new input patterns.
- Prefer components from `src/app/shared/bindings.module.ts` for terminology-driven forms and structured data entry.
- `AutocompleteBindingComponent` is the default choice for concept lookup and coded-input flows unless another existing binding is a better fit.
- If a new feature needs coded selection, first check whether `autocomplete`, `dropdown`, `radio`, `checkbox`, or `multi-prefix-select` bindings already cover the use case.
- Extend the shared bindings only when the interaction is genuinely new and likely to be reused by multiple features.
- Avoid feature-local copies of shared bindings behavior.

## Terminology Access

- Prefer `TerminologyService` for terminology operations instead of creating feature-specific terminology clients.
- Treat `TerminologyService` as the project's standardized FHIR terminology API layer.
- Reuse its existing methods and server/context handling before adding new terminology request code.
- If a new terminology capability is needed, prefer extending `TerminologyService` rather than calling FHIR terminology endpoints ad hoc from components.
- Keep components focused on UI and orchestration; terminology querying, lookup, expansion, validation, and language/context handling should live in services.
