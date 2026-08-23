import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from './parser.js';
import { SCHEMA_ID } from './spec.js';

export type AdoptionTarget = 'company' | 'customer' | 'offer' | 'voice' | 'design' | 'agent' | 'public-index';

export interface AdoptionCandidate {
  file: string;
  targets: AdoptionTarget[];
  headings: string[];
  reason: string;
}

export interface AdoptionReport {
  schema: 'companymd/adoption-report/v1';
  root: string;
  existingPack: boolean;
  dialect?: string;
  collision?: string;
  candidates: AdoptionCandidate[];
  recommendedOrder: string[];
}

export function inspectForAdoption(input: string): AdoptionReport {
  const root = path.resolve(input);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Adoption target must be an existing directory: ${root}`);
  }
  const files = walk(root, root, 0, 4, 500);
  const companyPath = files.find((file) => path.basename(file).toLowerCase() === 'company.md');
  let dialect: string | undefined;
  let collision: string | undefined;
  if (companyPath) {
    try {
      const parsed = parseDocument(fs.readFileSync(companyPath, 'utf8'), path.relative(root, companyPath));
      dialect = typeof parsed.meta.schema === 'string' ? parsed.meta.schema : undefined;
      if (dialect && dialect !== SCHEMA_ID) collision = `Existing COMPANY.md declares ${dialect}; do not overwrite it or interpret it as ${SCHEMA_ID}.`;
      if (!dialect) collision = `Existing COMPANY.md has no dialect namespace; preserve it and confirm its format before adding ${SCHEMA_ID}.`;
    } catch {
      collision = 'An existing COMPANY.md is not parseable as a Company.md context document; preserve it and review manually.';
    }
  }

  const candidates = files
    .map((file) => classifyCandidate(root, file))
    .filter((candidate): candidate is AdoptionCandidate => candidate !== undefined)
    .sort((left, right) => left.file.localeCompare(right.file));

  return {
    schema: 'companymd/adoption-report/v1',
    root,
    existingPack: dialect === SCHEMA_ID,
    ...(dialect ? { dialect } : {}),
    ...(collision ? { collision } : {}),
    candidates,
    recommendedOrder: [
      'Preserve all source files and resolve any COMPANY.md dialect collision.',
      'Map company and offer facts before voice or visual guidance.',
      'Mark imported statements as assumptions until an accountable owner verifies them.',
      'Create or update the four-file pack in draft status.',
      'Lint, review the semantic diff, and activate only with owner approval.',
    ],
  };
}

function classifyCandidate(root: string, file: string): AdoptionCandidate | undefined {
  const relative = path.relative(root, file);
  const basename = path.basename(file).toLowerCase();
  const normalized = relative.toLowerCase();
  const extension = path.extname(file).toLowerCase();
  if (!['.md', '.txt'].includes(extension)) return undefined;

  const targets = new Set<AdoptionTarget>();
  const reasons: string[] = [];
  if (['agents.md', 'claude.md', 'gemini.md', 'copilot-instructions.md'].includes(basename)) {
    targets.add('agent');
    reasons.push('existing agent instructions');
  }
  if (basename === 'readme.md' || /(?:company|about|strategy|positioning)/.test(normalized)) {
    targets.add('company');
    reasons.push('company or positioning context');
  }
  if (/(?:customer|persona|buyer|audience|\bicp\b)/.test(normalized)) {
    targets.add('customer');
    reasons.push('customer context');
  }
  if (/(?:offer|pricing|package|proposal|sales|product)/.test(normalized)) {
    targets.add('offer');
    reasons.push('offer or commercial context');
  }
  if (/(?:voice|tone|writing|content|brand)/.test(normalized)) {
    targets.add('voice');
    reasons.push('voice or brand context');
  }
  if (/(?:design|visual|brand)/.test(normalized)) {
    targets.add('design');
    reasons.push('visual context');
  }
  if (basename === 'llms.txt') {
    targets.add('public-index');
    reasons.push('public agent discovery index');
  }
  if (targets.size === 0) return undefined;

  let headings: string[] = [];
  try {
    const content = fs.readFileSync(file, 'utf8').slice(0, 200_000);
    headings = Array.from(content.matchAll(/^#{1,3}\s+(.+?)\s*$/gm), (match) => match[1]!.trim()).slice(0, 20);
  } catch {
    // The inventory remains useful even when a candidate cannot be read.
  }
  return { file: relative, targets: [...targets], headings, reason: reasons.join('; ') };
}

function walk(root: string, directory: string, depth: number, maxDepth: number, remaining: number): string[] {
  if (depth > maxDepth || remaining <= 0) return [];
  const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.cache']);
  const results: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (results.length >= remaining) break;
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(root, absolute, depth + 1, maxDepth, remaining - results.length));
    } else if (entry.isFile()) {
      results.push(absolute);
    }
  }
  return results;
}
