#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pkg = readJson("package.json");
const plugin = readJson("plugins/company-md/.codex-plugin/plugin.json");
const marketplace = readJson(".agents/plugins/marketplace.json");
const entry = marketplace.plugins?.find((candidate) => candidate.name === plugin.name);

assert(plugin.version === pkg.version, "Plugin and npm package versions must match.");
assert(marketplace.name === "company-md", "Marketplace name must remain `company-md`.");
assert(entry, "Marketplace must contain the Company.md plugin.");
assert(entry.source?.source === "local", "Marketplace plugin source must be local.");
assert(entry.source?.path === "./plugins/company-md", "Marketplace plugin path is invalid.");
assert(entry.policy?.installation === "AVAILABLE", "Plugin must be available for explicit installation.");
assert(entry.policy?.authentication === "ON_INSTALL", "Plugin authentication policy is missing.");
assert(plugin.skills === "./skills/", "Plugin must expose its skills directory.");

for (const field of ["composerIcon", "logo", "logoDark"]) {
  const relativePath = plugin.interface?.[field];
  assert(typeof relativePath === "string", `Plugin interface.${field} is required.`);
  assert(
    existsSync(join(root, "plugins", "company-md", relativePath)),
    `Plugin interface.${field} does not exist: ${relativePath}`,
  );
}

const prompts = plugin.interface?.defaultPrompt;
assert(Array.isArray(prompts) && prompts.length > 0 && prompts.length <= 3, "Plugin needs 1–3 starter prompts.");
for (const prompt of prompts) {
  assert(typeof prompt === "string" && prompt.length <= 128, "Plugin starter prompts must be at most 128 characters.");
}

assert(
  existsSync(join(root, "plugins", "company-md", "skills", "company", "SKILL.md")),
  "Packaged Company.md skill is missing.",
);

console.log(`Distribution metadata is consistent at version ${pkg.version}.`);
