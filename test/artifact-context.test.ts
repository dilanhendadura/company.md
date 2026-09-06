import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { verifyArtifactReceipt } from '../src/artifact.js';
import { createContext, writeContextReceipt } from '../src/context.js';
import { boundPresentation, json, pdf, presentationGates, record } from './artifact-fixtures.js';

function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-bound-artifact-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'deck.pdf'), pdf());
  const deliverable = record(root, 'deck.pdf');
  const receipt = {
    schema: 'companymd/receipt/v1', contract: 'presentation/v1', generatedAt: '2026-09-06T00:00:00Z',
    profile: 'visual', clearance: 'internal', completion: 'complete', deliverable,
    clientSources: [], unresolved: [], ...boundPresentation(root, { sha256: deliverable.sha256 }),
  };
  return { root, receipt };
}

const read = (root: string, file: string): Record<string, any> => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as Record<string, any>;
const run = (root: string, args: string[]) => spawnSync(process.execPath, [path.resolve('.agents/skills/company/scripts/create-receipt.mjs'), '--root', root, '--output', path.join(root, 'generated.json'), ...args], { encoding: 'utf8' });
function args(root: string, evidence = true): string[] {
  return ['--deliverable', path.join(root, 'deck.pdf'), '--contract', 'presentation/v1', '--profile', 'visual', '--clearance', 'internal',
    ...presentationGates.flatMap((gate) => ['--check', `${gate}=pass`]),
    ...(evidence ? presentationGates.filter((gate) => gate !== 'artifact/export').flatMap((gate) => ['--evidence', `${gate}=${path.join(root, `${gate.replace('/', '-')}.json`)}`]) : []),
  ];
}

test('end to end: CLI binds an actual resolved context snapshot and its presentation evidence', (t) => {
  const { root, receipt } = fixture(t);
  const pack = path.join(root, 'pack');
  fs.cpSync(path.resolve('examples/northstar'), pack, { recursive: true });
  const context = createContext(pack, { profile: 'visual', artifact: 'presentation', clearance: 'internal' });
  writeContextReceipt(context, path.join(root, 'context.json'));
  const result = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
  assert.equal(result.status, 0, result.stderr);
  const generated = read(root, 'generated.json');
  assert.equal(generated.context.subject, context.resolution.subject);
  assert.equal(generated.context.sha256, record(root, 'context.json').sha256);
  assert.equal(generated.sources.length, 5);
  assert.ok(generated.sources.every((source: any) => source.path.startsWith('pack/') && source.sha256 === record(root, source.path).sha256));
  const report = verifyArtifactReceipt(path.join(root, 'generated.json'), { root });
  assert.equal(report.valid, true, JSON.stringify(report.findings));
  assert.equal(report.completion, 'complete');
  assert.ok(report.findings.some((finding) => finding.ruleId === 'evidence/attestation'));
  assert.equal(receipt.context.subject, 'synthetic-product', 'source context must be selected afresh, not copied from prior fixture');
});

test('complete presentations require bound context, all roles and matching profile and clearance', (t) => {
  const { root, receipt } = fixture(t);
  const { context: _, ...unbound } = receipt;
  const noContext = verifyArtifactReceipt(json(root, 'receipt.json', { ...unbound, sources: [] }), { root });
  assert.equal(noContext.valid, false);
  assert.ok(noContext.findings.some((finding) => finding.ruleId === 'context/required'));
  assert.notEqual(run(root, args(root)).status, 0);
  const context = read(root, 'context.json');
  context.sources = context.sources.filter((source: any) => source.role !== 'design');
  delete context.binding;
  json(root, 'context.json', context);
  const noDesign = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
  assert.notEqual(noDesign.status, 0);
  assert.match(noDesign.stderr, /requires context source role design/);
  const missing = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt,
    context: { ...receipt.context, ...record(root, 'context.json') }, sources: receipt.sources.filter((source) => source.role !== 'design'),
  }), { root });
  assert.ok(missing.findings.some((finding) => finding.ruleId === 'context/missing-role'));
  for (const [field, value] of [['profile', 'communications'], ['clearance', 'public']]) {
    json(root, 'context.json', { ...context, [field!]: value });
    const mismatch = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /profile and clearance must match/);
  }
});

