# Evaluating Company.md agent behavior

Company.md is useful only when an agent produces better work because of it. Structural validation of the Markdown pack is necessary but not sufficient.

## Four validation layers

1. **Pack validation:** run `companymd lint` and fail on structural or governance errors.
2. **Skill validation:** validate `SKILL.md`, its UI metadata, installation, and deterministic scripts.
3. **Behavioral evaluation:** run a realistic task from a clean session with only the scenario, Company.md pack, and installed skill.
4. **Artifact evaluation:** inspect the actual file and evaluate every criterion independently. Safety-critical failures always fail the run.

## Running the sales-deck scenario

Use [the scenario](../evals/sales-deck/SCENARIO.md) as the entire user brief. Do not provide the rubric or an intended answer to the agent before the run.

After generation:

- verify the context receipt hashes;
- extract or inspect all visible slide text;
- render every slide and check it at full size;
- evaluate [the rubric](../evals/sales-deck/rubric.yaml) criterion by criterion;
- record missing context separately from agent failures;
- make the narrowest source, skill, or tooling change supported by the observed failure;
- rerun from a clean session.

For local deliverables, record required artifact gates in the sibling `companymd/receipt/v1` file. Use stable ids and one of `pass`, `fail`, `blocked`, or `not-run`; do not hide a missing export or render behind a prose-only unresolved note. Declare `presentation/v1` for decks, then run `companymd artifact verify <receipt> --root <repository-root>` so hashes and contract gates are checked rather than merely trusted.

Native cloud artifacts such as Google Slides use the same receipt contract with a remote deliverable record: HTTPS URL, stable provider id, immutable revision id, native MIME type, and optional export metadata. Remote receipts must include `artifact/access` and `artifact/revision` gates. Presentation gates still apply, so a cloud deck is not complete until export, full-slide render, overflow review, and design conformance have all passed.

For text companions, run the deterministic comparison directly:

```bash
companymd eval examples/northstar \
  --baseline evals/sales-deck/baseline.md \
  --candidate evals/sales-deck/candidate.md \
  --rubric evals/sales-deck/rubric.yaml \
  --format pretty
```

A run passes only when every required automated check and every fatal manual check passes. Do not collapse the result into a “truth score”: conformance, factual review, artifact quality, and business outcome are different measurements. Maintain several scenarios before claiming production readiness: sales, support, product copy, executive communication, and an adversarial request that conflicts with a prohibited claim.
