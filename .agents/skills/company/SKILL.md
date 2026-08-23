---
name: company
description: Create or review customer-facing, commercial, product, support, and visual work using the governed COMPANY.md, CUSTOMER.md, OFFER.md, VOICE.md, and linked DESIGN.md context. Use when the user invokes $company, says /company, asks for on-brand work, or asks an agent to follow company context; do not use as a substitute for missing business facts or approvals.
---

# Company

Turn a plain-language request into a deliverable that follows the nearest applicable Company.md pack.

## Resolve the request

Identify the deliverable, audience, purpose, customer inputs, output format, and whether visual design is in scope. Ask only for missing information that would materially change the result. Treat facts supplied about a named customer as request context, not as permanent Company.md truth.

## Load the narrowest context

Locate the nearest `COMPANY.md`, then run its local Company.md CLI if available:

```bash
companymd lint <pack> --format pretty
companymd context <pack> --profile <profile> --output <temporary-context-file> --receipt <temporary-receipt-file>
```

Use the narrowest sufficient profile:

- `core`: internal company reasoning.
- `customer`: customer research or qualification.
- `commercial`: packaging, proposals, or sales strategy without authored copy.
- `communications`: emails, proposals, landing pages, scripts, support, or product copy.
- `visual`: decks, pages, ads, or other designed artifacts when `DESIGN.md` is linked.

Stop on validation errors. Draft context requires explicit user awareness; do not silently add `--allow-draft`. Never bypass a classification failure.

## Create the deliverable

Use the artifact capability appropriate to the requested output. Apply business meaning first, customer relevance second, offer and claim boundaries third, voice fourth, and visual rules last. Never invent prices, customer facts, proof, promises, availability, certifications, or design rules. Make assumptions visible and keep unresolved questions out of audience-facing copy unless the deliverable requires them.

For a sales presentation or pitch deck, read [references/sales-deck.md](references/sales-deck.md). For a before/after validation request, read [references/evaluation.md](references/evaluation.md).

## Verify and hand off

Before returning the work:

- check `Claims to Avoid`, commercial guardrails, and customer exclusions;
- confirm the writing follows `VOICE.md` rules rather than copying example wording mechanically;
- if visual, confirm `DESIGN.md` tokens and prohibitions were used after the business context;
- distinguish verified facts, user-provided client facts, and assumptions;
- preserve the context receipt beside the deliverable when the output is a file.

For a file-based output that needs artifact-level traceability, also run `scripts/create-receipt.mjs` after generation. Pass `--root <repository-root>` so stored paths remain portable, plus the deliverable, selected profile and clearance, exact source files, client sources, and unresolved facts. Keep this sibling receipt with the artifact.

Return the artifact first, followed by a concise Company check naming the profile, source files, unresolved facts, and any approval still required. Do not expose the generated context bundle as a second source of truth.
