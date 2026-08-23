import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createContext } from '../src/context.js';
import { initPack } from '../src/init.js';
import { lintPack } from '../src/pack.js';

test('initializes and validates a five-file draft pack', () => {
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
  assert.ok(report.summary.warnings > 0, 'draft placeholders should remain visible');
});

test('visual context orders business context before DESIGN.md', () => {
  const fixture = path.resolve('examples/northstar');
  const result = createContext(fixture, { profile: 'visual', clearance: 'internal' });
  assert.deepEqual(result.files, ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md', 'DESIGN.md']);
  assert.ok(result.markdown.indexOf('# Source: VOICE.md') < result.markdown.indexOf('# Source: DESIGN.md'));
  assert.match(result.markdown, /Do not invent pricing, proof, promises/);
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
