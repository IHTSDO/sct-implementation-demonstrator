#!/usr/bin/env node
/**
 * Builds eps-package/valueset-summaries.json: a small summary (title, version,
 * code systems, enumerated concept count, source package) of every value set
 * referenced by an `additional-binding` in the EPS StructureDefinitions.
 *
 * Those value sets live in other FHIR packages (IPS, HL7 Europe Base and the
 * MyHealth@EU Master Value Catalogue, which is ~18 MB), so instead of vendoring
 * them we keep only what the UI shows. Download the packages from
 * https://packages.fhir.org (e.g. `curl -L https://packages.fhir.org/<name>/<version>`)
 * and extract them, then run from the repo root:
 *
 *   node src/app/ehds/patient-summary/spec/extract-valueset-summaries.mjs <extracted-package-dir>...
 *
 * Each argument is a directory containing the package's `package/` folder
 * (or the `package/` folder itself).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const epsDir = join(here, 'eps-package');
const ADDITIONAL_BINDING = 'http://hl7.org/fhir/tools/StructureDefinition/additional-binding';

const stripVersion = (url) => (url || '').split('|')[0];

/** Canonicals referenced by additional bindings in the EPS profiles. */
function referencedValueSets() {
  const urls = new Set();
  for (const file of readdirSync(epsDir)) {
    if (!file.startsWith('StructureDefinition-')) continue;
    const sd = JSON.parse(readFileSync(join(epsDir, file), 'utf8'));
    for (const el of sd.snapshot?.element || []) {
      for (const ext of el.binding?.extension || []) {
        if (ext.url !== ADDITIONAL_BINDING) continue;
        const vs = (ext.extension || []).find((e) => e.url === 'valueSet')?.valueCanonical;
        if (vs) urls.add(stripVersion(vs));
      }
    }
  }
  return urls;
}

function packageFolder(dir) {
  return existsSync(join(dir, 'package', 'package.json')) ? join(dir, 'package') : dir;
}

function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('Usage: extract-valueset-summaries.mjs <extracted-package-dir>...');
    process.exit(1);
  }
  const wanted = referencedValueSets();
  const summaries = {};

  for (const dir of dirs.map(packageFolder)) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const file of readdirSync(dir)) {
      if (!file.startsWith('ValueSet-') || !file.endsWith('.json')) continue;
      const vs = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!wanted.has(vs.url) || summaries[vs.url]) continue;
      const includes = vs.compose?.include || [];
      const enumerated = includes.every((i) => i.concept && !i.filter);
      summaries[vs.url] = {
        title: vs.title || vs.name,
        version: vs.version,
        systems: [...new Set(includes.map((i) => i.system).filter(Boolean))],
        ...(enumerated ? { conceptCount: includes.reduce((n, i) => n + i.concept.length, 0) } : {}),
        package: `${pkg.name}#${pkg.version}`,
      };
    }
  }

  const missing = [...wanted].filter((u) => !summaries[u]);
  const out = join(epsDir, 'valueset-summaries.json');
  writeFileSync(out, JSON.stringify(summaries, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(summaries).length} value set summaries to ${out.replace(process.cwd() + '/', '')}`);
  if (missing.length) console.warn('Not found in the given packages:\n  ' + missing.join('\n  '));
}

main();
