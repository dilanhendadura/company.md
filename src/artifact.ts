import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ARTIFACT_CONTRACTS = ['generic/v1', 'presentation/v1'] as const;
export type ArtifactContract = typeof ARTIFACT_CONTRACTS[number];
export type ArtifactGateStatus = 'pass' | 'fail' | 'blocked' | 'not-run';
export type ArtifactCompletion = 'complete' | 'failed' | 'blocked' | 'incomplete';

export const PRESENTATION_REQUIRED_GATES = [
  'artifact/export',
  'artifact/render',
  'artifact/overflow',
  'design/conformance',
] as const;

export const REMOTE_REQUIRED_GATES = [
  'artifact/access',
  'artifact/revision',
] as const;

interface ArtifactFileRecord {
  path: string;
  exists: boolean;
  sha256: string | null;
}

interface ArtifactRemoteExport {
  mimeType: string;
  size: number;
  sha256?: string | null;
}

interface ArtifactRemoteRecord {
  kind: 'remote';
  url: string;
  provider: string;
  revisionId: string;
  mimeType: string;
  title?: string;
  export?: ArtifactRemoteExport;
}

type ArtifactDeliverable = ArtifactFileRecord | ArtifactRemoteRecord;

export interface ArtifactGate {
  id: string;
  status: ArtifactGateStatus;
  note?: string;
  evidence?: ArtifactFileRecord[];
}

