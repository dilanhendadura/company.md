#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const HELP = `Create an artifact-level Company.md receipt.

Usage:
  node create-receipt.mjs --output <json> (--deliverable <file> | --expected-deliverable <path> | --remote-url <https-url>) --profile <profile> --clearance <level> [options]

Options:
  --root <directory>       Store portable paths relative to this root
  --contract <name>        Artifact contract: generic/v1 or presentation/v1 (default: generic/v1)
  --provider <id>          Remote provider id, for example google-slides
  --revision <id>          Remote artifact revision id
  --mime-type <type>       Remote artifact native MIME type
  --title <text>           Optional remote artifact title
  --export-mime-type <t>   Optional remote export MIME type
  --export-size <bytes>     Optional remote export byte size
  --export-sha256 <hash>   Optional SHA-256 for exported remote bytes
  --source <file>          Governed source file; repeat as needed
  --context-receipt <json> Bind resolved context and copy its verified sources and attachments
  --evidence <id=json>     Hashed companymd/evidence/v1 proof for a gate; repeat as needed
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
  const repeatable = new Set(['source', 'intermediate', 'client-source', 'unresolved', 'check', 'check-note', 'evidence']);
  const allowed = new Set([
    'output', 'deliverable', 'expected-deliverable', 'remote-url', 'provider', 'revision', 'mime-type', 'title',
    'export-mime-type', 'export-size', 'export-sha256', 'profile', 'clearance', 'root', 'contract', 'context-receipt', ...repeatable,
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) throw new Error(`Unexpected argument: ${token ?? ''}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    if (repeatable.has(key)) {
      repeated.set(key, [...(repeated.get(key) ?? []), value]);
    } else {
      if (values.has(key)) throw new Error(`Duplicate option: --${key}`);
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
  const absolute = fs.realpathSync(path.resolve(file));
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
  let absolute = path.resolve(file);
  if (fs.existsSync(absolute)) {
    throw new Error(`Expected deliverable already exists; use --deliverable instead: ${absolute}`);
  }
  let parent = path.dirname(absolute);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  absolute = path.resolve(fs.realpathSync(parent), path.relative(parent, absolute));
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
  if (!deliverableExists || verification.length === 0 || verification.some((check) => check.status === 'not-run')) return 'incomplete';
  return 'complete';
}

const { values, repeated } = parseArgs(process.argv.slice(2));
const output = values.get('output');
const deliverable = values.get('deliverable');
const expectedDeliverable = values.get('expected-deliverable');
const remoteUrl = values.get('remote-url');
const profile = values.get('profile');
const clearance = values.get('clearance');
const root = values.get('root') ? fs.realpathSync(path.resolve(values.get('root'))) : undefined;
const contract = values.get('contract') ?? 'generic/v1';
const verification = verificationChecks(repeated.get('check') ?? [], repeated.get('check-note') ?? []);
const deliverableModes = [deliverable, expectedDeliverable, remoteUrl].filter(Boolean);
if (!output || deliverableModes.length !== 1 || !profile || !clearance) {
  throw new Error('Required: --output, exactly one of --deliverable, --expected-deliverable, or --remote-url, --profile, and --clearance');
}
const remoteOnlyOptions = ['provider', 'revision', 'mime-type', 'title', 'export-mime-type', 'export-size', 'export-sha256']
  .filter((key) => values.has(key));
if (!remoteUrl && remoteOnlyOptions.length > 0) {
  throw new Error(`Remote-only options require --remote-url: ${remoteOnlyOptions.map((key) => `--${key}`).join(', ')}`);
}
if (!new Set(['core', 'customer', 'commercial', 'communications', 'visual', 'all']).has(profile)) {
  throw new Error(`Invalid --profile ${profile}`);
}
if (!new Set(['public', 'internal', 'confidential', 'restricted']).has(clearance)) {
  throw new Error(`Invalid --clearance ${clearance}`);
}
if (!new Set(['generic/v1', 'presentation/v1']).has(contract)) {
  throw new Error(`Invalid --contract ${contract}; expected generic/v1 or presentation/v1`);
}
if (verification.length === 0) throw new Error('At least one --check verification gate is required');
if (remoteUrl) {
  let parsedRemote;
  try {
    parsedRemote = new URL(remoteUrl);
  } catch {
    throw new Error('--remote-url must be a valid HTTPS URL');
  }
  if (parsedRemote.protocol !== 'https:') throw new Error('--remote-url must use HTTPS');
  const provider = values.get('provider');
  const revision = values.get('revision');
  const mimeType = values.get('mime-type');
  if (!provider || !revision || !mimeType) throw new Error('Remote artifacts require --provider, --revision, and --mime-type');
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(provider)) throw new Error('--provider must be a stable lowercase identifier');
  if (!validMimeType(mimeType)) throw new Error('--mime-type is invalid');
  const required = ['artifact/access', 'artifact/revision'];
  const present = new Set(verification.map((check) => check.id));
  const missing = required.filter((id) => !present.has(id));
  if (missing.length) throw new Error(`Remote artifacts are missing required verification gates: ${missing.join(', ')}`);
}
if (contract === 'presentation/v1') {
  if (profile !== 'visual') throw new Error('presentation/v1 requires --profile visual');
  const required = ['artifact/export', 'artifact/render', 'artifact/overflow', 'design/conformance'];
  const present = new Set(verification.map((check) => check.id));
  const missing = required.filter((id) => !present.has(id));
  if (missing.length) throw new Error(`presentation/v1 is missing required verification gates: ${missing.join(', ')}`);
}
if (expectedDeliverable && !verification.some((check) => ['fail', 'blocked'].includes(check.status))) {
  throw new Error('--expected-deliverable requires at least one failed or blocked verification gate');
}
const deliverableRecord = deliverable
  ? fileRecord(deliverable, root)
  : expectedDeliverable
    ? expectedFileRecord(expectedDeliverable, root)
    : remoteRecord(values);

const completion = completionStatus(verification, remoteUrl ? true : deliverableRecord.exists);
const contextFile = values.get('context-receipt');
if (contextFile && repeated.has('source')) throw new Error('--context-receipt copies authoritative sources; do not combine it with --source');
const bound = contextFile ? bindContext(contextFile, root ?? fs.realpathSync(process.cwd()), profile, clearance, contract, completion) : undefined;
attachEvidence(verification, repeated.get('evidence') ?? [], deliverableRecord, root ?? fs.realpathSync(process.cwd()));
if (contract === 'presentation/v1' && completion === 'complete' && !bound) throw new Error('Completed presentation/v1 requires --context-receipt');
const requiredEvidence = [
  ...(contract === 'presentation/v1' && completion === 'complete' ? ['artifact/render', 'artifact/overflow', 'design/conformance'] : []),
  ...(remoteUrl && completion === 'complete' ? ['artifact/access', 'artifact/revision'] : []),
];
for (const id of requiredEvidence) {
  if (!verification.find((gate) => gate.id === id)?.evidence?.length) throw new Error(`Completed artifact requires --evidence ${id}=<json>`);
}

const receipt = {
  schema: 'companymd/receipt/v1',
  contract,
  generatedAt: new Date().toISOString(),
  profile,
  clearance,
  deliverable: deliverableRecord,
  sources: bound?.sources ?? (repeated.get('source') ?? []).map((source) => fileRecord(source, root)),
  ...(bound ? { context: bound.context, attachments: bound.attachments } : {}),
  intermediates: (repeated.get('intermediate') ?? []).map((intermediate) => fileRecord(intermediate, root)),
  clientSources: repeated.get('client-source') ?? [],
  unresolved: repeated.get('unresolved') ?? [],
  ...(verification.length ? {
    completion,
    verification,
  } : {}),
};

const destination = path.resolve(output);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${destination}\n`);

function remoteRecord(values) {
  const exportMimeType = values.get('export-mime-type');
  const exportSizeText = values.get('export-size');
  const exportSha256 = values.get('export-sha256');
  const exportOptions = [exportMimeType, exportSizeText, exportSha256].filter(Boolean);
  if (exportOptions.length > 0 && (!exportMimeType || !exportSizeText)) {
    throw new Error('Remote export metadata requires --export-mime-type and --export-size');
  }
  let remoteExport;
  if (exportMimeType && exportSizeText) {
    if (!validMimeType(exportMimeType)) throw new Error('--export-mime-type is invalid');
    const size = Number(exportSizeText);
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('--export-size must be a positive integer');
    if (exportSha256 && !/^[a-f0-9]{64}$/.test(exportSha256)) throw new Error('--export-sha256 must be a lowercase SHA-256 hash');
    remoteExport = {
      mimeType: exportMimeType,
      size,
      ...(exportSha256 ? { sha256: exportSha256 } : {}),
    };
  }
  return {
    kind: 'remote',
    url: values.get('remote-url'),
    provider: values.get('provider'),
    revisionId: values.get('revision'),
    mimeType: values.get('mime-type'),
    ...(values.get('title') ? { title: values.get('title') } : {}),
    ...(remoteExport ? { export: remoteExport } : {}),
  };
}

function validMimeType(value) {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value);
}

