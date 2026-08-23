import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectForAdoption } from '../src/adopt.js';
import { seedPackFromHtml } from '../src/bootstrap.js';
import { createContext, writeContextReceipt } from '../src/context.js';
import { evaluateBeforeAfter } from '../src/eval.js';

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
    profile: string;
    deliverable: { path: string; sha256: string };
    sources: Array<{ path: string; sha256: string }>;
    unresolved: string[];
  };
  const digest = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(receipt.profile, 'visual');
  assert.equal(digest(receipt.deliverable.path), receipt.deliverable.sha256);
  assert.ok(receipt.sources.every((source) => digest(source.path) === source.sha256));
  assert.ok(receipt.unresolved.some((item) => /PPTX export/.test(item)));
});
