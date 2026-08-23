#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sandbox = mkdtempSync(join(tmpdir(), "company-md-package-"));
const consumer = join(sandbox, "consumer");
const pack = join(consumer, "acme-context");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    shell: options.shell ?? false,
    stdio: options.quiet ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.\n${details}`);
  }
  return result.stdout ?? "";
}

function requirePath(path) {
  if (!existsSync(path)) throw new Error(`Expected package smoke artifact is missing: ${path}`);
}

try {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this smoke test through `npm run test:package`.");
  const npm = process.execPath;
  const packed = JSON.parse(
    run(npm, [npmCli, "pack", "--json", "--pack-destination", sandbox], { quiet: true }),
  );
  const tarball = join(sandbox, packed[0].filename);

  mkdirSync(consumer);
  run(npm, [npmCli, "init", "--yes"], { cwd: consumer, quiet: true });
  run(npm, [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: consumer,
    quiet: true,
  });

  const executableSuffix = process.platform === "win32" ? ".cmd" : "";
  const executable = join(consumer, "node_modules", ".bin", `companymd${executableSuffix}`);
  const dottedExecutable = join(consumer, "node_modules", ".bin", `company.md${executableSuffix}`);
  const shell = process.platform === "win32";

  run(executable, ["help"], { cwd: consumer, quiet: true, shell });
  run(dottedExecutable, ["help"], { cwd: consumer, quiet: true, shell });
  run(
    executable,
    [
      "init",
      pack,
      "--name",
      "Acme Corporation",
      "--owner",
      "Corporate Strategy",
      "--contact",
      "strategy@example.com",
      "--mode",
      "starter",
      "--with-design",
    ],
    { cwd: consumer, quiet: true, shell },
  );
  run(executable, ["lint", pack, "--format", "pretty"], {
    cwd: consumer,
    quiet: true,
    shell,
  });
  run(
    executable,
    [
      "context",
      pack,
      "--profile",
      "visual",
      "--allow-draft",
      "--output",
      join(consumer, "context.md"),
      "--receipt",
      join(consumer, "context.receipt.json"),
    ],
    { cwd: consumer, quiet: true, shell },
  );
  run(executable, ["diff", pack, pack], { cwd: consumer, quiet: true, shell });
  run(executable, ["spec"], { cwd: consumer, quiet: true, shell });
  run(executable, ["schema"], { cwd: consumer, quiet: true, shell });
  run(executable, ["install", pack, "--agent", "codex"], {
    cwd: consumer,
    quiet: true,
    shell,
  });

  for (const path of [
    join(pack, "COMPANY.md"),
    join(pack, "CUSTOMER.md"),
    join(pack, "OFFER.md"),
    join(pack, "VOICE.md"),
    join(pack, "DESIGN.md"),
    join(pack, ".agents", "skills", "company", "SKILL.md"),
    join(consumer, "context.md"),
    join(consumer, "context.receipt.json"),
  ]) {
    requirePath(path);
  }

  const context = readFileSync(join(consumer, "context.md"), "utf8");
  if (!context.includes("# Company context bundle") || !context.includes("# Source: DESIGN.md")) {
    throw new Error("Installed package did not generate the expected visual context bundle.");
  }

  console.log("Package smoke test passed: clean install, both binaries, CLI workflow, and skill install.");
} finally {
  rmSync(sandbox, { force: true, recursive: true });
}
