import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createContext, writeContextReceipt } from '../src/context.js';
import { resolveContext } from '../src/resolve.js';
import { lintPack } from '../src/pack.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-resolve-')));
  fs.mkdirSync(path.join(root, '.git'));
  for (const id of ['doczoom', 'amaril']) {
    const dir = path.join(root, id);
    fs.cpSync(path.resolve('examples/northstar'), dir, { recursive: true });
    for (const name of ['COMPANY', 'CUSTOMER', 'OFFER', 'VOICE']) {
      const file = path.join(dir, `${name}.md`);
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('northstar-cloud', id).replace(/products: \[[^\]]+\]/g, `products: [${id}]`));
    }
    fs.appendFileSync(path.join(dir, 'DESIGN.md'), `\nDESIGN_${id.toUpperCase()}\n`);
    fs.mkdirSync(path.join(dir, 'slides'));
    fs.copyFileSync(path.join(dir, 'DESIGN.md'), path.join(dir, 'slides/DESIGN.md'));
    fs.writeFileSync(path.join(dir, 'slides/SKILL.md'), `---\nname: ${id}-slides\ndescription: Slides for ${id}\n---\nUse ${id} design.`);
    fs.mkdirSync(path.join(dir, 'work/slides'), { recursive: true });
  }
  const registry = { schema: 'companymd/registry/v1', subjects: ['doczoom', 'amaril'].map(id => ({ id, kind: 'product', aliases: [id === 'doczoom' ? 'dz' : 'am'], pack: `./${id}`, artifacts: { presentation: { design: `./${id}/slides/DESIGN.md`, templateSkill: `./${id}/slides/SKILL.md` } } })) };
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  return { root, registry, pack: (id = 'doczoom') => path.join(root, id) };
}

test('registry resolves explicit alias and nearest pack, never arbitrary multi-product fallback', () => {
  const { root, pack } = fixture();
  assert.throws(() => resolveContext(root), /Ambiguous/);
  assert.throws(() => resolveContext(root, { subject: 'missing' }), /Unknown subject/);
  assert.equal(resolveContext(root, { subject: 'DZ' }).subject, 'doczoom');
  assert.equal(resolveContext(path.join(pack(), 'work/slides')).subject, 'doczoom');
  assert.equal(resolveContext(pack(), { subject: 'amaril' }).subject, 'amaril');
  assert.equal(resolveContext(root, { subject: 'am', artifact: 'presentation' }).binding?.templateSkill, path.join(root, 'amaril/slides/SKILL.md'));
});

test('product switch creates isolated sources, presentation design and template bindings', () => {
  const { root } = fixture();
  for (let i = 0; i < 30; i++) {
    const subject = i % 2 ? 'amaril' : 'doczoom';
    const other = subject === 'doczoom' ? 'AMARIL' : 'DOCZOOM';
    const result = createContext(root, { subject, artifact: 'presentation' });
    assert.equal(result.profile, 'visual');
    assert.match(result.markdown, new RegExp(`DESIGN_${subject.toUpperCase()}`));
    assert.doesNotMatch(result.markdown, new RegExp(`DESIGN_${other}`));
    assert.ok(result.files.includes('slides/DESIGN.md'));
    assert.ok(result.attachments.some(a => a.role === 'templateSkill'));
  }
});

test('scope mismatches and wrong registry identity fail before output', () => {
  const { root, pack, registry } = fixture();
  const voice = path.join(pack(), 'VOICE.md');
  fs.writeFileSync(voice, fs.readFileSync(voice, 'utf8').replace('products: [doczoom]', 'products: [amaril]'));
  assert.equal(lintPack(pack()).valid, false);
  assert.throws(() => createContext(root, { subject: 'doczoom', artifact: 'presentation' }), /scope/i);
  fs.writeFileSync(voice, fs.readFileSync(voice, 'utf8').replace('products: [amaril]', 'products: [doczoom]'));
  registry.subjects[0]!.id = 'unrelated';
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.throws(() => createContext(root, { subject: 'unrelated', artifact: 'presentation' }), /does not match/);
});

