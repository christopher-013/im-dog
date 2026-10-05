// Post-build guard: private references must not ship, and public-release response headers must ship.
// Runs automatically at the end of `npm run build`.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = path.join(root, 'dist');
const referenceDir = path.join(root, 'reference');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (!existsSync(distDir)) {
  console.error('verify-dist: dist/ not found. Run vite build first.');
  process.exit(1);
}

const referenceHashes = new Map();
if (existsSync(referenceDir)) {
  for (const file of walk(referenceDir)) {
    if (file.endsWith('.md')) continue;
    referenceHashes.set(sha256(file), path.relative(root, file));
  }
}

const problems = [];
const wranglerConfig = readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
if (!/"main"\s*:\s*"\.\/src\/feedback\/entry\.ts"/.test(wranglerConfig)) {
  problems.push('wrangler.jsonc (Worker must use the handler-only entry point)');
}
const headersFile = path.join(distDir, '_headers');
if (!existsSync(headersFile)) {
  problems.push('_headers (missing security and cache rules)');
} else {
  const headers = readFileSync(headersFile, 'utf8');
  if (!/\/\*\s*\n(?:[^\n]*\n)*?\s*Content-Security-Policy: frame-ancestors 'none';/.test(headers)) {
    problems.push('_headers (missing page frame protection)');
  }
  if (!/\/app\/\*\s*\n\s*Cache-Control: public, max-age=31536000, immutable/.test(headers)) {
    problems.push('_headers (missing fingerprinted-asset cache rule)');
  }
  if (/\/sw\.js\s*\n\s*Cache-Control:.*immutable/i.test(headers) || /\/index\.html\s*\n\s*Cache-Control:.*immutable/i.test(headers)) {
    problems.push('_headers (HTML or service worker must not be immutable)');
  }
}
let checked = 0;
for (const file of walk(distDir)) {
  checked++;
  const rel = path.relative(distDir, file);
  if (/(^|[\\/])reference([\\/]|$)/i.test(rel)) problems.push(`${rel} (lives under a "reference" path)`);
  const match = referenceHashes.get(sha256(file));
  if (match) problems.push(`${rel} (identical to private photo ${match})`);
}

if (problems.length > 0) {
  console.error(`verify-dist: release guard failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(
  `verify-dist: OK. ${checked} files checked against ${referenceHashes.size} private reference files; none leaked.`,
);
