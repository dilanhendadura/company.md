#!/usr/bin/env node

import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repositoryRoot, ".agents", "skills", "company");
const destination = join(repositoryRoot, "plugins", "company-md", "skills", "company");
const checkOnly = process.argv.includes("--check");

function listFiles(root, current = root) {
  return readdirSync(current, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(current, entry.name);
      return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
    })
    .sort();
}

function compareDirectories(left, right) {
  if (!existsSync(right)) return [`missing ${relative(repositoryRoot, right)}`];
  const leftFiles = listFiles(left);
  const rightFiles = listFiles(right);
  const differences = [];

  for (const path of new Set([...leftFiles, ...rightFiles])) {
    if (!leftFiles.includes(path)) differences.push(`unexpected ${path}`);
    else if (!rightFiles.includes(path)) differences.push(`missing ${path}`);
    else if (!readFileSync(join(left, path)).equals(readFileSync(join(right, path)))) {
      differences.push(`changed ${path}`);
    }
  }
  return differences;
}

if (checkOnly) {
  const differences = compareDirectories(source, destination);
  if (differences.length > 0) {
    console.error("Plugin skill is out of sync:");
    for (const difference of differences) console.error(`- ${difference}`);
    console.error("Run `npm run sync:plugin` and commit the result.");
    process.exit(1);
  }
  console.log("Plugin skill matches .agents/skills/company.");
  process.exit(0);
}

const stagingRoot = mkdtempSync(join(tmpdir(), "company-md-skill-"));
const stagedSkill = join(stagingRoot, basename(destination));

try {
  cpSync(source, stagedSkill, { recursive: true });
  rmSync(destination, { force: true, recursive: true });
  cpSync(stagedSkill, destination, { recursive: true });
  console.log(`Synced ${relative(repositoryRoot, source)} to ${relative(repositoryRoot, destination)}.`);
} finally {
  rmSync(stagingRoot, { force: true, recursive: true });
}