test('missing design cannot satisfy a presentation, while core does not load unrelated companions', () => {
  const { pack } = fixture();
  const directory = pack();
  fs.rmSync(path.join(directory, 'OFFER.md'));
  const core = createContext(directory, { profile: 'core' });
  assert.deepEqual(core.files, ['COMPANY.md']);
  fs.rmSync(path.join(directory, '..', 'companymd.yaml'));
  const company = path.join(directory, 'COMPANY.md');
  fs.writeFileSync(company, fs.readFileSync(company, 'utf8').replace('  design: ./DESIGN.md\n', ''));
  // Restore the unrelated companion to isolate the design requirement.
  fs.copyFileSync(path.resolve('examples/northstar/OFFER.md'), path.join(directory, 'OFFER.md'));
  const offer = path.join(directory, 'OFFER.md');
  fs.writeFileSync(offer, fs.readFileSync(offer, 'utf8').replaceAll('northstar-cloud', 'doczoom').replace('products: [platform]', 'products: [doczoom]'));
  assert.throws(() => createContext(directory, { artifact: 'presentation' }), /requires a linked DESIGN/);
});

test('registry rejects ambiguous aliases, parent cycles, missing bindings and unknown formats', () => {
  const { root, registry } = fixture();
  registry.subjects[1]!.aliases = ['DZ'];
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.throws(() => resolveContext(root, { subject: 'doczoom' }), /Duplicate/);
  registry.subjects[1]!.aliases = ['am'];
  Object.assign(registry.subjects[0]!, { parent: 'amaril' });
  Object.assign(registry.subjects[1]!, { parent: 'doczoom' });
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.throws(() => resolveContext(root, { subject: 'doczoom' }), /parent cycle/);
});

test('loader and registry reject sibling workspace and symlink escapes', () => {
  const { root, pack, registry } = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-outside-'));
  fs.copyFileSync(path.join(pack(), 'DESIGN.md'), path.join(outside, 'DESIGN.md'));
  const link = path.join(pack(), 'escape.md');
  fs.symlinkSync(path.join(outside, 'DESIGN.md'), link);
  const company = path.join(pack(), 'COMPANY.md');
  fs.writeFileSync(company, fs.readFileSync(company, 'utf8').replace('./DESIGN.md', './escape.md'));
  assert.equal(lintPack(pack()).valid, false);
  registry.subjects[0]!.artifacts.presentation.design = './doczoom/escape.md';
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.throws(() => resolveContext(root, { subject: 'doczoom' }), /outside workspace/);
});

test('context reads each selected document once and hashes original CRLF bytes', () => {
  const { root, pack } = fixture();
  const company = path.join(pack(), 'COMPANY.md');
  const original = fs.readFileSync(company, 'utf8').replace(/\n/g, '\r\n');
  fs.writeFileSync(company, original);
  const realRead = fs.readFileSync;
  const reads: string[] = [];
  fs.readFileSync = function (file: any, ...args: any[]) {
    if (typeof file === 'string' && file.startsWith(pack()) && /\.md$/.test(file)) reads.push(file);
    return (realRead as any).call(fs, file, ...args);
  } as typeof fs.readFileSync;
  try {
    const result = createContext(root, { subject: 'doczoom', artifact: 'presentation' });
    assert.equal(reads.filter(f => f === company).length, 1);
    assert.equal(new Set(reads).size, reads.length);
    assert.equal(result.sources.find(s => s.role === 'company')?.sha256, createHash('sha256').update(original).digest('hex'));
    const output = path.join(root, 'receipt.json');
    writeContextReceipt(result, output);
    const receipt = JSON.parse(realRead(output, 'utf8'));
    assert.equal(receipt.subject, 'doczoom');
    assert.equal(receipt.binding.templateSkill, 'slides/SKILL.md');
    assert.equal(path.resolve(root, receipt.sourceRoot), pack());
  } finally { fs.readFileSync = realRead; }
});

