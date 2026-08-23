import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type SupportedAgent = 'codex';

export interface InstallOptions {
  agent?: SupportedAgent;
  force?: boolean;
}

export interface InstallResult {
  agent: SupportedAgent;
  directory: string;
  files: string[];
}

export function installAgentIntegration(directory: string, options: InstallOptions = {}): InstallResult {
  const agent = options.agent ?? 'codex';
  if (agent !== 'codex') throw new Error(`Unsupported agent ${agent}; currently available: codex`);

  const targetRoot = path.resolve(directory);
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(`Install target must be an existing directory: ${targetRoot}`);
  }

  const source = bundledSkillDirectory();
  const destination = path.join(targetRoot, '.agents', 'skills', 'company');
  if (fs.existsSync(destination)) {
    if (!options.force) throw new Error(`Refusing to overwrite existing skill: ${destination}`);
    fs.rmSync(destination, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });

  return {
    agent,
    directory: destination,
    files: listFiles(destination).map((file) => path.relative(targetRoot, file)),
  };
}

function bundledSkillDirectory(): string {
  const current = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(current, '..', '.agents', 'skills', 'company'),
    path.resolve(current, '..', '..', '.agents', 'skills', 'company'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'SKILL.md')));
  if (!found) throw new Error('Packaged Company skill is missing');
  return found;
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : [absolute];
    })
    .sort();
}
