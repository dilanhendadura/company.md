# Sales deck workflow

Use this reference only for a new or substantially revised sales presentation.

## Required inputs

Establish the named customer, audience, meeting stage, desired next decision, and known customer situation. If these cannot be inferred from supplied material, ask for them. Do not browse for or infer non-public customer facts without authorization.

## Context

Use `communications` for a content-only storyboard. For slides, generate context with `--artifact presentation` and the requested `--subject` when using a registry. This requires visual context and a resolved design. Keep customer-specific facts separate from the Company.md pack.

Read the `templateSkill` path in the resolved context receipt, if present, and follow it with the host's presentation capability. Use a bound `template` file when provided. Do not substitute a different product's template; a generic presentation capability can use the selected design when no specific template is bound. See [product-routing.md](product-routing.md) for registry and product-switch behavior.

## Completion contract

When the user requests a PowerPoint, Google Slides deck, or another binary presentation, a storyboard is an intermediate—not the completed deliverable. Invoke the available presentation artifact capability after generating the `visual` context. Export the requested file, render every slide, inspect the full-size renders, and fix overflow, clipping, wrapping, and design-system violations before claiming completion.

Create the sibling Company.md receipt with `--contract presentation/v1 --context-receipt <context-receipt.json>` and record artifact gates with repeated `--check <id=status>` arguments. Preserve the selected identity and bound design/template sources. The contract requires:

- `artifact/export=pass|fail|blocked|not-run`;
- `artifact/render=pass|fail|blocked|not-run`;
- `artifact/overflow=pass|fail|blocked|not-run`;
- `design/conformance=pass|fail|blocked|not-run`.

For a native cloud deck, record its HTTPS URL, provider, immutable revision id, native MIME type, and export metadata with the remote options. Also record `artifact/access` and `artifact/revision`; a share link without a revision and rendered-slide inspection is not a complete deck artifact.

All four gates must be `pass` for a binary deck to be called complete. If an artifact runtime is unavailable, do not substitute a different format silently. Create the receipt with `--expected-deliverable <requested-path>`, record any storyboard with `--intermediate <path>`, mark the affected gates `blocked`, attach the cause with `--check-note <id=text>`, and name the missing capability. Return a storyboard only when the user requested one or accepts it as a fallback.

After receipt creation, run `companymd artifact verify <receipt> --root <authorized-root> --format pretty` through the skill runner. Do not call the deck complete unless verification succeeds and the slides were actually inspected. The verifier recomputes recorded local hashes; gate declarations alone do not establish visual quality, and remote metadata checks are offline.

## Narrative

Prefer a decision-oriented sequence:

1. customer situation and consequence;
2. the bounded workflow worth changing;
3. why the current handoffs fail;
4. the proposed operating model;
5. how the offer delivers it;
6. controls, evidence, and human approvals;
7. proof that is approved for this audience;
8. concrete next step.

Adapt the sequence to the meeting; it is not a mandatory slide count. Do not lead with generic company history or a feature inventory.

## Verification

- Do not state a price unless the approved pricing source was provided for this task.
- Do not convert internal or segment-level proof into a named-customer claim.
- Put qualifications next to the claim they constrain.
- Apply linked `DESIGN.md` colors, typography, density, and prohibitions.
- Keep internal planning notes and Company.md metadata out of visible slides.
- Preserve sources in speaker notes or the requested citation mechanism.
