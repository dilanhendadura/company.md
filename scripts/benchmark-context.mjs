import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { createContext } from '../dist/context.js';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-bench-')));
fs.mkdirSync(path.join(root, '.git'));
const base = path.join(root, 'base');
const child = path.join(root, 'product');
fs.cpSync(path.join(repository, 'examples/northstar'), base, { recursive: true });
fs.cpSync(base, child, { recursive: true });
for (const file of ['COMPANY.md','CUSTOMER.md','OFFER.md','VOICE.md']) {
  const source = path.join(child, file);
  fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replaceAll('northstar-cloud', 'northstar-cloud.product').replace('claims:', `extends: ../base/${file}\nclaims:`));
}
function measure(fn, samples = 30) {
  for (let i = 0; i < 5; i++) fn();
  const values = [];
  for (let i = 0; i < samples; i++) { const start = performance.now(); fn(); values.push(performance.now() - start); }
  values.sort((a,b) => a-b);
  return { samples, medianMs: +values[Math.floor(samples / 2)].toFixed(2), p95Ms: +values[Math.ceil(samples * .95) - 1].toFixed(2) };
}
const realRead = fs.readFileSync;
let sourceReads = 0;
fs.readFileSync = function (file, ...args) { if (typeof file === 'string' && file.startsWith(base) && file.endsWith('.md')) sourceReads++; return realRead.call(this, file, ...args); };
try { createContext(base, { profile: 'visual' }); } finally { fs.readFileSync = realRead; }
const full = createContext(child, { profile: 'visual' });
const compact = createContext(child, { profile: 'visual', compact: true });
const result = {
  node: process.version, platform: `${process.platform}-${process.arch}`, generatedAt: new Date().toISOString(),
  uniqueSources: 5, sourceReads,
  visual: measure(() => createContext(base, { profile: 'visual' })),
  core: measure(() => createContext(base, { profile: 'core' })),
  overlayFull: measure(() => createContext(child, { profile: 'visual' })),
  overlayCompact: measure(() => createContext(child, { profile: 'visual', compact: true })),
  overlayBytes: { full: Buffer.byteLength(full.markdown), compact: Buffer.byteLength(compact.markdown), omittedDuplicateSections: compact.stats.omittedDuplicateSections },
  cli: measure(() => { const c = spawnSync(process.execPath, [path.join(repository, 'dist/cli.js'), 'context', base, '--profile', 'visual'], { stdio: 'ignore' }); if (c.status) throw new Error('CLI failed'); }, 10),
  note: 'Local warm microbenchmark, not model inference or total artifact latency. Exact duplicate prose only; original source hashes are unchanged.',
};
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
fs.rmSync(root, { recursive: true, force: true });
