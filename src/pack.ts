import fs from 'node:fs';
import path from 'node:path';
import { lint as lintDesignDocument } from '@google/design.md/linter';
import { parseDocument } from './parser.js';
import { lintDocument } from './lint.js';
import {
  CLASSIFICATIONS,
  CONVENTIONAL_FILENAMES,
  KINDS,
  SPEC_VERSION,
  classificationRank,
} from './spec.js';
import type {
  Classification,
  DocumentKind,
  FileReport,
  Finding,
  LintReport,
  LoadedDocument,
  LoadedPack,
  ParsedDocument,
  Severity,
  Summary,
} from './types.js';

export interface LintPackOptions {
  now?: Date;
}

export function resolveCompanyPath(input: string): string {
  const absolute = path.resolve(input);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    throw new Error(`Input does not exist: ${absolute}`);
  }

  if (stat.isFile()) return absolute;
  if (!stat.isDirectory()) throw new Error(`Input is neither a file nor a directory: ${absolute}`);

  for (const candidate of [CONVENTIONAL_FILENAMES.company, 'company.md', 'Company.md']) {
    const possible = path.join(absolute, candidate);
    if (fs.existsSync(possible) && fs.statSync(possible).isFile()) return possible;
  }
  throw new Error(`No COMPANY.md found in ${absolute}`);
}

export function loadPack(input: string): LoadedPack {
  const companyPath = resolveCompanyPath(input);
  const root = path.dirname(companyPath);
  const company = readCompanyDocument(companyPath, root);
  const documents: LoadedDocument[] = [];
  const visited = new Set<string>();

  loadCompanyChain(companyPath, 'company', root, documents, visited, [], undefined);

  const links = isStringMap(company.meta.links) ? company.meta.links : {};
  for (const role of ['customer', 'offer', 'voice'] as DocumentKind[]) {
    const linked = links[role];
    if (typeof linked !== 'string' || linked.trim() === '') continue;
    const linkedPath = resolveLocalLink(companyPath, linked);
    loadCompanyChain(linkedPath, role, root, documents, visited, [], undefined);
  }

  if (typeof links.design === 'string' && links.design.trim() !== '') {
    const designPath = resolveLocalLink(companyPath, links.design);
    const key = `design:${designPath}`;
    if (!visited.has(key)) {
      if (!fs.existsSync(designPath)) throw new Error(`Linked design file does not exist: ${links.design}`);
      documents.push({
        role: 'design',
        path: designPath,
        content: fs.readFileSync(designPath, 'utf8'),
        inherited: false,
      });
      visited.add(key);
    }
  }

  return { root, company, documents };
}

export function lintPack(input: string, options: LintPackOptions = {}): LintReport {
  let pack: LoadedPack;
  try {
    pack = loadPack(input);
  } catch (error) {
    const root = path.resolve(input);
    const finding: Finding = {
      ruleId: 'pack/load',
      severity: 'error',
      file: root,
      message: error instanceof Error ? error.message : String(error),
    };
    return makeReport(root, [{ file: root, kind: 'unknown', findings: [finding] }]);
  }

  const fileReports: FileReport[] = [];
  const rootId = typeof pack.company.meta.id === 'string' ? pack.company.meta.id : undefined;
  const rootMaturity = typeof pack.company.meta.maturity === 'string' ? pack.company.meta.maturity : undefined;
  const documentIds = new Map<string, string>();

  for (const loaded of pack.documents) {
    if (loaded.role === 'design') {
      fileReports.push(lintDesign(loaded, pack.root));
      continue;
    }

    const parsed = loaded.parsed;
    if (!parsed) continue;
    const findings = lintDocument(parsed, {
      expectedKind: loaded.role,
      ...(options.now ? { now: options.now } : {}),
    });
    if (parsed.meta.status === 'deprecated') {
      findings.push({
        ruleId: 'pack/deprecated-document',
        severity: 'error',
        file: parsed.path,
        path: 'status',
        message: 'A linked pack document cannot be deprecated',
      });
    }
    const id = typeof parsed.meta.id === 'string' ? parsed.meta.id : undefined;
    if (id) {
      const prior = documentIds.get(id);
      if (prior) {
        findings.push({
          ruleId: 'pack/duplicate-id',
          severity: 'error',
          file: parsed.path,
          path: 'id',
          message: `Document id ${id} is already used by ${prior}`,
        });
      } else {
        documentIds.set(id, parsed.path);
      }
    }
    // A base companion belongs to the company id declared by its own base
    // pack, not to the more-specific overlay currently being linted. The
    // overlay companion itself must still reference the overlay root id.
    if (loaded.role !== 'company' && !loaded.inherited && rootId && parsed.meta.company !== rootId) {
      findings.push({
        ruleId: 'pack/company-reference',
        severity: 'error',
        file: parsed.path,
        path: 'company',
        message: `company must reference root id ${rootId}`,
      });
    }
    if (rootMaturity && typeof parsed.meta.maturity === 'string' && parsed.meta.maturity !== rootMaturity) {
      findings.push({
        ruleId: 'pack/maturity-mismatch',
        severity: 'error',
        file: parsed.path,
        path: 'maturity',
        message: `Pack documents must use root maturity ${rootMaturity}; found ${parsed.meta.maturity}`,
      });
    }
    fileReports.push({ file: parsed.path, kind: loaded.role, findings });
  }

  lintInheritance(pack, fileReports);
  return makeReport(pack.root, fileReports);
}

