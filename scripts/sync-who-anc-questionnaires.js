#!/usr/bin/env node
/**
 * Rebuilds the WHO SMART ANC Questionnaires into SDC-compatible, self-contained
 * Questionnaires under src/assets/questionnaires/who-anc/.
 *
 * Run with:  npm run sync:who-anc
 *            npm run sync:who-anc -- --package /path/to/package.tgz
 *
 * The published Questionnaires are not usable as they are: their answer value sets do
 * not resolve, quantity items have no units, multi-answer questions are single-answer,
 * and there is no extraction metadata (only `definition`). This script fixes that in the
 * Questionnaire itself, so the generic renderer and the generic SDC observation-based
 * extraction work without ANC-specific application code:
 *
 *  - answerValueSet  -> contained, expanded ValueSet referenced as "#id"
 *  - quantity items  -> questionnaire-unitOption (UCUM) from UNITS below
 *  - Observation data elements -> item.code (ANC data dictionary code) +
 *                       sdc-questionnaire-observationExtract
 *  - multi-answer questions -> repeats: true (see REPEATING_ITEMS)
 *  - broken items (choice with no options) -> retyped (see TYPE_OVERRIDES), else free
 *                       text for data elements and yes/no for the rest
 *
 * Source: WHO SMART ANC IG (CC0-1.0), continuous-integration build. The build changes
 * without notice, so the generated files are committed and the manifest records the
 * package version and build date they came from.
 *
 * No extra npm dependencies: uses curl and tar plus Node built-ins.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PACKAGE_URL = 'https://build.fhir.org/ig/WorldHealthOrganization/smart-anc/package.tgz';
const EXPECTED_VERSION = '0.3.0';
const DEST = path.join(__dirname, '..', 'src', 'assets', 'questionnaires', 'who-anc');

const ANC_CODE_SYSTEM = 'http://smart.who.int/anc/CodeSystem/anc-custom-codes';
const UCUM = 'http://unitsofmeasure.org';
const EXT_OBSERVATION_EXTRACT = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-observationExtract';
const EXT_UNIT_OPTION = 'http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption';
const ADAPTATION_TAG = {
  system: 'urn:sct-implementation-demonstrator:questionnaire-adaptation',
  code: 'who-anc-sdc-adapted',
  display: 'WHO SMART ANC Questionnaire adapted for SDC rendering and observation-based extraction'
};

// WHO contact workflow order. `role` tells the ANC module where each form belongs.
// Registration and pregnancy confirmation are generated for completeness but are not
// steps of a contact: the EHR already holds the patient, creates the contact with its date
// and number, and confirms the pregnancy when the pregnancy episode is started.
const QUESTIONNAIRES = [
  { id: 'ANCA', role: 'registration' },
  { id: 'ANCB4', role: 'pregnancy-confirmation' },
  { id: 'ANCB5', role: 'contact' },
  { id: 'ANCB6', role: 'contact' },
  { id: 'ANCB7', role: 'contact' },
  { id: 'ANCB8', role: 'contact' },
  { id: 'ANCB9', role: 'contact' },
  { id: 'ANCB10', role: 'contact' },
  { id: 'ANCB11', role: 'contact' },
  { id: 'ANCB12', role: 'contact' },
  { id: 'ANCC', role: 'referral' },
  { id: 'ANCEnd', role: 'end-of-pregnancy' }
];

// UCUM units by data-element profile id. The WHO decision logic thresholds are expressed
// in the units of the first block; the rest are conventional units for display.
const UNITS = {
  // Read by the CDS decision tables
  'anc-b6-de17': 'wk', // gestational age
  'anc-b8-de17': 'mm[Hg]', // systolic blood pressure
  'anc-b8-de19': 'mm[Hg]', // diastolic blood pressure
  'anc-b8-de20': 'mm[Hg]', // repeat systolic blood pressure
  'anc-b8-de21': 'mm[Hg]', // repeat diastolic blood pressure
  'anc-b9-de163': 'mg/dL', // fasting plasma glucose
  'anc-b9-de164': 'mg/dL', // OGTT fasting
  'anc-b9-de165': 'mg/dL', // OGTT 1 hour
  'anc-b9-de166': 'mg/dL', // OGTT 2 hours
  'anc-b9-de167': 'mg/dL', // random plasma glucose
  'anc-b9-de186': 'g/L', // haemoglobin (thresholds are 110 and 105 g/L)
  // Not read by the CDS decision tables
  'anc-b8-de1': 'cm', // height
  'anc-b8-de2': 'kg', // pre-gestational weight
  'anc-b8-de3': 'kg', // current weight
  'anc-b8-de4': 'kg/m2', // BMI
  'anc-b8-de15': 'kg/wk', // average weight gain per week
  'anc-b8-de16': 'kg', // total weight gain
  'anc-b8-de34': 'Cel', // body temperature
  'anc-b8-de35': 'Cel', // second body temperature
  'anc-b8-de36': '/min', // pulse rate
  'anc-b8-de37': '/min', // second pulse rate
  'anc-b8-de49': '%', // oximetry
  'anc-b8-de93': 'cm', // cervical dilation
  'anc-b8-de105': 'cm', // symphysis-fundal height
  'anc-b8-de107': '/min', // fetal heart rate
  'anc-b8-de108': '/min', // second fetal heart rate
  'anc-b9-de168': 'mg/dL', // blood glucose test result
  'anc-b9-de190': '%', // hematocrit
  'anc-b9-de191': '10*9/L', // white blood cell count
  'anc-b9-de192': '10*9/L', // platelet count
  'anc-end-23': 'g' // birth weight
};

// Questions where more than one answer can apply. The WHO logic reads every Observation
// of the data element in the contact, so each answer becomes its own Observation.
const REPEATING_ITEMS = new Set([
  'anc-b5-de48', // danger signs
  'anc-b6-de83', // existing chronic health conditions
  'anc-b8-de27' // symptoms of severe pre-eclampsia
]);

// Items whose published type cannot be rendered or is clearly wrong for the question.
const TYPE_OVERRIDES = {
  'anc-b6-de99': 'date', // "HIV diagnosis date" is published as a choice with no options
  'anc-b6-de145': 'boolean', // "Clinical enquiry ... done", choice with no options
  'anc-b7-de97': 'boolean', // "Woman discloses or is suspected to be subjected to IPV", choice with no options
  'anc-b10-de188': 'boolean', // "No doses of hepatitis B", choice with no options
  'anc-b8-de109': 'integer', // "Number of fetuses" is published as a quantity
  'anc-b8-de110': 'boolean' // "Number of fetuses unknown" is published as a quantity
};

function log(message) {
  console.log(`  ${message}`);
}

function parseArgs() {
  const index = process.argv.indexOf('--package');
  return { packagePath: index > -1 ? process.argv[index + 1] : null };
}

function fetchPackage(packagePath) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'who-anc-'));
  let tgz = packagePath;
  if (!tgz) {
    tgz = path.join(workDir, 'package.tgz');
    log(`Downloading ${PACKAGE_URL}`);
    execFileSync('curl', ['-fsSL', '-o', tgz, PACKAGE_URL], { stdio: 'pipe' });
  }
  const extractDir = path.join(workDir, 'extract');
  fs.mkdirSync(extractDir);
  execFileSync('tar', ['-xzf', tgz, '-C', extractDir], { stdio: 'pipe' });
  return { workDir, packageDir: path.join(extractDir, 'package') };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function indexByUrl(packageDir, prefix) {
  const index = new Map();
  for (const file of fs.readdirSync(packageDir)) {
    if (file.startsWith(`${prefix}-`) && file.endsWith('.json')) {
      const resource = readJson(path.join(packageDir, file));
      if (resource.url) {
        index.set(resource.url, resource);
      }
    }
  }
  return index;
}

function expansionOf(valueSet) {
  const contains = valueSet?.expansion?.contains;
  if (Array.isArray(contains) && contains.length) {
    return contains.map(({ system, code, display }) => ({ system, code, display }));
  }
  const fromCompose = [];
  for (const include of valueSet?.compose?.include || []) {
    for (const concept of include.concept || []) {
      fromCompose.push({ system: include.system, code: concept.code, display: concept.display });
    }
  }
  return fromCompose;
}

function splitDefinition(definition) {
  if (!definition || !definition.includes('#')) {
    return null;
  }
  const [profileUrl, element] = definition.split('#');
  return { profileUrl, profileId: profileUrl.split('/').pop(), element };
}

function profileElement(profile, elementId) {
  return (profile?.snapshot?.element || []).find((element) => element.id === elementId) || null;
}

// The data element's own code: the profile binds Observation.code to a value set that
// holds just that code. A few profiles point at a value set with no content; for those the
// code is derived from the profile id (anc-b6-de22 -> ANC.B6.DE22), as the IG names them.
function resolveObservationCode(profile, profileId, itemText, valueSets, report) {
  const binding = profileElement(profile, 'Observation.code')?.binding?.valueSet;
  const codes = binding ? expansionOf(valueSets.get(binding)) : [];
  if (codes.length === 1) {
    return codes[0];
  }
  const match = profileId.match(/^anc-([a-z0-9]+)-(?:de)?([a-z]?\d+)$/);
  if (!match) {
    return null;
  }
  const [, section, number] = match;
  const code = section === 'end' ? `ANC.End.${number}` : `ANC.${section.toUpperCase()}.DE${number.toUpperCase()}`;
  report.derivedCodes.push(code);
  return { system: ANC_CODE_SYSTEM, code, display: itemText };
}

function adaptItem(item, context) {
  const { profiles, valueSets, contained, report } = context;
  const adapted = { ...item };
  const definition = splitDefinition(item.definition);
  const profileId = definition?.profileId || '';
  const extensions = [...(item.extension || [])];

  if (TYPE_OVERRIDES[profileId]) {
    adapted.type = TYPE_OVERRIDES[profileId];
    delete adapted.answerValueSet;
    report.retyped.push(`${item.linkId} ${item.type} -> ${adapted.type}`);
  }

  if (adapted.type === 'choice') {
    const valueSet = item.answerValueSet ? valueSets.get(item.answerValueSet) : null;
    const options = expansionOf(valueSet);
    if (options.length) {
      if (!contained.has(valueSet.id)) {
        contained.set(valueSet.id, {
          resourceType: 'ValueSet',
          id: valueSet.id,
          url: valueSet.url,
          name: valueSet.name,
          title: valueSet.title,
          status: valueSet.status || 'active',
          expansion: { timestamp: valueSet.expansion?.timestamp || valueSet.date, contains: options }
        });
      }
      adapted.answerValueSet = `#${valueSet.id}`;
    } else {
      // No answer options are published for this question. Data elements become free text
      // so the form still renders (not extracted: a string is not a valid coded value).
      // The rest are "ordered / conducted / referred" style questions: a yes/no answer.
      adapted.type = definition?.element === 'Observation.value[x]' ? 'string' : 'boolean';
      delete adapted.answerValueSet;
      report.retyped.push(`${item.linkId} choice -> ${adapted.type} (no answer options published)`);
      return adapted;
    }
  }

  if (adapted.type === 'quantity') {
    const unit = UNITS[profileId];
    if (unit) {
      extensions.push({ url: EXT_UNIT_OPTION, valueCoding: { system: UCUM, code: unit, display: unit } });
    } else if (definition?.element === 'Observation.value[x]') {
      report.noUnit.push(`${item.linkId} ${item.text}`);
    }
  }

  if (definition?.element === 'Observation.value[x]') {
    const coding = resolveObservationCode(profiles.get(definition.profileUrl), profileId, item.text, valueSets, report);
    if (coding) {
      adapted.code = [coding];
      extensions.push({ url: EXT_OBSERVATION_EXTRACT, valueBoolean: true });
      report.extractable += 1;
    }
    if (REPEATING_ITEMS.has(profileId)) {
      adapted.repeats = true;
      report.repeating.push(`${item.linkId} ${item.text}`);
    }
  }

  if (extensions.length) {
    adapted.extension = extensions;
  }
  return adapted;
}

function adaptQuestionnaire(source, context) {
  const contained = new Map();
  const report = { extractable: 0, repeating: [], retyped: [], noUnit: [], derivedCodes: [] };
  const items = source.item.map((item) => adaptItem(item, { ...context, contained, report }));

  // Drop the generated narrative: it describes the original, not the adapted form.
  const { text, contained: _ignored, item: _items, meta, ...rest } = source;
  const adapted = {
    ...rest,
    meta: { ...(meta || {}), tag: [...(meta?.tag || []), ADAPTATION_TAG] },
    ...(contained.size ? { contained: Array.from(contained.values()) } : {}),
    item: items
  };
  return { adapted, report };
}

function main() {
  console.log('\nRebuilding WHO SMART ANC Questionnaires\n');
  const { packagePath } = parseArgs();
  const { workDir, packageDir } = fetchPackage(packagePath);

  try {
    const packageInfo = readJson(path.join(packageDir, 'package.json'));
    if (packageInfo.version !== EXPECTED_VERSION) {
      console.warn(`  WARNING: package version is ${packageInfo.version}, expected ${EXPECTED_VERSION}. Review the output.`);
    }
    log(`Package ${packageInfo.name}#${packageInfo.version}, built ${packageInfo.date}`);

    const valueSets = indexByUrl(packageDir, 'ValueSet');
    const profiles = indexByUrl(packageDir, 'StructureDefinition');

    fs.mkdirSync(DEST, { recursive: true });
    const manifest = {
      source: {
        package: packageInfo.name,
        version: packageInfo.version,
        buildDate: packageInfo.date,
        url: packageInfo.url,
        license: packageInfo.license
      },
      questionnaires: []
    };

    for (const entry of QUESTIONNAIRES) {
      const source = readJson(path.join(packageDir, `Questionnaire-${entry.id}.json`));
      const { adapted, report } = adaptQuestionnaire(source, { valueSets, profiles });
      const file = `${entry.id}.json`;
      fs.writeFileSync(path.join(DEST, file), `${JSON.stringify(adapted, null, 2)}\n`);
      manifest.questionnaires.push({
        ...entry,
        file,
        url: source.url,
        title: source.title,
        items: adapted.item.length,
        adaptations: report
      });
      log(
        `${entry.id.padEnd(7)} ${String(adapted.item.length).padStart(3)} items, ` +
          `${String(report.extractable).padStart(3)} extractable, ${report.retyped.length} retyped, ` +
          `${report.noUnit.length} without unit`
      );
    }

    fs.writeFileSync(path.join(DEST, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`\nWrote ${manifest.questionnaires.length} questionnaires and index.json to ${path.relative(process.cwd(), DEST)}\n`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main();
