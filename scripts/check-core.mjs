// Fails when src/core/ was edited by hand or no longer matches sumry/web core/.
// The vendored files carry a sha256 of their body, so hand edits are caught without the
// web repo; when the web repo is around ($SUMRY_WEB_CORE, default /opt/docker/websites/sumry/core)
// the copy is also compared with the source.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const dest = path.resolve(here, '../src/core');
const source = process.env.SUMRY_WEB_CORE ?? '/opt/docker/websites/sumry/core';
const HEADER = /^\/\/ generated - edit in sumry\/web core\/ and run scripts\/sync-core\.sh\. sha256:([0-9a-f]{64})\n/;
const sha = (s) => createHash('sha256').update(s).digest('hex');

const problems = [];
const vendored = fs.readdirSync(dest).filter((f) => f.endsWith('.ts')).sort();

for (const f of vendored) {
  const text = fs.readFileSync(path.join(dest, f), 'utf8');
  const m = HEADER.exec(text);
  if (!m) {
    problems.push(`${f}: missing generated header`);
    continue;
  }
  const body = text.slice(m[0].length);
  if (sha(body) !== m[1]) problems.push(`${f}: edited by hand (hash mismatch)`);
}

if (fs.existsSync(source)) {
  const expected = fs.readdirSync(source).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
  for (const f of expected) {
    if (!vendored.includes(f)) {
      problems.push(`${f}: missing, run scripts/sync-core.sh in sumry/web`);
      continue;
    }
    const body = fs.readFileSync(path.join(dest, f), 'utf8').replace(HEADER, '');
    if (body !== fs.readFileSync(path.join(source, f), 'utf8')) problems.push(`${f}: out of date with ${source}`);
  }
  for (const f of vendored) if (!expected.includes(f)) problems.push(`${f}: no longer in ${source}`);
} else {
  console.warn(`check-core: ${source} not found, only checked the hashes`);
}

if (problems.length) {
  console.error(`src/core differs from sumry/web core/:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-core: ${vendored.length} files ok`);
