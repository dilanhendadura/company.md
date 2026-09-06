import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectForAdoption } from '../src/adopt.js';
import { verifyArtifactReceipt } from '../src/artifact.js';
import { seedPackFromHtml } from '../src/bootstrap.js';
import { createContext, writeContextReceipt } from '../src/context.js';
import { evaluateBeforeAfter } from '../src/eval.js';
import { boundPresentation } from './artifact-fixtures.js';

test('seeds a low-confidence starter pack from public homepage metadata', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-bootstrap-'));
  const result = seedPackFromHtml(
    'https://acme.example/',
    '<html><head><title>Acme | Controlled workflows</title><meta name="description" content="A governed workflow platform for operations teams."></head></html>',
    target,
    { owner: 'Strategy', contact: 'strategy@acme.example' },
  );
  assert.equal(result.extracted.name, 'Acme');
  assert.equal(result.confidence, 'low');
  const company = fs.readFileSync(path.join(target, 'COMPANY.md'), 'utf8');
  assert.match(company, /schema: companymd\/context\/v1/);
  assert.match(company, /maturity: starter/);
  assert.match(company, /status: assumption/);
  assert.match(company, /unverified seed/);
});

test('adoption inventory maps existing context without rewriting it', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-adopt-'));
  fs.mkdirSync(path.join(target, '.git'));
  fs.writeFileSync(path.join(target, 'BRAND.md'), '# Voice\nDirect and calm.\n', 'utf8');
  fs.writeFileSync(path.join(target, 'pricing-notes.md'), '# Packages\nInternal notes.\n', 'utf8');
  const report = inspectForAdoption(target);
  assert.equal(report.existingPack, false);
  assert.ok(report.candidates.some((candidate) => candidate.file === 'BRAND.md' && candidate.targets.includes('voice')));
  assert.ok(report.candidates.some((candidate) => candidate.file === 'pricing-notes.md' && candidate.targets.includes('offer')));
  assert.equal(fs.existsSync(path.join(target, 'COMPANY.md')), false);
});

test('adoption inventory ignores nested Claude worktrees and distant path noise', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-adopt-worktrees-'));
  fs.mkdirSync(path.join(target, '.claude', 'worktrees', 'export-branding', 'appweb'), { recursive: true });
  fs.mkdirSync(path.join(target, 'export-branding', 'appweb'), { recursive: true });
  fs.writeFileSync(
    path.join(target, '.claude', 'worktrees', 'export-branding', 'appweb', 'README.md'),
    '# Duplicate checkout\n',
    'utf8',
  );
  fs.writeFileSync(path.join(target, 'export-branding', 'appweb', 'README.md'), '# Application\n', 'utf8');
  fs.mkdirSync(path.join(target, '.agents', 'skills', 'brand', 'references'), { recursive: true });
  fs.writeFileSync(
    path.join(target, '.agents', 'skills', 'brand', 'references', 'company-positioning.md'),
    '# Skill reference, not company context\n',
    'utf8',
  );

  const report = inspectForAdoption(target);

  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0]?.file, path.join('export-branding', 'appweb', 'README.md'));
  assert.deepEqual(report.candidates[0]?.targets, ['company']);
});

test('before/after eval reports fixed constraints without a truth score', () => {
  const report = evaluateBeforeAfter(
    'examples/northstar',
    'evals/sales-deck/baseline.md',
    'evals/sales-deck/candidate.md',
    'evals/sales-deck/rubric.yaml',
  );
  assert.equal(report.outcome, 'improved');
  assert.equal(report.candidate.passed, true);
  assert.equal(report.regressions.length, 0);
  assert.ok(report.fixed.length > 0);
  assert.ok(report.fixed.includes('offer/claim-to-avoid/zero-risk'));
  assert.match(report.note, /not a truth score/i);
});

