import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { loadPack } from './pack.js';
import { normalizeHeading } from './spec.js';
import type { LoadedPack } from './types.js';

export interface EvalCheck {
  id: string;
  description: string;
  requiredAny?: string[];
  requiredAll?: string[];
  forbidden?: string[];
}

export interface EvalOutputResult {
  file: string;
  passed: boolean;
  checks: Array<{
    id: string;
    description: string;
    passed: boolean;
    missing: string[];
    violations: string[];
  }>;
}

export interface EvalReport {
  schema: 'companymd/eval-report/v1';
  pack: string;
  rubric?: string;
  baseline: EvalOutputResult;
  candidate: EvalOutputResult;
  fixed: string[];
  regressions: string[];
  unchangedFailures: string[];
  outcome: 'improved' | 'regressed' | 'unchanged';
  note: string;
}

export function evaluateBeforeAfter(
  packInput: string,
  baselineFile: string,
  candidateFile: string,
  rubricFile?: string,
): EvalReport {
  const pack = loadPack(packInput);
  const checks = [...defaultChecks(pack), ...(rubricFile ? loadRubric(rubricFile) : [])];
  const uniqueChecks = deduplicateChecks(checks);
  const baseline = evaluateOutput(baselineFile, uniqueChecks);
  const candidate = evaluateOutput(candidateFile, uniqueChecks);
  const baselineById = new Map(baseline.checks.map((check) => [check.id, check.passed]));
  const candidateById = new Map(candidate.checks.map((check) => [check.id, check.passed]));
  const fixed = uniqueChecks.filter((check) => baselineById.get(check.id) === false && candidateById.get(check.id) === true).map((check) => check.id);
  const regressions = uniqueChecks.filter((check) => baselineById.get(check.id) === true && candidateById.get(check.id) === false).map((check) => check.id);
  const unchangedFailures = uniqueChecks.filter((check) => baselineById.get(check.id) === false && candidateById.get(check.id) === false).map((check) => check.id);
  const outcome = regressions.length > fixed.length ? 'regressed' : fixed.length > regressions.length ? 'improved' : 'unchanged';

  return {
    schema: 'companymd/eval-report/v1',
    pack: pack.root,
    ...(rubricFile ? { rubric: path.resolve(rubricFile) } : {}),
    baseline,
    candidate,
    fixed,
    regressions,
    unchangedFailures,
    outcome,
    note: 'This is a conformance comparison, not a truth score. It checks explicit textual constraints and cannot establish factual truth or business performance.',
  };
}

function evaluateOutput(file: string, checks: EvalCheck[]): EvalOutputResult {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`Eval output does not exist: ${absolute}`);
  const content = fs.readFileSync(absolute, 'utf8');
  const normalized = normalizeText(content);
  const results = checks.map((check) => {
    const requiredAny = check.requiredAny ?? [];
    const requiredAll = check.requiredAll ?? [];
    const forbidden = check.forbidden ?? [];
    const anySatisfied = requiredAny.length === 0 || requiredAny.some((phrase) => normalized.includes(normalizeText(phrase)));
    const missingAll = requiredAll.filter((phrase) => !normalized.includes(normalizeText(phrase)));
    const violations = forbidden.filter((phrase) => normalized.includes(normalizeText(phrase)));
    const missing = [...(anySatisfied ? [] : requiredAny), ...missingAll];
    return {
      id: check.id,
      description: check.description,
      passed: missing.length === 0 && violations.length === 0,
      missing,
      violations,
    };
  });
  return { file: absolute, passed: results.every((result) => result.passed), checks: results };
}

function defaultChecks(pack: LoadedPack): EvalCheck[] {
  // Prohibitions are cumulative: a more specific overlay cannot erase a
  // restriction merely by omitting it from its own section.
  const offer = sections(pack, 'offer', 'Claims to Avoid');
  const voice = sections(pack, 'voice', 'Phrases We Avoid');
  const prohibitedClaims = extractQuotedPhrases(offer);
  const avoidedPhrases = extractLeadingPhrases(voice);
  return [
    ...forbiddenChecks(prohibitedClaims, 'offer/claim-to-avoid', 'prohibited offer claim'),
    ...forbiddenChecks(avoidedPhrases, 'voice/phrase-to-avoid', 'avoided voice phrase'),
  ];
}

