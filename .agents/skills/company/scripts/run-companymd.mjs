#!/usr/bin/env node

import { existsSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const RELEASE = 'github:dilanhendadura/company.md#v0.3.2';
const args = process.argv.slice(2);

const override = process.env.COMPANYMD_CLI?.trim();
if (override) {
  const target = isAbsolute(override) ? override : resolve(process.cwd(), override);
  if (!isFile(target)) fail(`COMPANYMD_CLI does not point to a file: ${target}`);
  exit(run(target.endsWith('.js') || target.endsWith('.mjs') ? process.execPath : target, target.endsWith('.js') || target.endsWith('.mjs') ? [target, ...args] : args));
}

for (const candidate of workspaceExecutables(process.cwd())) {
  if (isFile(candidate)) exit(run(candidate, args));
}

const installed = executableOnPath('companymd');
if (installed) exit(run(installed, args));

const npx = executableOnPath(process.platform === 'win32' ? 'npx.cmd' : 'npx');
if (!npx) fail('Company.md is not installed and npx is unavailable. Install Node.js 20+ or set COMPANYMD_CLI to a trusted CLI path.');
exit(run(npx, ['--yes', `--package=${RELEASE}`, 'companymd', ...args]));

function workspaceExecutables(start) {
  const names = process.platform === 'win32' ? ['companymd.cmd', 'company.md.cmd'] : ['companymd', 'company.md'];
  const candidates = [];
  let current = resolve(start);
  while (true) {
    for (const name of names) candidates.push(join(current, 'node_modules', '.bin', name));
    const parent = dirname(current);
    if (parent === current) return candidates;
    current = parent;
  }
}

function executableOnPath(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, name);
    if (isFile(candidate)) return candidate;
  }
  return undefined;
}

function isFile(file) {
  try {
    return existsSync(file) && statSync(file).isFile();
  } catch {
    return false;
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false });
  if (result.error) fail(`Unable to run Company.md: ${result.error.message}`);
  return result.status ?? 2;
}

function exit(code) {
  process.exit(code);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