test('context receipts record source hashes and profile', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-receipt-'));
  const output = path.join(target, 'receipt.json');
  const context = createContext('examples/northstar', { profile: 'visual', clearance: 'internal' });
  writeContextReceipt(context, output);
  const receipt = JSON.parse(fs.readFileSync(output, 'utf8')) as { profile: string; sources: Array<{ sha256: string }> };
  assert.equal(receipt.profile, 'visual');
  assert.equal(receipt.sources.length, 5);
  assert.ok(receipt.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
});

test('the checked-in sales-deck candidate receipt matches its artifact and sources', () => {
  const receipt = JSON.parse(fs.readFileSync('evals/sales-deck/candidate.companymd.json', 'utf8')) as {
    contract: string;
    profile: string;
    completion: string;
    deliverable: { path: string; exists: boolean; sha256: null };
    intermediates: Array<{ path: string; sha256: string }>;
    sources: Array<{ path: string; sha256: string }>;
    unresolved: string[];
    verification: Array<{ id: string; status: string }>;
  };
  const digest = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(receipt.profile, 'visual');
  assert.equal(receipt.contract, 'presentation/v1');
  assert.equal(receipt.completion, 'blocked');
  assert.equal(receipt.deliverable.exists, false);
  assert.equal(receipt.deliverable.sha256, null);
  assert.equal(fs.existsSync(receipt.deliverable.path), false);
  assert.ok(receipt.intermediates.every((intermediate) => digest(intermediate.path) === intermediate.sha256));
  assert.ok(receipt.sources.every((source) => digest(source.path) === source.sha256));
  assert.ok(receipt.unresolved.some((item) => /PPTX export/.test(item)));
  assert.ok(receipt.verification.some((check) => check.id === 'artifact/export' && check.status === 'blocked'));
  assert.equal(verifyArtifactReceipt('evals/sales-deck/candidate.companymd.json').valid, true);
});

