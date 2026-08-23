import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deriveArtifactCompletion,
  formatArtifactVerificationReport,
  verifyArtifactReceipt,
  type ArtifactGate,
} from '../src/artifact.js';

const digest = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-artifact-verify-'));
  const deliverable = Buffer.from('verified artifact');
  const source = Buffer.from('# Company\n');
  fs.writeFileSync(path.join(root, 'artifact.txt'), deliverable);
  fs.writeFileSync(path.join(root, 'COMPANY.md'), source);
  return {
    root,
    receipt: {
      schema: 'companymd/receipt/v1',
      contract: 'generic/v1',
      generatedAt: '2026-08-23T00:00:00.000Z',
      profile: 'communications',
      clearance: 'internal',
      completion: 'complete',
      deliverable: { path: 'artifact.txt', exists: true, sha256: digest(deliverable) },
      sources: [{ path: 'COMPANY.md', exists: true, sha256: digest(source) }],
      intermediates: [],
      clientSources: [],
      unresolved: [],
      verification: [{ id: 'content/conformance', status: 'pass' }],
    },
  };
}

function writeReceipt(root: string, name: string, receipt: unknown): string {
  const destination = path.join(root, name);
  fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return destination;
}

test('artifact verifier accepts an intact generic receipt and formats a clean report', () => {
  const { root, receipt } = fixture();
  const report = verifyArtifactReceipt(writeReceipt(root, 'receipt.json', receipt), { root });
  assert.equal(report.valid, true);
  assert.match(formatArtifactVerificationReport(report), /No findings/);

  const gate = (status: ArtifactGate['status']): ArtifactGate => ({ id: 'gate', status });
  assert.equal(deriveArtifactCompletion([gate('fail')], true), 'failed');
  assert.equal(deriveArtifactCompletion([gate('blocked')], true), 'blocked');
  assert.equal(deriveArtifactCompletion([gate('not-run')], true), 'incomplete');
  assert.equal(deriveArtifactCompletion([], true), 'incomplete');
  assert.equal(deriveArtifactCompletion([gate('pass')], false), 'incomplete');
});

test('artifact verifier reports unreadable, non-object, and structurally invalid receipts', () => {
  const { root } = fixture();
  const unreadable = verifyArtifactReceipt(path.join(root, 'missing.json'), { root });
  assert.equal(unreadable.valid, false);
  assert.equal(unreadable.contract, 'unknown');
  assert.ok(unreadable.findings.some((finding) => finding.ruleId === 'receipt/read'));

  const scalar = verifyArtifactReceipt(writeReceipt(root, 'scalar.json', 'not an object'), { root });
  assert.ok(scalar.findings.some((finding) => finding.ruleId === 'receipt/type'));

  const malformed = verifyArtifactReceipt(writeReceipt(root, 'malformed.json', {
    schema: 'wrong',
    contract: 'unknown/v1',
    generatedAt: 'never',
    profile: 'wrong',
    clearance: 'wrong',
    deliverable: {},
    sources: 'wrong',
    intermediates: 'wrong',
    clientSources: [''],
    unresolved: 'wrong',
    completion: 'wrong',
    verification: [],
  }), { root });
  assert.equal(malformed.valid, false);
  for (const ruleId of [
    'receipt/schema',
    'receipt/contract',
    'receipt/generated-at',
    'receipt/profile',
    'receipt/clearance',
    'receipt/deliverable',
    'receipt/sources',
    'receipt/intermediates',
    'receipt/client-sources',
    'receipt/unresolved',
    'receipt/verification',
  ]) assert.ok(malformed.findings.some((finding) => finding.ruleId === ruleId), ruleId);
});

test('artifact verifier catches stale file states, invalid hashes, and duplicate gates', () => {
  const { root, receipt } = fixture();
  const stale = verifyArtifactReceipt(writeReceipt(root, 'stale.json', {
    ...receipt,
    completion: 'blocked',
    deliverable: { path: 'artifact.txt', exists: false, sha256: '0'.repeat(64) },
    sources: [
      { path: 'missing.md', exists: true, sha256: '0'.repeat(64) },
      { path: 'COMPANY.md', exists: true, sha256: 'bad' },
    ],
    verification: [
      { id: 'artifact/export', status: 'blocked' },
      { id: 'artifact/export', status: 'blocked' },
    ],
  }), { root });
  for (const ruleId of ['file/unexpected-present', 'file/expected-hash', 'file/missing', 'file/hash-format', 'gate/duplicate']) {
    assert.ok(stale.findings.some((finding) => finding.ruleId === ruleId), ruleId);
  }
  assert.match(formatArtifactVerificationReport(stale), /Integrity: invalid/);
});

test('presentation contract validates known binary formats and rejects unsupported artifacts', () => {
  const { root, receipt } = fixture();
  const gates = [
    { id: 'artifact/export', status: 'pass' },
    { id: 'artifact/render', status: 'pass' },
    { id: 'artifact/overflow', status: 'pass' },
    { id: 'design/conformance', status: 'pass' },
  ];
  const pdf = Buffer.from('%PDF-1.7\nminimal test fixture');
  fs.writeFileSync(path.join(root, 'deck.pdf'), pdf);
  const validPdf = verifyArtifactReceipt(writeReceipt(root, 'pdf.json', {
    ...receipt,
    contract: 'presentation/v1',
    profile: 'visual',
    deliverable: { path: 'deck.pdf', exists: true, sha256: digest(pdf) },
    verification: gates,
  }), { root });
  assert.equal(validPdf.valid, true);

  const unsupported = Buffer.from('keynote-like content');
  fs.writeFileSync(path.join(root, 'deck.key'), unsupported);
  const invalidKey = verifyArtifactReceipt(writeReceipt(root, 'key.json', {
    ...receipt,
    contract: 'presentation/v1',
    profile: 'wrong',
    deliverable: { path: 'deck.key', exists: true, sha256: digest(unsupported) },
    verification: gates.slice(0, 1),
  }), { root });
  assert.equal(invalidKey.valid, false);
  assert.ok(invalidKey.findings.some((finding) => finding.ruleId === 'presentation/format'));
  assert.ok(invalidKey.findings.some((finding) => finding.ruleId === 'contract/profile'));
  assert.ok(invalidKey.findings.some((finding) => finding.ruleId === 'gate/missing'));
});