export interface ArtifactVerificationFinding {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

export interface ArtifactVerificationReport {
  schema: 'companymd/artifact-verification/v1';
  valid: boolean;
  verificationMode: 'offline-integrity';
  receipt: string;
  root: string;
  contract: ArtifactContract | 'legacy/v1' | 'unknown';
  completion?: ArtifactCompletion;
  findings: ArtifactVerificationFinding[];
  summary: {
    errors: number;
    warnings: number;
  };
}

export interface VerifyArtifactOptions {
  root?: string;
}

export function verifyArtifactReceipt(receiptFile: string, options: VerifyArtifactOptions = {}): ArtifactVerificationReport {
  const absoluteReceipt = path.resolve(receiptFile);
  const root = path.resolve(options.root ?? process.cwd());
  const findings: ArtifactVerificationFinding[] = [];
  const add = (
    ruleId: string,
    severity: ArtifactVerificationFinding['severity'],
    message: string,
    findingPath?: string,
  ): void => {
    findings.push({ ruleId, severity, message, ...(findingPath ? { path: findingPath } : {}) });
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absoluteReceipt, 'utf8'));
  } catch (error) {
    add('receipt/read', 'error', error instanceof Error ? error.message : String(error), absoluteReceipt);
    return createReport(absoluteReceipt, root, 'unknown', undefined, findings);
  }

  if (!isRecord(parsed)) {
    add('receipt/type', 'error', 'Receipt must be a JSON object.', absoluteReceipt);
    return createReport(absoluteReceipt, root, 'unknown', undefined, findings);
  }

  if (parsed.schema !== 'companymd/receipt/v1') {
    add('receipt/schema', 'error', 'Receipt schema must be companymd/receipt/v1.', absoluteReceipt);
  }
  if (typeof parsed.generatedAt !== 'string' || Number.isNaN(Date.parse(parsed.generatedAt))) {
    add('receipt/generated-at', 'error', 'Receipt generatedAt must be an ISO-compatible date-time.', absoluteReceipt);
  }
  if (typeof parsed.profile !== 'string' || !['core', 'customer', 'commercial', 'communications', 'visual', 'all'].includes(parsed.profile)) {
    add('receipt/profile', 'error', 'Receipt profile is missing or unsupported.', absoluteReceipt);
  }
  if (typeof parsed.clearance !== 'string' || !['public', 'internal', 'confidential', 'restricted'].includes(parsed.clearance)) {
    add('receipt/clearance', 'error', 'Receipt clearance is missing or unsupported.', absoluteReceipt);
  }
  if (!stringArray(parsed.clientSources)) {
    add('receipt/client-sources', 'error', 'Receipt clientSources must be an array of non-empty strings.', absoluteReceipt);
  }
  if (!stringArray(parsed.unresolved)) {
    add('receipt/unresolved', 'error', 'Receipt unresolved must be an array of non-empty strings.', absoluteReceipt);
  }

  const contract = artifactContract(parsed.contract);
  if (contract === 'unknown') {
    add('receipt/contract', 'error', `Unknown artifact contract: ${String(parsed.contract)}.`, absoluteReceipt);
  } else if (contract === 'legacy/v1') {
    add('receipt/legacy-contract', 'warning', 'Receipt has no explicit artifact contract; regenerate it to enable contract-specific verification.', absoluteReceipt);
  }

  const deliverable = artifactDeliverable(parsed.deliverable);
  if (!deliverable) {
    add('receipt/deliverable', 'error', 'Receipt deliverable must be a local file record or a versioned HTTPS remote artifact.', absoluteReceipt);
  } else if (isRemoteDeliverable(deliverable)) {
    verifyRemoteDeliverable(deliverable, contract, add);
  } else {
    verifyFileRecord(deliverable, 'deliverable', root, add);
    if (contract === 'presentation/v1' && deliverable.exists === true) {
      verifyPresentationFormat(deliverable, root, add);
    }
  }

  const sources = fileRecordArray(parsed.sources);
  if (!sources) {
    add('receipt/sources', 'error', 'Receipt sources must be an array of file records.', absoluteReceipt);
  } else {
    sources.forEach((source, index) => verifyFileRecord(source, `sources/${index}`, root, add));
  }

  const completePresentation = contract === 'presentation/v1' && parsed.completion === 'complete';
  if (parsed.context !== undefined) {
    verifyContextBinding(parsed, root, completePresentation, add);
  } else if (completePresentation) {
    add('context/required', 'error', 'A completed presentation requires a bound context receipt, including its design and any required template.', absoluteReceipt);
  }
  if (parsed.attachments !== undefined) {
    const attachments = fileRecordArray(parsed.attachments);
    if (!attachments) add('receipt/attachments', 'error', 'Receipt attachments must be an array of file records.', absoluteReceipt);
    else attachments.forEach((attachment, index) => verifyFileRecord(attachment, `attachments/${index}`, root, add));
  }

  const intermediates = parsed.intermediates === undefined ? [] : fileRecordArray(parsed.intermediates);
  if (!intermediates) {
    add('receipt/intermediates', 'error', 'Receipt intermediates must be an array of file records.', absoluteReceipt);
  } else {
    intermediates.forEach((intermediate, index) => verifyFileRecord(intermediate, `intermediates/${index}`, root, add));
  }

  const gates = gateArray(parsed.verification);
  if (!gates) {
    add('receipt/verification', 'error', 'Receipt verification must be a non-empty array of gate records.', absoluteReceipt);
  } else {
    const seen = new Set<string>();
    for (const gate of gates) {
      if (seen.has(gate.id)) add('gate/duplicate', 'error', `Verification gate ${gate.id} appears more than once.`, gate.id);
      seen.add(gate.id);
      if (gate.evidence) gate.evidence.forEach((record, index) => verifyEvidence(record, gate, deliverable, root, add, `${gate.id}/evidence/${index}`));
    }

    if (contract === 'presentation/v1') {
      if (parsed.profile !== 'visual') {
        add('contract/profile', 'error', 'presentation/v1 receipts must use the visual profile.', absoluteReceipt);
      }
      for (const required of PRESENTATION_REQUIRED_GATES) {
        if (!seen.has(required)) add('gate/missing', 'error', `presentation/v1 requires verification gate ${required}.`, required);
      }
    }

    if (deliverable && isRemoteDeliverable(deliverable)) {
      for (const required of REMOTE_REQUIRED_GATES) {
        if (!seen.has(required)) add('gate/missing', 'error', `Remote artifacts require verification gate ${required}.`, required);
      }
      add('remote/offline', 'warning', 'This verifier checks recorded metadata and hashed provider observations offline. It does not confirm current access, the current revision, or the authenticity of the caller\'s provider observation.', absoluteReceipt);
    }

    const evidenceRequired = [
      ...(completePresentation ? ['artifact/render', 'artifact/overflow', 'design/conformance'] : []),
      ...(parsed.completion === 'complete' && deliverable && isRemoteDeliverable(deliverable) ? REMOTE_REQUIRED_GATES : []),
    ];
    for (const id of evidenceRequired) {
      if (!gates.find((gate) => gate.id === id)?.evidence?.length) {
        add('evidence/required', 'error', `Completed artifacts require hashed evidence for ${id}. A declared pass alone is insufficient.`, id);
      }
    }

    const completion = artifactCompletion(parsed.completion);
    if (!completion) {
      add('receipt/completion', 'error', 'Receipt completion must be complete, failed, blocked, or incomplete.', absoluteReceipt);
    } else if (deliverable) {
      const expected = deriveArtifactCompletion(gates, deliverableAvailable(deliverable));
      if (completion !== expected) {
        add('completion/mismatch', 'error', `Receipt says ${completion}, but its deliverable and gates derive ${expected}.`, absoluteReceipt);
      }
    }
  }

  return createReport(
    absoluteReceipt,
    root,
    contract,
    artifactCompletion(parsed.completion),
    findings,
  );
}

