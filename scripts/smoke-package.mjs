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
    env: options.env ?? process.env,
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
  run(executable, ["--help"], { cwd: consumer, quiet: true, shell });
  run(executable, ["-h"], { cwd: consumer, quiet: true, shell });
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
  run(executable, ["schema", "artifact-receipt"], { cwd: consumer, quiet: true, shell });
  run(executable, ["install", pack, "--agent", "codex"], {
    cwd: consumer,
    quiet: true,
    shell,
  });
  const skillRunner = join(pack, ".agents", "skills", "company", "scripts", "run-companymd.mjs");
  const receiptTool = join(pack, ".agents", "skills", "company", "scripts", "create-receipt.mjs");
  const packagedCli = join(consumer, "node_modules", "company.md", "dist", "cli.js");
  const artifactReceipt = join(consumer, "artifact.companymd.json");
  const blockedArtifactReceipt = join(consumer, "blocked-artifact.companymd.json");
  const expectedDeck = join(consumer, "expected-deck.pptx");
  run(process.execPath, [skillRunner, "--version"], {
    cwd: pack,
    quiet: true,
  });
  run(process.execPath, [skillRunner, "context", pack, "--profile", "visual", "--allow-draft", "--compact", "--output", join(consumer, "runner-context.md")], { cwd: pack, quiet: true });
  run(process.execPath, [receiptTool, "--help"], { cwd: pack, quiet: true });
  run(process.execPath, [
    receiptTool,
    "--root", consumer,
    "--output", artifactReceipt,
    "--deliverable", join(consumer, "context.md"),
    "--profile", "visual",
    "--clearance", "internal",
    "--contract", "generic/v1",
    "--source", join(pack, "COMPANY.md"),
    "--client-source", "package smoke scenario",
    "--check", "artifact/export=pass",
    "--check", "artifact/render=blocked",
    "--check-note", "artifact/render=render runtime intentionally absent from package smoke",
    "--unresolved", "render runtime intentionally absent from package smoke",
  ], { cwd: pack, quiet: true });
  run(process.execPath, [
    receiptTool,
    "--root", consumer,
    "--output", blockedArtifactReceipt,
    "--expected-deliverable", expectedDeck,
    "--profile", "visual",
    "--clearance", "internal",
    "--contract", "presentation/v1",
    "--source", join(pack, "DESIGN.md"),
    "--intermediate", join(consumer, "context.md"),
    "--client-source", "package smoke scenario",
    "--check", "artifact/export=blocked",
    "--check-note", "artifact/export=presentation runtime unavailable",
    "--check", "artifact/render=not-run",
    "--check-note", "artifact/render=no exported deck to render",
    "--check", "artifact/overflow=not-run",
    "--check-note", "artifact/overflow=no rendered slides to inspect",
    "--check", "design/conformance=not-run",
    "--check-note", "design/conformance=no rendered slides to inspect",
    "--unresolved", "presentation runtime unavailable",
  ], { cwd: pack, quiet: true });

  run(executable, ["artifact", "verify", artifactReceipt, "--root", consumer], {
    cwd: consumer,
    quiet: true,
    shell,
  });
  run(executable, ["artifact", "verify", blockedArtifactReceipt, "--root", consumer], {
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
    skillRunner,
    receiptTool,
    join(consumer, "context.md"),
    join(consumer, "context.receipt.json"),
    artifactReceipt,
    blockedArtifactReceipt,
  ]) {
    requirePath(path);
  }

  const context = readFileSync(join(consumer, "context.md"), "utf8");
  if (!context.includes("# Company context bundle") || !context.includes("# Source: DESIGN.md")) {
    throw new Error("Installed package did not generate the expected visual context bundle.");
  }
  const artifact = JSON.parse(readFileSync(artifactReceipt, "utf8"));
  if (
    artifact.completion !== "blocked"
    || artifact.contract !== "generic/v1"
    || artifact.deliverable?.exists !== true
    || artifact.verification?.[0]?.id !== "artifact/export"
    || artifact.verification?.[0]?.status !== "pass"
    || artifact.verification?.[1]?.id !== "artifact/render"
    || artifact.verification?.[1]?.status !== "blocked"
  ) {
    throw new Error("Artifact receipt did not preserve machine-readable verification gates.");
  }
  const blockedArtifact = JSON.parse(readFileSync(blockedArtifactReceipt, "utf8"));
  if (
    blockedArtifact.completion !== "blocked"
    || blockedArtifact.contract !== "presentation/v1"
    || blockedArtifact.deliverable?.path !== "expected-deck.pptx"
    || blockedArtifact.deliverable?.exists !== false
    || blockedArtifact.deliverable?.sha256 !== null
    || blockedArtifact.intermediates?.[0]?.path !== "context.md"
    || !/^[a-f0-9]{64}$/.test(blockedArtifact.intermediates?.[0]?.sha256 ?? "")
    || blockedArtifact.verification?.[0]?.note !== "presentation runtime unavailable"
  ) {
    throw new Error("Blocked artifact receipt did not preserve the expected deliverable and gate cause.");
  }

  console.log("Package smoke test passed: clean install, both binaries, CLI workflow, and skill install.");
} finally {
  rmSync(sandbox, { force: true, recursive: true });
}
