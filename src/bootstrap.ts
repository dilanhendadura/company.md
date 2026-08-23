import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { initPack } from './init.js';
import type { Classification, MaturityLevel } from './types.js';

const MAX_HTML_BYTES = 2_000_000;

export interface BootstrapOptions {
  name?: string;
  id?: string;
  owner?: string;
  contact?: string;
  classification?: Classification;
  maturity?: MaturityLevel;
  withDesign?: boolean;
  force?: boolean;
}

export interface BootstrapResult {
  directory: string;
  files: string[];
  source: string;
  extracted: {
    name: string;
    title?: string;
    description?: string;
  };
  confidence: 'low';
  reviewRequired: true;
}

export async function createPackFromUrl(
  sourceUrl: string,
  directory: string,
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const fetched = await fetchPublicHtml(sourceUrl);
  return seedPackFromHtml(fetched.url, fetched.html, directory, options);
}

export function seedPackFromHtml(
  sourceUrl: string,
  html: string,
  directory: string,
  options: BootstrapOptions = {},
): BootstrapResult {
  const url = new URL(sourceUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Source URL must use http or https');
  const extracted = extractHomepageContext(html);
  const name = (options.name?.trim() || extracted.siteName || inferredName(extracted.title) || url.hostname).replace(/\s+/g, ' ');
  const result = initPack(directory, {
    name,
    ...(options.id ? { id: options.id } : {}),
    ...(options.owner ? { owner: options.owner } : {}),
    ...(options.contact ? { contact: options.contact } : {}),
    ...(options.classification ? { classification: options.classification } : {}),
    maturity: options.maturity ?? 'starter',
    withDesign: options.withDesign ?? false,
    force: options.force ?? false,
  });

  const companyPath = path.join(result.directory, 'COMPANY.md');
  let company = fs.readFileSync(companyPath, 'utf8');
  const description = extracted.description?.trim();
  const source = url.toString();
  const claimsBlock = description
    ? `claims:\n  - id: company.public-homepage\n    status: assumption\n    source: ${JSON.stringify(source)}\n    owner: ${JSON.stringify((options.owner?.trim() || 'Company Context Council').replace(/\s+/g, ' '))}`
    : 'claims: []';
  const publicSummary = description
    ? `The public homepage describes ${name} as: “${description}” {claim:company.public-homepage}. This wording is an unverified seed, not an approved company claim.`
    : `A public homepage was imported for ${name}, but it did not expose a usable description. An owner must add and verify the company overview.`;
  const sellSeed = description
    ? `Use the homepage description as a discovery lead only: “${description}” {claim:company.public-homepage}. Replace this paragraph with approved product and service categories.`
    : 'The public seed did not provide enough evidence to identify the offer. Add approved product and service categories.';

  company = company
    .replace('claims: []', claimsBlock)
    .replace('TODO: In two concrete sentences, say what the company is and the change it creates.', publicSummary)
    .replace('TODO: Name the product and service categories. Link to an approved claim for time-sensitive facts.', sellSeed)
    .replace(
      'TODO: List unresolved questions, assumptions, owners, and dates for resolution.',
      `Public seed created from ${source}. Verify the company description, offer, customers, business model, differentiation, and boundaries with accountable owners before activation.`,
    );
  fs.writeFileSync(companyPath, company, 'utf8');

  return {
    ...result,
    source,
    extracted: {
      name,
      ...(extracted.title ? { title: extracted.title } : {}),
      ...(description ? { description } : {}),
    },
    confidence: 'low',
    reviewRequired: true,
  };
}

export function extractHomepageContext(html: string): { title?: string; description?: string; siteName?: string } {
  const title = cleanText(matchFirst(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i));
  const description = cleanText(findMetaContent(html, ['description', 'og:description', 'twitter:description']));
  const siteName = cleanText(findMetaContent(html, ['og:site_name', 'application-name']));
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(siteName ? { siteName } : {}),
  };
}

async function fetchPublicHtml(sourceUrl: string): Promise<{ url: string; html: string }> {
  let current = new URL(sourceUrl);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicHttpUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'Company.md/0.2 public-context-bootstrap' },
      });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect from ${current} has no Location header`);
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`Unable to fetch ${current}: HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('text/html')) throw new Error(`Expected HTML from ${current}, received ${contentType || 'unknown content type'}`);
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    if (contentLength > MAX_HTML_BYTES) throw new Error(`Homepage exceeds the ${MAX_HTML_BYTES} byte import limit`);
    const html = await readLimitedText(response, MAX_HTML_BYTES);
    return { url: current.toString(), html };
  }
  throw new Error('Too many redirects while fetching homepage');
}

async function readLimitedText(response: Response, limit: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`Homepage exceeds the ${limit} byte import limit`);
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Source URL must use http or https');
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local and private network URLs are not allowed for public bootstrap');
  }
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Local and private network URLs are not allowed for public bootstrap');
    return;
  }
  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Hostname resolves to a local or private network address');
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)?.[1];
  const ipv4 = mapped ?? (net.isIPv4(normalized) ? normalized : undefined);
  if (!ipv4) return false;
  const parts = ipv4.split('.').map(Number);
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || first >= 224;
}

function findMetaContent(html: string, keys: string[]): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.name ?? attributes.property ?? '').toLowerCase();
    if (keys.includes(key) && attributes.content) return attributes.content;
  }
  return undefined;
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    const key = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (key && value !== undefined) attributes[key] = value;
  }
  return attributes;
}

function inferredName(title: string | undefined): string | undefined {
  if (!title) return undefined;
  return title.split(/\s+[|–—-]\s+/)[0]?.trim() || title;
}

function matchFirst(value: string, pattern: RegExp): string | undefined {
  return pattern.exec(value)?.[1];
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const decoded = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || undefined;
}
