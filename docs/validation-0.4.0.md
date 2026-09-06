# Validation of the 0.4.0 development candidate

Local validation on macOS arm64, 2026-09-06. This records observed results, not certification of every agent, editor or operating system. The candidate has not been published by this development run.

## Automated checks

- `npm run check`: 74 tests pass; TypeScript, example pack and synchronized plugin/distribution checks pass.
- `npm run test:coverage`: 74 tests pass on Node 22.11.0; source coverage 87.65% lines, 79.59% branches and 92.43% functions. Original thresholds remain 80/65/85. Coverage explicitly includes source TypeScript to avoid counting generated subprocess code twice.
- Independent routing stress task: 66 original cases and 50 additional edge cases pass after fixes. Cases cover repeated product switching, aliases, ambiguity, nested packs, inherited constraints, schema types, missing assets and workspace boundaries.
- Installer and runner tests cover Codex, Claude Code, Cursor and Copilot adapters, including clean local package discovery and shell-free argument handling. A clean package smoke test checks both CLI names and the installed skill runner.

## Real agent and artifact observations

Codex CLI 0.153.0 discovered the local skill explicitly and implicitly, selected the correct product design/template, refreshed context when switching products in the same session, and requested clarification for an ambiguous request. The initial named-product attempt timed out at 180 seconds; one resume completed its storyboard in about 93 seconds. The second product completed in about 104 seconds. This is success with a retry, not first-attempt reliability or a latency guarantee.

Claude Code 2.1.258 loaded the native project skill. After correcting the test harness's restricted skill visibility and command allowlist, two calls in the same session resolved different products, wrote and read context receipts, and preserved their separate designs. All 21 source/attachment hashes matched. An ambiguous request was also handled without choosing an arbitrary product. Editorial review found unsupported narrative time claims in the raw storyboards; a QA repair and two disclosed reviewer edits corrected them. Context routing and hash verification do not guarantee truthful generated copy.

Two separate Codex desktop tasks each produced a five-slide editable PPTX and PDF for a different pilot product. One used a recovered product-specific presentation skill and a presentation design distinct from its application design. The other used its website-derived design with the generic presentation capability and its documented font fallback. All ten slides were rendered and visually inspected; font substitutions and an overflow found during QA were corrected. Context-bound artifact receipts verify with zero errors; each has an expected warning identifying design conformance as an attestation. No Microsoft PowerPoint application test is claimed.

The host observations precede the final instruction refinement to resolve context before recursive discovery. Its total model latency has not been remeasured. The final runner optimization is covered by automated regression tests. Cursor/Copilot native agent sessions and Windows native host sessions remain untested.

## Performance scope

A same-fixture comparison against commit `c501e99cd994ebea70af9ddf82ac1271159942e0` used the same Node 22 runtime and alternating sample order:

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Markdown reads, documented lint + context workflow | 18 | 5 |
| Warm context API median, 30 paired samples | 10.235 ms | 7.401 ms |
| Direct CLI workflow median, 12 paired samples | 491.167 ms | 278.618 ms |

The old CLI workflow ran lint then context; the candidate runs one validating context command. Imports are excluded from warm API timing. Source-read instrumentation ran separately from timing. These are local microbenchmarks under shared machine load, not model or end-to-end artifact timings. A duplicate-heavy inheritance fixture also reduced context size from 33,091 to 22,420 bytes with `--compact`; real savings depend on actual duplicate prose.

Detailed private pilot sources, host transcripts, per-slide proofs, stress snapshots and reproducible benchmark scripts are retained outside the distributable repository. Tests use authorized draft/internal packs; the run does not approve their commercial claims or publish those sources.