type AddFinding = (ruleId: string, severity: ArtifactVerificationFinding['severity'], message: string, path?: string) => void;

function readEvidenceJson(record: ArtifactFileRecord, label: string, root: string, add: AddFinding): Record<string, unknown> | undefined {
  verifyFileRecord(record, label, root, add);
  if (!record.exists) {
    add('evidence/absent', 'error', `${label} must exist.`, record.path);
    return undefined;
  }
  const absolute = resolveInsideRoot(record.path, root);
  if (!absolute) return undefined;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    if (!isRecord(parsed)) throw new Error('Expected a JSON object');
    return parsed;
  } catch (error) {
    add('evidence/read', 'error', `${label}: ${error instanceof Error ? error.message : String(error)}`, record.path);
    return undefined;
  }
}

function verifyContextBinding(receipt: Record<string, unknown>, root: string, requirePresentation: boolean, add: AddFinding): void {
  const record = fileRecord(receipt.context);
  if (!record || !isRecord(receipt.context)) {
    add('context/record', 'error', 'context must record the original context receipt path and SHA-256.');
    return;
  }
  const context = readEvidenceJson(record, 'context receipt', root, add);
  if (!context) return;
  if (context.schema !== 'companymd/context-receipt/v1') add('context/schema', 'error', 'Bound context schema must be companymd/context-receipt/v1.', record.path);
  if (typeof context.generatedAt !== 'string' || Number.isNaN(Date.parse(context.generatedAt))) add('context/generated-at', 'error', 'Bound context needs a valid generatedAt.', record.path);
  if (context.profile !== receipt.profile || context.clearance !== receipt.clearance) add('context/profile-clearance', 'error', 'Bound context profile and clearance must match the artifact receipt.', record.path);
  if (typeof context.subject !== 'string' || !context.subject.trim() || context.subject !== receipt.context.subject) add('context/subject', 'error', 'Artifact subject must match the bound context subject.', record.path);
  if (context.artifact !== receipt.context.artifact || (requirePresentation && context.artifact !== undefined && context.artifact !== 'presentation')) add('context/artifact', 'error', 'Artifact format must match the bound context artifact.', record.path);
  const contextPath = resolveInsideRoot(record.path, root);
  const sourceRoot = contextPath && typeof context.sourceRoot === 'string' && context.sourceRoot.length > 0 && !path.isAbsolute(context.sourceRoot)
    ? resolveInsideRoot(path.resolve(path.dirname(contextPath), context.sourceRoot), root) : undefined;
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    add('context/source-root', 'error', 'Context sourceRoot must resolve to a directory inside the verification root.', record.path);
    return;
  }
  const sourceRoles = ['company', 'customer', 'offer', 'voice', 'design'];
  const attachmentRoles = ['registry', 'template', 'templateSkill'];
  const resolved = new Map<string, Array<{ absolute: string; role: string }>>();
  for (const category of ['sources', 'attachments'] as const) {
    const expected = context[category];
    const copied = receipt[category];
    if (!Array.isArray(expected) || !Array.isArray(copied)) {
      add('context/files', 'error', `Both receipts must contain ${category} arrays.`, record.path);
      continue;
    }
    const expectedKeys: string[] = [];
    const actualKeys: string[] = [];
    const entries: Array<{ absolute: string; role: string }> = [];
    for (const entry of expected) {
      if (!isRecord(entry) || typeof entry.file !== 'string' || !entry.file || path.isAbsolute(entry.file)
        || typeof entry.role !== 'string' || !(category === 'sources' ? sourceRoles : attachmentRoles).includes(entry.role) || !isSha256(entry.sha256)) {
        add('context/file-record', 'error', `Invalid ${category} record in bound context.`, record.path);
        continue;
      }
      const absolute = resolveInsideRoot(path.resolve(sourceRoot, entry.file), root);
      if (!absolute) {
        add('context/outside-root', 'error', `Context source escapes verification root: ${entry.file}.`, entry.file);
        continue;
      }
      const levels = ['public', 'internal', 'confidential', 'restricted'];
      if (category === 'sources' && (typeof entry.classification !== 'string' || typeof context.clearance !== 'string'
        || !levels.includes(entry.classification) || levels.indexOf(entry.classification) > levels.indexOf(context.clearance))) {
        add('context/classification', 'error', `Source classification is invalid or exceeds context clearance: ${entry.file}.`, entry.file);
      }
      verifyFileRecord({ path: absolute, exists: true, sha256: entry.sha256 }, `context/${category}`, root, add);
      entries.push({ absolute, role: entry.role });
      expectedKeys.push(JSON.stringify([absolute, entry.role, entry.sha256, entry.classification, entry.status]));
    }
    for (const entry of copied) {
      if (!isRecord(entry) || typeof entry.path !== 'string' || entry.exists !== true) {
        add('context/file-record', 'error', `Invalid copied ${category} record.`, record.path);
        continue;
      }
      actualKeys.push(JSON.stringify([resolveInsideRoot(entry.path, root), entry.role, entry.sha256, entry.classification, entry.status]));
    }
    if (new Set(expectedKeys).size !== expectedKeys.length) add('context/duplicate-source', 'error', `Bound context repeats a ${category} record.`, record.path);
    if (JSON.stringify(expectedKeys.sort()) !== JSON.stringify(actualKeys.sort())) add('context/sources-mismatch', 'error', `Artifact ${category} must exactly match the paths, roles and hashes in its bound context.`, record.path);
    resolved.set(category, entries);
  }
  if (requirePresentation) {
    for (const role of sourceRoles) {
      if (!resolved.get('sources')?.some((entry) => entry.role === role)) add('context/missing-role', 'error', `Completed presentations require a ${role} source in the bound context.`, role);
    }
  }
  if (context.binding !== undefined) {
    if (!isRecord(context.binding)) add('context/binding', 'error', 'Context artifact binding must be an object.', record.path);
    else for (const role of ['design', 'template', 'templateSkill']) {
      const file = context.binding[role];
      if (file === undefined) continue;
      const absolute = typeof file === 'string' && !path.isAbsolute(file) ? resolveInsideRoot(path.resolve(sourceRoot, file), root) : undefined;
      if (!absolute || !resolved.get(role === 'design' ? 'sources' : 'attachments')?.some((entry) => entry.role === role && entry.absolute === absolute)) {
        add('context/binding-missing', 'error', `Required ${role} binding is missing from the bound files.`, role);
      }
    }
  }
}

