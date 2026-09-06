import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { lintLoadedPack, loadPack } from './pack.js';
import { resolveContext, insideRoot, type ResolveOptions, type ResolvedContext } from './resolve.js';
import { CLASSIFICATIONS, PROFILE_ROLES, classificationRank } from './spec.js';
import type { Classification, LoadedDocument } from './types.js';

export interface ContextOptions extends ResolveOptions {
  profile?: keyof typeof PROFILE_ROLES;
  clearance?: Classification;
  allowInvalid?: boolean;
  allowDraft?: boolean;
  requireDesign?: boolean;
  compact?: boolean;
}

export interface ContextResult {
  markdown: string;
  root: string;
  files: string[];
  profile: string;
  clearance: Classification;
  generatedAt: string;
  sources: ContextSource[];
  resolution: ResolvedContext;
  attachments: Array<{ file: string; role: string; sha256: string }>;
  stats: { files: number; sourceBytes: number; contextBytes: number; omittedDuplicateSections: number };
}

export interface ContextSource {
  file: string;
  role: string;
  sha256: string;
  classification: Classification;
  status?: string;
}

const sha256 = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex');

export function createContext(input: string, options: ContextOptions = {}): ContextResult {
  const profile = options.profile ?? (options.artifact === 'presentation' ? 'visual' : 'all');
  const clearance = options.clearance ?? 'internal';
  const roles = Object.hasOwn(PROFILE_ROLES, profile) ? PROFILE_ROLES[profile] : undefined;
  if (!roles) throw new Error(`Unknown profile ${profile}. Choose: ${Object.keys(PROFILE_ROLES).join(', ')}`);
  if (!CLASSIFICATIONS.includes(clearance)) throw new Error(`Unknown clearance ${clearance}`);
  if (options.artifact === 'presentation' && profile !== 'visual') throw new Error('presentation requires the visual profile');
  const resolution = resolveContext(input, options);
  const pack = loadPack(resolution.pack, {
    workspaceRoot: resolution.workspaceRoot,
    roles,
    ...(resolution.binding?.design ? { design: resolution.binding.design } : {}),
  });
  if (!options.allowInvalid) {
    const report = lintLoadedPack(pack);
    if (!report.valid) {
      const detail = report.findings.filter(f => f.severity === 'error').map(f => `${f.file}: ${f.message}`).join('; ');
      throw new Error(`Context pack has ${report.summary.errors} validation error(s): ${detail}`);
    }
  }
  const selected = pack.documents;
  const deprecated = selected.filter(document => document.parsed?.meta.status === 'deprecated');
  if (deprecated.length) throw new Error(`Deprecated context cannot be bundled: ${deprecated.map(d => d.path).join(', ')}`);
  const drafts = selected.filter(document => document.parsed?.meta.status === 'draft');
  if (drafts.length && !options.allowDraft) throw new Error(`Draft context requires --allow-draft: ${drafts.map(d => path.relative(pack.root, d.path)).join(', ')}`);
  const blocked = selected.filter(document => classificationRank(classificationOf(document, pack.company.meta.classification)) > classificationRank(clearance));
  if (blocked.length) throw new Error(`Clearance ${clearance} is insufficient for: ${blocked.map(d => path.relative(pack.root, d.path)).join(', ')}`);

  if (resolution.subject) {
    const rootProducts = scopeValues(pack.company.meta.scope, 'products');
    if (pack.company.meta.id !== resolution.subject && !rootProducts?.includes(resolution.subject)) {
      throw new Error(`Subject ${resolution.subject} does not match pack ${String(pack.company.meta.id)}`);
    }
    if (resolution.kind === 'product') {
      for (const document of selected) {
        const products = scopeValues(document.parsed?.meta.scope, 'products');
        if (products && !products.includes('all') && !products.includes(resolution.subject)) {
          throw new Error(`Subject ${resolution.subject} conflicts with products scope in ${document.path}`);
        }
      }
    }
  } else if (typeof pack.company.meta.id === 'string') resolution.subject = pack.company.meta.id;

  const design = selected.find(d => d.role === 'design');
  const foreignDesign = design && (!insideRoot(design.path, pack.root)
    || resolution.nestedPackRoots?.some(root => insideRoot(design.path, root)));
  if (options.requireDesign || options.artifact === 'presentation') {
    if (!design) throw new Error('This artifact requires a linked DESIGN.md; no design was resolved');
    if (!resolution.binding?.design && foreignDesign) {
      throw new Error('A shared or external design requires an explicit registry artifact binding');
    }
  }
  if (resolution.registry && design && !resolution.binding?.design && foreignDesign) {
    throw new Error('Design belonging to another pack requires an explicit artifact binding');
  }

  const files = selected.map(document => path.relative(pack.root, document.path));
  const generatedAt = new Date().toISOString();
  const sources = selected.map(document => ({
    file: path.relative(pack.root, document.path), role: document.role,
    sha256: sha256(document.content), classification: classificationOf(document, pack.company.meta.classification),
    ...(typeof document.parsed?.meta.status === 'string' ? { status: document.parsed.meta.status } : {}),
  }));
  const attachments: ContextResult['attachments'] = [];
  for (const [role, file] of Object.entries({ registry: resolution.registry, template: resolution.binding?.template, templateSkill: resolution.binding?.templateSkill })) {
    if (file) attachments.push({ file: path.relative(pack.root, file), role, sha256: sha256(fs.readFileSync(file)) });
  }
  let omittedDuplicateSections = 0;
  const bodies = selected.map((document, index) => {
    let content = document.content.trim();
    if (options.compact && document.inherited && document.parsed) {
      // Only exact duplicate prose is elided. Unique inherited constraints remain verbatim.
      const duplicate = document.parsed.sections.filter(section => selected.slice(index + 1).some(later => later.role === document.role
        && later.parsed?.sections.some(s => s.normalizedHeading === section.normalizedHeading && s.content === section.content)));
      if (duplicate.length) {
        const names = new Set(duplicate.map(s => s.normalizedHeading));
        const lines = document.content.replace(/\r\n?/g, '\n').split('\n');
        const omitted = new Set<number>();
        document.parsed.sections.forEach((section, sectionIndex) => {
          if (!names.has(section.normalizedHeading)) return;
          const end = document.parsed!.sections[sectionIndex + 1]?.line ?? (lines.length + 1);
          for (let line = section.line - 1; line < end - 1; line++) omitted.add(line);
        });
        content = `${lines.filter((_, line) => !omitted.has(line)).join('\n').trim()}\n\n<!-- ${duplicate.length} identical inherited section(s) appear in later sources. -->`;
        omittedDuplicateSections += duplicate.length;
      }
    }
    return `\n---\n\n# Source: ${path.relative(pack.root, document.path)}${document.inherited ? ' (inherited base)' : ''}\n\n${content}\n`;
  });
  const preamble = [
    '<!-- Generated by Company.md. Edit source files, not this bundle. -->', '# Company context bundle', '',
    `- Subject: ${resolution.subject ?? 'unspecified'}`, `- Profile: ${profile}`, `- Clearance: ${clearance}`,
    `- Generated: ${generatedAt}`, `- Sources: ${files.join(', ')}`,
    ...(resolution.artifact ? [`- Artifact: ${resolution.artifact}`] : []),
    ...(resolution.binding?.template ? [`- Required template: ${resolution.binding.template}`] : []),
    ...(resolution.binding?.templateSkill ? [`- Required template skill: ${resolution.binding.templateSkill}`] : []),
    ...(drafts.length ? ['- TEST CONTEXT: draft sources; not approved company truth.'] : []), '', '## Agent contract', '',
    '- Use this newly resolved subject only; do not reuse another product’s context, assets, claims, or template from earlier turns.',
    '- Apply every inherited prohibition and operating boundary. More specific preferences override base preferences only within their declared scope.',
    '- Prefer verified claims over assumptions; never turn an open question into a fact.',
    '- Do not invent pricing, proof, promises, customer facts, or brand rules.',
    '- For visual work, apply DESIGN.md after business, customer, offer, and voice constraints; use any explicitly bound template and template skill.',
  ].join('\n');
  const markdown = `${preamble}${bodies.join('')}\n`;
  return { markdown, root: pack.root, files, profile, clearance, generatedAt, sources, resolution, attachments,
    stats: { files: selected.length, sourceBytes: selected.reduce((sum, d) => sum + Buffer.byteLength(d.content), 0), contextBytes: Buffer.byteLength(markdown), omittedDuplicateSections } };
}