test('stale context sources and edited context receipts are detected at creation and verification', (t) => {
  const { root, receipt } = fixture(t);
  fs.appendFileSync(path.join(root, 'VOICE.md'), 'Changed voice.');
  const result = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Stale context source hash: VOICE.md/);
  const report = verifyArtifactReceipt(json(root, 'receipt.json', receipt), { root });
  assert.ok(report.findings.some((finding) => finding.ruleId === 'file/hash-mismatch'));
  const context = read(root, 'context.json');
  json(root, 'context.json', { ...context, subject: 'another-product' });
  const edited = verifyArtifactReceipt(path.join(root, 'receipt.json'), { root });
  assert.ok(edited.findings.some((finding) => finding.ruleId === 'context/subject'));
  assert.ok(edited.findings.some((finding) => finding.ruleId === 'file/hash-mismatch'));
});

test('sources with the same basename in another product cannot replace the resolved files', (t) => {
  const { root, receipt } = fixture(t);
  fs.mkdirSync(path.join(root, 'other-product'));
  fs.copyFileSync(path.join(root, 'DESIGN.md'), path.join(root, 'other-product', 'DESIGN.md'));
  const sources = receipt.sources.map((source) => source.role === 'design' ? { ...source, path: 'other-product/DESIGN.md' } : source);
  const report = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt, sources }), { root });
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'context/sources-mismatch'));
  const combined = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json'), '--source', path.join(root, 'other-product', 'DESIGN.md')]);
  assert.notEqual(combined.status, 0);
  assert.match(combined.stderr, /do not combine it with --source/);
});

test('declared template bindings must be present and retain their exact bytes', (t) => {
  const { root, receipt } = fixture(t);
  fs.writeFileSync(path.join(root, 'template.md'), '# Approved deck template\n');
  const context = read(root, 'context.json');
  context.binding.templateSkill = 'template.md';
  json(root, 'context.json', context);
  const missing = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing required context templateSkill binding/);
  context.attachments.push({ file: 'template.md', role: 'templateSkill', sha256: record(root, 'template.md').sha256 });
  json(root, 'context.json', context);
  assert.equal(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).status, 0);
  const report = verifyArtifactReceipt(path.join(root, 'generated.json'), { root });
  assert.equal(report.valid, true, JSON.stringify(report.findings));
  fs.appendFileSync(path.join(root, 'template.md'), 'Unexpected edit.');
  assert.equal(verifyArtifactReceipt(path.join(root, 'generated.json'), { root }).valid, false);
  assert.equal(receipt.attachments.length, 0);
});

test('sourceRoot and source symlinks cannot escape the verification root', (t) => {
  const { root, receipt } = fixture(t);
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-outside-source-')));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(root, 'escape'), 'dir');
  const context = read(root, 'context.json');
  json(root, 'context.json', { ...context, sourceRoot: 'escape' });
  const outsideRoot = run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]);
  assert.notEqual(outsideRoot.status, 0);
  assert.match(outsideRoot.stderr, /outside --root/);
  const report = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt, context: { ...receipt.context, ...record(root, 'context.json') } }), { root });
  assert.ok(report.findings.some((finding) => finding.ruleId === 'context/source-root'));
  json(root, 'context.json', context);
  fs.copyFileSync(path.join(root, 'DESIGN.md'), path.join(outside, 'DESIGN.md'));
  fs.unlinkSync(path.join(root, 'DESIGN.md'));
  fs.symlinkSync(path.join(outside, 'DESIGN.md'), path.join(root, 'DESIGN.md'));
  assert.notEqual(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).status, 0);
  assert.equal(verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt, context: { ...receipt.context, ...record(root, 'context.json') } }), { root }).valid, false);
});

