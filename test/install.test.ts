import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installAgentIntegration } from '../src/install.js';

test('installs a repository-scoped Codex skill', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-skill-'));
  const result = installAgentIntegration(target);
  assert.equal(result.agent, 'codex');
  assert.ok(result.files.includes('.agents/skills/company/SKILL.md'));
  assert.ok(result.files.includes('.agents/skills/company/agents/openai.yaml'));
  assert.ok(result.files.includes('.agents/skills/company/scripts/create-receipt.mjs'));
  assert.match(fs.readFileSync(path.join(result.directory, 'SKILL.md'), 'utf8'), /name: company/);
});

test('does not overwrite an installed skill without force', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-skill-collision-'));
  installAgentIntegration(target);
  assert.throws(() => installAgentIntegration(target), /Refusing to overwrite/);
  assert.doesNotThrow(() => installAgentIntegration(target, { force: true }));
});