function bindContext(file, root, profile, clearance, contract, completion) {
  const contextRecord = fileRecord(file, root);
  const contextPath = path.resolve(root, contextRecord.path);
  const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  if (!context || context.schema !== 'companymd/context-receipt/v1') throw new Error('Invalid context receipt schema');
  if (typeof context.generatedAt !== 'string' || Number.isNaN(Date.parse(context.generatedAt))) throw new Error('Context receipt needs valid generatedAt');
  if (context.profile !== profile || context.clearance !== clearance) throw new Error('Context receipt profile and clearance must match --profile and --clearance');
  if (typeof context.subject !== 'string' || !context.subject.trim()) throw new Error('Context receipt needs a resolved subject');
  if (contract === 'presentation/v1' && context.artifact !== undefined && context.artifact !== 'presentation') throw new Error('Context artifact does not match presentation/v1');
  if (typeof context.sourceRoot !== 'string' || !context.sourceRoot || path.isAbsolute(context.sourceRoot)) throw new Error('Context sourceRoot must be relative to its receipt');
  const sourceRoot = fs.realpathSync(path.resolve(path.dirname(contextPath), context.sourceRoot));
  portablePath(sourceRoot, root);
  if (!fs.statSync(sourceRoot).isDirectory()) throw new Error('Context sourceRoot must be a directory');
  const sources = copyContextFiles(context.sources, sourceRoot, root, ['company', 'customer', 'offer', 'voice', 'design'], clearance);
  const attachments = copyContextFiles(context.attachments, sourceRoot, root, ['registry', 'template', 'templateSkill']);
  if (contract === 'presentation/v1' && completion === 'complete') {
    for (const role of ['company', 'customer', 'offer', 'voice', 'design']) {
      if (!sources.some((source) => source.role === role)) throw new Error(`Completed presentation requires context source role ${role}`);
    }
  }
  if (context.binding !== undefined) {
    if (!context.binding || typeof context.binding !== 'object' || Array.isArray(context.binding)) throw new Error('Context binding must be an object');
    for (const role of ['design', 'template', 'templateSkill']) {
      const binding = context.binding[role];
      if (binding === undefined) continue;
      if (typeof binding !== 'string' || path.isAbsolute(binding)) throw new Error(`Invalid context ${role} binding`);
      const expected = fileRecord(path.resolve(sourceRoot, binding), root);
      if (!(role === 'design' ? sources : attachments).some((entry) => entry.role === role && entry.path === expected.path && entry.sha256 === expected.sha256)) throw new Error(`Missing required context ${role} binding`);
    }
  }
  return {
    context: { ...contextRecord, subject: context.subject, ...(context.artifact !== undefined ? { artifact: context.artifact } : {}) },
    sources, attachments,
  };
}

