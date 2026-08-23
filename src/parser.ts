import { parse as parseYaml } from 'yaml';
import type { MarkdownSection, ParsedDocument } from './types.js';
import { normalizeHeading } from './spec.js';

export class CompanyMdParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = 'CompanyMdParseError';
  }
}

export function parseDocument(content: string, path = '<stdin>'): ParsedDocument {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0] !== '---') {
    throw new CompanyMdParseError('The document must start with YAML front matter delimited by ---', 1);
  }

  const closingFence = lines.indexOf('---', 1);
  if (closingFence === -1) {
    throw new CompanyMdParseError('The YAML front matter has no closing --- fence', 1);
  }

  const frontmatter = lines.slice(1, closingFence).join('\n');
  let meta: unknown;
  try {
    meta = parseYaml(frontmatter);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CompanyMdParseError(`Invalid YAML front matter: ${message}`, 2);
  }

  if (!isRecord(meta)) {
    throw new CompanyMdParseError('YAML front matter must be a mapping/object', 2);
  }

  const sections: MarkdownSection[] = [];
  const headingRows: Array<{ heading: string; lineIndex: number }> = [];
  for (let index = closingFence + 1; index < lines.length; index += 1) {
    const match = /^##\s+(.+?)\s*$/.exec(lines[index] ?? '');
    if (match?.[1]) headingRows.push({ heading: match[1], lineIndex: index });
  }

  for (let index = 0; index < headingRows.length; index += 1) {
    const current = headingRows[index];
    if (!current) continue;
    const next = headingRows[index + 1];
    sections.push({
      heading: current.heading,
      normalizedHeading: normalizeHeading(current.heading),
      line: current.lineIndex + 1,
      content: lines.slice(current.lineIndex + 1, next?.lineIndex ?? lines.length).join('\n').trim(),
    });
  }

  const claimReferences = Array.from(normalized.matchAll(/\{claim:([a-z0-9][a-z0-9._-]*)\}/gi), (match) => match[1]!)
    .filter((value, index, values) => values.indexOf(value) === index);

  return { path, content: normalized, frontmatter, meta, sections, claimReferences };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