function loadCompanyChain(
  absolutePath: string,
  role: DocumentKind,
  root: string,
  documents: LoadedDocument[],
  visited: Set<string>,
  stack: string[],
  inheritedBy: string | undefined,
): void {
  const resolved = path.resolve(absolutePath);
  if (stack.includes(resolved)) {
    const cycle = [...stack.slice(stack.indexOf(resolved)), resolved]
      .map((entry) => displayPath(root, entry))
      .join(' → ');
    throw new Error(`extends cycle detected: ${cycle}`);
  }
  if (!fs.existsSync(resolved)) throw new Error(`Linked ${role} file does not exist: ${displayPath(root, resolved)}`);

  const parsed = readCompanyDocument(resolved, root);
  const extensions = normalizeExtends(parsed.meta.extends);
  for (const extension of extensions) {
    const basePath = resolveLocalLink(resolved, extension);
    loadCompanyChain(basePath, role, root, documents, visited, [...stack, resolved], resolved);
  }

  const key = `${role}:${resolved}`;
  if (visited.has(key)) return;
  documents.push({
    role,
    path: resolved,
    content: parsed.content,
    parsed,
    inherited: inheritedBy !== undefined,
    ...(inheritedBy ? { inheritedBy } : {}),
  });
  visited.add(key);
}

function readCompanyDocument(absolutePath: string, root: string): ParsedDocument {
  if (!fs.existsSync(absolutePath)) throw new Error(`File does not exist: ${displayPath(root, absolutePath)}`);
  const content = fs.readFileSync(absolutePath, 'utf8');
  return parseDocument(content, displayPath(root, absolutePath));
}

function resolveLocalLink(fromFile: string, linkedPath: string): string {
  if (/^(?:https?:)?\/\//i.test(linkedPath)) throw new Error(`Remote links are not allowed in context topology: ${linkedPath}`);
  return path.resolve(path.dirname(fromFile), linkedPath);
}

function normalizeExtends(value: unknown): string[] {
  if (value === undefined) return [];
  if (typeof value === 'string' && value.trim() !== '') return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim() !== '')) {
    return value;
  }
  throw new Error('extends must be a local path or an array of local paths');
}

function lintDesign(document: LoadedDocument, root: string): FileReport {
  const file = displayPath(root, document.path);
  try {
    const report = lintDesignDocument(document.content);
    const findings: Finding[] = report.findings.map((finding) => ({
      ruleId: 'design.md/validation',
      severity: normalizeSeverity(finding.severity),
      file,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
    }));
    return { file, kind: 'design', findings };
  } catch (error) {
    return {
      file,
      kind: 'design',
      findings: [{
        ruleId: 'design.md/parse',
        severity: 'error',
        file,
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

function lintInheritance(pack: LoadedPack, reports: FileReport[]): void {
  const parsedByAbsolutePath = new Map<string, ParsedDocument>();
  for (const document of pack.documents) {
    if (document.parsed) parsedByAbsolutePath.set(document.path, document.parsed);
  }

  for (const document of pack.documents) {
    if (!document.parsed || !document.inheritedBy) continue;
    const child = parsedByAbsolutePath.get(document.inheritedBy);
    if (!child) continue;
    const baseClassification = asClassification(document.parsed.meta.classification);
    const childClassification = asClassification(child.meta.classification);
    if (
      baseClassification
      && childClassification
      && classificationRank(childClassification) < classificationRank(baseClassification)
    ) {
      const report = reports.find((entry) => entry.file === child.path);
      report?.findings.push({
        ruleId: 'governance/classification-downgrade',
        severity: 'error',
        file: child.path,
        path: 'classification',
        message: `An overlay cannot downgrade inherited ${baseClassification} context to ${childClassification}`,
      });
    }
  }
}

function makeReport(root: string, files: FileReport[]): LintReport {
  const findings = files.flatMap((file) => file.findings);
  const summary = summarize(findings);
  return {
    specVersion: SPEC_VERSION,
    valid: summary.errors === 0,
    root,
    files,
    findings,
    summary,
  };
}

function summarize(findings: Finding[]): Summary {
  return {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    infos: findings.filter((finding) => finding.severity === 'info').length,
  };
}

function normalizeSeverity(value: string): Severity {
  return value === 'error' || value === 'warning' || value === 'info' ? value : 'info';
}

function displayPath(root: string, absolutePath: string): string {
  const relative = path.relative(root, absolutePath);
  return relative === '' ? path.basename(absolutePath) : relative;
}

function isStringMap(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asClassification(value: unknown): Classification | undefined {
  return typeof value === 'string' && CLASSIFICATIONS.includes(value as Classification)
    ? value as Classification
    : undefined;
}

export function listedKinds(pack: LoadedPack): Array<DocumentKind | 'design'> {
  return pack.documents
    .map((document) => document.role)
    .filter((role, index, roles) => roles.indexOf(role) === index && (KINDS.includes(role as DocumentKind) || role === 'design'));
}
