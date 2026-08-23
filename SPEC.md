# Company.md format specification

Version: `0.1`

This document is normative. The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** describe requirement levels.

## 1. Purpose

A Company.md pack is a plain-text, version-controlled representation of the minimum company context an AI agent needs to perform business-facing work consistently. It is designed to be understandable by humans without tooling and mechanically checkable without a model.

The format standardizes context, not company strategy. It does not decide what a company should believe, sell, charge, claim, or sound like.

## 2. Pack topology

A complete pack MUST have one root `COMPANY.md` and three linked companions:

```text
COMPANY.md
├── CUSTOMER.md
├── OFFER.md
└── VOICE.md
```

The root MAY link one `DESIGN.md`:

```yaml
links:
  customer: ./CUSTOMER.md
  offer: ./OFFER.md
  voice: ./VOICE.md
  design: ./DESIGN.md
```

Links MUST be local paths relative to the file declaring them. HTTP links are not valid topology because an agent must consume the same version that reviewers approved. Evidence sources inside `claims` MAY be URLs, document identifiers, or internal source-of-truth references.

Conventional filenames are uppercase. Consumers SHOULD accept `company.md` and `Company.md` when discovering only the root, but producers MUST create `COMPANY.md`.

## 3. Document structure

Each of the four Company.md documents has two layers:

1. YAML front matter, delimited by exact `---` lines at the start of the file.
2. Markdown prose organized by second-level (`##`) headings.

The front matter is normative for identity, lifecycle, ownership, classification, applicability, topology, and evidence status. The prose is normative for business meaning and agent behavior. When metadata and prose conflict, the document is invalid in substance even if a structural linter cannot detect the contradiction.

Unknown front-matter keys and extra Markdown sections MUST be preserved by consumers. A future-compatible consumer MUST NOT silently discard unknown content when rewriting a file.

## 4. Common front matter

```yaml
companymd: "0.1"
schema: companymd/context/v1
maturity: starter | team | enterprise
kind: company | customer | offer | voice
id: stable-lowercase-id
company: root-company-id       # required except on the root company document
name: Human-readable name
status: draft | active | deprecated
classification: public | internal | confidential | restricted
owners:
  - team: Accountable team
    contact: group@example.com # optional but recommended
review:
  last_reviewed: "YYYY-MM-DD"
  next_review: "YYYY-MM-DD"
scope:
  business_units: [all]
  regions: [all]
  products: [all]
extends: ./base/COMPANY.md      # optional; string or array
exceptions:                    # optional
  - rule: rule/id
    reason: Why compliance is intentionally impossible
    approved_by: role-or-person # required to suppress a warning
    expires: "YYYY-MM-DD"       # required to suppress a warning
claims: []
```

### 4.1 Identity

- `companymd` MUST be the quoted string `"0.1"`. Quoting prevents YAML parsers from converting the version to a number.
- `schema` SHOULD be `companymd/context/v1`. Consumers accept an absent value for `0.1` compatibility, but MUST fail clearly when another `COMPANY.md` dialect is declared rather than interpreting it as this format.
- `maturity` SHOULD be `starter`, `team`, or `enterprise` and controls validation policy, not the truth or quality of the content. When absent, consumers use `team` behavior.
- `kind` MUST match the document's role.
- `id` MUST be stable across renames. It uses lowercase letters, digits, `.`, `_`, and `-`, has 2–128 characters, and begins with a letter or digit.
- `company` MUST equal the root company `id` in every companion.
- `name` is a human label and MAY change without changing `id`.

### 4.1.1 Maturity levels

- `starter` minimizes first-run friction. Placeholders and temporary example contacts are informational while the pack remains a draft.
- `team` makes collaboration, ownership, and freshness gaps visible as warnings.
- `enterprise` requires durable escalation contacts and is intended for strict review and CI.

Maturity MUST NOT weaken structural, classification, secret, topology, or prohibited-claim errors. Moving to a stricter level is a governance rollout decision; it does not certify the content as true.

### 4.2 Lifecycle

- `draft` content MAY be authored by agents but MUST require explicit opt-in before entering an agent context bundle.
- `active` content is approved and is the default consumable state.
- `deprecated` content MUST NOT enter a new context bundle.

Changing `status` to `active` is a governance decision, not a formatting task. Organizations SHOULD require an owner review for this transition.

### 4.3 Classification

Classification order is:

```text
public < internal < confidential < restricted
```

