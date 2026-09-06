import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { evaluateBeforeAfter } from '../src/eval.js';
import { lintPack, loadPack } from '../src/pack.js';
import { classificationRank } from '../src/spec.js';
import type { Classification } from '../src/types.js';

const filenames = ['COMPANY.md', 'CUSTOMER.md', 'OFFER.md', 'VOICE.md'];
const now = new Date('2026-09-06T00:00:00Z');

function workspace(t: TestContext): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-inheritance-')));
  fs.mkdirSync(path.join(root, '.git'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function node(root: string, name: string, bases: string[] = [], classification: Classification = 'internal'): void {
  const directory = path.join(root, name);
  fs.cpSync(path.resolve('examples/northstar'), directory, { recursive: true });
  for (const filename of filenames) {
    const file = path.join(directory, filename);
    let content = fs.readFileSync(file, 'utf8')
      .replaceAll('northstar-cloud', `inheritance.${name}`)
      .replace('classification: internal', `classification: ${classification}`);
    if (bases.length) {
      content = content.replace('claims:', `extends: ${JSON.stringify(bases.map((base) => `../${base}/${filename}`))}\nclaims:`);
    }
    fs.writeFileSync(file, content, 'utf8');
  }
}

function constraints(root: string, name: string, offer: string[], voice: string[]): void {
  for (const [filename, heading, phrases] of [
    ['OFFER.md', 'Claims to Avoid', offer],
    ['VOICE.md', 'Phrases We Avoid', voice],
  ] as const) {
    const file = path.join(root, name, filename);
    const content = fs.readFileSync(file, 'utf8');
    const start = content.indexOf(`## ${heading}\n`);
    const end = content.indexOf('\n## ', start + 1);
    const replacement = `## ${heading}\n\n${phrases.map((phrase) => `- “${phrase}”`).join('\n')}\n`;
    fs.writeFileSync(file, content.slice(0, start) + replacement + content.slice(end), 'utf8');
  }
}

function output(root: string, name: string, content: string): string {
  const file = path.join(root, name);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

test('classification checks every diamond edge independently of extends order across four levels', (t) => {
  const root = workspace(t);
  node(root, 'group', [], 'confidential');
  node(root, 'shared', ['group'], 'confidential');
  node(root, 'left', ['shared'], 'confidential');
  node(root, 'right', ['shared'], 'internal');
  const failures: string[][] = [];
  for (const bases of [['left', 'right'], ['right', 'left']]) {
    node(root, 'product', bases, 'confidential');
    const report = lintPack(path.join(root, 'product'), { now });
    const downgrades = report.findings.filter((finding) => finding.ruleId === 'governance/classification-downgrade');
    assert.equal(report.valid, false);
    assert.equal(downgrades.length, 4, 'company and each companion must validate the shared-to-right edge');
    assert.ok(downgrades.every((finding) => finding.file.startsWith('../right/')));
    assert.ok(downgrades.every((finding) => /from \.\.\/shared\//.test(finding.message)));
    failures.push(downgrades.map((finding) => `${finding.file}:${finding.message}`).sort());
    const pack = loadPack(path.join(root, 'product'));
    assert.equal(pack.documents.length, 21, 'five unique nodes per role, plus the product design');
    const shared = pack.documents.find((document) => document.role === 'offer' && document.path === path.join(root, 'shared', 'OFFER.md'));
    assert.deepEqual(shared?.inheritedByPaths?.slice().sort(), [
      path.join(root, 'left', 'OFFER.md'), path.join(root, 'right', 'OFFER.md'),
    ].sort());
    assert.equal(shared?.inheritedBy, path.join(root, bases[0]!, 'OFFER.md'), 'legacy first-parent metadata is retained');
  }
  assert.deepEqual(failures[0], failures[1]);
});

test('multiple valid bases and repeated extends preserve each document and edge once', (t) => {
  const root = workspace(t);
  node(root, 'group', [], 'public');
  node(root, 'left', ['group'], 'internal');
  node(root, 'right', ['group'], 'confidential');
  node(root, 'product', ['left', 'right', 'left'], 'restricted');
  const report = lintPack(path.join(root, 'product'), { now });
  assert.equal(report.valid, true, JSON.stringify(report.findings));
  const pack = loadPack(path.join(root, 'product'));
  assert.equal(pack.documents.length, 17);
  const left = pack.documents.find((document) => document.role === 'company' && document.path === path.join(root, 'left', 'COMPANY.md'));
  assert.deepEqual(left?.inheritedByPaths, [path.join(root, 'product', 'COMPANY.md')]);
});

test('cycles fail before deduplication including self cycles and cycles behind a shared branch', (t) => {
  const root = workspace(t);
  node(root, 'group');
  node(root, 'left', ['group']);
  node(root, 'middle', ['right']);
  node(root, 'right', ['middle']);
  node(root, 'product', ['left', 'right']);
  assert.throws(() => loadPack(path.join(root, 'product')), /extends cycle detected: .*right\/COMPANY.md.*middle\/COMPANY.md.*right\/COMPANY.md/);
  const report = lintPack(path.join(root, 'product'), { now });
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'pack/load' && /cycle/.test(finding.message)));
  node(root, 'product', ['product']);
  assert.throws(() => loadPack(path.join(root, 'product')), /extends cycle detected: COMPANY.md → COMPANY.md/);
});

test('eval accumulates all inherited offer and voice prohibitions through diamonds without duplicate checks', (t) => {
  const root = workspace(t);
  node(root, 'group');
  constraints(root, 'group', ['guaranteed forever'], ['magic']);
  node(root, 'shared', ['group']);
  constraints(root, 'shared', ['no oversight'], ['effortless']);
  node(root, 'left', ['shared']);
  constraints(root, 'left', ['instant savings'], ['disrupt']);
  node(root, 'right', ['shared']);
  constraints(root, 'right', ['GUARANTEED  FOREVER', 'error free'], ['MAGIC', 'limitless']);
  const baseline = output(root, 'bad.md', 'Guaranteed forever. No oversight. Instant savings. Error free. Risk removed. Magic. Effortless. Disrupt. Limitless. Miracle.');
  const candidate = output(root, 'good.md', 'A bounded process with a named reviewer.');
  const results = [];
  for (const bases of [['left', 'right'], ['right', 'left']]) {
    node(root, 'product', bases);
    constraints(root, 'product', ['risk removed'], ['miracle']);
    const result = evaluateBeforeAfter(path.join(root, 'product'), baseline, candidate);
    assert.equal(result.baseline.passed, false);
    assert.equal(result.candidate.passed, true);
    assert.equal(result.fixed.length, 10);
    assert.equal(result.regressions.length, 0);
    assert.equal(result.outcome, 'improved');
    assert.equal(new Set(result.fixed).size, 10);
    assert.ok(result.fixed.includes('offer/claim-to-avoid/guaranteed-forever'));
    assert.ok(result.fixed.includes('voice/phrase-to-avoid/magic'));
    results.push(result.baseline.checks);
  }
  assert.deepEqual(results[0], results[1], 'all check IDs and matching outcomes must be independent of traversal order');
});

test('an overlay with no avoidance sections cannot remove a base prohibition', (t) => {
  const root = workspace(t);
  node(root, 'group');
  constraints(root, 'group', ['guaranteed safety'], ['miraculous']);
  node(root, 'product', ['group']);
  for (const filename of ['OFFER.md', 'VOICE.md']) {
    const file = path.join(root, 'product', filename);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('## Claims to Avoid', '## Notes').replace('## Phrases We Avoid', '## Notes'), 'utf8');
  }
  const baseline = output(root, 'bad.md', 'Guaranteed safety is miraculous.');
  const candidate = output(root, 'good.md', 'The review covers the documented scope.');
  const result = evaluateBeforeAfter(path.join(root, 'product'), baseline, candidate);
  assert.equal(result.fixed.length, 2);
  assert.equal(result.candidate.passed, true);
});

test('distinct restrictions with colliding slugs and non-Latin text are all evaluated', (t) => {
  const root = workspace(t);
  node(root, 'product');
  const longPrefix = 'a'.repeat(64);
  const claims = ['co-op', 'co op', '完全保証', '絶対安全', `${longPrefix} one`, `${longPrefix} two`];
  constraints(root, 'product', claims, []);
  const baseline = output(root, 'bad.md', claims.join('\n'));
  const candidate = output(root, 'good.md', 'Documented scope.');
  const result = evaluateBeforeAfter(path.join(root, 'product'), baseline, candidate);
  assert.equal(result.fixed.length, claims.length);
  assert.equal(new Set(result.fixed).size, claims.length);
  assert.equal(result.candidate.passed, true);
});

test('a custom rubric cannot silently replace an inherited prohibition', (t) => {
  const root = workspace(t);
  node(root, 'group');
  constraints(root, 'group', ['zero risk'], []);
  node(root, 'product', ['group']);
  constraints(root, 'product', [], []);
  const file = output(root, 'copy.md', 'Zero risk.');
  const rubric = output(root, 'rubric.yaml', 'checks:\n  - id: offer/claim-to-avoid/zero-risk\n    description: Attempted override\n    required_any: [risk]\n');
  assert.throws(() => evaluateBeforeAfter(path.join(root, 'product'), file, file, rubric), /Duplicate eval check id: offer\/claim-to-avoid\/zero-risk/);
});

test('long inherited prohibitions remain active while quoted voice replacements remain allowed', (t) => {
  const root = workspace(t);
  const prohibition = 'We guarantee that every possible document will always be processed with perfect accuracy and no need for review';
  node(root, 'group');
  constraints(root, 'group', [prohibition], []);
  const voiceFile = path.join(root, 'group', 'VOICE.md');
  fs.writeFileSync(voiceFile, fs.readFileSync(voiceFile, 'utf8').replace('## Phrases We Avoid\n', '## Phrases We Avoid\n\n- “Effortless magic” → “A process with explicit reviews”\n- AI-powered -> Describe the task.\n'), 'utf8');
  node(root, 'product', ['group']);
  constraints(root, 'product', [], []);
  const baseline = output(root, 'bad.md', `${prohibition}. Effortless magic. AI-powered.`);
  const candidate = output(root, 'good.md', 'A process with explicit reviews.');
  const result = evaluateBeforeAfter(path.join(root, 'product'), baseline, candidate);
  assert.equal(result.fixed.length, 3);
  assert.equal(result.candidate.passed, true);
});

test('stress: every edge is validated in 24 deterministic eight-level DAGs', (t) => {
  const root = workspace(t);
  const levels: Classification[] = ['public', 'internal', 'confidential', 'restricted'];
  let seed = 173;
  const random = (limit: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  for (let round = 0; round < 24; round++) {
    const classifications: Classification[] = [];
    const edges: Array<[number, number]> = [];
    for (let index = 0; index < 8; index++) {
      const classification = levels[random(levels.length)]!;
      classifications.push(classification);
      const bases = index ? [index - 1] : [];
      for (let base = 0; base < index - 1; base++) {
        if (random(3) === 0) bases.push(base);
      }
      if (random(2)) bases.reverse();
      for (const base of bases) edges.push([index, base]);
      node(root, `node-${index}`, bases.map((base) => `node-${base}`), classification);
    }
    const report = lintPack(path.join(root, 'node-7'), { now });
    const expected = edges.filter(([child, base]) => classificationRank(classifications[child]!) < classificationRank(classifications[base]!))
      .flatMap(([child, base]) => filenames.map((filename) => `${child}:${base}:${filename}`)).sort();
    const actual = report.findings.filter((finding) => finding.ruleId === 'governance/classification-downgrade')
      .map((finding) => {
        const child = finding.file === 'COMPANY.md' || !finding.file.startsWith('../') ? '7' : finding.file.match(/node-(\d+)\//)![1];
        const base = finding.message.match(/from \.\.\/node-(\d+)\//)![1];
        return `${child}:${base}:${path.basename(finding.file)}`;
      }).sort();
    assert.deepEqual(actual, expected, `DAG ${round} classification mismatches`);
    assert.equal(loadPack(path.join(root, 'node-7')).documents.length, 33, `DAG ${round} duplicates a node`);
  }
});
