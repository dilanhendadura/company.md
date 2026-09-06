---
name: company
description: Create or review customer-facing, commercial, product, support, and visual work using the governed COMPANY.md, CUSTOMER.md, OFFER.md, VOICE.md, and linked DESIGN.md context. Use when the user invokes $company, says /company, asks for on-brand work, or asks an agent to follow company context; do not use as a substitute for missing business facts or approvals.
---

# Company

Turn a plain-language request into a deliverable using the company or product explicitly resolved for that task.

## Start or adopt a pack

Resolve the absolute path of [scripts/run-companymd.mjs](scripts/run-companymd.mjs) beside this file and execute that runner for Company.md CLI calls. It selects `COMPANYMD_CLI`, a workspace-local install, an installed executable, or the pinned GitHub release. Inspect the runner source when diagnosing a failure, not as a prerequisite to running it. Do not execute arbitrary npm cache files.

When the user asks to set up Company.md and no pack exists, read [references/authoring.md](references/authoring.md). Initialize drafts, derive what the authorized sources support, keep unknowns explicit, and lint the result. Ask for facts that remain necessary after inspecting supplied sources. Do not invent evidence or treat drafting as approval to activate documents.

When business context already exists and the user is adopting Company.md, run the same skill runner with `adopt <workspace> --format pretty` first. Map useful sources into the four-file minimum; do not rewrite or delete the originals.

## Resolve the request

Identify the deliverable, audience, purpose, customer inputs, output format, and whether visual design is in scope. Ask only for missing information that would materially change the result. Treat facts supplied about a named customer as request context, not as permanent Company.md truth.

## Load the narrowest context

Use the VCS root as the workspace boundary when present; otherwise use the initial working directory. An explicit user-authorized workspace containing several repositories can be the boundary instead. Pass it as `--workspace-root`; do not expand it merely to make a failed link load.

Invoke `context` directly on the supplied workspace or current directory before a recursive file inventory: the resolver discovers the nearest registry or pack. Pass any explicitly named product or company as `--subject <id-or-alias>` without first checking for a registry; the CLI also validates a simple pack's identity. Omit the selector when no identity was named. Run one `context` command, which resolves and validates the same snapshot. Use `--compact` to elide identical inherited prose while retaining source hashes and constraints.

Read the resolved context and binding paths. Do not enumerate sibling packs, historical fixtures, or all installed skills to choose a product or template. Read other related files when the task needs them, after resolving the identity. An unknown or ambiguous identity is a routing error, never a reason to borrow a nearby pack. For registry setup, product changes, or template binding, read [references/product-routing.md](references/product-routing.md).

```bash
node <absolute-skill-directory>/scripts/run-companymd.mjs context <workspace-or-pack> --subject <id-or-alias> --profile <profile> --compact --workspace-root <authorized-root> --output <temporary-context-file> --receipt <temporary-receipt-file>
```

Use the narrowest sufficient profile:

- `core`: internal company reasoning.
- `customer`: customer research or qualification.
- `commercial`: packaging, proposals, or sales strategy without authored copy.
- `communications`: emails, proposals, landing pages, scripts, support, or product copy.
- `visual`: decks, pages, ads, or other designed artifacts. Add `--require-design` when the requested result must use the brand design. For slides, pass `--artifact presentation`, which requires visual context and design.

Read the generated context and receipt before authoring. Stop dependent work on validation errors; use `lint` for diagnosis or CI, not as a mandatory duplicate read before `context`. Add `--allow-draft` only when the user knowingly requests work with draft context, including creating and testing a new pack. Existing authorization is sufficient; make the draft status clear in the handoff. Never bypass a classification failure.

## Create the deliverable

Use the artifact capability appropriate to the requested output. Apply business meaning first, customer relevance second, offer and claim boundaries third, voice fourth, and visual rules last. Never invent prices, customer facts, proof, promises, availability, certifications, or design rules. Make assumptions visible and keep unresolved questions out of audience-facing copy unless the deliverable requires them.

For a sales presentation or pitch deck, read [references/sales-deck.md](references/sales-deck.md) and honor its binary-artifact completion contract. For a before/after validation request, read [references/evaluation.md](references/evaluation.md).

## Verify and hand off

Before returning the work:

- check `Claims to Avoid`, commercial guardrails, and customer exclusions;
- require evidence for qualitative time or performance claims such as “hours,” “half a day,” or “instant,” including narrative baselines, just as for numeric ROI or percentages;
- confirm the writing follows `VOICE.md` rules rather than copying example wording mechanically;
- if visual, confirm `DESIGN.md` tokens and prohibitions were used after the business context;
- distinguish verified facts, user-provided client facts, and assumptions;
- preserve the context receipt beside the deliverable when the output is a file.

For artifact traceability, run `scripts/create-receipt.mjs` after generation with `--context-receipt <temporary-receipt-file>` to bind the resolved identity, design, template, and source hashes. Pass `--root <authorized-root>` so paths remain portable, `--contract generic/v1` or the required specific contract, client sources, intermediates, unresolved facts, and verification gates. For a native cloud artifact, also pass `--remote-url`, `--provider`, `--revision`, and `--mime-type`, export metadata when available, and the `artifact/access` and `artifact/revision` gates. When the requested artifact cannot be created, use `--expected-deliverable` with blocked gates and a concrete cause. Keep the receipt beside the artifact or its local manifest.

After writing the receipt, invoke the skill runner with `artifact verify <receipt> --root <authorized-root> --format pretty`. Fix verification failures before handoff. Hash checks establish source integrity; declared gates require actual artifact inspection and do not prove visual conformance by themselves. Remote verification is offline unless the provider was independently checked.

Return the artifact first, followed by a concise Company check naming the profile, source files, unresolved facts, and any approval still required. Do not expose the generated context bundle as a second source of truth.
