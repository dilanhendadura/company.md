#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HELP = `Create an artifact-level Company.md receipt.

Usage:
  node create-receipt.mjs --output <json> (--deliverable <file> | --expected-deliverable <path>) --profile <profile> --clearance <level> [options]

Options:
  --root <directory>       Store portable paths relative to this root
  --source <file>          Governed source file; repeat as needed
  --intermediate <file>    Generated intermediate file; repeat as needed
  --client-source <label>  Client input or source label; repeat as needed
  --unresolved <item>      Unresolved fact or approval; repeat as needed
  --check <id=status>      Verification gate; status is pass, fail, blocked, or not-run
  --check-note <id=text>   Explanation for a verification gate; repeat as needed
  --help, -h               Show this help
`;

if (process.argv.slice(2).some((argument) => argument === '--help' || argument === '-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

function parseArgs(argv) {
  const values = new Map();
  const repeated = new Map();
  const repeatable = new Set(['source', 'intermediate', 'client-source', 'unresolved', 'check', 'check-note']);
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
  return {
    path: portablePath(absolute, root),
    exists: true,
    sha256: hashFile(absolute),
  };
}

function expectedFileRecord(file, root) {
  const absolute = path.resolve(file);
  if (fs.existsSync(absolute)) {
    throw new Error(`Expected deliverable already exists; use --deliverable instead: ${absolute}`);
  }
  return {
    path: portablePath(absolute, root),
    exists: false,
    sha256: null,
  };
}

function portablePath(absolute, root) {
  const relative = root ? path.relative(root, absolute) : undefined;
  if (relative && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    throw new Error(`Receipt file is outside --root: ${absolute}`);
  }
  return relative || (root ? path.basename(absolute) : absolute);
}

function verificationChecks(values, noteValues) {
  const allowed = new Set(['pass', 'fail', 'blocked', 'not-run']);
  const idPattern = /^[a-z0-9][a-z0-9._/-]{0,127}$/;
  const seen = new Set();
  const notes = new Map();
  for (const value of noteValues) {
    const [id, note] = parseAssignment(value, '--check-note');
    if (notes.has(id)) throw new Error(`Duplicate --check-note id: ${id}`);
    notes.set(id, note);
  }
  const checks = values.map((value) => {
    const separator = value.indexOf('=');
    const id = separator === -1 ? '' : value.slice(0, separator).trim();
    const status = separator === -1 ? '' : value.slice(separator + 1).trim();
    if (!idPattern.test(id) || !allowed.has(status)) {
      throw new Error(`Invalid --check ${value}; expected <id>=pass|fail|blocked|not-run`);
    }
    if (seen.has(id)) throw new Error(`Duplicate --check id: ${id}`);
    seen.add(id);
    return { id, status, ...(notes.has(id) ? { note: notes.get(id) } : {}) };
  });
  for (const id of notes.keys()) {
    if (!seen.has(id)) throw new Error(`--check-note references missing --check id: ${id}`);
  }
  return checks;
}

function parseAssignment(value, label) {
  const separator = value.indexOf('=');
  const id = separator === -1 ? '' : value.slice(0, separator).trim();
  const assigned = separator === -1 ? '' : value.slice(separator + 1).trim();
  if (!id || !assigned) throw new Error(`Invalid ${label} ${value}; expected <id>=<value>`);
  return [id, assigned];
}

function completionStatus(verification, deliverableExists) {
  if (verification.some((check) => check.status === 'fail')) return 'failed';
  if (verification.some((check) => check.status === 'blocked')) return 'blocked';
  if (!deliverableExists || verification.some((check) => check.status === 'not-run')) return 'incomplete';
  return 'complete';
}

const { values, repeated } = parseArgs(process.argv.slice(2));
const output = values.get('output');
const deliverable = values.get('deliverable');
const expectedDeliverable = values.get('expected-deliverable');
const profile = values.get('profile');
const clearance = values.get('clearance');
const root = values.get('root') ? path.resolve(values.get('root')) : undefined;
const verification = verificationChecks(repeated.get('check') ?? [], repeated.get('check-note') ?? []);
if (!output || (!deliverable && !expectedDeliverable) || !profile || !clearance) {
  throw new Error('Required: --output, exactly one of --deliverable or --expected-deliverable, --profile, and --clearance');
}
if (deliverable && expectedDeliverable) throw new Error('Use exactly one of --deliverable or --expected-deliverable');
if (!new Set(['core', 'customer', 'commercial', 'communications', 'visual', 'all']).has(profile)) {
  throw new Error(`Invalid --profile ${profile}`);
}
if (!new Set(['public', 'internal', 'confidential', 'restricted']).has(clearance)) {
  throw new Error(`Invalid --clearance ${clearance}`);
}
if (expectedDeliverable && !verification.some((check) => ['fail', 'blocked'].includes(check.status))) {
  throw new Error('--expected-deliverable requires at least one failed or blocked verification gate');
}
const deliverableRecord = deliverable ? fileRecord(deliverable, root) : expectedFileRecord(expectedDeliverable, root);

const receipt = {
  schema: 'companymd/receipt/v1',
  generatedAt: new Date().toISOString(),
  profile,
  clearance,
  deliverable: deliverableRecord,
  sources: (repeated.get('source') ?? []).map((source) => fileRecord(source, root)),
  intermediates: (repeated.get('intermediate') ?? []).map((intermediate) => fileRecord(intermediate, root)),
  clientSources: repeated.get('client-source') ?? [],
  unresolved: repeated.get('unresolved') ?? [],
  ...(verification.length ? {
    completion: completionStatus(verification, deliverableRecord.exists),
    verification,
  } : {}),
};

const destination = path.resolve(output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${destination}\n`);