export function writeContext(result: ContextResult, output: string): void {
  fs.writeFileSync(path.resolve(output), result.markdown, 'utf8');
}

export function writeContextReceipt(result: ContextResult, output: string): void {
  const receipt = {
    schema: 'companymd/context-receipt/v1', generatedAt: result.generatedAt, profile: result.profile, clearance: result.clearance,
    sourceRoot: path.relative(path.dirname(path.resolve(output)), result.root) || '.',
    subject: result.resolution.subject, artifact: result.resolution.artifact,
    sources: result.sources, attachments: result.attachments, stats: result.stats,
    ...(result.resolution.binding ? { binding: Object.fromEntries(Object.entries(result.resolution.binding).map(([role, file]) => [role, path.relative(result.root, file)])) } : {}),
  };
  fs.writeFileSync(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

function scopeValues(scope: unknown, dimension: string): string[] | undefined {
  if (typeof scope !== 'object' || !scope || Array.isArray(scope)) return undefined;
  const values = (scope as Record<string, unknown>)[dimension];
  return Array.isArray(values) && values.every(v => typeof v === 'string') ? values : undefined;
}

function classificationOf(document: LoadedDocument, companyClassification: unknown): Classification {
  if (document.role === 'design') return asClassification(companyClassification) ?? 'internal';
  return asClassification(document.parsed?.meta.classification) ?? 'restricted';
}

function asClassification(value: unknown): Classification | undefined {
  return typeof value === 'string' && CLASSIFICATIONS.includes(value as Classification) ? value as Classification : undefined;
}
