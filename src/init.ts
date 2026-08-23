import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIFICATIONS } from './spec.js';
import type { Classification } from './types.js';

export interface InitOptions {
  name: string;
  id?: string;
  owner?: string;
  contact?: string;
  classification?: Classification;
  withDesign?: boolean;
  force?: boolean;
  now?: Date;
}

export interface InitResult {
  directory: string;
  files: string[];
}

export function initPack(directory: string, options: InitOptions): InitResult {
  if (!options.name.trim()) throw new Error('--name is required');
  const classification = options.classification ?? 'internal';
  if (!CLASSIFICATIONS.includes(classification)) throw new Error(`Invalid classification: ${classification}`);

  const target = path.resolve(directory);
  const id = options.id ?? slugify(options.name);
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(id)) throw new Error('id must be a stable lowercase identifier');

  const now = options.now ?? new Date();
  const lastReviewed = toDate(now);
  const nextReviewDate = new Date(now);
  nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + 90);
  const replacements: Record<string, string> = {
    '{{COMPANY_NAME}}': options.name.trim(),
    '{{COMPANY_ID}}': id,
    '{{OWNER_TEAM}}': options.owner?.trim() || 'Company Context Council',
    '{{OWNER_CONTACT}}': options.contact?.trim() || 'context-owner@example.com',
    '{{CLASSIFICATION}}': classification,
    '{{LAST_REVIEWED}}': lastReviewed,
    '{{NEXT_REVIEW}}': toDate(nextReviewDate),
    '{{DESIGN_LINK}}': options.withDesign ? '  design: ./DESIGN.md' : '',
  };

  const names = ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md'];
  if (options.withDesign) names.push('DESIGN.md');
  fs.mkdirSync(target, { recursive: true });

  const collisions = names.filter((name) => fs.existsSync(path.join(target, name)));
  if (collisions.length > 0 && !options.force) {
    throw new Error(`Refusing to overwrite: ${collisions.join(', ')}. Use --force only if replacement is intended.`);
  }

  for (const name of names) {
    const template = fs.readFileSync(path.join(templatesDirectory(), `${name}.template`), 'utf8');
    let rendered = template;
    for (const [needle, replacement] of Object.entries(replacements)) rendered = rendered.replaceAll(needle, replacement);
    fs.writeFileSync(path.join(target, name), rendered, 'utf8');
  }
  return { directory: target, files: names };
}

function templatesDirectory(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(current, '..', 'templates'),
    path.resolve(current, '..', '..', 'templates'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Packaged templates directory is missing');
  return found;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

function toDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
