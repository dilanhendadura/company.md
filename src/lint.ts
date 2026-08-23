import path from 'node:path';
import type {
  Claim,
  Classification,
  DocumentKind,
  Finding,
  ParsedDocument,
  Severity,
} from './types.js';
import {
  CLASSIFICATIONS,
  CONVENTIONAL_FILENAMES,
  KINDS,
  REQUIRED_SECTIONS,
  SPEC_VERSION,
  STATUSES,
  normalizeHeading,
} from './spec.js';
import { isRecord } from './parser.js';

export interface LintDocumentOptions {
  now?: Date;
  expectedKind?: DocumentKind;
}

export function lintDocument(document: ParsedDocument, options: LintDocumentOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const now = options.now ?? new Date();
  const meta = document.meta;
  const relativeFile = document.path;
  const add = (
    ruleId: string,
    severity: Severity,
    message: string,
    extra: Partial<Pick<Finding, 'path' | 'line' | 'suggestion'>> = {},
  ): void => {
    findings.push({ ruleId, severity, file: relativeFile, message, ...extra });
  };

  if (String(meta.companymd ?? '') !== SPEC_VERSION) {
    add(
      'metadata/spec-version',
      'error',
      `companymd must be the quoted string "${SPEC_VERSION}"`,
      { path: 'companymd' },
    );
  }

  const kind = typeof meta.kind === 'string' && KINDS.includes(meta.kind as DocumentKind)
    ? meta.kind as DocumentKind
    : undefined;
  if (!kind) {
    add('metadata/kind', 'error', `kind must be one of: ${KINDS.join(', ')}`, { path: 'kind' });
  } else {
    if (options.expectedKind && kind !== options.expectedKind) {
      add('metadata/link-kind', 'error', `Expected a ${options.expectedKind} document but found ${kind}`, { path: 'kind' });
    }
    const actualFilename = path.basename(document.path);
    if (actualFilename !== CONVENTIONAL_FILENAMES[kind]) {
      add(
        'convention/filename',
        'warning',
        `${kind} documents should normally be named ${CONVENTIONAL_FILENAMES[kind]}`,
      );
    }
  }

  if (typeof meta.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(meta.id)) {
    add('metadata/id', 'error', 'id must be a stable 2-128 character lowercase identifier', { path: 'id' });
  }
  if (typeof meta.name !== 'string' || meta.name.trim().length < 2) {
    add('metadata/name', 'error', 'name must be a non-empty human-readable label', { path: 'name' });
  }
  if (typeof meta.status !== 'string' || !STATUSES.includes(meta.status as (typeof STATUSES)[number])) {
    add('metadata/status', 'error', `status must be one of: ${STATUSES.join(', ')}`, { path: 'status' });
  }
  if (typeof meta.classification !== 'string' || !CLASSIFICATIONS.includes(meta.classification as Classification)) {
    add(
      'governance/classification',
      'error',
      `classification must be one of: ${CLASSIFICATIONS.join(', ')}`,
      { path: 'classification' },
    );
  }

  lintOwners(meta.owners, add);
  lintReview(meta.review, now, add);
  lintScope(meta.scope, add);
  lintExceptions(meta.exceptions, now, add);
  lintClaims(meta.claims, document.claimReferences, add);

  if (kind === 'company') lintCompanyLinks(meta.links, add);
  if (kind && kind !== 'company' && (typeof meta.company !== 'string' || meta.company.trim() === '')) {
    add('metadata/company-reference', 'error', 'Companion documents must identify the root company id', { path: 'company' });
  }

  if (kind) lintSections(document, kind, add);
  lintSecrets(document.content, add);

  return applyExceptions(findings, meta.exceptions, now);
}

function lintOwners(
  value: unknown,
  add: AddFinding,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    add('governance/owner', 'error', 'owners must contain at least one accountable team', { path: 'owners' });
    return;
  }
  value.forEach((owner, index) => {
    if (!isRecord(owner) || typeof owner.team !== 'string' || owner.team.trim() === '') {
      add('governance/owner', 'error', 'Each owner needs a non-empty team', { path: `owners[${index}].team` });
    } else if (typeof owner.contact === 'string' && /@example\.com$/i.test(owner.contact.trim())) {
      add('governance/placeholder-contact', 'warning', 'Replace the example.com owner contact before activation', { path: `owners[${index}].contact` });
    }
  });
}

function lintReview(value: unknown, now: Date, add: AddFinding): void {
  if (!isRecord(value)) {
    add('governance/review', 'error', 'review must define last_reviewed and next_review', { path: 'review' });
    return;
  }
  const last = parseDate(value.last_reviewed);
  const next = parseDate(value.next_review);
  if (!last) add('governance/review', 'error', 'last_reviewed must use YYYY-MM-DD', { path: 'review.last_reviewed' });
  if (!next) add('governance/review', 'error', 'next_review must use YYYY-MM-DD', { path: 'review.next_review' });
  if (last && next && next < last) {
    add('governance/review-order', 'error', 'next_review cannot be earlier than last_reviewed', { path: 'review.next_review' });
  }
  if (next && next.getTime() < startOfUtcDay(now).getTime()) {
    add(
      'governance/stale',
      'warning',
      `Review was due on ${String(value.next_review)}`,
      { path: 'review.next_review', suggestion: 'Review the document and advance both review dates.' },
    );
  }
}

