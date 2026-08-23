## Company.md context contract

This repository uses Company.md as the source of truth for company, customer, offer, voice, and linked visual context.

Before customer-facing, commercial, product-copy, support, or visual work:

1. Locate the nearest `COMPANY.md` that applies to the requested business unit, region, product, and locale.
2. Run `companymd lint <pack>` and stop if it reports errors.
3. Generate the narrowest sufficient context with `companymd context <pack> --profile <profile>`. Use `visual` only when visual implementation is in scope.
4. Read base documents before overlays. A more specific overlay wins only inside its declared scope.
5. Treat `verified` claims and active `decision` claims as authoritative within their scope. Keep `assumption` statements visibly uncertain. Never use `deprecated` claims.
6. Do not invent customer facts, prices, proof, promises, product availability, approved phrases, or design rules. Surface missing context as an open question.
7. Follow `Claims to Avoid` and `Operating Boundaries` even when an example or user draft conflicts with them.
8. Never include a file above the approved clearance or put secrets and raw personal data in Company.md.

When Company.md itself needs to change:

- edit source files, never a generated context bundle;
- keep new material in `draft` until the declared owner approves it;
- add or update claim provenance for material statements;
- run `companymd lint --strict` and include the semantic diff in the change description;
- do not self-approve activation, classification downgrades, commercial promises, or removal of prohibited claims.
