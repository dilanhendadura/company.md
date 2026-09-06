#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectForAdoption } from './adopt.js';
import { formatArtifactVerificationReport, verifyArtifactReceipt } from './artifact.js';
import { createPackFromUrl } from './bootstrap.js';
import { createContext, writeContext, writeContextReceipt } from './context.js';
import { diffPacks } from './diff.js';
import { evaluateBeforeAfter } from './eval.js';
import { initPack } from './init.js';
import { installAgentIntegration, SUPPORTED_AGENTS, type SupportedAgent } from './install.js';
import { resolveContext } from './resolve.js';
import { lintDocument } from './lint.js';
import { lintPack } from './pack.js';
import { parseDocument } from './parser.js';
import { CLASSIFICATIONS, MATURITY_LEVELS, PROFILE_ROLES, SPEC_VERSION } from './spec.js';
import type { Classification, Finding, LintReport, MaturityLevel } from './types.js';

const VERSION = '0.4.0';
const BOOLEAN_OPTIONS = new Set(['strict', 'with-design', 'force', 'allow-invalid', 'allow-draft', 'require-design', 'compact', 'help', 'version']);

async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (!command || command === 'help' || command === '--help' || command === '-h' || parsed.flags.has('help')) {
    process.stdout.write(helpText());
    return 0;
  }
  if (command === '--version' || command === '-v' || parsed.flags.has('version')) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  validateArgs(command, parsed);
  switch (command) {
    case 'resolve': {
      const result = resolveContext(parsed.positionals[0] ?? '.', resolutionOptions(parsed));
      const format = parsed.options.get('format') ?? 'json';
      if (!['json', 'pretty'].includes(format)) throw new Error('--format must be json or pretty');
      process.stdout.write(format === 'json' ? `${JSON.stringify(result, null, 2)}\n` : `Subject: ${result.subject ?? 'unspecified'}\nPack: ${result.pack}\nReason: ${result.reason}\nDesign: ${result.binding?.design ?? '(pack link)'}\nTemplate skill: ${result.binding?.templateSkill ?? '(none)'}\n`);
      return 0;
    }
    case 'init':
      return runInit(parsed);
    case 'create':
    case 'from-url':
      return runCreate(parsed);
    case 'adopt':
      return runAdopt(parsed);
    case 'install':
      return runInstall(parsed);
    case 'lint':
      return runLint(parsed);
    case 'context':
      return runContext(parsed);
    case 'diff':
      return runDiff(parsed);
    case 'eval':
      return runEval(parsed);
    case 'artifact':
      return runArtifact(parsed);
    case 'spec':
      process.stdout.write(readProjectFile('SPEC.md'));
      return 0;
    case 'schema':
      process.stdout.write(readProjectFile(schemaPath(parsed.positionals[0])));
      return 0;
    default:
      throw new Error(`Unknown command ${command}. Run companymd help.`);
  }
}