test('evidence must match its gate and deliverable and detects tampered nested proof files', (t) => {
  const { root, receipt } = fixture(t);
  const withoutEvidence = run(root, [...args(root, false), '--context-receipt', path.join(root, 'context.json')]);
  assert.notEqual(withoutEvidence.status, 0);
  assert.match(withoutEvidence.stderr, /requires --evidence artifact\/render/);
  const evidence = read(root, 'artifact-render.json');
  fs.writeFileSync(path.join(root, 'render-result.txt'), 'One rendered page.');
  evidence.files = [record(root, 'render-result.txt')];
  json(root, 'artifact-render.json', evidence);
  assert.equal(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).status, 0);
  fs.appendFileSync(path.join(root, 'render-result.txt'), 'Tampered.');
  assert.equal(verifyArtifactReceipt(path.join(root, 'generated.json'), { root }).valid, false);
  const forged = { ...evidence, files: [], deliverable: { sha256: '0'.repeat(64) } };
  json(root, 'artifact-render.json', forged);
  assert.match(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).stderr, /different deliverable/);
  const mismatched = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt,
    verification: receipt.verification.map((gate) => gate.id === 'artifact/render' ? { ...gate, evidence: [record(root, 'artifact-render.json')] } : gate),
  }), { root });
  assert.ok(mismatched.findings.some((finding) => finding.ruleId === 'evidence/deliverable'));
  json(root, 'artifact-render.json', { ...evidence, files: [], gate: 'design/conformance' });
  assert.match(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).stderr, /Invalid companymd\/evidence/);
});

test('empty complete remote receipts are rejected; provider observations are checked offline', (t) => {
  const { root, receipt } = fixture(t);
  const identity = { url: 'https://docs.google.com/presentation/d/test/edit', provider: 'google-slides', revisionId: 'revision-7' };
  const remote = { ...receipt, deliverable: { kind: 'remote', ...identity, mimeType: 'application/vnd.google-apps.presentation' },
    ...boundPresentation(root, identity, true),
  };
  const empty = verifyArtifactReceipt(json(root, 'empty.json', { ...remote, context: undefined, sources: [], verification: remote.verification.map(({ evidence: _, ...gate }) => gate) }), { root });
  assert.equal(empty.valid, false);
  assert.ok(empty.findings.some((finding) => finding.ruleId === 'context/required'));
  assert.ok(empty.findings.some((finding) => finding.ruleId === 'evidence/required'));
  const valid = verifyArtifactReceipt(json(root, 'remote.json', remote), { root });
  assert.equal(valid.valid, true, JSON.stringify(valid.findings));
  assert.equal(valid.verificationMode, 'offline-integrity');
  assert.ok(valid.findings.some((finding) => finding.ruleId === 'remote/offline'));
  const access = read(root, 'artifact-access.json');
  json(root, 'artifact-access.json', { ...access, method: 'attestation' });
  const wrongMethod = verifyArtifactReceipt(json(root, 'remote.json', { ...remote,
    verification: remote.verification.map((gate) => gate.id === 'artifact/access' ? { ...gate, evidence: [record(root, 'artifact-access.json')] } : gate),
  }), { root });
  assert.ok(wrongMethod.findings.some((finding) => finding.ruleId === 'evidence/provider'));
});

test('receipt enum arrays cannot bypass schema checks or attestation disclosure', (t) => {
  const { root, receipt } = fixture(t);
  for (const field of ['profile', 'clearance'] as const) {
    const result = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt, [field]: [receipt[field]] }), { root });
    assert.ok(result.findings.some(finding => finding.ruleId === `receipt/${field}`));
  }
  const evidence = read(root, 'design-conformance.json');
  json(root, 'design-conformance.json', { ...evidence, method: ['attestation'] });
  const result = verifyArtifactReceipt(json(root, 'receipt.json', { ...receipt,
    verification: receipt.verification.map(gate => gate.id === 'design/conformance'
      ? { ...gate, evidence: [record(root, 'design-conformance.json')] } : gate),
  }), { root });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some(finding => finding.ruleId === 'evidence/schema'));
  assert.notEqual(run(root, [...args(root), '--context-receipt', path.join(root, 'context.json')]).status, 0);
});
