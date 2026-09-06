#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const RELEASE = 'github:dilanhendadura/company.md#v0.4.0';
const MIN_ROUTING_VERSION = '0.4.0';
const ROUTING_OPTIONS = new Set(['--subject', '--artifact', '--workspace-root', '--require-design', '--compact']);
const args = process.argv.slice(2);
const requiredFeatures = args.filter(arg => ROUTING_OPTIONS.has(arg.split('=')[0]));
if (args[0] === 'resolve') requiredFeatures.push('companymd resolve');
const agentIndex = args.indexOf('--agent');
const agent = agentIndex === -1 ? args.find(arg => arg.startsWith('--agent='))?.slice('--agent='.length) : args[agentIndex + 1];
if (args[0] === 'install' && agent && agent !== 'codex') requiredFeatures.push('claude|cursor|copilot');

const override = process.env.COMPANYMD_CLI?.trim();
if (override) {
  const target = isAbsolute(override) ? override : resolve(process.cwd(), override);
  if (!isFile(target)) fail(`COMPANYMD_CLI does not point to a file: ${target}`);
  execute(commandFor(target), true);
}

for (const directory of ancestors(process.cwd())) {
  const local = packageCommand(join(directory, 'node_modules', 'company.md'), 'company.md', ['companymd', 'company.md']);
  if (local) execute(local);
  for (const name of executableNames('companymd', 'company.md')) {
    const candidate = join(directory, 'node_modules', '.bin', name);
    if (isFile(candidate)) execute(commandFor(candidate));
  }
}

const installed = executableOnPath(executableNames('companymd', 'company.md'));
if (installed) execute(commandFor(installed));

// A development skill must not silently download an older CLI that ignores its
// new flags. The release pin is bumped together with the package at release time.
if (requiredFeatures.length && !atLeast(RELEASE.split('#v')[1], MIN_ROUTING_VERSION)) {
  fail(`This skill requires Company.md >=${MIN_ROUTING_VERSION} for ${requiredFeatures.join(', ')}; its pinned release is ${RELEASE}. Build the development checkout and set COMPANYMD_CLI to its dist/cli.js, or install a compatible release. No older release was downloaded.`);
}

const npx = executableOnPath(executableNames('npx'));
if (!npx) fail('Company.md is not installed and npx is unavailable. Install Node.js 20+ or set COMPANYMD_CLI to a trusted CLI path.');
const launcher = commandFor(npx, 'npm', ['npx']);
exit(run(launcher, ['--yes', `--package=${RELEASE}`, 'companymd', ...args]));

function execute(command, explicitOverride = false) {
  if (requiredFeatures.length) verifyCompatibility(command, explicitOverride);
  exit(run(command, args));
}

function verifyCompatibility(command, explicitOverride) {
  // The installed package is already trusted to execute. Its release metadata
  // avoids booting the entire CLI merely to check the same version string.
  if (atLeast(command.packageVersion, MIN_ROUTING_VERSION)) return;
  const result = spawnSync(command.executable, [...command.prefix, '--version'], { encoding: 'utf8', shell: false });
  const version = result.stdout?.trim();
  if (result.status === 0 && atLeast(version, MIN_ROUTING_VERSION)) return;
  // An explicitly selected development checkout may still carry the last release
  // version. Require its help to advertise every requested feature before using it.
  if (explicitOverride && result.status === 0) {
    const help = spawnSync(command.executable, [...command.prefix, '--help'], { encoding: 'utf8', shell: false });
    if (help.status === 0 && requiredFeatures.every(feature => help.stdout.includes(feature.split('=')[0]))) return;
  }
  fail(`Incompatible Company.md runtime ${version || '(unknown version)'} at ${command.label}; ${requiredFeatures.join(', ')} requires >=${MIN_ROUTING_VERSION}. Install a compatible version or set COMPANYMD_CLI to a development CLI that supports these features. The requested command was not executed.`);
}

function atLeast(value, minimum) {
  const parsed = /^(?:Company\.md\s+)?(\d+)\.(\d+)\.(\d+)(?:\+[^\s]+)?$/.exec(value ?? '');
  if (!parsed) return false;
  const numbers = parsed.slice(1).map(Number);
  const target = minimum.split('.').map(Number);
  for (let index = 0; index < target.length; index++) {
    if (numbers[index] !== target[index]) return numbers[index] > target[index];
  }
  return true;
}

function* ancestors(start) {
  let current = resolve(start);
  while (true) {
    yield current;
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function executableNames(...names) {
  return process.platform === 'win32' ? names.flatMap(name => [`${name}.cmd`, `${name}.exe`, name]) : names;
}

function executableOnPath(names) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = join(directory, name);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

function packageCommand(directory, expectedName, binNames) {
  try {
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (manifest.name !== expectedName) return undefined;
    const bin = typeof manifest.bin === 'string' ? manifest.bin : binNames.map(name => manifest.bin?.[name]).find(value => typeof value === 'string');
    if (!bin) return undefined;
    const entrypoint = resolve(directory, bin);
    if (!isFile(entrypoint)) return undefined;
    return { executable: process.execPath, prefix: [entrypoint], label: entrypoint, packageVersion: manifest.version };
  } catch {
    return undefined;
  }
}

function commandFor(candidate, expectedName = 'company.md', binNames = ['companymd', 'company.md']) {
  const target = realpathSync(candidate);
  if (/\.(?:cmd|bat)$/i.test(target)) {
    // npm places Windows shims next to node_modules globally and in .bin locally.
    // Resolve the package entrypoint; never interpolate user paths into cmd.exe.
    const directories = [join(dirname(target), 'node_modules', expectedName), join(dirname(target), '..', expectedName)];
    for (const directory of directories) {
      const resolved = packageCommand(directory, expectedName, binNames);
      if (resolved) return resolved;
    }
    fail(`Cannot safely resolve the Node entrypoint behind ${candidate}. Install the ${expectedName} package locally or set COMPANYMD_CLI to its JavaScript CLI file.`);
  }
  if (['.js', '.mjs', '.cjs'].includes(extname(target).toLowerCase())) {
    return { executable: process.execPath, prefix: [target], label: target, packageVersion: companyPackageVersion(target) };
  }
  return { executable: target, prefix: [], label: target };
}

function companyPackageVersion(entrypoint) {
  for (const directory of ancestors(dirname(entrypoint))) {
    const file = join(directory, 'package.json');
    if (!isFile(file)) continue;
    try {
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      // Stop at the first package boundary; do not borrow an ancestor's version.
      return manifest.name === 'company.md' ? manifest.version : undefined;
    } catch {
      return undefined;
    }
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
  const result = spawnSync(command.executable, [...command.prefix, ...commandArgs], { stdio: 'inherit', shell: false });
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