function lintScope(value: unknown, add: AddFinding): void {
  if (value === undefined) {
    add('governance/scope', 'warning', 'scope is not defined; agents cannot tell where this context applies', { path: 'scope' });
    return;
  }
  if (!isRecord(value) || Object.keys(value).length === 0) {
    add('governance/scope', 'error', 'scope must be a non-empty mapping of string arrays', { path: 'scope' });
    return;
  }
  for (const [key, entries] of Object.entries(value)) {
    if (!Array.isArray(entries) || entries.length === 0 || entries.some((entry) => typeof entry !== 'string')) {
      add('governance/scope', 'error', `scope.${key} must be a non-empty string array`, { path: `scope.${key}` });
    } else if (entries.includes('all') && entries.length > 1) {
      add('governance/scope-all', 'warning', `scope.${key} combines "all" with narrower values`, { path: `scope.${key}` });
    }
  }
}

function lintExceptions(value: unknown, now: Date, add: AddFinding): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add('governance/exceptions', 'error', 'exceptions must be an array', { path: 'exceptions' });
    return;
  }
  value.forEach((exception, index) => {
    if (!isRecord(exception) || typeof exception.rule !== 'string' || typeof exception.reason !== 'string') {
      add('governance/exceptions', 'error', 'Each exception needs rule and reason', { path: `exceptions[${index}]` });
      return;
    }
    if (typeof exception.approved_by !== 'string' || exception.approved_by.trim() === '') {
      add('governance/exception-approval', 'warning', 'An exception without approved_by cannot suppress a warning', { path: `exceptions[${index}].approved_by` });
    }
    if (exception.expires === undefined) {
      add('governance/exception-expiry', 'warning', 'An exception without expires cannot suppress a warning', { path: `exceptions[${index}].expires` });
    }
    if (exception.expires !== undefined) {
      const expiry = parseDate(exception.expires);
      if (!expiry) {
        add('governance/exception-expiry', 'error', 'Exception expiry must use YYYY-MM-DD', { path: `exceptions[${index}].expires` });
      } else if (expiry < startOfUtcDay(now)) {
        add('governance/exception-expiry', 'warning', `Exception for ${exception.rule} has expired`, { path: `exceptions[${index}].expires` });
      }
    }
  });
}

function lintClaims(value: unknown, references: string[], add: AddFinding): void {
  if (value === undefined) {
    if (references.length > 0) {
      references.forEach((reference) => add('evidence/unknown-claim', 'error', `Claim reference ${reference} is not registered`, { path: 'claims' }));
    } else {
      add('evidence/no-claims', 'info', 'No evidence claims are registered', { path: 'claims' });
    }
    return;
  }
  if (!Array.isArray(value)) {
    add('evidence/claims', 'error', 'claims must be an array', { path: 'claims' });
    return;
  }

  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      add('evidence/claim-shape', 'error', 'Each claim must be a mapping', { path: `claims[${index}]` });
      return;
    }
    const claim = item as unknown as Claim;
    if (typeof claim.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(claim.id)) {
      add('evidence/claim-id', 'error', 'Claim id must be a stable lowercase identifier', { path: `claims[${index}].id` });
    } else if (seen.has(claim.id)) {
      add('evidence/duplicate-claim', 'error', `Duplicate claim id ${claim.id}`, { path: `claims[${index}].id` });
    } else {
      seen.add(claim.id);
    }
    if (!['verified', 'assumption', 'decision', 'deprecated'].includes(String(claim.status))) {
      add('evidence/claim-status', 'error', 'Claim status must be verified, assumption, decision, or deprecated', { path: `claims[${index}].status` });
    }
    if (typeof claim.source !== 'string' || claim.source.trim() === '') {
      add('evidence/claim-source', 'error', 'Each claim needs a source or source-of-truth reference', { path: `claims[${index}].source` });
    }
    if (typeof claim.owner !== 'string' || claim.owner.trim() === '') {
      add('evidence/claim-owner', 'error', 'Each claim needs an accountable owner', { path: `claims[${index}].owner` });
    }
    if (claim.status === 'verified' && !parseDate(claim.verified_at)) {
      add('evidence/claim-verification', 'warning', 'Verified claims should include verified_at in YYYY-MM-DD format', { path: `claims[${index}].verified_at` });
    }
  });

  references.forEach((reference) => {
    if (!seen.has(reference)) {
      add('evidence/unknown-claim', 'error', `Claim reference ${reference} is not registered`, { path: 'claims' });
    }
  });
  const deprecated = new Set(
    value
      .filter((item): item is Record<string, unknown> => isRecord(item) && item.status === 'deprecated' && typeof item.id === 'string')
      .map((item) => item.id as string),
  );
  references.forEach((reference) => {
    if (deprecated.has(reference)) {
      add('evidence/deprecated-claim', 'error', `Deprecated claim ${reference} cannot be used in prose`, { path: 'claims' });
    }
  });
  for (const claimId of seen) {
    if (!references.includes(claimId)) {
      add('evidence/unreferenced-claim', 'info', `Registered claim ${claimId} is not referenced in the prose`, { path: 'claims' });
    }
  }
}

