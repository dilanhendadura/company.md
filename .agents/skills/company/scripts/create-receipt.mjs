#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const values = new Map();
  const repeated = new Map();
  const repeatable = new Set(['source', 'client-source', 'unresolved']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) throw new Error(`Unexpected argument: ${token ?? ''}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    if (repeatable.has(key)) {
      repeated.set(key, [...(repeated.get(key) ?? []), value]);
    } else {
      values.set(key, value);
    }
    index += 1;
  }
  return { values, repeated };
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fileRecord(file, root) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`File does not exist: ${absolute}`);
  }
  const relative = root ? path.relative(root, absolute) : undefined;
  if (relative && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    throw new Error(`Receipt file is outside --root: ${absolute}`);
  }
  return {
    path: relative || (root ? path.basename(absolute) : absolute),
    sha256: hashFile(absolute),
  };
}

const { values, repeated } = parseArgs(process.argv.slice(2));
const output = values.get('output');
const deliverable = values.get('deliverable');
const profile = values.get('profile');
const clearance = values.get('clearance');
const root = values.get('root') ? path.resolve(values.get('root')) : undefined;
if (!output || !deliverable || !profile || !clearance) {
  throw new Error('Required: --output, --deliverable, --profile, and --clearance');
}

const receipt = {
  schema: 'companymd/receipt/v1',
  generatedAt: new Date().toISOString(),
  profile,
  clearance,
  deliverable: fileRecord(deliverable, root),
  sources: (repeated.get('source') ?? []).map((source) => fileRecord(source, root)),
  clientSources: repeated.get('client-source') ?? [],
  unresolved: repeated.get('unresolved') ?? [],
};

const destination = path.resolve(output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${destination}\n`);
