#!/usr/bin/env node
/**
 * Syncs Health Icons SVGs from the GitHub main branch into src/assets/healthicons/.
 * Run with:  npm run sync:healthicons
 *
 * No extra npm dependencies — uses curl (available on macOS/Linux) and Node built-ins.
 * Source: https://github.com/resolvetosavelives/healthicons  (CC0 licence)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ZIP_URL = 'https://github.com/resolvetosavelives/healthicons/archive/refs/heads/main.zip';
const TMP_ZIP = path.join(os.tmpdir(), 'healthicons-main.zip');
const TMP_DIR = path.join(os.tmpdir(), 'healthicons-extract');
const DEST    = path.join(__dirname, '..', 'src', 'assets', 'healthicons');

function run(cmd, label) {
  process.stdout.write(`  ${label}... `);
  execSync(cmd, { stdio: 'pipe' });
  console.log('done');
}

(async () => {
  console.log('\n🏥  Syncing Health Icons from GitHub\n');

  run(`curl -fsSL -o "${TMP_ZIP}" "${ZIP_URL}"`,
      'Downloading archive');

  run(`rm -rf "${TMP_DIR}" && mkdir -p "${TMP_DIR}"`,
      'Preparing temp dir');

  run(`unzip -q "${TMP_ZIP}" "healthicons-main/public/icons/*" -d "${TMP_DIR}"`,
      'Extracting SVGs');

  run(`mkdir -p "${DEST}"`,
      'Ensuring destination exists');

  run(`cp -r "${TMP_DIR}/healthicons-main/public/icons/." "${DEST}/"`,
      'Copying icons to src/assets/healthicons');

  run(`rm -rf "${TMP_ZIP}" "${TMP_DIR}"`,
      'Cleaning up temp files');

  // Count what we got
  const count = parseInt(
    execSync(`find "${DEST}" -name "*.svg" | wc -l`).toString().trim(),
    10
  );
  console.log(`\n✅  ${count} SVG icons synced to src/assets/healthicons/`);
  console.log('   Usage: <app-health-icon category="body" name="lungs" />\n');
})().catch(err => {
  console.error('\n❌  Sync failed:', err.message);
  process.exit(1);
});
