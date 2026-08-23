# Sales deck workflow

Use this reference only for a new or substantially revised sales presentation.

## Required inputs

Establish the named customer, audience, meeting stage, desired next decision, and known customer situation. If these cannot be inferred from supplied material, ask for them. Do not browse for or infer non-public customer facts without authorization.

## Context

Use `communications` for a content-only storyboard. Use `visual` for slides or when the user asks to follow the design system. Keep customer-specific facts separate from the Company.md pack.

## Completion contract

When the user requests a PowerPoint, Google Slides deck, or another binary presentation, a storyboard is an intermediate—not the completed deliverable. Invoke the available presentation artifact capability after generating the `visual` context. Export the requested file, render every slide, inspect the full-size renders, and fix overflow, clipping, wrapping, and design-system violations before claiming completion.

Create the sibling Company.md receipt with `--contract presentation/v1` and record artifact gates with repeated `--check <id=status>` arguments. The contract requires:

- `artifact/export=pass|fail|blocked|not-run`;
- `artifact/render=pass|fail|blocked|not-run`;
- `artifact/overflow=pass|fail|blocked|not-run`;
- `design/conformance=pass|fail|blocked|not-run`.

All four gates must be `pass` for a binary deck to be called complete. If an artifact runtime is unavailable, do not substitute a different format silently. Create the receipt with `--expected-deliverable <requested-path>`, record any storyboard with `--intermediate <path>`, mark the affected gates `blocked`, attach the cause with `--check-note <id=text>`, and name the missing capability. Return a storyboard only when the user requested one or accepts it as a fallback.

After receipt creation, run `companymd artifact verify <receipt> --root <repository-root> --format pretty` through the skill runner. Do not hand off the deck or call it complete unless verification succeeds. The verifier must recompute every recorded source, intermediate, and deliverable hash; manually inspecting the JSON is not equivalent.

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
