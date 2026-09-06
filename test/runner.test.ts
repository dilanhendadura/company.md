import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { installAgentIntegration } from '../src/install.js';

const repository = fileURLToPath(new URL('../', import.meta.url));
const sourceRunner = path.join(repository, '.agents/skills/company/scripts/run-companymd.mjs');

function workspace(t: TestContext): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd runner with spaces '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(runner: string, cwd: string, args: string[], override?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: '' };
  delete env.COMPANYMD_CLI;
  if (override) env.COMPANYMD_CLI = override;
  return spawnSync(process.execPath, [runner, ...args], { cwd, env, encoding: 'utf8', shell: false });
}

function stubPackage(root: string, version: string, packageVersion?: string) {
  const directory = path.join(root, 'node_modules/company.md');
  fs.mkdirSync(directory, { recursive: true });
  const calls = path.join(root, 'calls.jsonl');
  const cli = path.join(directory, 'cli.mjs');
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'company.md', version: packageVersion, bin: { companymd: './cli.mjs' } }));
  fs.writeFileSync(cli, `import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args[0] === '--version') console.log(${JSON.stringify(version)});
else console.log(JSON.stringify(args));
`);
  return { cli, calls };
}

test('installed runner finds workspace package from a nested directory without override or shell shims', t => {
  const root = workspace(t);
  const localModules = path.join(root, 'node_modules');
  fs.mkdirSync(path.join(localModules, '.bin'), { recursive: true });
  fs.symlinkSync(repository, path.join(localModules, 'company.md'), process.platform === 'win32' ? 'junction' : 'dir');
  // A package-backed entrypoint must be preferred to a shell-specific bin shim.
  for (const name of ['companymd', 'companymd.cmd']) {
    fs.writeFileSync(path.join(localModules, '.bin', name), 'This shim must not execute.');
  }
  const pack = path.join(root, 'company context');
  fs.cpSync(path.join(repository, 'examples/northstar'), pack, { recursive: true });
  const nested = path.join(root, 'work area/nested');
  fs.mkdirSync(nested, { recursive: true });
  const installed = installAgentIntegration(root);
  const result = run(path.join(installed.directory, 'scripts/run-companymd.mjs'), nested, ['context', pack, '--profile', 'visual', '--require-design', '--compact']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile: visual/);
  assert.match(result.stdout, /DESIGN\.md/);
});

test('rejects old automatically discovered runtimes before executing new context flags', t => {
  const root = workspace(t);
  const { calls } = stubPackage(root, '0.3.4');
  const result = run(sourceRunner, root, ['context', '.', '--subject', 'product-a', '--compact']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Incompatible Company\.md runtime 0\.3\.4/);
  assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line)), [['--version']]);
});

test('new compatible runtime preserves spaces and shell metacharacters as literal arguments', t => {
  const root = workspace(t);
  const { calls } = stubPackage(root, '0.4.0');
  const args = ['resolve', '.', '--subject', 'Product A & echo unexpected', '--workspace-root', root];
  const result = run(sourceRunner, root, args);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), args);
  assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line)), [['--version'], args]);
});

for (const explicitOverride of [false, true]) {
  test(`compatible package metadata avoids a version subprocess${explicitOverride ? ' for an explicit JavaScript CLI' : ''}`, t => {
    const root = workspace(t);
    const { cli, calls } = stubPackage(root, '0.4.0', '0.4.0');
    const args = ['resolve', '.', '--subject', 'example'];
    const result = run(sourceRunner, root, args, explicitOverride ? cli : undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), args);
    assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line)), [args]);
  });
}

test('an explicit CLI cannot borrow version metadata across a different package boundary', t => {
  const root = workspace(t);
  const { cli } = stubPackage(root, '0.3.4', '0.4.0');
  const nested = path.join(path.dirname(cli), 'nested');
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ name: 'another-package', version: '0.4.0' }));
  const nestedCli = path.join(nested, 'cli.mjs');
  fs.copyFileSync(cli, nestedCli);
  const result = run(sourceRunner, root, ['resolve', '.', '--subject', 'example'], nestedCli);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Incompatible Company\.md runtime 0\.3\.4/);
});

test('resolves an npm Windows cmd shim to its Node entrypoint without executing cmd', t => {
  const root = workspace(t);
  stubPackage(root, '0.4.0');
  const bin = path.join(root, 'node_modules/.bin');
  fs.mkdirSync(bin, { recursive: true });
  const shim = path.join(bin, 'companymd.cmd');
  fs.writeFileSync(shim, 'This shim must not execute.');
  const result = run(sourceRunner, root, ['resolve', '.', '--subject', 'example'], shim);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['resolve', '.', '--subject', 'example']);
});

test('an explicitly selected development CLI must advertise requested features', t => {
  const root = workspace(t);
  const { cli, calls } = stubPackage(root, '0.3.4');
  const rejected = run(sourceRunner, root, ['resolve', '.', '--subject', 'example'], cli);
  assert.equal(rejected.status, 2);
  assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line)), [['--version'], ['--help']]);

  const pack = path.join(root, 'draft fixture');
  fs.cpSync(path.join(repository, 'examples/northstar'), pack, { recursive: true });
  const accepted = run(sourceRunner, root, ['context', pack, '--profile', 'visual', '--require-design', '--compact'], path.join(repository, 'dist/cli.js'));
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /Profile: visual/);
});

test('legacy development release pin never downloads a CLI that lacks routing features', t => {
  const root = workspace(t);
  // Freeze only the release pin, keeping this regression meaningful after 0.4.0 releases.
  const runner = path.join(root, 'old-pin-runner.mjs');
  fs.writeFileSync(runner, fs.readFileSync(sourceRunner, 'utf8').replace(/const RELEASE = '[^']+';/, "const RELEASE = 'github:dilanhendadura/company.md#v0.3.4';"));
  const result = run(runner, root, ['resolve', '.', '--subject', 'example']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No older release was downloaded/);
});
