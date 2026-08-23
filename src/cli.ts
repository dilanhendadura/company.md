#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, writeContext } from './context.js';
import { diffPacks } from './diff.js';
import { initPack } from './init.js';
import { lintDocument } from './lint.js';
import { lintPack } from './pack.js';
import { parseDocument } from './parser.js';
import { CLASSIFICATIONS, PROFILE_ROLES, SPEC_VERSION } from './spec.js';
import type { Classification, Finding, LintReport } from './types.js';

const VERSION = '0.1.0';
const BOOLEAN_OPTIONS = new Set(['strict', 'with-design', 'force', 'allow-invalid', 'allow-draft', 'help', 'version']);

async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (!command || command === 'help' || parsed.flags.has('help')) {
    process.stdout.write(helpText());
    return 0;
  }
  if (command === '--version' || command === '-v' || parsed.flags.has('version')) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  switch (command) {
    case 'init':
      return runInit(parsed);
    case 'lint':
      return runLint(parsed);
    case 'context':
      return runContext(parsed);
    case 'diff':
      return runDiff(parsed);
    case 'spec':
      process.stdout.write(readProjectFile('SPEC.md'));
      return 0;
    case 'schema':
      process.stdout.write(readProjectFile(path.join('schemas', 'frontmatter.schema.json')));
      return 0;
    default:
      throw new Error(`Unknown command ${command}. Run companymd help.`);
  }
}

function runInit(args: ParsedArgs): number {
  const name = args.options.get('name');
  if (!name) throw new Error('init requires --name "Company name"');
  const classification = (args.options.get('classification') ?? 'internal') as Classification;
  if (!CLASSIFICATIONS.includes(classification)) {
    throw new Error(`--classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
  }
  const id = args.options.get('id');
  const owner = args.options.get('owner');
  const contact = args.options.get('contact');
  const result = initPack(args.positionals[0] ?? '.', {
    name,
    ...(id ? { id } : {}),
    ...(owner ? { owner } : {}),
    ...(contact ? { contact } : {}),
    classification,
    withDesign: args.flags.has('with-design'),
    force: args.flags.has('force'),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

function runLint(args: ParsedArgs): number {
  const input = args.positionals[0] ?? '.';
  const format = args.options.get('format') ?? 'json';
  const report = input === '-' ? lintStdin() : lintPack(input);
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (format === 'pretty') {
    process.stdout.write(formatLintReport(report));
  } else {
    throw new Error('--format must be json or pretty');
  }
  const failed = report.summary.errors > 0 || (args.flags.has('strict') && report.summary.warnings > 0);
  return failed ? 1 : 0;
}

function runContext(args: ParsedArgs): number {
  const profile = args.options.get('profile') ?? 'all';
  if (!(profile in PROFILE_ROLES)) throw new Error(`--profile must be one of: ${Object.keys(PROFILE_ROLES).join(', ')}`);
  const clearance = (args.options.get('clearance') ?? 'internal') as Classification;
  if (!CLASSIFICATIONS.includes(clearance)) throw new Error(`--clearance must be one of: ${CLASSIFICATIONS.join(', ')}`);
  const result = createContext(args.positionals[0] ?? '.', {
    profile,
    clearance,
    allowInvalid: args.flags.has('allow-invalid'),
    allowDraft: args.flags.has('allow-draft'),
  });
  const output = args.options.get('output');
  if (output) {
    writeContext(result, output);
    process.stdout.write(`${JSON.stringify({ ok: true, output: path.resolve(output), files: result.files }, null, 2)}\n`);
  } else {
    process.stdout.write(result.markdown);
  }
  return 0;
}

function runDiff(args: ParsedArgs): number {
  const before = args.positionals[0];
  const after = args.positionals[1];
  if (!before || !after) throw new Error('diff requires <before> and <after> paths');
  const report = diffPacks(before, after);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.regression ? 1 : 0;
}

function lintStdin(): LintReport {
  const content = fs.readFileSync(0, 'utf8');
  try {
    const parsed = parseDocument(content, '<stdin>');
    const findings = lintDocument(parsed);
    return reportForSingleFile(findings, typeof parsed.meta.kind === 'string' ? parsed.meta.kind : 'unknown');
  } catch (error) {
    return reportForSingleFile([{
      ruleId: 'parse/frontmatter',
      severity: 'error',
      file: '<stdin>',
      message: error instanceof Error ? error.message : String(error),
    }], 'unknown');
  }
}

function reportForSingleFile(findings: Finding[], kind: string): LintReport {
  const summary = {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    infos: findings.filter((finding) => finding.severity === 'info').length,
  };
  return {
    specVersion: SPEC_VERSION,
    valid: summary.errors === 0,
    root: '<stdin>',
    files: [{ file: '<stdin>', kind: ['company', 'customer', 'offer', 'voice', 'design'].includes(kind) ? kind as 'company' : 'unknown', findings }],
    findings,
    summary,
  };
}

function formatLintReport(report: LintReport): string {
  const lines: string[] = [];
  for (const finding of report.findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`${finding.severity.toUpperCase().padEnd(7)} ${finding.ruleId} ${location}`);
    lines.push(`        ${finding.message}`);
    if (finding.suggestion) lines.push(`        Fix: ${finding.suggestion}`);
  }
  if (report.findings.length === 0) lines.push('No findings.');
  lines.push(`Summary: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.infos} info(s)`);
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (!rawKey) continue;
    if (BOOLEAN_OPTIONS.has(rawKey)) {
      flags.add(rawKey);
      continue;
    }
    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Option --${rawKey} needs a value`);
    options.set(rawKey, value);
    if (inlineValue === undefined) index += 1;
  }
  return { positionals, options, flags };
}

function readProjectFile(relative: string): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(current, '..', relative),
    path.resolve(current, '..', '..', relative),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Packaged resource is missing: ${relative}`);
  const content = fs.readFileSync(found, 'utf8');
  return content.endsWith('\n') ? content : `${content}\n`;
}

function helpText(): string {
  return `Company.md ${VERSION}

Agent-readable company context for enterprise AI workspaces.

Usage:
  companymd init [directory] --name <name> [--with-design]
  companymd lint [path|-] [--format json|pretty] [--strict]
  companymd context [path] [--profile <profile>] [--clearance <level>] [--output <file>]
  companymd diff <before> <after>
  companymd spec
  companymd schema

Profiles: ${Object.keys(PROFILE_ROLES).join(', ')}
Clearance: ${CLASSIFICATIONS.join(', ')}

Common init options:
  --id <id>                 Stable lowercase company id
  --owner <team>            Accountable team
  --contact <contact>       Owner email or directory handle
  --classification <level> Defaults to internal
  --with-design             Add and link a DESIGN.md file
  --force                   Replace colliding framework files

Lint exits 1 for errors; --strict also exits 1 for warnings.
JSON is the default lint format so coding agents and CI can act on findings.
Draft documents require an explicit --allow-draft when creating context.
`;
}

interface ParsedArgs {
  positionals: string[];
  options: Map<string, string>;
  flags: Set<string>;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
    process.exitCode = 2;
  });
