import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { installAgentIntegration, SUPPORTED_AGENTS, type InstallResult } from '../src/install.js';

const repository = fileURLToPath(new URL('../', import.meta.url));

for (const agent of SUPPORTED_AGENTS) {
  test(`CLI installs ${agent} skill and executes its runner against a complete fixture`, (t) => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), `companymd-${agent}-skill-`));
    t.after(() => fs.rmSync(target, { recursive: true, force: true }));
    const prefix = agent === 'claude' ? '.claude' : '.agents';
    const instruction = path.join(target, 'AGENTS.md');
    fs.writeFileSync(instruction, 'Existing project instructions\n');
    const pack = path.join(target, 'context');
    fs.cpSync(path.join(repository, 'examples/northstar'), pack, { recursive: true });
    const originalCompany = fs.readFileSync(path.join(pack, 'COMPANY.md'));

    const installation = spawnSync(process.execPath, [path.join(repository, 'dist/cli.js'), 'install', target, '--agent', agent], { encoding: 'utf8' });
    assert.equal(installation.status, 0, installation.stderr);
    const result = JSON.parse(installation.stdout) as InstallResult;
    assert.equal(result.agent, agent);
    assert.equal(result.directory, path.join(target, prefix, 'skills/company'));
    for (const file of ['SKILL.md', 'agents/openai.yaml', 'scripts/create-receipt.mjs', 'scripts/run-companymd.mjs']) {
      assert.ok(result.files.includes(`${prefix}/skills/company/${file}`));
      assert.deepEqual(
        fs.readFileSync(path.join(result.directory, file)),
        fs.readFileSync(path.join(repository, '.agents/skills/company', file)),
      );
    }
    assert.equal(fs.readFileSync(instruction, 'utf8'), 'Existing project instructions\n');
    assert.deepEqual(fs.readFileSync(path.join(pack, 'COMPANY.md')), originalCompany);

    const execution = spawnSync(process.execPath, [
      path.join(result.directory, 'scripts/run-companymd.mjs'), 'context', pack, '--profile', 'visual',
    ], {
      cwd: target,
      env: { ...process.env, COMPANYMD_CLI: path.join(repository, 'dist/cli.js') },
      encoding: 'utf8',
    });
    assert.equal(execution.status, 0, execution.stderr);
    assert.match(execution.stdout, /Profile: visual/);
    assert.match(execution.stdout, /DESIGN\.md/);
  });
}

test('does not overwrite an installed skill without force, including shared agent locations', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-skill-collision-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  installAgentIntegration(target);
  assert.throws(() => installAgentIntegration(target), /Refusing to overwrite/);
  assert.throws(() => installAgentIntegration(target, { agent: 'cursor' }), /Refusing to overwrite/);
  assert.throws(() => installAgentIntegration(target, { agent: 'copilot' }), /Refusing to overwrite/);
  assert.doesNotThrow(() => installAgentIntegration(target, { force: true }));
});

test('rejects unsupported agents and missing targets without writing files', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-install-invalid-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  // Exercise the runtime boundary used by JavaScript consumers, not only TypeScript.
  assert.throws(() => installAgentIntegration(target, { agent: 'unknown' as never }), /Unsupported agent/);
  assert.deepEqual(fs.readdirSync(target), []);
  assert.throws(() => installAgentIntegration(path.join(target, 'missing')), /existing directory/);
});