test('artifact receipt tool records completed and expected blocked deliverables', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-artifact-receipt-'));
  const tool = path.resolve('.agents/skills/company/scripts/create-receipt.mjs');
  const source = path.join(target, 'COMPANY.md');
  const deliverable = path.join(target, 'deck.pptx');
  const completeReceipt = path.join(target, 'deck.pptx.companymd-receipt.json');
  const blockedReceipt = path.join(target, 'blocked.pptx.companymd-receipt.json');
  fs.writeFileSync(source, '# Company\n', 'utf8');
  fs.writeFileSync(deliverable, 'test artifact', 'utf8');

  const run = (...args: string[]) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });
  const complete = run(
    '--root', target,
    '--output', completeReceipt,
    '--deliverable', deliverable,
    '--profile', 'visual',
    '--clearance', 'internal',
    '--contract', 'generic/v1',
    '--source', source,
    '--check', 'artifact/export=pass',
    '--check-note', 'artifact/export=exported by the presentation runtime',
  );
  assert.equal(complete.status, 0, complete.stderr);
  const completed = JSON.parse(fs.readFileSync(completeReceipt, 'utf8')) as {
    contract: string;
    completion: string;
    deliverable: { exists: boolean; sha256: string };
    verification: Array<{ note?: string }>;
  };
  assert.equal(completed.contract, 'generic/v1');
  assert.equal(completed.completion, 'complete');
  assert.equal(completed.deliverable.exists, true);
  assert.match(completed.deliverable.sha256, /^[a-f0-9]{64}$/);
  assert.equal(completed.verification[0]?.note, 'exported by the presentation runtime');
  assert.equal(verifyArtifactReceipt(completeReceipt, { root: target }).valid, true);

  const blocked = run(
    '--root', target,
    '--output', blockedReceipt,
    '--expected-deliverable', path.join(target, 'blocked.pptx'),
    '--profile', 'visual',
    '--clearance', 'internal',
    '--contract', 'presentation/v1',
    '--source', source,
    '--check', 'artifact/export=blocked',
    '--check-note', 'artifact/export=presentation runtime unavailable',
    '--check', 'artifact/render=not-run',
    '--check', 'artifact/overflow=not-run',
    '--check', 'design/conformance=not-run',
  );
  assert.equal(blocked.status, 0, blocked.stderr);
  const pending = JSON.parse(fs.readFileSync(blockedReceipt, 'utf8')) as {
    completion: string;
    deliverable: { exists: boolean; sha256: null };
    verification: Array<{ id: string; status: string; note?: string }>;
  };
  assert.equal(pending.completion, 'blocked');
  assert.equal(pending.deliverable.exists, false);
  assert.equal(pending.deliverable.sha256, null);
  assert.equal(pending.verification[0]?.note, 'presentation runtime unavailable');
  assert.equal(verifyArtifactReceipt(blockedReceipt, { root: target }).valid, true);

  const fakeDeck = path.join(target, 'fake.pptx');
  const fakeDeckReceipt = path.join(target, 'fake.pptx.companymd-receipt.json');
  fs.writeFileSync(fakeDeck, 'not a PowerPoint file', 'utf8');
  const fakeBinding = boundPresentation(target, { sha256: createHash('sha256').update(fs.readFileSync(fakeDeck)).digest('hex') });
  const fakePresentation = run(
    '--root', target,
    '--output', fakeDeckReceipt,
    '--deliverable', fakeDeck,
    '--profile', 'visual',
    '--clearance', 'internal',
    '--contract', 'presentation/v1',
    '--context-receipt', path.join(target, 'context.json'),
    ...fakeBinding.verification.flatMap((gate) => (gate.evidence ?? []).flatMap((evidence) => ['--evidence', `${gate.id}=${path.join(target, evidence.path)}`])),
    '--check', 'artifact/export=pass',
    '--check', 'artifact/render=pass',
    '--check', 'artifact/overflow=pass',
    '--check', 'design/conformance=pass',
  );
  assert.equal(fakePresentation.status, 0, fakePresentation.stderr);
  const fakeVerification = verifyArtifactReceipt(fakeDeckReceipt, { root: target });
  assert.equal(fakeVerification.valid, false);
  assert.ok(fakeVerification.findings.some((finding) => finding.ruleId === 'presentation/format'));

  const remoteReceipt = path.join(target, 'remote-slides.companymd-receipt.json');
  const remoteBinding = boundPresentation(target, { url: 'https://docs.google.com/presentation/d/example/edit', provider: 'google-slides', revisionId: 'revision-42' }, true);
  const remotePresentation = run(
    '--root', target,
    '--output', remoteReceipt,
    '--remote-url', 'https://docs.google.com/presentation/d/example/edit',
    '--provider', 'google-slides',
    '--revision', 'revision-42',
    '--mime-type', 'application/vnd.google-apps.presentation',
    '--title', 'Remote deck',
    '--export-mime-type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '--export-size', '64501',
    '--profile', 'visual',
    '--clearance', 'internal',
    '--contract', 'presentation/v1',
    '--context-receipt', path.join(target, 'context.json'),
    ...remoteBinding.verification.flatMap((gate) => (gate.evidence ?? []).flatMap((evidence) => ['--evidence', `${gate.id}=${path.join(target, evidence.path)}`])),
    '--check', 'artifact/access=pass',
    '--check', 'artifact/revision=pass',
    '--check', 'artifact/export=pass',
    '--check', 'artifact/render=pass',
    '--check', 'artifact/overflow=pass',
    '--check', 'design/conformance=pass',
  );
  assert.equal(remotePresentation.status, 0, remotePresentation.stderr);
  const remote = JSON.parse(fs.readFileSync(remoteReceipt, 'utf8')) as {
    completion: string;
    deliverable: { kind: string; provider: string; revisionId: string; export: { size: number } };
  };
  assert.equal(remote.completion, 'complete');
  assert.equal(remote.deliverable.kind, 'remote');
  assert.equal(remote.deliverable.provider, 'google-slides');
  assert.equal(remote.deliverable.revisionId, 'revision-42');
  assert.equal(remote.deliverable.export.size, 64501);
  assert.equal(verifyArtifactReceipt(remoteReceipt, { root: target }).valid, true);

  const missingRemoteGate = run(
    '--root', target,
    '--output', path.join(target, 'remote-missing-gate.json'),
    '--remote-url', 'https://docs.google.com/presentation/d/example/edit',
    '--provider', 'google-slides',
    '--revision', 'revision-42',
    '--mime-type', 'application/vnd.google-apps.presentation',
    '--profile', 'visual',
    '--clearance', 'internal',
    '--check', 'artifact/access=pass',
  );
  assert.notEqual(missingRemoteGate.status, 0);
  assert.match(missingRemoteGate.stderr, /missing required verification gates/);

  const missingPresentationGate = run(
    '--root', target,
    '--output', path.join(target, 'missing-gate.json'),
    '--deliverable', deliverable,
    '--profile', 'visual',
    '--clearance', 'internal',
    '--contract', 'presentation/v1',
    '--check', 'artifact/export=pass',
  );
  assert.notEqual(missingPresentationGate.status, 0);
  assert.match(missingPresentationGate.stderr, /missing required verification gates/);

  const unknownOption = run(
    '--root', target,
    '--output', path.join(target, 'unknown.json'),
    '--deliverable', deliverable,
    '--profile', 'visual',
    '--clearance', 'internal',
    '--check', 'artifact/export=pass',
    '--typo', 'ignored-before-v0.3.3',
  );
  assert.notEqual(unknownOption.status, 0);
  assert.match(unknownOption.stderr, /Unknown option: --typo/);

  const remoteOptionWithoutRemote = run(
    '--root', target,
    '--output', path.join(target, 'local-with-remote-option.json'),
    '--deliverable', deliverable,
    '--provider', 'google-slides',
    '--profile', 'visual',
    '--clearance', 'internal',
    '--check', 'artifact/export=pass',
  );
  assert.notEqual(remoteOptionWithoutRemote.status, 0);
  assert.match(remoteOptionWithoutRemote.stderr, /Remote-only options require --remote-url/);

  const invalid = run(
    '--root', target,
    '--output', path.join(target, 'invalid.json'),
    '--expected-deliverable', path.join(target, 'invalid.pptx'),
    '--profile', 'visual',
    '--clearance', 'internal',
    '--check', 'artifact/export=blocked',
    '--check-note', 'artifact/export=first cause',
    '--check-note', 'artifact/export=second cause',
  );
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Duplicate --check-note id/);

  const contradictoryReceipt = path.join(target, 'contradictory.json');
  fs.writeFileSync(contradictoryReceipt, `${JSON.stringify({ ...completed, completion: 'blocked' }, null, 2)}\n`, 'utf8');
  const contradictory = verifyArtifactReceipt(contradictoryReceipt, { root: target });
  assert.equal(contradictory.valid, false);
  assert.ok(contradictory.findings.some((finding) => finding.ruleId === 'completion/mismatch'));

  const escapedReceipt = path.join(target, 'escaped.json');
  fs.writeFileSync(escapedReceipt, `${JSON.stringify({
    ...completed,
    sources: [{ path: '../outside.md', exists: true, sha256: '0'.repeat(64) }],
  }, null, 2)}\n`, 'utf8');
  const escaped = verifyArtifactReceipt(escapedReceipt, { root: target });
  assert.equal(escaped.valid, false);
  assert.ok(escaped.findings.some((finding) => finding.ruleId === 'file/outside-root'));

  fs.writeFileSync(source, '# Company\nTampered after receipt.\n', 'utf8');
  const tampered = verifyArtifactReceipt(completeReceipt, { root: target });
  assert.equal(tampered.valid, false);
  assert.ok(tampered.findings.some((finding) => finding.ruleId === 'file/hash-mismatch'));

});
