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

interface ArtifactFileRecord {
  path: string;
  exists: boolean;
  sha256: string | null;
}

export interface ArtifactGate {
  id: string;
  status: ArtifactGateStatus;
  note?: string;
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
  if (!['core', 'customer', 'commercial', 'communications', 'visual', 'all'].includes(String(parsed.profile))) {
    add('receipt/profile', 'error', 'Receipt profile is missing or unsupported.', absoluteReceipt);
  }
  if (!['public', 'internal', 'confidential', 'restricted'].includes(String(parsed.clearance))) {
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

  const deliverable = fileRecord(parsed.deliverable);
  if (!deliverable) {
    add('receipt/deliverable', 'error', 'Receipt deliverable must include a path, exists flag, and SHA-256 value.', absoluteReceipt);
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
    }

    if (contract === 'presentation/v1') {
      if (parsed.profile !== 'visual') {
        add('contract/profile', 'error', 'presentation/v1 receipts must use the visual profile.', absoluteReceipt);
      }
      for (const required of PRESENTATION_REQUIRED_GATES) {
        if (!seen.has(required)) add('gate/missing', 'error', `presentation/v1 requires verification gate ${required}.`, required);
      }
    }

    const completion = artifactCompletion(parsed.completion);
    if (!completion) {
      add('receipt/completion', 'error', 'Receipt completion must be complete, failed, blocked, or incomplete.', absoluteReceipt);
    } else if (deliverable) {
      const expected = deriveArtifactCompletion(gates, deliverable.exists === true);
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

export function formatArtifactVerificationReport(report: ArtifactVerificationReport): string {
  const lines = [
    `Artifact receipt: ${report.receipt}`,
    `Contract: ${report.contract}`,
    `Completion: ${report.completion ?? 'unknown'}`,
    `Integrity: ${report.valid ? 'valid' : 'invalid'}`,
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
    gates.push({ id: item.id, status: item.status as ArtifactGateStatus, ...(typeof item.note === 'string' ? { note: item.note } : {}) });
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
    receipt,
    root,
    contract,
    ...(completion ? { completion } : {}),
    findings,
    summary: { errors, warnings },
  };
}
