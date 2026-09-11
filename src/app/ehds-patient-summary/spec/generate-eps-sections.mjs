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
 *   node src/app/ehds-patient-summary/spec/generate-eps-sections.mjs
 *
 * Do not edit eps-sections.generated.ts by hand — edit the config and re-run.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
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
  return url;
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
  return {
    strength: b.strength || 'unknown',
    valueSet,
    pageUrl: valueSetPageUrl(valueSet),
    isSct,
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