function lintCompanyLinks(value: unknown, add: AddFinding): void {
  if (!isRecord(value)) {
    add('links/companions', 'error', 'COMPANY.md must link to customer, offer, and voice documents', { path: 'links' });
    return;
  }
  for (const required of ['customer', 'offer', 'voice']) {
    if (typeof value[required] !== 'string' || value[required].trim() === '') {
      add('links/companions', 'error', `links.${required} must point to a local Markdown file`, { path: `links.${required}` });
    }
  }
  for (const [key, linkedPath] of Object.entries(value)) {
    if (!['customer', 'offer', 'voice', 'design'].includes(key)) {
      add('links/unknown-role', 'warning', `Unknown linked document role: ${key}`, { path: `links.${key}` });
    }
    if (typeof linkedPath === 'string' && /^(?:https?:)?\/\//i.test(linkedPath)) {
      add('links/remote', 'error', `links.${key} must resolve to a versioned local file`, { path: `links.${key}` });
    }
  }
}

function lintSections(document: ParsedDocument, kind: DocumentKind, add: AddFinding): void {
  const required = REQUIRED_SECTIONS[kind];
  const present = document.sections.map((section) => section.normalizedHeading);
  const duplicates = present.filter((heading, index) => present.indexOf(heading) !== index);
  for (const duplicate of new Set(duplicates)) {
    const section = document.sections.find((item) => item.normalizedHeading === duplicate);
    add(
      'structure/duplicate-section',
      'error',
      `Duplicate section: ${section?.heading ?? duplicate}`,
      section ? { line: section.line } : {},
    );
  }

  for (const heading of required) {
    if (!present.includes(normalizeHeading(heading))) {
      add('structure/missing-section', 'error', `Missing required section: ${heading}`, { path: `sections.${heading}` });
    }
  }

  const orderedPresent = required
    .map((heading) => present.indexOf(normalizeHeading(heading)))
    .filter((index) => index >= 0);
  if (orderedPresent.some((value, index) => index > 0 && value < (orderedPresent[index - 1] ?? -1))) {
    add('structure/section-order', 'warning', `Sections should follow the canonical ${kind} order`, {
      suggestion: required.join(' → '),
    });
  }

  for (const section of document.sections) {
    if (section.content.trim() === '') {
      add('content/empty-section', 'warning', `Section ${section.heading} is empty`, { line: section.line });
    } else if (/\b(?:TODO|TBD|REPLACE ME|INSERT HERE)\b/i.test(section.content)) {
      add('content/placeholder', 'warning', `Section ${section.heading} still contains placeholder content`, { line: section.line });
    }
  }
}

function lintSecrets(content: string, add: AddFinding): void {
  const patterns: Array<[RegExp, string]> = [
    [/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/, 'a private key'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key'],
    [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'a secret API token'],
    [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, 'a GitHub token'],
  ];
  for (const [pattern, label] of patterns) {
    if (pattern.test(content)) {
      add('security/possible-secret', 'error', `The document appears to contain ${label}; Company.md files must never store secrets`);
    }
  }
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

type AddFinding = (
  ruleId: string,
  severity: Severity,
  message: string,
  extra?: Partial<Pick<Finding, 'path' | 'line' | 'suggestion'>>,
) => void;

function applyExceptions(findings: Finding[], value: unknown, now: Date): Finding[] {
  if (!Array.isArray(value)) return findings;
  const active = new Map<string, { reason: string; approvedBy: string; expires: string }>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (
      typeof item.rule !== 'string'
      || typeof item.reason !== 'string'
      || typeof item.approved_by !== 'string'
      || typeof item.expires !== 'string'
    ) continue;
    const expiry = parseDate(item.expires);
    if (!expiry || expiry < startOfUtcDay(now)) continue;
    active.set(item.rule, { reason: item.reason, approvedBy: item.approved_by, expires: item.expires });
  }
  return findings.map((finding) => {
    const exception = active.get(finding.ruleId);
    if (!exception || finding.severity !== 'warning') return finding;
    return {
      ...finding,
      severity: 'info',
      message: `Accepted warning until ${exception.expires} by ${exception.approvedBy}: ${exception.reason}. Original finding: ${finding.message}`,
    };
  });
}
