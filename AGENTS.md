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

## Internationalisation (i18n)

- The project uses **@jsverse/transloco** (v8) for runtime language switching.
- Supported languages are configured in `AppModule` via `provideTransloco()`: currently `en` and `es`.
- The selected language is persisted to `localStorage` under the key `ui-lang` and restored in `AppComponent.ngOnInit()`.
- Run `npm run i18n:extract` to auto-generate or update JSON source files from template keys.

### Translation files

- Global (app-level) strings live in `src/assets/i18n/{lang}.json`.
- Feature scopes live in `src/assets/i18n/{scope-name}/{scope-name}-{lang}.json`, e.g. `src/assets/i18n/benefits-demo/benefits-demo-en.json`.
- Scope file keys use a flat namespace per component, e.g. `createPatient.title`, `clinicalRecord.actions.close`.
- Both `{scope}-en.json` and `{scope}-es.json` must exist for every scope; Transloco will 404 without the active-language file.
- The `{scope-name}` prefix in the filename makes the file self-describing when shared for external translation, since the folder context is not visible in isolation.

#### `home` scope pattern (AppModule-declared component)

- `HomeComponent` is declared in `AppModule` directly, so no module-level `TRANSLOCO_SCOPE` is provided; the directive carries both: `*transloco="let t; scope: 'home'; prefix: 'home'"`.
- `menu.service.ts` demo items expose a `key` field (camelCase, e.g. `clinicalDemo`) used for translation lookup as `t('menu.' + demo.key + '.name')`, and a `subtitle` field (camelCase, e.g. `clinicalDemo`, `tool`) resolved as `t('subtitles.' + demo.subtitle)`.
- Translation files live at `src/assets/i18n/home/home-en.json` and `home-es.json`; keys follow the `menu.<key>.name` / `subtitles.<subtitle>` structure.
- Search in `home.component.ts` filters against the English `name`/`description` fields from the service (not translated values) — intentional first-iteration behaviour.

### Adding i18n to a new feature module

1. Import `TranslocoModule` in the feature module.
2. Decide on a scope name, e.g. `my-feature`. Create `src/assets/i18n/my-feature/my-feature-en.json` and `my-feature-es.json`.
3. Choose the loading strategy based on whether the module contains `@ViewChild` references used in chart / D3 initialisation:

   **A — Template-only components (no chart ViewChild)**
   Add `{ provide: TRANSLOCO_SCOPE, useValue: 'my-feature' }` to the module providers.
   Wrap the template content with `*transloco="let t; prefix: 'myFeature'"`.
   Use `t('key')` for all string bindings.
   Do **not** add a scope prefix to the directive when a module-level `TRANSLOCO_SCOPE` is already provided.

   **B — Components that initialise charts or use `@ViewChild({ static: true })`**
   Do **not** use `*transloco` as an outer structural wrapper — it delays the embedded view creation and leaves `ViewChild` elements undefined when the chart init code runs.
   Instead: inject `TranslocoService`, add a `t(key, params?)` method that calls `translocoService.translate('myFeature.' + key, params ?? {})`, and load the scope in `ngOnInit()` with the `langChanges$` pipeline shown in the descriptive-statistics components.
   Use a `translationsReady` flag to return `''` from `t()` until the scope file has loaded, preventing spurious "Missing translation for" console warnings.

4. TypeScript strings (snackbars, error messages, dynamic labels) must use the full prefixed key path: `translocoService.translate('myFeature.key', params)` — passing the scope name as the third `lang` argument does **not** work and silently returns missing translations.

### Transloco v8 structural-directive rules

- `scope:` on `*transloco` triggers file loading but does **not** prefix `t()` key lookups.
- `prefix:` on `*transloco` sets the key-lookup prefix but does **not** load any file.
- To use the structural directive without a module-level `TRANSLOCO_SCOPE`, specify both: `*transloco="let t; scope: 'my-feature'; prefix: 'myFeature'"`.
- Inside the directive, keys must be **relative** (no scope prefix): `t('section.key')`, not `t('myFeature.section.key')`.
- If a module already provides `TRANSLOCO_SCOPE`, the directive only needs `prefix:`.