function verifyEvidence(record: ArtifactFileRecord, gate: ArtifactGate, deliverable: ArtifactDeliverable | undefined, root: string, add: AddFinding, label: string): void {
  const evidence = readEvidenceJson(record, label, root, add);
  if (!evidence) return;
  if (evidence.schema !== 'companymd/evidence/v1' || evidence.gate !== gate.id
    || typeof evidence.method !== 'string' || !['measured', 'attestation', 'provider'].includes(evidence.method)
    || typeof evidence.observedAt !== 'string' || Number.isNaN(Date.parse(evidence.observedAt))
    || typeof evidence.details !== 'string' || !evidence.details.trim()) {
    add('evidence/schema', 'error', 'Evidence needs schema companymd/evidence/v1, matching gate, method, observedAt and non-empty details.', record.path);
  }
  if (REMOTE_REQUIRED_GATES.some((id) => id === gate.id) && evidence.method !== 'provider') add('evidence/provider', 'error', `${gate.id} requires a recorded provider observation.`, record.path);
  if (evidence.method === 'attestation') add('evidence/attestation', 'warning', `${gate.id} is a caller attestation; its file integrity is checked, not its semantic correctness.`, record.path);
  const identity = evidence.deliverable;
  if (!deliverable || !isRecord(identity) || (isRemoteDeliverable(deliverable)
    ? identity.url !== deliverable.url || identity.provider !== deliverable.provider || identity.revisionId !== deliverable.revisionId
    : identity.sha256 !== deliverable.sha256)) {
    add('evidence/deliverable', 'error', 'Evidence refers to a different deliverable hash or remote revision.', record.path);
  }
  if (evidence.files !== undefined) {
    const files = fileRecordArray(evidence.files);
    if (!files || files.some((file) => !file.exists)) add('evidence/files', 'error', 'Evidence files must be existing hashed file records relative to the verification root.', record.path);
    else files.forEach((file, index) => verifyFileRecord(file, `${label}/files/${index}`, root, add));
  }
}