function copyContextFiles(entries, sourceRoot, root, roles, clearance) {
  if (!Array.isArray(entries)) throw new Error('Context sources and attachments must be arrays');
  const seen = new Set();
  return entries.map((entry) => {
    if (!entry || typeof entry.file !== 'string' || !entry.file || path.isAbsolute(entry.file) || !roles.includes(entry.role) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid context file record');
    const actual = fileRecord(path.resolve(sourceRoot, entry.file), root);
    if (actual.sha256 !== entry.sha256) throw new Error(`Stale context source hash: ${entry.file}`);
    const key = `${entry.role}:${actual.path}`;
    if (seen.has(key)) throw new Error(`Duplicate context source: ${entry.file}`);
    seen.add(key);
    if (clearance) {
      const levels = ['public', 'internal', 'confidential', 'restricted'];
      if (!levels.includes(entry.classification) || levels.indexOf(entry.classification) > levels.indexOf(clearance)) throw new Error(`Context source exceeds clearance or has invalid classification: ${entry.file}`);
      if (entry.status !== undefined && typeof entry.status !== 'string') throw new Error(`Invalid source status: ${entry.file}`);
    }
    return { ...actual, role: entry.role,
      ...(clearance ? { classification: entry.classification } : {}),
      ...(entry.status !== undefined ? { status: entry.status } : {}),
    };
  });
}

function attachEvidence(gates, values, deliverable, root) {
  for (const value of values) {
    const [id, file] = parseAssignment(value, '--evidence');
    const gate = gates.find((entry) => entry.id === id);
    if (!gate) throw new Error(`--evidence references missing --check id: ${id}`);
    const record = fileRecord(file, root);
    const evidence = JSON.parse(fs.readFileSync(path.resolve(root, record.path), 'utf8'));
    if (!evidence || evidence.schema !== 'companymd/evidence/v1' || evidence.gate !== id
      || !['measured', 'attestation', 'provider'].includes(evidence.method)
      || typeof evidence.observedAt !== 'string' || Number.isNaN(Date.parse(evidence.observedAt))
      || typeof evidence.details !== 'string' || !evidence.details.trim()) throw new Error(`Invalid companymd/evidence/v1 evidence for ${id}`);
    const identity = evidence.deliverable;
    if (!identity || (deliverable.kind === 'remote'
      ? identity.url !== deliverable.url || identity.provider !== deliverable.provider || identity.revisionId !== deliverable.revisionId
      : identity.sha256 !== deliverable.sha256)) throw new Error(`Evidence ${id} refers to a different deliverable`);
    if (['artifact/access', 'artifact/revision'].includes(id) && evidence.method !== 'provider') throw new Error(`${id} requires provider observation evidence`);
    if (evidence.files !== undefined) {
      if (!Array.isArray(evidence.files)) throw new Error(`Evidence ${id} files must be an array`);
      for (const entry of evidence.files) {
        if (!entry || typeof entry.path !== 'string' || entry.exists !== true) throw new Error(`Invalid evidence file for ${id}`);
        const actual = fileRecord(path.resolve(root, entry.path), root);
        if (actual.sha256 !== entry.sha256) throw new Error(`Stale evidence file hash: ${entry.path}`);
      }
    }
    if (gate.evidence?.some((existing) => existing.path === record.path)) throw new Error(`Duplicate evidence for ${id}: ${record.path}`);
    (gate.evidence ??= []).push(record);
  }
}