test('compact context elides exact inherited duplicates but retains unique policy and preamble', () => {
  const { root, pack } = fixture();
  const base = path.join(root, 'base');
  fs.cpSync(pack(), base, { recursive: true });
  for (const filename of ['COMPANY', 'CUSTOMER', 'OFFER', 'VOICE']) {
    const baseFile = path.join(base, `${filename}.md`);
    fs.writeFileSync(baseFile, fs.readFileSync(baseFile, 'utf8').replaceAll('doczoom', 'base').replace('products: [base]', 'products: [all]').replace('## ', 'Unique inherited preamble survives.\n\n## '));
    const child = path.join(pack(), `${filename}.md`);
    fs.writeFileSync(child, fs.readFileSync(child, 'utf8').replace('claims:', `extends: ../base/${filename}.md\nclaims:`));
  }
  const full = createContext(pack(), { profile: 'communications' });
  const compact = createContext(pack(), { profile: 'communications', compact: true });
  assert.ok(compact.stats.omittedDuplicateSections > 0);
  assert.ok(compact.stats.contextBytes < full.stats.contextBytes);
  assert.match(compact.markdown, /Unique inherited preamble survives/);
  assert.match(compact.markdown, /Claims to Avoid/);
  assert.deepEqual(compact.sources, full.sources);
});

test('CLI rejects unknown, duplicate and malformed flags rather than silently using another product', () => {
  for (const args of [
    ['context', 'examples/northstar', '--product', 'amaril'],
    ['context', 'examples/northstar', '--profile', 'visual', '--profile', 'core'],
    ['context', 'examples/northstar', '--allow-invalid=false'],
    ['lint', 'examples/northstar', 'extra'],
  ]) {
    const child = spawnSync(process.execPath, ['dist/cli.js', ...args], { encoding: 'utf8' });
    assert.notEqual(child.status, 0, args.join(' '));
    assert.doesNotMatch(child.stdout, /Company context bundle/);
  }
});


test('trimmed aliases remain usable and prototype names never select undeclared artifacts', () => {
  const { root, registry } = fixture();
  registry.subjects[0]!.aliases = ['  spaced-alias  '];
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.equal(resolveContext(root, { subject: 'spaced-alias' }).subject, 'doczoom');
  for (const artifact of ['constructor', 'toString', '__proto__']) {
    assert.throws(() => resolveContext(root, { subject: 'doczoom', artifact }), /no .* artifact binding/);
    assert.throws(() => createContext(root, { subject: 'doczoom', profile: artifact }), /Unknown profile/);
  }
});

test('registry rejects schema-invalid kinds, empty parents, and null aliases', () => {
  for (const mutation of [{ kind: ['product'] }, { parent: '' }, { parent: '  ' }, { aliases: null }]) {
    const { root, registry } = fixture();
    Object.assign(registry.subjects[0]!, mutation);
    fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
    assert.throws(() => resolveContext(root, { subject: 'doczoom' }), /requires|Invalid/);
  }
});

test('nested registered products require explicit permission to share their design', () => {
  const { root, registry, pack } = fixture();
  fs.renameSync(pack('amaril'), path.join(pack(), 'amaril'));
  registry.subjects[1]!.pack = './doczoom/amaril';
  registry.subjects[1]!.artifacts.presentation.design = './doczoom/amaril/slides/DESIGN.md';
  registry.subjects[1]!.artifacts.presentation.templateSkill = './doczoom/amaril/slides/SKILL.md';
  const binding = registry.subjects[0]!.artifacts;
  delete (registry.subjects[0] as any).artifacts;
  const company = path.join(pack(), 'COMPANY.md');
  fs.writeFileSync(company, fs.readFileSync(company, 'utf8').replace('./DESIGN.md', './amaril/DESIGN.md'));
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  for (const options of [{ artifact: 'presentation' }, { profile: 'visual' as const }, { requireDesign: true }]) {
    assert.throws(() => createContext(root, { subject: 'doczoom', ...options }), /explicit .*binding/);
  }
  binding.presentation.design = './doczoom/amaril/DESIGN.md';
  registry.subjects[0]!.artifacts = binding;
  fs.writeFileSync(path.join(root, 'companymd.yaml'), JSON.stringify(registry));
  assert.match(createContext(root, { subject: 'doczoom', artifact: 'presentation' }).markdown, /DESIGN_AMARIL/);
});