A context consumer MUST NOT include a document above the requested clearance. A visual file inherits the root company classification unless the surrounding access-control system imposes a stricter level.

Classification metadata does not encrypt files, redact content, authenticate users, or prevent a model provider from receiving a prompt. Repositories, agent sandboxes, logs, and model data controls MUST enforce the real boundary.

Secrets, authentication material, private keys, and raw personal data MUST NOT be stored in any Company.md file at any classification.

### 4.4 Ownership and review

At least one `owners` entry MUST name an accountable team. A contact SHOULD be a durable group address or directory handle, not a single employee when avoidable.

Review dates use ISO `YYYY-MM-DD`. `next_review` MUST NOT precede `last_reviewed`. Consumers SHOULD warn after the next-review date. Review means the owner checked accuracy, applicability, evidence status, and access classification—not merely that a file changed recently.

### 4.5 Scope

`scope` describes where a document applies. Each key maps to a non-empty array of strings. Standard keys are:

- `business_units`
- `regions`
- `products`
- `locales`
- `channels`

Organizations MAY add keys. The value `all` means no restriction within that dimension and SHOULD NOT appear beside narrower values.

## 5. Evidence claims

Claims make time-sensitive, differentiating, commercial, or externally published statements traceable.

```yaml
claims:
  - id: company.revenue.subscription
    status: verified
    source: internal://finance/fy26-commercial-model
    owner: Finance
    verified_at: "2026-08-20"
```

Prose references a claim registered in the same document with `{claim:company.revenue.subscription}`.

Claim status is one of:

- `verified`: supported by the named source and checked on `verified_at`;
- `assumption`: useful working context that is not yet proven;
- `decision`: a deliberate policy or positioning choice, with the decision record as source;
- `deprecated`: no longer valid and not usable in new output.

Claims MUST have a stable `id`, `source`, and `owner`. Verified claims SHOULD have `verified_at`. A source reference does not need to be fetchable by every agent; lack of source access means the agent can use the approved claim but cannot independently re-verify it.

Prose MUST NOT reference a deprecated claim.

Not every sentence needs a claim. Claims SHOULD cover statements whose falsity would create material commercial, legal, customer, or reputational risk.

## 6. Canonical prose sections

Required sections MUST occur once. They SHOULD follow the order below. Additional `##` sections MAY appear and MUST be preserved.

### 6.1 COMPANY.md

1. `Overview`
2. `What We Sell`
3. `Who We Serve`
4. `How We Make Money`
5. `What We Believe`
6. `What Makes Us Different`
7. `Operating Boundaries`
8. `Evidence and Open Questions`

### 6.2 CUSTOMER.md

1. `Ideal Customer Profile`
2. `Pains`
3. `Objections`
4. `Buying Triggers`
5. `Questions`
6. `Language`
7. `Fears`
8. `Decision Criteria`
9. `Exclusions`
10. `Evidence and Open Questions`

Customer descriptions MUST distinguish observed evidence from inference. They MUST NOT encode protected characteristics as targeting shortcuts or present stereotypes as customer research.

### 6.3 OFFER.md

1. `Packages`
2. `Deliverables`
3. `Pricing Logic`
4. `Proof`
5. `Promises`
6. `Claims to Avoid`
7. `Good-Fit Customers`
8. `Commercial Guardrails`
9. `Evidence and Open Questions`

`Pricing Logic` may describe principles without storing price lists. `Claims to Avoid` is normative negative context and takes precedence over examples elsewhere in the pack.

### 6.4 VOICE.md

1. `Voice Principles`
2. `How We Talk`
3. `How We Never Sound`
4. `Phrases We Use`
5. `Phrases We Avoid`
6. `Writing Mechanics`
7. `Channel Adaptations`
8. `Examples of Good Writing`
9. `Review Checklist`

Examples SHOULD include the task and audience that make them good. Agents MUST apply rules, not mimic accidental facts in an example.

## 7. Inheritance and scoped overlays

A document MAY use `extends` to identify one or more base documents of the same kind. Paths are resolved relative to the extending document. Cycles are invalid.

In version `0.1`, every overlay is a complete document: it carries all common metadata and all required prose sections. Consumers read base documents first and the more specific overlay last. When statements conflict, the later, more specific overlay wins only within its declared scope.

An overlay MUST NOT declare a less restrictive classification than any inherited base. It MAY be more restrictive. Organizations SHOULD keep inheritance shallow; more than two levels is difficult for humans to audit.

