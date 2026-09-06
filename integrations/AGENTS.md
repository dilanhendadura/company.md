## Company.md context contract

This repository uses Company.md as the source of truth for company, customer, offer, voice, and linked visual context.

Before customer-facing, commercial, product-copy, support, or visual work:

1. Use the installed `company` skill. Keep company facts in its referenced source pack, not this instruction file.
2. Generate context once with `companymd context <workspace-or-pack> --profile <profile> --compact --workspace-root <authorized-root>` before recursively listing files. The CLI discovers and validates the registry or pack. Pass `--subject <requested-id-or-alias>` whenever the user names an identity; do not infer one from a nearby directory or a similar skill name. Read the resulting source/binding paths instead of enumerating sibling packs, historical fixtures or all skills to choose a template.
3. For slides, add `--artifact presentation` and follow the resolved design and `templateSkill`/`template` bindings with the available presentation capability. For other work that requires a brand design, add `--require-design`. An unresolved identity or required design is a concrete error to resolve before dependent work.
4. Use the selected scope and keep inherited prohibitions. Organizational membership alone does not inherit another product's offer, voice, or design. Generate a fresh context and receipt when the requested product changes.
5. Treat `verified` claims and active `decision` claims as authoritative within their scope. Keep `assumption` statements visibly uncertain. Never use `deprecated` claims.
6. Do not invent customer facts, prices, proof, promises, product availability, approved phrases, or design rules. Surface missing context as an open question.
7. Follow `Claims to Avoid` and `Operating Boundaries` even when an example or user draft conflicts with them.
8. Never include a file above the approved clearance or put secrets and raw personal data in Company.md. Use `--allow-draft` for consciously authorized draft work, including a requested new-pack test; disclose draft status without repeating an already granted permission request.
9. Preserve the context receipt beside artifacts. Bind it with `create-receipt.mjs --context-receipt <context-receipt.json>`, inspect the actual output, and run `companymd artifact verify` before claiming completion. Hash validation and declared gates alone do not establish visual quality.

When Company.md itself needs to change:

- edit source files, never a generated context bundle;
- keep new material in `draft` until the authorized owner approves activation;
- add or update claim provenance for material statements;
- run `companymd lint --strict` and include the semantic diff in the change description;
- do not self-approve activation, classification downgrades, commercial promises, or removal of prohibited claims.
