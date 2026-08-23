# Sales deck evaluation result

Run date: 2026-08-23

## Outcome

The Company.md candidate improved on the no-context baseline and passed every automated textual conformance check with no regression.

- Context profile: `visual`
- Ordered sources: `COMPANY.md`, `CUSTOMER.md`, `OFFER.md`, `VOICE.md`, `DESIGN.md`
- Baseline: non-conformant
- Candidate storyboard: conformant
- Fixed checks: all baseline failures covered by the rubric
- Regressions: 0
- Unchanged failures: 0

The candidate removed avoided voice and offer claims, grounded the narrative in supplied Meridian facts, preserved human final approval, made discovery precede final scope, and carried the approved palette and typography into the production specification.

## Artifact gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Pack and DESIGN.md validation | Pass | `companymd lint examples/northstar` reports 0 errors and 0 warnings |
| Skill structure and installation | Pass | Skill validator and install tests pass |
| Before/after textual conformance | Pass | `companymd eval` reports `improved`, candidate conformant, no regressions |
| Source and artifact traceability | Pass | `candidate.companymd.json` records portable paths and SHA-256 hashes |
| PowerPoint export | Blocked | Required presentation workspace runtime loader was unavailable in the test environment |
| Rendered-slide inspection | Blocked | Requires the exported PowerPoint |

This is a successful semantic workflow test, not a completed presentation test. Company.md must not claim production-ready deck generation until the PowerPoint exports, every slide renders, and the visual rubric passes.
