/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const inputFile = process.argv[2] || path.resolve(process.cwd(), 'dental-procedures.xlsx');
const outputFile = path.resolve(
  process.cwd(),
  'src/app/benefits-demo/dentistry-record/data/dental-procedure-options.ts'
);

function inferScope(display) {
  const text = String(display || '').toLowerCase();
  if (text.includes('periodontal')) {
    return 'periodontalSite';
  }
  if (
    text.includes('restoration') ||
    text.includes('inlay') ||
    text.includes('fissure seal') ||
    text.includes('filling')
  ) {
    return 'surface';
  }
  if (
    text.includes('consultation') ||
    text.includes('report') ||
    text.includes('anesthetic') ||
    text.includes('preventive')
  ) {
    return 'global';
  }
  return 'tooth';
}

function escapeDisplay(display) {
  return String(display || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const wb = XLSX.readFile(inputFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

const concepts = rows
  .map((row) => ({
    code: String(row.code || '').trim(),
    display: String(row.display || '').trim()
  }))
  .filter((row) => row.code && row.display)
  .map((row) => ({
    ...row,
    scope: inferScope(row.display)
  }));

const lines = [];
lines.push("import { SnomedConceptOption } from '../models/tooth.model';");
lines.push('');
lines.push('export const DENTAL_PROCEDURE_OPTIONS: SnomedConceptOption[] = [');
for (const concept of concepts) {
  lines.push(
    `  { code: '${concept.code}', display: '${escapeDisplay(concept.display)}', scope: '${concept.scope}' },`
  );
}
lines.push('];');
lines.push('');

fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
console.log(`Wrote ${concepts.length} procedures to ${outputFile}`);