function runInstall(args: ParsedArgs): number {
  const agent = args.options.get('agent') ?? 'codex';
  if (!SUPPORTED_AGENTS.includes(agent as SupportedAgent)) throw new Error(`--agent must be one of: ${SUPPORTED_AGENTS.join(', ')}`);
  const result = installAgentIntegration(args.positionals[0] ?? '.', {
    agent: agent as SupportedAgent,
    force: args.flags.has('force'),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

async function runCreate(args: ParsedArgs): Promise<number> {
  const source = args.positionals[0];
  if (!source) throw new Error('create requires <public-url>');
  const classification = (args.options.get('classification') ?? 'internal') as Classification;
  if (!CLASSIFICATIONS.includes(classification)) throw new Error(`--classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
  const maturity = (args.options.get('mode') ?? args.options.get('maturity') ?? 'starter') as MaturityLevel;
  if (!MATURITY_LEVELS.includes(maturity)) throw new Error(`--mode must be one of: ${MATURITY_LEVELS.join(', ')}`);
  const name = args.options.get('name');
  const id = args.options.get('id');
  const owner = args.options.get('owner');
  const contact = args.options.get('contact');
  const result = await createPackFromUrl(source, args.positionals[1] ?? '.', {
    ...(name ? { name } : {}),
    ...(id ? { id } : {}),
    ...(owner ? { owner } : {}),
    ...(contact ? { contact } : {}),
    classification,
    maturity,
    withDesign: args.flags.has('with-design'),
    force: args.flags.has('force'),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

function runAdopt(args: ParsedArgs): number {
  const report = inspectForAdoption(args.positionals[0] ?? '.');
  const format = args.options.get('format') ?? 'json';
  let content: string;
  if (format === 'json') content = `${JSON.stringify(report, null, 2)}\n`;
  else if (format === 'pretty') content = formatAdoptionReport(report);
  else throw new Error('--format must be json or pretty');
  const output = args.options.get('output');
  if (output) fs.writeFileSync(path.resolve(output), content, 'utf8');
  else process.stdout.write(content);
  return report.collision ? 1 : 0;
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
  const maturity = (args.options.get('mode') ?? args.options.get('maturity') ?? 'starter') as MaturityLevel;
  if (!MATURITY_LEVELS.includes(maturity)) {
    throw new Error(`--mode must be one of: ${MATURITY_LEVELS.join(', ')}`);
  }
  const result = initPack(args.positionals[0] ?? '.', {
    name,
    ...(id ? { id } : {}),
    ...(owner ? { owner } : {}),
    ...(contact ? { contact } : {}),
    classification,
    maturity,
    withDesign: args.flags.has('with-design'),
    force: args.flags.has('force'),
  });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

function runLint(args: ParsedArgs): number {
  const input = args.positionals[0] ?? '.';
  const format = args.options.get('format') ?? 'json';
  const report = input === '-' ? lintStdin() : lintPack(input, { ...(args.options.has('workspace-root') ? { workspaceRoot: args.options.get('workspace-root')! } : {}) });
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
  const profile = args.options.get('profile') ?? (args.options.get('artifact') === 'presentation' ? 'visual' : 'all');
  if (!Object.hasOwn(PROFILE_ROLES, profile)) throw new Error(`--profile must be one of: ${Object.keys(PROFILE_ROLES).join(', ')}`);
  const clearance = (args.options.get('clearance') ?? 'internal') as Classification;
  if (!CLASSIFICATIONS.includes(clearance)) throw new Error(`--clearance must be one of: ${CLASSIFICATIONS.join(', ')}`);
  const result = createContext(args.positionals[0] ?? '.', {
    profile,
    clearance,
    allowInvalid: args.flags.has('allow-invalid'),
    allowDraft: args.flags.has('allow-draft'),
    requireDesign: args.flags.has('require-design'),
    compact: args.flags.has('compact'),
    ...resolutionOptions(args),
  });
  const output = args.options.get('output');
  const receipt = args.options.get('receipt');
  if (output) {
    writeContext(result, output);
    if (receipt) writeContextReceipt(result, receipt);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      output: path.resolve(output),
      ...(receipt ? { receipt: path.resolve(receipt) } : {}),
      files: result.files,
      resolution: result.resolution,
      stats: result.stats,
    }, null, 2)}\n`);
  } else {
    if (receipt) writeContextReceipt(result, receipt);
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

function runEval(args: ParsedArgs): number {
  const baseline = args.options.get('baseline');
  const candidate = args.options.get('candidate');
  if (!baseline || !candidate) throw new Error('eval requires --baseline <file> and --candidate <file>');
  const report = evaluateBeforeAfter(args.positionals[0] ?? '.', baseline, candidate, args.options.get('rubric'));
  const format = args.options.get('format') ?? 'json';
  if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (format === 'pretty') process.stdout.write(formatEvalReport(report));
  else throw new Error('--format must be json or pretty');
  return report.regressions.length > 0 || !report.candidate.passed ? 1 : 0;
}

function runArtifact(args: ParsedArgs): number {
  const subcommand = args.positionals[0];
  if (subcommand !== 'verify') throw new Error('artifact requires: verify <receipt.json>');
  const receipt = args.positionals[1];
  if (!receipt) throw new Error('artifact verify requires <receipt.json>');
  const report = verifyArtifactReceipt(receipt, { root: args.options.get('root') ?? process.cwd() });
  const format = args.options.get('format') ?? 'json';
  if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (format === 'pretty') process.stdout.write(formatArtifactVerificationReport(report));
  else throw new Error('--format must be json or pretty');
  return report.valid ? 0 : 1;
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

function formatAdoptionReport(report: ReturnType<typeof inspectForAdoption>): string {
  const lines = [
    `Adoption inventory: ${report.root}`,
    `Existing Company.md pack: ${report.existingPack ? 'yes' : 'no'}`,
  ];
  if (report.dialect) lines.push(`Dialect: ${report.dialect}`);
  if (report.collision) lines.push(`COLLISION: ${report.collision}`);
  lines.push('', 'Candidates:');
  if (report.candidates.length === 0) lines.push('- none');
  for (const candidate of report.candidates) lines.push(`- ${candidate.file} → ${candidate.targets.join(', ')} (${candidate.reason})`);
  lines.push('', 'Recommended order:', ...report.recommendedOrder.map((item, index) => `${index + 1}. ${item}`));
  return `${lines.join('\n')}\n`;
}

function formatEvalReport(report: ReturnType<typeof evaluateBeforeAfter>): string {
  return [
    `Outcome: ${report.outcome}`,
    `Baseline: ${report.baseline.passed ? 'conformant' : 'non-conformant'}`,
    `Candidate: ${report.candidate.passed ? 'conformant' : 'non-conformant'}`,
    `Fixed: ${report.fixed.length ? report.fixed.join(', ') : 'none'}`,
    `Regressions: ${report.regressions.length ? report.regressions.join(', ') : 'none'}`,
    `Unchanged failures: ${report.unchangedFailures.length ? report.unchangedFailures.join(', ') : 'none'}`,
    '',
    report.note,
    '',
  ].join('\n');
}

function resolutionOptions(args: ParsedArgs) {
  return {
    ...(args.options.has('subject') ? { subject: args.options.get('subject')! } : {}),
    ...(args.options.has('artifact') ? { artifact: args.options.get('artifact')! } : {}),
    ...(args.options.has('workspace-root') ? { workspaceRoot: args.options.get('workspace-root')! } : {}),
  };
}

function validateArgs(command: string, args: ParsedArgs): void {
  const common = ['help', 'version'];
  const configuration: Record<string, { options: string[]; min: number; max: number }> = {
    init: { options: ['name','id','owner','contact','classification','mode','maturity','with-design','force'], min: 0, max: 1 },
    create: { options: ['name','id','owner','contact','classification','mode','maturity','with-design','force'], min: 1, max: 2 },
    adopt: { options: ['format','output'], min: 0, max: 1 },
    install: { options: ['agent','force'], min: 0, max: 1 },
    lint: { options: ['format','strict','workspace-root'], min: 0, max: 1 },
    context: { options: ['profile','clearance','output','receipt','allow-invalid','allow-draft','subject','artifact','workspace-root','require-design','compact'], min: 0, max: 1 },
    resolve: { options: ['subject','artifact','workspace-root','format'], min: 0, max: 1 },
    diff: { options: [], min: 2, max: 2 },
    eval: { options: ['baseline','candidate','rubric','format'], min: 0, max: 1 },
    artifact: { options: ['root','format'], min: 2, max: 2 },
    spec: { options: [], min: 0, max: 0 },
    schema: { options: [], min: 0, max: 1 },
  };
  const key = command === 'from-url' ? 'create' : command;
  const rule = Object.hasOwn(configuration, key) ? configuration[key] : undefined;
  if (!rule) return;
  const allowed = new Set([...common, ...rule.options]);
  for (const option of [...args.options.keys(), ...args.flags]) if (!allowed.has(option)) throw new Error(`Unknown option --${option} for ${command}`);
  if (args.positionals.length < rule.min || args.positionals.length > rule.max) throw new Error(`Unexpected arguments for ${command}; expected ${rule.min === rule.max ? rule.min : `${rule.min}-${rule.max}`} positional argument(s)`);
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
    if (flags.has(rawKey) || options.has(rawKey)) throw new Error(`Duplicate option --${rawKey}`);
    if (BOOLEAN_OPTIONS.has(rawKey)) {
      if (inlineValue !== undefined) throw new Error(`--${rawKey} is a flag and does not accept a value`);
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

function schemaPath(name = 'frontmatter'): string {
  const schemas = new Map([
    ['frontmatter', 'frontmatter.schema.json'],
    ['artifact-receipt', 'artifact-receipt.schema.json'],
    ['artifact-evidence', 'artifact-evidence.schema.json'],
    ['registry', 'registry.schema.json'],
  ]);
  const file = schemas.get(name);
  if (!file) throw new Error(`Unknown schema ${name}; available: ${[...schemas.keys()].join(', ')}`);
  return path.join('schemas', file);
}

function helpText(): string {
  return `Company.md ${VERSION}

Agent-readable company context for enterprise AI workspaces.

Usage:
  companymd init [directory] --name <name> [--mode starter|team|enterprise]
  companymd create <public-url> [directory] [--name <name>] [--with-design]
  companymd adopt [directory] [--format json|pretty] [--output <file>]
  companymd install [directory] [--agent codex|claude|cursor|copilot]
  companymd lint [path|-] [--format json|pretty] [--strict]
  companymd resolve [path] [--subject <id>] [--artifact presentation] [--workspace-root <path>]
  companymd context [path] [--profile <profile>] [--clearance <level>] [--output <file>] [--receipt <file>]
  companymd diff <before> <after>
  companymd eval [path] --baseline <file> --candidate <file> [--rubric <yaml>]
  companymd artifact verify <receipt.json> [--root <directory>] [--format json|pretty]
  companymd spec
  companymd schema [frontmatter|artifact-receipt|artifact-evidence|registry]

Profiles: ${Object.keys(PROFILE_ROLES).join(', ')}
Clearance: ${CLASSIFICATIONS.join(', ')}

Common init options:
  --id <id>                 Stable lowercase company id
  --owner <team>            Accountable team
  --contact <contact>       Owner email or directory handle
  --classification <level> Defaults to internal
  --mode <level>            starter, team, or enterprise; defaults to starter
  --subject <id>            Select a registry subject or alias
  --artifact presentation   Require visual context and bound design/template
  --workspace-root <path>   Explicit authorized discovery and source boundary
  --require-design          Reject missing or unbound shared design
  --compact                 Elide identical inherited prose sections only
  --with-design             Add and link a DESIGN.md file
  --force                   Replace colliding framework files

Lint exits 1 for errors; --strict also exits 1 for warnings.
JSON is the default lint format so coding agents and CI can act on findings.
Draft documents require an explicit --allow-draft when creating context.
Install adds the repository-scoped $company skill without changing Company.md sources.
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
