#!/usr/bin/env node
/**
 * Builds ehds-mappings.json: the element-level mappings from the Xt-EHR EHDS
 * logical models to the HL7 Europe FHIR profiles.
 *
 * Neither the EPS nor the EU Base package carries these mappings in computable
 * form (no ConceptMap, StructureMap or element.mapping). They are published as
 * hand-written XHTML tables (input/pagecontent/map-ehds*.xml) whose
 * "Relation" column uses ConceptMap relationship codes, so we parse those
 * tables. Sources are pinned to a commit of each repository so the output is
 * reproducible; bump the SHAs below to refresh.
 *
 * Run from the repo root (needs network access):
 *   node src/app/ehds/patient-summary/spec/extract-ehds-mappings.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const SOURCES = [
  // EPS-specific models (Device, DeviceUse, TravelHistory, MedicationUse, ...)
  { key: 'eps', repo: 'hl7-eu/eps', sha: '021bc32f96a3548edaf4cb693b14cdbb0822e536', site: 'https://hl7.eu/fhir/eps' },
  // Models mapped once for all EU Core profiles (Condition, AllergyIntolerance, ...)
  { key: 'base', repo: 'hl7-eu/base', sha: '68e4d3abe32ff9a642fb680f77f088ef224888c0', site: 'https://hl7.eu/fhir/base' },
];

const RELATIONSHIPS = new Set([
  'equivalent',
  'related-to',
  'source-is-narrower-than-target',
  'source-is-broader-than-target',
  'not-related-to',
  'no-map',
]);

const text = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'sct-implementation-demonstrator' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

/** Normalise a relationship cell; legacy/odd values are kept but flagged. */
function relationship(cell) {
  const codes = cell.split(/\s+/).filter(Boolean);
  const first = codes[0] || '';
  if (RELATIONSHIPS.has(first)) return first;
  if (first === 'narrower') return 'source-is-narrower-than-target';
  if (first === 'broader') return 'source-is-broader-than-target';
  return first || 'unknown';
}

/** "medication[x]  〔R4〕" → { element: "medication[x]", fhirVersion: "R4" } */
function targetElement(cell) {
  const version = cell.match(/〔(R\d)〕/)?.[1];
  const element = cell.replace(/〔R\d〕.*$/, '').trim().split(/\s+/)[0] || '';
  return { element: element === '.' ? '' : element, ...(version ? { fhirVersion: version } : {}) };
}

function parsePage(xml, file, source) {
  const title = text(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
  // Titles use "→", "->" or "↔" between the model and the FHIR target.
  const [model, profile] = title.split(/\s*(?:→|->|↔)\s*/).map((s) => s.trim());
  const body = xml.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
  const rows = [];
  for (const tr of body.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    if (cells.length < 4) continue;
    const [source, rel, resource, target, note] = cells;
    rows.push({
      source,
      relationship: relationship(rel),
      resource,
      ...targetElement(target),
      ...(note ? { note } : {}),
    });
  }
  const page = file.replace(/\.xml$/, '');
  return { model, profile, pageUrl: `${source.site}/${page}.html`, source: source.key, rows };
}

async function main() {
  const pages = [];
  for (const source of SOURCES) {
    const tree = await (await get(`https://api.github.com/repos/${source.repo}/git/trees/${source.sha}?recursive=1`)).json();
    const files = tree.tree
      .map((t) => t.path)
      .filter((p) => /^input\/pagecontent\/map-ehds[^/]*\.xml$/.test(p));
    for (const path of files) {
      const xml = await (await get(`https://raw.githubusercontent.com/${source.repo}/${source.sha}/${path}`)).text();
      pages.push(parsePage(xml, path.split('/').pop(), source));
    }
  }
  const out = {
    sources: SOURCES.map(({ key, repo, sha }) => ({ key, repo, sha })),
    pages,
  };
  writeFileSync(join(here, 'ehds-mappings.json'), JSON.stringify(out, null, 2) + '\n');
  const rows = pages.reduce((n, p) => n + p.rows.length, 0);
  console.log(`Wrote ${pages.length} mapping pages (${rows} rows) to ehds-mappings.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
