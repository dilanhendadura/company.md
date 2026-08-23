import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDocument } from '../src/parser.js';
import { lintDocument } from '../src/lint.js';

const validCompany = `---
companymd: "0.1"
kind: company
id: test-company
name: Test Company
status: active
classification: internal
owners:
  - team: Strategy
review:
  last_reviewed: "2026-08-20"
  next_review: "2026-11-20"
scope:
  regions: [all]
links:
  customer: ./CUSTOMER.md
  offer: ./OFFER.md
  voice: ./VOICE.md
claims:
  - id: company.verified-fact
    status: verified
    source: internal://strategy/one
    owner: Strategy
    verified_at: "2026-08-20"
---

## Overview
Specific company overview.
## What We Sell
One product {claim:company.verified-fact}.
## Who We Serve
Operations teams.
## How We Make Money
Annual subscription.
## What We Believe
Boundaries precede automation.
## What Makes Us Different
Evidence travels with work.
## Operating Boundaries
No high-impact autonomous decisions.
## Evidence and Open Questions
No open questions.
`;

test('parses YAML, canonical sections, and claim references', () => {
  const document = parseDocument(validCompany, 'COMPANY.md');
  assert.equal(document.meta.kind, 'company');
  assert.equal(document.sections.length, 8);
  assert.deepEqual(document.claimReferences, ['company.verified-fact']);
  const findings = lintDocument(document, { now: new Date('2026-08-23T00:00:00Z') });
  assert.deepEqual(findings.filter((finding) => finding.severity === 'error'), []);
});

test('reports missing sections and stale review dates', () => {
  const incomplete = validCompany
    .replace('  next_review: "2026-11-20"', '  next_review: "2026-08-21"')
    .replace('## What We Sell\nOne product {claim:company.verified-fact}.\n', '');
  const findings = lintDocument(parseDocument(incomplete, 'COMPANY.md'), {
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.ok(findings.some((finding) => finding.ruleId === 'structure/missing-section' && finding.severity === 'error'));
  assert.ok(findings.some((finding) => finding.ruleId === 'governance/stale' && finding.severity === 'warning'));
});

test('rejects unresolved claims and likely secrets', () => {
  const unsafe = validCompany
    .replace('{claim:company.verified-fact}', '{claim:company.not-registered}')
    .replace('No open questions.', 'Credential: AKIAABCDEFGHIJKLMNOP');
  const findings = lintDocument(parseDocument(unsafe, 'COMPANY.md'));
  assert.ok(findings.some((finding) => finding.ruleId === 'evidence/unknown-claim'));
  assert.ok(findings.some((finding) => finding.ruleId === 'security/possible-secret'));
});

test('rejects impossible dates and references to deprecated claims', () => {
  const invalid = validCompany
    .replace('  next_review: "2026-11-20"', '  next_review: "2026-02-30"')
    .replace('    status: verified', '    status: deprecated');
  const findings = lintDocument(parseDocument(invalid, 'COMPANY.md'));
  assert.ok(findings.some((finding) => finding.ruleId === 'governance/review'));
  assert.ok(findings.some((finding) => finding.ruleId === 'evidence/deprecated-claim'));
});

test('a time-bounded approved exception suppresses warnings but not errors', () => {
  const excepted = validCompany
    .replace('  next_review: "2026-11-20"', '  next_review: "2026-08-21"')
    .replace('claims:\n', `exceptions:
  - rule: governance/stale
    reason: Quarterly council meets next week
    approved_by: Chief of Staff
    expires: "2026-08-30"
claims:
`)
    .replace('## What We Sell\nOne product {claim:company.verified-fact}.\n', '');
  const findings = lintDocument(parseDocument(excepted, 'COMPANY.md'), {
    now: new Date('2026-08-23T00:00:00Z'),
  });
  assert.equal(findings.find((finding) => finding.ruleId === 'governance/stale')?.severity, 'info');
  assert.equal(findings.find((finding) => finding.ruleId === 'structure/missing-section')?.severity, 'error');
});
