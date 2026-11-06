#!/usr/bin/env node
/**
 * EHDS Patient Summary — section metadata generator (hybrid B+C).
 *
 * Reads the curated overlay (eps-sections.config.ts) and cross-checks every
 * configured field against the HL7 EU EPS StructureDefinitions in ./eps-package,
 * filling in the real cardinality (min/max) and must-support / obligation flags
 * from the spec. Writes eps-sections.generated.ts, which the Angular render
 * engine consumes. The curated config decides *which* fields appear; the spec
 * decides their structural truth.
 *
 * Run from the repo root:
 *   node src/app/ehds/patient-summary/spec/generate-eps-sections.mjs
 *
 * Do not edit eps-sections.generated.ts by hand — edit the config and re-run.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, 'eps-package');

/** Transpile a sibling .ts module and import it, so Node can read the config. */
async function importTs(relPath) {
  const src = readFileSync(join(here, relPath), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  return import(dataUrl);
}

const OBLIGATION_EXT = 'http://hl7.org/fhir/StructureDefinition/obligation';

/** Index a StructureDefinition's elements (differential first, snapshot as fallback) by path. */
function indexElements(sd) {
  const byPath = {};
  const add = (el) => {
    const cur = byPath[el.path] || (byPath[el.path] = {});
    if ('min' in el) cur.min = el.min;
    if ('max' in el) cur.max = el.max;
    if (el.mustSupport) cur.mustSupport = true;
    // Rich documentation lives in the snapshot; keep the first occurrence with content.
    for (const k of ['short', 'definition', 'comment', 'isModifier', 'isSummary', 'type', 'binding', 'constraint']) {
      if (cur[k] === undefined && el[k] !== undefined) cur[k] = el[k];
    }
    const exts = el.extension || [];
    if (exts.some((e) => (e.url || '').includes('obligation')) || el.url === OBLIGATION_EXT) {
      cur.obligation = true;
    }
  };
  (sd.snapshot?.element || []).forEach(add);
  (sd.differential?.element || []).forEach(add);
  return byPath;
}

function lookup(index, path) {
  if (index[path]) return index[path];
  // onset[x] / medication[x] etc. may be indexed under a typed path
  const base = path.replace(/\[x\]$/, '');
  const hit = Object.keys(index).find((p) => p === base || p.startsWith(base + '[x]') || p.startsWith(base));
  return hit ? index[hit] : {};
}

/** Strip a canonical's |version suffix. */
function stripVersion(url) {
  return (url || '').split('|')[0];
}

/** Best-effort human-readable IG page for a value set canonical (embedded in the dialog). */
function valueSetPageUrl(canonical) {
  const url = stripVersion(canonical);
  let m;
  if ((m = url.match(/^https?:\/\/hl7\.org\/fhir\/uv\/ips\/ValueSet\/(.+)$/))) {
    return `https://hl7.org/fhir/uv/ips/ValueSet-${m[1]}.html`;
  }
  if ((m = url.match(/^https?:\/\/hl7\.org\/fhir\/ValueSet\/(.+)$/))) {
    // EPS is FHIR R4: pin core value sets to the R4 pages (bare hl7.org/fhir/
    // serves the latest FHIR, where some R4 value sets were renamed/removed).
    return `https://hl7.org/fhir/R4/valueset-${m[1]}.html`;
  }
  if ((m = url.match(/^https?:\/\/terminology\.hl7\.org\/ValueSet\/(.+)$/))) {
    return `https://terminology.hl7.org/ValueSet-${m[1]}.html`;
  }
  if ((m = url.match(/^https?:\/\/hl7\.eu\/fhir\/([^/]+)\/ValueSet\/(.+)$/))) {
    return `https://hl7.eu/fhir/${m[1]}/ValueSet-${m[2]}.html`;
  }
  if ((m = url.match(/^https?:\/\/terminology\.ehdsi\.eu\/ValueSet\/(.+)$/))) {
    // MyHealth@EU Master Value Catalogue (myhealth.eu.fhir.mvc-package).
    return `https://fhir.ehdsi.eu/mvc-package/ValueSet-${m[1]}.html`;
  }
  return url;
}

/** Pages served with X-Frame-Options / frame-ancestors 'self' cannot be shown in the dialog iframe. */
function isEmbeddable(pageUrl) {
  return !/^https:\/\/fhir\.ehdsi\.eu\//.test(pageUrl);
}

const SYSTEM_NAMES = {
  'http://snomed.info/sct': 'SNOMED CT',
  'http://hl7.org/fhir/sid/icd-10': 'ICD-10',
  'http://www.whocc.no/atc': 'WHO ATC',
  'http://www.orpha.net': 'Orphacode',
  // MyHealth@EU's own code system for medical devices (EMDN-based).
  'urn:oid:1.3.6.1.4.1.12559.11.10.1.3.1.44.6': 'eHDSI medical device codes',
};

const ADDITIONAL_BINDING = 'http://hl7.org/fhir/tools/StructureDefinition/additional-binding';

/**
 * Summaries of the value sets referenced by additional bindings (title, code
 * systems, size), extracted from their FHIR packages by extract-valueset-summaries.mjs.
 */
const valueSetSummaries = existsSync(join(pkgDir, 'valueset-summaries.json'))
  ? JSON.parse(readFileSync(join(pkgDir, 'valueset-summaries.json'), 'utf8'))
  : {};

/** Read the `additional-binding` extensions of an element binding. */
function buildAdditionalBindings(binding) {
  return (binding?.extension || [])
    .filter((ext) => ext.url === ADDITIONAL_BINDING)
    .map((ext) => {
      const part = (name) => (ext.extension || []).find((e) => e.url === name) || {};
      const valueSet = stripVersion(part('valueSet').valueCanonical);
      if (!valueSet) return undefined;
      const summary = valueSetSummaries[valueSet] || {};
      const systemUrls = summary.systems || [];
      const pageUrl = valueSetPageUrl(valueSet);
      return {
        purpose: part('purpose').valueCode || 'unknown',
        valueSet,
        title: summary.title || valueSet.split('/').pop(),
        ...(part('shortDoco').valueString ? { usage: part('shortDoco').valueString } : {}),
        ...(part('documentation').valueMarkdown ? { documentation: part('documentation').valueMarkdown } : {}),
        systems: systemUrls.map((s) => SYSTEM_NAMES[s] || s),
        ...(summary.conceptCount !== undefined ? { conceptCount: summary.conceptCount } : {}),
        ...(summary.package ? { sourcePackage: summary.package } : {}),
        pageUrl,
        embeddable: isEmbeddable(pageUrl),
        isSct: systemUrls.includes('http://snomed.info/sct'),
      };
    })
    .filter(Boolean);
}

/** IG definitions page anchor for a given element path. */
function elementDefinitionUrl(profileFile, path) {
  return `https://hl7.eu/fhir/eps/${profileFile}-definitions.html#${path.replace(/\[x\]$/, '[x]')}`;
}

/** Extract the FHIR element documentation from a snapshot element record. */
function buildDoc(spec, profileFile, path, min, max) {
  const types = (spec.type || []).map((t) => t.code).filter(Boolean);
  const invariants = (spec.constraint || []).map((c) => c.key).filter(Boolean);
  const b = spec.binding;
  const bindingText = b
    ? `The codes are ${b.strength} to ${stripVersion(b.valueSet) || '(unspecified value set)'}.`
    : undefined;
  return {
    short: spec.short,
    definition: spec.definition,
    comment: spec.comment,
    control: `${min}..${max}`,
    types,
    isModifier: !!spec.isModifier,
    isSummary: !!spec.isSummary,
    invariants,
    bindingText,
    definitionUrl: elementDefinitionUrl(profileFile, path),
  };
}

/** Extract the terminology binding (for the BINDING badge), if any. */
function buildBinding(spec, control) {
  const b = spec.binding;
  if (!b || !b.valueSet) return undefined;
  const valueSet = stripVersion(b.valueSet);
  const isSct = control === 'snomed' || /snomed|sct|\/uv\/ips\//i.test(valueSet);
  const additional = buildAdditionalBindings(b);
  return {
    strength: b.strength || 'unknown',
    valueSet,
    pageUrl: valueSetPageUrl(valueSet),
    isSct,
    ...(additional.length ? { additional } : {}),
  };
}

// ---------------------------------------------------------------------------
// Xt-EHR EHDS logical models (./xtehr-package): the requirements the EPS
// profiles realise. Only the Patient Summary model and the entry models used
// by the demo sections are vendored.
// ---------------------------------------------------------------------------
const xtehrDir = join(here, 'xtehr-package');
const XTEHR_PAGE = (name) => `https://www.xt-ehr.eu/fhir/models/en/StructureDefinition-${name}.html`;

function loadXtehrModels() {
  const models = {};
  if (!existsSync(xtehrDir)) return { models, pkg: undefined };
  for (const file of readdirSync(xtehrDir)) {
    if (!file.startsWith('StructureDefinition-')) continue;
    const sd = JSON.parse(readFileSync(join(xtehrDir, file), 'utf8'));
    models[sd.name] = sd;
  }
  const pkg = JSON.parse(readFileSync(join(xtehrDir, 'package.json'), 'utf8'));
  return { models, pkg: `${pkg.name}#${pkg.version}` };
}

/** Resolve `EHDSPatientSummary.<section>` and its entry models from the Xt-EHR package. */
function buildEhdsSection(sectionName, xtehr) {
  if (!sectionName) return null;
  const ps = xtehr.models.EHDSPatientSummary;
  if (!ps) throw new Error('xtehr-package is missing EHDSPatientSummary');
  const path = `EHDSPatientSummary.${sectionName}`;
  const elements = ps.differential?.element || [];
  const section = elements.find((e) => e.path === path);
  if (!section) throw new Error(`Xt-EHR Patient Summary has no section ${path}`);

  // Entry models: the child elements typed with another EHDS logical model.
  const entryModels = [];
  for (const child of elements.filter((e) => e.path.startsWith(path + '.') && e.path.split('.').length === 3)) {
    for (const t of child.type || []) {
      const name = (t.code || '').split('/').pop();
      if (!name.startsWith('EHDS') || entryModels.some((m) => m.name === name)) continue;
      const model = xtehr.models[name];
      if (!model) throw new Error(`xtehr-package is missing ${name} (used by ${child.path})`);
      entryModels.push({ name, title: model.title, description: model.description, pageUrl: XTEHR_PAGE(name) });
    }
  }

  return {
    path,
    title: (section.short || sectionName).replace(/^Section:\s*/, ''),
    cardinality: `${section.min ?? 0}..${section.max ?? '*'}`,
    entryModels,
    pageUrl: XTEHR_PAGE('EHDSPatientSummary'),
    sourcePackage: xtehr.pkg,
  };
}

const HEADER = `/**
 * AUTO-GENERATED by generate-eps-sections.mjs — do not edit by hand.
 * Structure (min/max/mustSupport) is derived from the HL7 EU EPS FHIR package;
 * field selection and SNOMED ECL bindings come from eps-sections.config.ts.
 */
import { EpsSectionMeta } from './eps-sections.model';
`;

async function main() {
  const { EPS_SECTIONS_CONFIG } = await importTs('eps-sections.config.ts');
  const xtehr = loadXtehrModels();

  // Index every profile in the package by its resource type, so a field whose
  // path lives in another resource (e.g. Device.type inside a Medical Devices
  // section built on DeviceUseStatement) still resolves against the right spec.
  const byType = {};
  const fileByType = {};
  for (const file of readdirSync(pkgDir)) {
    if (!file.startsWith('StructureDefinition-') || !file.endsWith('.json')) continue;
    const sd = JSON.parse(readFileSync(join(pkgDir, file), 'utf8'));
    if (!sd.type) continue;
    byType[sd.type] = indexElements(sd);
    fileByType[sd.type] = file.replace(/\.json$/, '');
  }

  const sections = EPS_SECTIONS_CONFIG.map((section) => {
    const fields = section.fields.map((f) => {
      const root = f.path.split('.')[0];
      const index = byType[root] || byType[section.resourceType] || {};
      const profileFile = fileByType[root] || section.profileFile;
      const spec = lookup(index, f.path);
      const min = typeof spec.min === 'number' ? spec.min : 0;
      const max = spec.max || '1';
      const mustSupport = !!(spec.mustSupport || spec.obligation);
      const doc = buildDoc(spec, profileFile, f.path, min, max);
      const bindingMeta = buildBinding(spec, f.control);
      return {
        key: f.key,
        path: f.path,
        label: f.label,
        control: f.control,
        min,
        max,
        mustSupport,
        ...(f.binding ? { binding: f.binding } : {}),
        ...(f.options ? { options: f.options } : {}),
        ...(f.system ? { system: f.system } : {}),
        ...(f.hint ? { hint: f.hint } : {}),
        ...(f.alignmentNote ? { alignmentNote: f.alignmentNote } : {}),
        doc,
        ...(bindingMeta ? { bindingMeta } : {}),
      };
    });
    return {
      key: section.key,
      kind: section.kind || 'resource',
      title: section.title,
      loincCode: section.loincCode,
      resourceType: section.resourceType,
      profile: section.profile,
      profilePageUrl: `https://hl7.eu/fhir/eps/${section.profileFile}.html`,
      icon: section.icon,
      description: section.description,
      ehds: buildEhdsSection(section.ehdsSection, xtehr),
      fields,
    };
  });

  const body =
    HEADER +
    '\nexport const EPS_SECTIONS: EpsSectionMeta[] = ' +
    JSON.stringify(sections, null, 2) +
    ';\n';
  const outPath = join(here, 'eps-sections.generated.ts');
  writeFileSync(outPath, body);

  // Report what was derived from the spec, for transparency.
  console.log('Generated', outPath.replace(process.cwd() + '/', ''));
  for (const s of sections) {
    console.log(`  ${s.title} (${s.resourceType}) — ${s.fields.length} fields`);
    for (const f of s.fields) {
      console.log(`    ${f.key.padEnd(16)} ${String(f.min) + '..' + f.max} ${f.mustSupport ? 'MS' : '  '} ${f.control}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
