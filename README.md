# Company.md

[![CI](https://github.com/dilanhendadura/company.md/actions/workflows/ci.yml/badge.svg)](https://github.com/dilanhendadura/company.md/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-2563eb.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)

**Give every AI agent the same approved business context—without pasting it into every prompt.** Company.md turns four small Markdown files into a source-controlled contract that people can review, agents can follow, and CI can validate.

```text
COMPANY.md  ─┬─ CUSTOMER.md
             ├─ OFFER.md
             ├─ VOICE.md
             └─ DESIGN.md (optional, validated with @google/design.md)
```

```text
$company create a sales deck for Meridian using the approved design
```

The agent loads the right company, customer, offer, voice, and visual context; refuses unsupported claims; creates the artifact with the appropriate tool; and leaves a source receipt beside file-based outputs. Company.md complements `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and similar instruction files instead of replacing them.

Company.md was sparked by [this tweet by Corey Ganim](https://x.com/coreyganim/status/2091196448364974090?s=46) about the four context files every useful AI workspace needs.

## Why this exists

Prompts are temporary. Company knowledge is shared, reviewed, scoped, and constantly changing. Company.md makes that knowledge:

- **agent-readable:** stable sections plus structured YAML metadata;
- **human-owned:** every file names owners, scope, classification, and review dates;
- **evidence-aware:** important statements can reference a claim registry instead of disguising assumptions as facts;
- **composable:** company-wide files can be specialized with governed overlays;
- **safe to consume:** context bundles fail closed on validation, draft status, and clearance;
- **visual when needed:** `COMPANY.md` can link to a standard [`DESIGN.md`](https://github.com/google-labs-code/design.md).

Classification labels are policy metadata, not access control. Store these files in systems whose real permissions match their declared classification, and never put credentials or personal data in them.

## Quick start

Requirements: Node.js 20 or newer.

From this repository:

```bash
npm install
npm run build

node dist/cli.js init ./company-context \
  --name "Acme Corporation" \
  --owner "Corporate Strategy" \
  --contact "strategy@example.com" \
  --mode starter \
  --with-design

node dist/cli.js lint ./company-context --format pretty
```

After the first npm release, the same commands can run as `npx company.md ...`. On Windows, use the dot-free alias with `npx -p company.md companymd ...` to avoid Markdown file-association collisions.

The initializer creates drafts. `starter` keeps incomplete authoring guidance informational; `team` turns collaboration gaps into warnings; `enterprise` requires durable escalation contacts and is intended for strict CI. A coding agent can interview the owners using the [authoring playbook](docs/authoring-playbook.md), replace placeholders, register evidence, and open a pull request. Humans then approve the files and change `status` to `active`.

For the lowest-friction start, seed a draft from a public homepage. Imported wording is always marked as a low-confidence assumption:

```bash
companymd create https://acme.example ./company-context --with-design
companymd adopt ./existing-workspace --format pretty
```

Generate only the context required for a task:

```bash
# Business fundamentals only
npx company.md context ./company-context --profile core

# Company + customer + offer + voice
npx company.md context ./company-context --profile communications \
  --output .company-context.md

# All business context followed by DESIGN.md
npx company.md context ./company-context --profile visual \
  --clearance internal \
  --output .company-context.md \
  --receipt .company-context.receipt.json
```

Profiles are cumulative: `core`, `customer`, `commercial`, `communications`, `visual`, and `all`. Context generation refuses invalid, deprecated, over-classified, or draft sources by default. During authoring, use `--allow-draft` deliberately.

## The four-file minimum

| File | Question it answers | Required content |
| --- | --- | --- |
| `COMPANY.md` | Who are we? | What the company sells, serves, earns from, believes, differentiates, and will not do |
| `CUSTOMER.md` | Who are we for? | ICP, pains, objections, triggers, questions, language, fears, criteria, and exclusions |
| `OFFER.md` | What can we promise? | Packages, deliverables, pricing logic, proof, promises, prohibited claims, fit, and guardrails |
| `VOICE.md` | How do we communicate? | Voice behavior, anti-patterns, phrases, mechanics, channel adaptations, and examples |

`DESIGN.md` is an optional fifth file. Company.md owns business meaning and verbal constraints; DESIGN.md owns visual rationale and design tokens. The CLI validates a linked design file with Google's official linter and places it last in visual context bundles.

## CLI

```text
companymd init [directory] --name <name> [--with-design]
companymd create <public-url> [directory] [--mode starter|team|enterprise]
companymd adopt [directory] [--format json|pretty]
companymd install [directory] [--agent codex]
companymd lint [path|-] [--format json|pretty] [--strict]
companymd context [path] [--profile <profile>] [--clearance <level>] [--receipt <file>]
companymd diff <before> <after>
companymd eval [path] --baseline <file> --candidate <file> [--rubric <yaml>]
companymd spec
companymd schema
```

`lint` emits JSON by default and returns exit code `1` for errors. `--strict` also fails on warnings. `diff` reports changed metadata and sections and returns `1` when validation findings regress. `eval` compares explicit conformance criteria before and after Company.md; it deliberately does not produce a truth score. The programmatic API exports the same capabilities. See the [lint rule reference](docs/lint-rules.md) for stable finding IDs.

## Use it with a coding agent

Install the repository-scoped Company skill:

```bash
companymd install . --agent codex
```

In Codex, type `$company` to invoke it directly, or type `/` and select the enabled **Company** skill from the command list. The user only describes the outcome:

```text
$company create a sales deck for Meridian using the approved design
$company review this proposal against our offer and claims policy
$company write a follow-up email for this buyer
```

The skill finds and validates the pack, selects the narrowest context profile, separates client facts from company truth, uses `DESIGN.md` for visual work, and records the exact sources behind file-based outputs. Codex may also select the skill implicitly when the request clearly matches its description.

Copy [integrations/AGENTS.md](integrations/AGENTS.md) into the relevant part of a repository, or adapt the same contract for another agent instruction file. The safe loop is:

1. lint the source pack;
2. request the narrowest context profile for the task;
3. make the deliverable without inventing missing facts;
4. cite proposed context changes in a separate pull request;
5. require the declared owners to approve active-context changes.

For a larger rollout, see [Enterprise adoption](docs/enterprise-adoption.md). The complete normative definition is in [SPEC.md](SPEC.md). Behavioral validation starts with the reproducible [sales-deck evaluation](evals/sales-deck/SCENARIO.md), its [latest result](evals/sales-deck/RESULT.md), and the [evaluation guide](docs/evaluation.md).

## Status

The CLI is at `0.2`; the compatible context format remains `0.1` and now declares the unambiguous dialect `companymd/context/v1`. Unknown metadata keys and extra Markdown sections are preserved so organizations can extend the format without waiting for `1.0`.

## Inspiration and relationship to DESIGN.md

Company.md adopts the useful pattern demonstrated by [Google Labs' DESIGN.md](https://github.com/google-labs-code/design.md): machine-readable front matter for exact values, Markdown prose for intent, a JSON-first linter, semantic diffs, and context that persists across agents. Company.md is an independent project and specification focused on enterprise business context; it uses `@google/design.md` as a dependency only when validating a linked visual system.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a schema or behavior change. The project is released under the [Apache License 2.0](LICENSE).
