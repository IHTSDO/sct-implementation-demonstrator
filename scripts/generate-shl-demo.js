const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'src/assets/data/ips-example-active-penicillin.json');
const outDir = path.join(rootDir, 'src/assets/shl/ips-example-active-penicillin');
const manifestPath = path.join(outDir, 'manifest.json');
const jwePath = path.join(outDir, 'ips-example-active-penicillin.jwe');
const metadataPath = path.join(outDir, 'demo-link-metadata.json');

const toBase64Url = (input) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

function encryptCompactJwe(plainText, keyBytes) {
  const protectedHeader = { alg: 'dir', enc: 'A256GCM' };
  const protectedHeaderB64 = toBase64Url(JSON.stringify(protectedHeader));

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(protectedHeaderB64, 'ascii'));

  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const jweCompact = [
    protectedHeaderB64,
    '',
    toBase64Url(iv),
    toBase64Url(ciphertext),
    toBase64Url(tag)
  ].join('.');

  return jweCompact;
}

function main() {
  const plainText = fs.readFileSync(sourcePath, 'utf8');
  fs.mkdirSync(outDir, { recursive: true });

  const envKey = process.env.SHL_DEMO_KEY_B64URL;
  const keyBytes = envKey
    ? Buffer.from(envKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(envKey.length / 4) * 4, '='), 'base64')
    : crypto.randomBytes(32);

  if (keyBytes.length !== 32) {
    throw new Error('SHL_DEMO_KEY_B64URL must decode to exactly 32 bytes for A256GCM');
  }

  const keyB64Url = toBase64Url(keyBytes);
  const jweCompact = encryptCompactJwe(plainText, keyBytes);

  const manifest = {
    presentationInfo: {
      name: 'IPS Example Active Penicillin'
    },
    files: [
      {
        contentType: 'application/fhir+json',
        location: './ips-example-active-penicillin.jwe'
      }
    ]
  };

  const metadata = {
    id: 'ips-example-active-penicillin',
    label: 'IPS Example Active Penicillin',
    sourceFile: 'assets/data/ips-example-active-penicillin.json',
    manifestFile: 'assets/shl/ips-example-active-penicillin/manifest.json',
    key: keyB64Url,
    alg: 'dir',
    enc: 'A256GCM'
  };

  fs.writeFileSync(jwePath, jweCompact, 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  console.log('Generated SHL demo files:');
  console.log(`- ${path.relative(rootDir, manifestPath)}`);
  console.log(`- ${path.relative(rootDir, jwePath)}`);
  console.log(`- ${path.relative(rootDir, metadataPath)}`);
  console.log('');
  console.log('Use this SHL key in SmartHealthLinksComponent:');
  console.log(keyB64Url);
}

main();