## 8. Agent context profiles

Consumers SHOULD load the narrowest profile that can answer the task:

| Profile | Ordered roles |
| --- | --- |
| `core` | company |
| `customer` | company, customer |
| `commercial` | company, customer, offer |
| `communications` | company, customer, offer, voice |
| `visual` | company, customer, offer, voice, design |
| `all` | company, customer, offer, voice, design |

Within each role, bases appear before overlays. `DESIGN.md` appears last so visual implementation is constrained by company meaning, customer needs, offer truth, and voice before styling begins.

Generated bundles MUST identify their profile, clearance, generation time, and source files. A consumer MAY emit a `companymd/context-receipt/v1` sidecar containing source paths and SHA-256 digests. Generated bundles and receipts are disposable artifacts and MUST NOT become a second source of truth.

A file-based deliverable MAY carry a sibling `companymd/receipt/v1` sidecar conforming to [`schemas/artifact-receipt.schema.json`](schemas/artifact-receipt.schema.json), with the deliverable digest, governed source digests, generated intermediate digests, client-source labels, unresolved facts, and verification gates. A blocked receipt MAY identify an expected deliverable that does not exist; it records `exists: false` and `sha256: null` rather than fabricating an artifact. Each verification gate has a stable id and one status: `pass`, `fail`, `blocked`, or `not-run`. A consumer MUST NOT describe an artifact as complete when a required gate is `fail`, `blocked`, or `not-run`.

## 9. DESIGN.md interoperability

Company.md does not redefine visual tokens. If `links.design` is present:

- the file MUST exist locally;
- it MUST conform to the external DESIGN.md specification selected by the organization;
- Company.md tooling SHOULD delegate visual validation to `@google/design.md`;
- business facts, customer evidence, offer claims, and writing rules MUST remain in Company.md files rather than being copied into design tokens;
- visual prose MAY reference Company.md concepts by stable claim id or section name.

If the business and visual systems conflict, no general automatic precedence is safe. An agent MUST surface the conflict to the relevant business and design owners.

## 10. Validation

A conforming linter reports structured findings with:

- stable rule id;
- severity (`error`, `warning`, or `info`);
- source file;
- human-readable message;
- optional metadata path, line, and suggestion.

Errors include invalid YAML, missing required metadata or sections, bad topology, unresolved evidence references, inheritance cycles, classification downgrades, and likely secrets. Warnings include stale reviews, section-order drift, placeholders, and missing recommended provenance. Informational findings do not make a pack invalid.

A documented exception may suppress a warning to informational severity only when it names the exact rule, reason, approver, and a non-expired date. Exceptions cannot suppress errors, including structural, evidence, topology, classification, or secret findings.

Default lint exit behavior:

- `0`: no errors;
- `1`: one or more errors;
- `2`: CLI or input failure before a report can be produced.

Strict mode also returns `1` for warnings.

## 11. Change management

Company.md source belongs in version control. Active changes SHOULD be proposed with:

- the business reason;
- affected scopes and agent workflows;
- added, changed, or deprecated claims;
- source evidence;
- accountable owner approval;
- review-date updates when a substantive review occurred.

Agents MAY draft changes but MUST NOT self-approve a transition to active status, a classification downgrade, new commercial promises, or the removal of `Claims to Avoid`.

## 12. Extensions and compatibility

Version `0.1` allows organization-specific front-matter keys and additional prose sections. Extension keys SHOULD use a distinctive namespace such as `x-acme-legal`. Consumers MUST preserve unknown data but MAY ignore it.

For migration only, a consumer MAY accept an older `0.1` pack that lacks `schema` or `maturity`, but it MUST warn, assume `team` validation, and MUST NOT overwrite an existing `COMPANY.md` until its dialect is confirmed.

Breaking changes to required fields, semantics, or resolution behavior require a new `companymd` version. Adding optional metadata or lint warnings does not necessarily require a version change.

## 13. Agent skills and behavioral evaluation

An integration MAY expose the workflow as an Agent Skill named `company`. The skill MUST validate the pack, select the narrowest sufficient context profile, keep request-specific customer facts separate from durable company truth, and preserve human approval boundaries.

Before/after evaluation SHOULD run the same task with the same model, tools, attachments, and output constraints. Reports SHOULD expose criterion-level passes, fixed failures, regressions, and unresolved failures. They MUST NOT present structural or textual conformance as a truth score, factual certification, or business-outcome prediction.
