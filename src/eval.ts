import fs from 'node:fs';
import path from 'node:path';
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
  const offer = section(pack, 'offer', 'Claims to Avoid');
  const voice = section(pack, 'voice', 'Phrases We Avoid');
  const prohibitedClaims = extractQuotedPhrases(offer);
  const avoidedPhrases = extractLeadingPhrases(voice);
  return [
    ...prohibitedClaims.map((phrase) => ({
      id: `offer/claim-to-avoid/${slug(phrase)}`,
      description: `Do not use the prohibited offer claim “${phrase}”`,
      forbidden: [phrase],
    })),
    ...avoidedPhrases.map((phrase) => ({
      id: `voice/phrase-to-avoid/${slug(phrase)}`,
      description: `Do not use the avoided voice phrase “${phrase}”`,
      forbidden: [phrase],
    })),
  ];
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

function section(pack: LoadedPack, role: 'offer' | 'voice', heading: string): string {
  const document = pack.documents.find((entry) => entry.role === role && !entry.inherited && entry.parsed);
  const found = document?.parsed?.sections.find((entry) => entry.normalizedHeading === normalizeHeading(heading));
  return found?.content ?? '';
}

function extractQuotedPhrases(content: string): string[] {
  return unique(Array.from(
    content.matchAll(/[“"]([^”"]{2,80})[”"]/g),
    (match) => match[1]!.trim().replace(/[.,;:!?]+$/g, ''),
  ));
}

function extractLeadingPhrases(content: string): string[] {
  const quoted = extractQuotedPhrases(content);
  const beforeArrow = Array.from(content.matchAll(/^\s*[-*]\s+([^\n→-]{2,80})\s*(?:→|->)/gm), (match) => match[1]!.replace(/[“”"']/g, '').trim());
  return unique([...quoted, ...beforeArrow]);
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
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
