# Changelog

All notable changes to Company.md will be documented here.

## 0.3.1 — 2026-08-23

- Fixes complete product overlays so inherited base documents validate against their own company id.
- Adds a deterministic skill runner and forbids coding agents from selecting arbitrary npm-cache artifacts.
- Treats the current VCS or working-directory root as a hard context-discovery boundary so agents cannot borrow sibling packs.
- Removes nested Claude worktrees and installed skill references from adoption inventories.
- Accepts top-level `companymd --help` and `companymd -h` as expected.

## 0.3.0 — 2026-08-23

- Packages Company.md as an installable Codex plugin with guided starter prompts and synchronized skill sources.
- Adds a non-technical owner interview flow for creating or adopting a context pack.
- Rebuilds onboarding around a tested GitHub quickstart and the native `$company` Codex invocation.
- Adds a public compatibility map, governance model, evidence-gated roadmap, launch kit, and adoption showcase template.
- Adds coverage thresholds, clean-package tests, Linux/macOS/Windows smoke jobs, dependency review, production audit, and CodeQL.
- Prepares npm trusted publishing with OIDC and provenance while keeping registry publication an explicit external gate.
- Adds a reusable visual identity and social-preview asset for the open-source launch.

## 0.2.0 — 2026-08-23

- Adds the `companymd/context/v1` dialect namespace and explicit collision detection.
- Adds `starter`, `team`, and `enterprise` validation maturity levels.
- Ships the repository-scoped `$company` Agent Skill and `companymd install`.
- Adds low-confidence public homepage bootstrap and read-only adoption inventory.
- Adds source-hashed context receipts and criterion-level before/after evals without a truth score.
- Adds a reproducible sales-deck scenario and thin integration guidance for existing agent context files.
- Records a before/after Codex storyboard evaluation and keeps unverified PowerPoint rendering as an explicit open gate.

## 0.1.0 — 2026-08-23

- Defines the four-file Company.md format and optional DESIGN.md link.
- Adds ownership, lifecycle, scope, classification, review, claims, exceptions, and complete overlays.
- Ships `init`, `lint`, `context`, `diff`, `spec`, and `schema` commands.
- Delegates linked visual validation to `@google/design.md` 0.4.0.
- Adds fail-closed context profiles, an enterprise adoption guide, agent instructions, JSON Schema, CI, fixtures, and tests.