function forbiddenChecks(phrases: string[], prefix: string, description: string): EvalCheck[] {
  const slugCounts = new Map<string, number>();
  for (const phrase of phrases) slugCounts.set(slug(phrase), (slugCounts.get(slug(phrase)) ?? 0) + 1);
  return phrases.map((phrase) => {
    const baseId = slug(phrase);
    // Keep existing readable IDs where possible, while preserving distinct
    // phrases with colliding/truncated slugs and non-Latin-only constraints.
    const suffix = !baseId || slugCounts.get(baseId)! > 1
      ? `-${createHash('sha256').update(normalizeText(phrase)).digest('hex').slice(0, 12)}`
      : '';
    return {
      id: `${prefix}/${baseId}${suffix}`,
      description: `Do not use the ${description} “${phrase}”`,
      forbidden: [phrase],
    };
  });
}

function loadRubric(file: string): EvalCheck[] {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`Rubric does not exist: ${absolute}`);
  const parsed = parseYaml(fs.readFileSync(absolute, 'utf8')) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.checks)) throw new Error('Rubric must contain a checks array');
  return parsed.checks.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.description !== 'string') {
      throw new Error(`Rubric check ${index} needs id and description`);
    }
    const requiredAny = stringArray(raw.required_any, `checks[${index}].required_any`);
    const requiredAll = stringArray(raw.required_all, `checks[${index}].required_all`);
    const forbidden = stringArray(raw.forbidden, `checks[${index}].forbidden`);
    if (requiredAny.length + requiredAll.length + forbidden.length === 0) {
      throw new Error(`Rubric check ${raw.id} must define required_any, required_all, or forbidden`);
    }
    return {
      id: raw.id,
      description: raw.description,
      ...(requiredAny.length ? { requiredAny } : {}),
      ...(requiredAll.length ? { requiredAll } : {}),
      ...(forbidden.length ? { forbidden } : {}),
    };
  });
}

function sections(pack: LoadedPack, role: 'offer' | 'voice', heading: string): string {
  const normalizedHeading = normalizeHeading(heading);
  return pack.documents
    .filter((entry) => entry.role === role)
    .flatMap((entry) => entry.parsed?.sections
      .filter((candidate) => candidate.normalizedHeading === normalizedHeading)
      .map((candidate) => candidate.content) ?? [])
    .join('\n');
}

function extractQuotedPhrases(content: string): string[] {
  return unique(Array.from(
    content.matchAll(/“([^”\n]+)”|"([^"\n]+)"/g),
    (match) => (match[1] ?? match[2])!.trim().replace(/[.,;:!?]+$/g, ''),
  ));
}

function extractLeadingPhrases(content: string): string[] {
  return unique(content.split('\n').flatMap((line) => {
    const beforeArrow = line.match(/^\s*[-*]\s+(.+?)\s*(?:→|->)/)?.[1];
    if (!beforeArrow) return extractQuotedPhrases(line);
    const quoted = extractQuotedPhrases(beforeArrow);
    // Text after an arrow is the suggested replacement, even when quoted.
    return quoted.length ? quoted : [beforeArrow.trim().replace(/^'|'$/g, '')];
  }));
}

function deduplicateChecks(checks: EvalCheck[]): EvalCheck[] {
  const seen = new Set<string>();
  return checks.filter((check) => {
    if (seen.has(check.id)) throw new Error(`Duplicate eval check id: ${check.id}`);
    seen.add(check.id);
    return true;
  });
}

function stringArray(value: unknown, pathLabel: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    throw new Error(`${pathLabel} must be a string array`);
  }
  return value as string[];
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

function slug(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

function unique(values: string[]): string[] {
  // Sorting makes check identities and descriptions independent of extends
  // order; matching already ignores case, apostrophe style and whitespace.
  const byNormalizedText = new Map<string, string>();
  for (const value of [...values].sort()) {
    const normalized = normalizeText(value);
    if (normalized && !byNormalizedText.has(normalized)) byNormalizedText.set(normalized, value);
  }
  return [...byNormalizedText.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