function verifyRemoteDeliverable(
  deliverable: ArtifactRemoteRecord,
  contract: ArtifactVerificationReport['contract'],
  add: (ruleId: string, severity: ArtifactVerificationFinding['severity'], message: string, path?: string) => void,
): void {
  let parsedUrl: URL | undefined;
  try {
    parsedUrl = new URL(deliverable.url);
  } catch {
    add('remote/url', 'error', 'Remote artifact URL is invalid.', deliverable.url);
  }
  if (parsedUrl && parsedUrl.protocol !== 'https:') {
    add('remote/url', 'error', 'Remote artifact URL must use HTTPS.', deliverable.url);
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(deliverable.provider)) {
    add('remote/provider', 'error', 'Remote artifact provider must be a stable lowercase identifier.', deliverable.provider);
  }
  if (deliverable.revisionId.trim().length === 0) {
    add('remote/revision', 'error', 'Remote artifact revisionId must be non-empty.', deliverable.url);
  }
  if (!validMimeType(deliverable.mimeType)) {
    add('remote/mime-type', 'error', 'Remote artifact mimeType is invalid.', deliverable.mimeType);
  }
  if (deliverable.export) {
    if (!validMimeType(deliverable.export.mimeType)) {
      add('remote/export-mime-type', 'error', 'Remote artifact export mimeType is invalid.', deliverable.export.mimeType);
    }
    if (!Number.isSafeInteger(deliverable.export.size) || deliverable.export.size <= 0) {
      add('remote/export-size', 'error', 'Remote artifact export size must be a positive integer.', String(deliverable.export.size));
    }
    if (deliverable.export.sha256 !== undefined && deliverable.export.sha256 !== null && !isSha256(deliverable.export.sha256)) {
      add('remote/export-hash', 'error', 'Remote artifact export SHA-256 is invalid.', deliverable.url);
    }
  }
  if (contract === 'presentation/v1') {
    const candidateMimeTypes = [deliverable.mimeType, deliverable.export?.mimeType].filter((value): value is string => Boolean(value));
    if (!candidateMimeTypes.some(isPresentationMimeType)) {
      add('presentation/remote-format', 'error', 'Remote presentation must declare a native or exported presentation MIME type.', deliverable.url);
    }
  }
}

export function formatArtifactVerificationReport(report: ArtifactVerificationReport): string {
  const lines = [
    `Artifact receipt: ${report.receipt}`,
    `Contract: ${report.contract}`,
    `Declared completion: ${report.completion ?? 'unknown'}`,
    `Integrity: ${report.valid ? 'valid' : 'invalid'}`,
    'Verification: offline integrity and evidence coherence; semantic conformance is not independently established.',
    '',
  ];
  if (report.findings.length === 0) lines.push('No findings.');
  for (const finding of report.findings) {
    lines.push(`${finding.severity.toUpperCase().padEnd(7)} ${finding.ruleId}${finding.path ? ` ${finding.path}` : ''}`);
    lines.push(`        ${finding.message}`);
  }
  lines.push(`Summary: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s)`);
  return `${lines.join('\n')}\n`;
}