### Scope naming

- Scope file folder: `kebab-case`, e.g. `benefits-demo`, `descriptive-statistics`.
- Transloco auto-derives the camelCase alias used as the translation store key: `benefitsDemo`, `descriptiveStatistics`.
- Use the camelCase alias as the prefix in `t()` calls and in programmatic `translate()` key paths.

### Route-to-scope coverage indexing

- User-facing feedback for untranslated modules is driven by route-to-scope coverage detection in `TranslationCoverageService`.
- When adding i18n to a feature, create scope files in `src/assets/i18n/{scope}/{scope}-{lang}.json`.
- Prefer naming the top-level route segment and i18n scope folder the same, so coverage detection works automatically, e.g. `/my-feature` maps to `src/assets/i18n/my-feature/my-feature-{lang}.json`.
- If a route segment intentionally differs from the scope folder, add it to the translation coverage alias map in `src/app/services/translation-coverage.service.ts`.
- When one translated feature module is exposed through several top-level routes, map each route segment to the same scope.
- When adding a new Site language, add the global file and every translated scope file for that language.
- New routes without matching scope assets are considered English-only and will trigger the user-facing coverage notice when a non-English Site language is active.

### Avoiding TRANSLOCO_SCOPE token conflicts

- When module A is imported by module B, and both provide `TRANSLOCO_SCOPE`, the last provider in the shared injector wins — silently breaking the other.
- Do **not** add `TRANSLOCO_SCOPE` to shared feature modules that are imported by other feature modules.
- Use the directive's `scope:` input or the component `t()` method pattern instead.

## Static SVG Icon Assets (Health Icons)

- The project uses a subset of [Health Icons](https://healthicons.org/) (CC0) committed directly to `src/assets/healthicons/svg/outline/`.
- **Only commit the specific SVG files actually used by the app.** Do not commit the full icon library (~2 000 files, 25 MB).
- Icons are fetched lazily at runtime via `HttpClient` in `HealthIconComponent` (`src/app/shared/health-icon/`). No build step or npm package is required.
- To add a new icon: copy the relevant SVG from the [healthicons GitHub repo](https://github.com/resolvetosavelives/healthicons) into the matching `svg/outline/<category>/` folder and commit it.
- `scripts/sync-healthicons.js` (`npm run sync:healthicons`) downloads the full library locally for browsing. It is a dev-only utility; never add it to CI.
- Icon color is driven by the parent element's CSS `color` property via `fill: currentColor` on the inline SVG — no `fill` attribute needed on the icon itself.

## Adding a New Demo

- Always append new demos to the **end** of the `demos` array in `src/app/services/menu.service.ts`. The home page uses array order to determine which demos are newest.
- Always include `addedAt: "YYYY-MM-DD"` with today's date when adding a demo entry.
- The home page displays a "New" badge on any demo whose `addedAt` is within the last 90 days. No manual cleanup needed — the badge expires automatically.
- Register the route in `src/app/app-routing.module.ts` (lazy-loaded unless genuinely trivial).
- Add the demo name, description, and subtitle translations to `src/assets/i18n/home/home-en.json` and `home-es.json`.

## Terminology Server Rate Limiting

- Minimize HTTP requests to terminology servers; they have rate limits and cold-start latency.
- **Sequential over parallel**: Never fire multiple terminology requests concurrently for the same user action. Chain calls with `switchMap` so only one request is in-flight at a time per flow.
- For any call that may be triggered multiple times in a session (e.g., once per result row), apply a two-level cache:
  1. A **results cache** (Map) that returns a resolved value immediately on subsequent calls.
  2. An **in-flight deduplication map** (`Map<key, Observable>`) that lets concurrent callers share one pending request via `shareReplay(1)` rather than firing duplicates.
- Request only the minimum `count` needed: if you only need to confirm membership, use `count=1`.
- Prefer ECL over repeated `$lookup` calls when checking properties of multiple concepts.
- Keep terminology calls in services, not components, so caching is shared across the application lifetime.
