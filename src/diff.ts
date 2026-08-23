import { createHash } from 'node:crypto';
import path from 'node:path';
import { lintPack, loadPack } from './pack.js';
import type { LoadedDocument, Summary } from './types.js';

export interface DocumentDiff {
  role: string;
  before?: string;
  after?: string;
  change: 'added' | 'removed' | 'modified';
  metadata: { added: string[]; removed: string[]; modified: string[] };
  sections: { added: string[]; removed: string[]; modified: string[] };
}

export interface DiffReport {
  documents: DocumentDiff[];
  findings: {
    before: Summary;
    after: Summary;
    delta: { errors: number; warnings: number };
  };
  regression: boolean;
}

export function diffPacks(beforeInput: string, afterInput: string): DiffReport {
  const before = loadPack(beforeInput);
  const after = loadPack(afterInput);
  const beforeDocs = primaryByRole(before.documents);
  const afterDocs = primaryByRole(after.documents);
  const roles = Array.from(new Set([...beforeDocs.keys(), ...afterDocs.keys()]));
  const documents: DocumentDiff[] = [];

  for (const role of roles) {
    const oldDoc = beforeDocs.get(role);
    const newDoc = afterDocs.get(role);
    if (!oldDoc && newDoc) {
      documents.push({
        role,
        after: path.relative(after.root, newDoc.path),
        change: 'added',
        metadata: { added: Object.keys(newDoc.parsed?.meta ?? {}), removed: [], modified: [] },
        sections: { added: newDoc.parsed?.sections.map((section) => section.heading) ?? [], removed: [], modified: [] },
      });
      continue;
    }
    if (oldDoc && !newDoc) {
      documents.push({
        role,
        before: path.relative(before.root, oldDoc.path),
        change: 'removed',
        metadata: { added: [], removed: Object.keys(oldDoc.parsed?.meta ?? {}), modified: [] },
        sections: { added: [], removed: oldDoc.parsed?.sections.map((section) => section.heading) ?? [], modified: [] },
      });
      continue;
    }
    if (!oldDoc || !newDoc || hash(oldDoc.content) === hash(newDoc.content)) continue;
    documents.push({
      role,
      before: path.relative(before.root, oldDoc.path),
      after: path.relative(after.root, newDoc.path),
      change: 'modified',
      metadata: compareRecords(oldDoc.parsed?.meta ?? {}, newDoc.parsed?.meta ?? {}),
      sections: compareSections(oldDoc, newDoc),
    });
  }

  const beforeLint = lintPack(beforeInput).summary;
  const afterLint = lintPack(afterInput).summary;
  const delta = {
    errors: afterLint.errors - beforeLint.errors,
    warnings: afterLint.warnings - beforeLint.warnings,
  };
  return {
    documents,
    findings: { before: beforeLint, after: afterLint, delta },
    regression: delta.errors > 0 || delta.warnings > 0,
  };
}

function primaryByRole(documents: LoadedDocument[]): Map<string, LoadedDocument> {
  const result = new Map<string, LoadedDocument>();
  for (const document of documents) {
    if (!document.inherited) result.set(document.role, document);
  }
  return result;
}

function compareRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { added: string[]; removed: string[]; modified: string[] } {
  const oldFlat = flatten(before);
  const newFlat = flatten(after);
  const oldKeys = Object.keys(oldFlat);
  const newKeys = Object.keys(newFlat);
  return {
    added: newKeys.filter((key) => !(key in oldFlat)),
    removed: oldKeys.filter((key) => !(key in newFlat)),
    modified: oldKeys.filter((key) => key in newFlat && oldFlat[key] !== newFlat[key]),
  };
}

function compareSections(
  before: LoadedDocument,
  after: LoadedDocument,
): { added: string[]; removed: string[]; modified: string[] } {
  const oldSections = new Map(before.parsed?.sections.map((section) => [section.normalizedHeading, section]) ?? []);
  const newSections = new Map(after.parsed?.sections.map((section) => [section.normalizedHeading, section]) ?? []);
  return {
    added: [...newSections.keys()].filter((key) => !oldSections.has(key)).map((key) => newSections.get(key)?.heading ?? key),
    removed: [...oldSections.keys()].filter((key) => !newSections.has(key)).map((key) => oldSections.get(key)?.heading ?? key),
    modified: [...oldSections.keys()]
      .filter((key) => newSections.has(key) && hash(oldSections.get(key)?.content ?? '') !== hash(newSections.get(key)?.content ?? ''))
      .map((key) => newSections.get(key)?.heading ?? key),
  };
}

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((result, entry, index) => ({
      ...result,
      ...flatten(entry, `${prefix}[${index}]`),
    }), {});
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, string>>((result, [key, entry]) => ({
      ...result,
      ...flatten(entry, prefix ? `${prefix}.${key}` : key),
    }), {});
  }
  return { [prefix]: JSON.stringify(value) };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