export function deriveArtifactCompletion(gates: ArtifactGate[], deliverableExists: boolean): ArtifactCompletion {
  if (gates.some((gate) => gate.status === 'fail')) return 'failed';
  if (gates.some((gate) => gate.status === 'blocked')) return 'blocked';
  if (!deliverableExists || gates.length === 0 || gates.some((gate) => gate.status === 'not-run')) return 'incomplete';
  return 'complete';
}

function verifyFileRecord(
  record: ArtifactFileRecord,
  label: string,
  root: string,
  add: (ruleId: string, severity: ArtifactVerificationFinding['severity'], message: string, path?: string) => void,
): void {
  const resolved = resolveInsideRoot(record.path, root);
  if (!resolved) {
    add('file/outside-root', 'error', `Recorded path escapes the verification root: ${record.path}.`, record.path);
    return;
  }
  const exists = fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  if (record.exists === false) {
    if (exists) add('file/unexpected-present', 'error', `Expected ${label} to be absent, but it now exists. Regenerate the receipt.`, record.path);
    if (record.sha256 !== null) add('file/expected-hash', 'error', `Absent ${label} must use a null SHA-256 value.`, record.path);
    return;
  }
  if (!exists) {
    add('file/missing', 'error', `Recorded ${label} is missing.`, record.path);
    return;
  }
  if (!isSha256(record.sha256)) {
    add('file/hash-format', 'error', `Recorded ${label} has an invalid SHA-256 value.`, record.path);
    return;
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  if (actual !== record.sha256) add('file/hash-mismatch', 'error', `Recorded ${label} changed after the receipt was created.`, record.path);
}

function resolveInsideRoot(recordedPath: string, root: string): string | undefined {
  try {
    const canonicalRoot = fs.realpathSync(root);
    const resolved = path.resolve(canonicalRoot, recordedPath);
    if (!isInsideRoot(resolved, canonicalRoot)) return undefined;
    if (!fs.existsSync(resolved)) return resolved;
    const canonicalFile = fs.realpathSync(resolved);
    return isInsideRoot(canonicalFile, canonicalRoot) ? canonicalFile : undefined;
  } catch {
    return undefined;
  }
}

function isInsideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function verifyPresentationFormat(
  deliverable: ArtifactFileRecord,
  root: string,
  add: (ruleId: string, severity: ArtifactVerificationFinding['severity'], message: string, path?: string) => void,
): void {
  const resolved = resolveInsideRoot(deliverable.path, root);
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return;
  const content = fs.readFileSync(resolved);
  const extension = path.extname(resolved).toLowerCase();
  const zipSignature = content.length >= 4 && content[0] === 0x50 && content[1] === 0x4b;
  let valid = false;
  if (['.pptx', '.pptm', '.ppsx'].includes(extension)) {
    valid = zipSignature
      && content.includes(Buffer.from('[Content_Types].xml'))
      && content.includes(Buffer.from('ppt/presentation.xml'));
  } else if (extension === '.pdf') {
    valid = content.subarray(0, 5).toString('ascii') === '%PDF-';
  } else if (extension === '.odp') {
    valid = zipSignature
      && content.includes(Buffer.from('content.xml'))
      && content.includes(Buffer.from('application/vnd.oasis.opendocument.presentation'));
  } else {
    add('presentation/format', 'error', `Unsupported presentation artifact extension: ${extension || '(none)'}.`, deliverable.path);
    return;
  }
  if (!valid) {
    add('presentation/format', 'error', `Deliverable does not have the expected ${extension} presentation structure.`, deliverable.path);
  }
}

function fileRecord(value: unknown): ArtifactFileRecord | undefined {
  if (!isRecord(value) || typeof value.path !== 'string' || value.path.length === 0 || typeof value.exists !== 'boolean') return undefined;
  if (value.sha256 !== null && typeof value.sha256 !== 'string') return undefined;
  return { path: value.path, exists: value.exists, sha256: value.sha256 as string | null };
}

function artifactDeliverable(value: unknown): ArtifactDeliverable | undefined {
  const local = fileRecord(value);
  if (local) return local;
  if (
    !isRecord(value)
    || value.kind !== 'remote'
    || typeof value.url !== 'string'
    || typeof value.provider !== 'string'
    || typeof value.revisionId !== 'string'
    || typeof value.mimeType !== 'string'
    || (value.title !== undefined && (typeof value.title !== 'string' || value.title.length === 0))
  ) return undefined;
  let remoteExport: ArtifactRemoteExport | undefined;
  if (value.export !== undefined) {
    if (
      !isRecord(value.export)
      || typeof value.export.mimeType !== 'string'
      || typeof value.export.size !== 'number'
      || (value.export.sha256 !== undefined && value.export.sha256 !== null && typeof value.export.sha256 !== 'string')
    ) return undefined;
    remoteExport = {
      mimeType: value.export.mimeType,
      size: value.export.size,
      ...(value.export.sha256 !== undefined ? { sha256: value.export.sha256 as string | null } : {}),
    };
  }
  return {
    kind: 'remote',
    url: value.url,
    provider: value.provider,
    revisionId: value.revisionId,
    mimeType: value.mimeType,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(remoteExport ? { export: remoteExport } : {}),
  };
}

function isRemoteDeliverable(deliverable: ArtifactDeliverable): deliverable is ArtifactRemoteRecord {
  return 'kind' in deliverable && deliverable.kind === 'remote';
}

function deliverableAvailable(deliverable: ArtifactDeliverable): boolean {
  return isRemoteDeliverable(deliverable) || deliverable.exists === true;
}

function fileRecordArray(value: unknown): ArtifactFileRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const records = value.map(fileRecord);
  return records.every((record): record is ArtifactFileRecord => record !== undefined) ? records : undefined;
}

