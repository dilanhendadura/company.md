import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createContext, writeContextReceipt } from '../src/context.js';
import { initPack } from '../src/init.js';
import { lintPack } from '../src/pack.js';

test('initializes a starter pack without a wall of warnings', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-init-'));
  const result = initPack(temp, {
    name: 'Example Holdings',
    owner: 'Strategy',
    contact: 'strategy@example.com',
    withDesign: true,
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.deepEqual(result.files, ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md', 'DESIGN.md']);
  const report = lintPack(temp, { now: new Date('2026-08-23T00:00:00Z') });
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.warnings, 1, 'only the external DESIGN.md placeholder warning remains');
  assert.ok(report.summary.infos > 0, 'starter guidance should remain visible as information');
});

test('enterprise mode treats a missing owner contact as an error', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-enterprise-'));
  initPack(temp, {
    name: 'Enterprise Example',
    owner: 'Strategy',
    contact: '',
    maturity: 'enterprise',
    now: new Date('2026-08-23T00:00:00Z'),
  });
  const companyPath = path.join(temp, 'COMPANY.md');
  fs.writeFileSync(companyPath, fs.readFileSync(companyPath, 'utf8').replace('    contact: "context-owner@example.com"\n', ''), 'utf8');
  const report = lintPack(temp, { now: new Date('2026-08-23T00:00:00Z') });
  assert.ok(report.findings.some((finding) => finding.ruleId === 'governance/owner-contact' && finding.severity === 'error'));
});

test('detects a competing COMPANY.md dialect explicitly', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-dialect-'));
  initPack(temp, { name: 'Dialect Example', now: new Date('2026-08-23T00:00:00Z') });
  const companyPath = path.join(temp, 'COMPANY.md');
  fs.writeFileSync(
    companyPath,
    fs.readFileSync(companyPath, 'utf8').replace('schema: companymd/context/v1', 'schema: agentcompanies/v1'),
    'utf8',
  );
  const report = lintPack(temp);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'metadata/schema' && finding.severity === 'error'));
});

test('visual context orders business context before DESIGN.md', () => {
  const fixture = path.resolve('examples/northstar');
  const result = createContext(fixture, { profile: 'visual', clearance: 'internal' });
  assert.deepEqual(result.files, ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md', 'DESIGN.md']);
  assert.ok(result.markdown.indexOf('# Source: VOICE.md') < result.markdown.indexOf('# Source: DESIGN.md'));
  assert.match(result.markdown, /Do not invent pricing, proof, promises/);
  assert.equal(result.sources.length, 5);
  assert.ok(result.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
});

test('complete product overlays can extend a base enterprise pack', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-overlay-'));
  const base = path.join(temp, 'global');
  const overlay = path.join(temp, 'product');
  fs.cpSync(path.resolve('examples/northstar'), base, { recursive: true });
  fs.cpSync(path.resolve('examples/northstar'), overlay, { recursive: true });

  for (const filename of ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md']) {
    const file = path.join(overlay, filename);
    const content = fs.readFileSync(file, 'utf8')
      .replaceAll('northstar-cloud', 'northstar-cloud.product')
      .replace('claims:', `extends: ../global/${filename}\nclaims:`);
    fs.writeFileSync(file, content, 'utf8');
  }

  const report = lintPack(overlay, { workspaceRoot: temp, now: new Date('2026-08-23T00:00:00Z') });
  assert.equal(report.summary.errors, 0);

  const context = createContext(overlay, { workspaceRoot: temp, profile: 'communications', clearance: 'internal' });
  assert.deepEqual(context.files, [
    '../global/COMPANY.md',
    'COMPANY.md',
    '../global/CUSTOMER.md',
    'CUSTOMER.md',
    '../global/OFFER.md',
    'OFFER.md',
    '../global/VOICE.md',
    'VOICE.md',
  ]);
  assert.match(context.markdown, /# Source: \.\.\/global\/COMPANY\.md \(inherited base\)/);
});

test('writes a machine-readable context receipt', () => {
  const result = createContext(path.resolve('examples/northstar'), { profile: 'visual', clearance: 'internal' });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-receipt-'));
  const output = path.join(temp, 'context.companymd.json');
  writeContextReceipt(result, output);
  const receipt = JSON.parse(fs.readFileSync(output, 'utf8')) as { schema: string; profile: string; sources: unknown[] };
  assert.equal(receipt.schema, 'companymd/context-receipt/v1');
  assert.equal(receipt.profile, 'visual');
  assert.equal(receipt.sources.length, 5);
});

test('context fails closed on draft status and insufficient clearance', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-clearance-'));
  initPack(temp, {
    name: 'Restricted Example',
    classification: 'confidential',
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.throws(() => createContext(temp, { profile: 'core', clearance: 'confidential' }), /Draft context requires/);
  assert.throws(
    () => createContext(temp, { profile: 'core', clearance: 'internal', allowDraft: true }),
    /Clearance internal is insufficient/,
  );
});

test('initializer does not overwrite an existing pack implicitly', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-collision-'));
  initPack(temp, { name: 'First Company', now: new Date('2026-08-23T00:00:00Z') });
  assert.throws(
    () => initPack(temp, { name: 'Second Company', now: new Date('2026-08-23T00:00:00Z') }),
    /Refusing to overwrite/,
  );
});

test('initializer safely quotes human labels in YAML', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-quoted-name-'));
  initPack(temp, {
    name: 'Acme "North"\nGroup',
    owner: 'Strategy & "Ops"',
    contact: 'context@acme.example',
    now: new Date('2026-08-23T00:00:00Z'),
  });
  const report = lintPack(temp, { now: new Date('2026-08-23T00:00:00Z') });
  assert.equal(report.summary.errors, 0);
  assert.match(fs.readFileSync(path.join(temp, 'COMPANY.md'), 'utf8'), /name: "Acme \\"North\\" Group"/);
});

test('a pack cannot link a deprecated companion', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-deprecated-'));
  fs.cpSync(path.resolve('examples/northstar'), temp, { recursive: true });
  const customerPath = path.join(temp, 'CUSTOMER.md');
  fs.writeFileSync(
    customerPath,
    fs.readFileSync(customerPath, 'utf8').replace('status: active', 'status: deprecated'),
    'utf8',
  );
  const report = lintPack(temp);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'pack/deprecated-document'));
  assert.equal(report.valid, false);
});
