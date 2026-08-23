# Lint rule reference

Rule IDs are stable machine-facing identifiers. Messages may improve without a format-version change. Exact rules can be referenced by time-bounded warning exceptions.

## Metadata and structure

| Rule | Default severity | Meaning |
| --- | --- | --- |
| `metadata/spec-version` | error | Unsupported or unquoted Company.md version |
| `metadata/kind` | error | Missing or invalid document kind |
| `metadata/link-kind` | error | Linked file kind does not match its role |
| `metadata/id` | error | Invalid stable document id |
| `metadata/name` | error | Missing human-readable name |
| `metadata/status` | error | Invalid lifecycle status |
| `metadata/company-reference` | error | Companion lacks a root-company id |
| `convention/filename` | warning | File does not use the conventional uppercase name |
| `structure/missing-section` | error | Required `##` section is absent |
| `structure/duplicate-section` | error | A normalized `##` section occurs more than once |
| `structure/section-order` | warning | Canonical sections are out of order |
| `content/empty-section` | warning | A section has no prose |
| `content/placeholder` | warning | Draft markers such as TODO or TBD remain |

## Governance

| Rule | Default severity | Meaning |
| --- | --- | --- |
| `governance/classification` | error | Missing or invalid classification |
| `governance/owner` | error | No accountable owner team |
| `governance/placeholder-contact` | warning | Initializer contact has not been replaced |
| `governance/review` | error | Missing or invalid review metadata |
| `governance/review-order` | error | Next review precedes last review |
| `governance/stale` | warning | Next-review date has passed |
| `governance/scope` | error/warning | Scope is invalid or absent |
| `governance/scope-all` | warning | `all` is mixed with narrower scope values |
| `governance/exceptions` | error | Exception list is malformed |
| `governance/exception-approval` | warning | Exception cannot suppress without approval |
| `governance/exception-expiry` | error/warning | Exception date is missing, invalid, or expired |
| `governance/classification-downgrade` | error | Overlay is less restricted than its base |

An active, approved, non-expired exception can convert only the exact warning named in `rule` to informational severity. Errors are never suppressible.

## Evidence

| Rule | Default severity | Meaning |
| --- | --- | --- |
| `evidence/no-claims` | info | No claim registry is present |
| `evidence/claims` | error | Claims value is not an array |
| `evidence/claim-shape` | error | Claim entry is not a mapping |
| `evidence/claim-id` | error | Claim id is invalid |
| `evidence/duplicate-claim` | error | Claim id repeats within a document |
| `evidence/claim-status` | error | Claim status is invalid |
| `evidence/claim-source` | error | Claim lacks provenance |
| `evidence/claim-owner` | error | Claim lacks an accountable owner |
| `evidence/claim-verification` | warning | Verified claim lacks a valid verification date |
| `evidence/unknown-claim` | error | Prose references a claim not registered in that document |
| `evidence/deprecated-claim` | error | Prose uses a deprecated claim |
| `evidence/unreferenced-claim` | info | Registered claim is unused in prose |

## Topology, design, and security

| Rule | Default severity | Meaning |
| --- | --- | --- |
| `links/companions` | error | Root lacks a customer, offer, or voice link |
| `links/unknown-role` | warning | Root declares a non-standard linked role |
| `links/remote` | error | Topology points to an HTTP resource |
| `pack/load` | error | Pack, link, YAML, or inheritance chain cannot load |
| `pack/duplicate-id` | error | Two pack documents share an id |
| `pack/company-reference` | error | Companion references a different root id |
| `pack/deprecated-document` | error | Pack topology still links deprecated content |
| `design.md/parse` | error | Linked DESIGN.md cannot be parsed |
| `design.md/validation` | delegated | Finding returned by `@google/design.md` |
| `security/possible-secret` | error | A high-confidence credential pattern is present |

Secret detection is intentionally small and low-noise. It does not replace repository secret scanning or data-loss prevention.