function gateArray(value: unknown): ArtifactGate[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const allowed = new Set<ArtifactGateStatus>(['pass', 'fail', 'blocked', 'not-run']);
  const idPattern = /^[a-z0-9][a-z0-9._/-]{0,127}$/;
  const gates: ArtifactGate[] = [];
  for (const item of value) {
    if (
      !isRecord(item)
      || typeof item.id !== 'string'
      || !idPattern.test(item.id)
      || !allowed.has(item.status as ArtifactGateStatus)
      || (item.note !== undefined && (typeof item.note !== 'string' || item.note.length === 0))
    ) return undefined;
    const evidence = item.evidence === undefined ? undefined : fileRecordArray(item.evidence);
    if (item.evidence !== undefined && !evidence) return undefined;
    gates.push({ id: item.id, status: item.status as ArtifactGateStatus,
      ...(typeof item.note === 'string' ? { note: item.note } : {}),
      ...(evidence ? { evidence } : {}),
    });
  }
  return gates;
}

function artifactContract(value: unknown): ArtifactContract | 'legacy/v1' | 'unknown' {
  if (value === undefined) return 'legacy/v1';
  return ARTIFACT_CONTRACTS.includes(value as ArtifactContract) ? value as ArtifactContract : 'unknown';
}

function artifactCompletion(value: unknown): ArtifactCompletion | undefined {
  return ['complete', 'failed', 'blocked', 'incomplete'].includes(String(value)) ? value as ArtifactCompletion : undefined;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validMimeType(value: string): boolean {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value);
}

function isPresentationMimeType(value: string): boolean {
  return new Set([
    'application/vnd.google-apps.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.oasis.opendocument.presentation',
    'application/pdf',
  ]).has(value.toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function createReport(
  receipt: string,
  root: string,
  contract: ArtifactVerificationReport['contract'],
  completion: ArtifactCompletion | undefined,
  findings: ArtifactVerificationFinding[],
): ArtifactVerificationReport {
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  return {
    schema: 'companymd/artifact-verification/v1',
    valid: errors === 0,
    verificationMode: 'offline-integrity',
    receipt,
    root,
    contract,
    ...(completion ? { completion } : {}),
    findings,
    summary: { errors, warnings },
  };
}
