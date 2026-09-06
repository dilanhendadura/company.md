# Enterprise adoption

Company.md should begin as a narrow operating contract, not as a program to rewrite every company document. Start where agents already produce customer-facing or product-facing work and where inconsistent context has a measurable cost.

## Recommended operating model

| Role | Accountability |
| --- | --- |
| Executive sponsor | Defines the business boundary and resolves cross-functional conflicts |
| Context steward | Maintains topology, lint health, review cadence, and release notes |
| Domain owner | Approves the substance of company, customer, offer, voice, or design context |
| Security/privacy owner | Approves repository, agent, model, logging, and classification controls |
| Agent consumer | Selects the narrowest profile and reports gaps instead of inventing context |

Ownership should map to durable teams. The same person may perform multiple roles in a small pilot, but an agent must never become its own approver.

## Rollout in four stages

### 1. Pilot

Choose one product, region, language, agent workflow, and measurable failure mode. Inventory existing material with `companymd adopt`, initialize a `starter` pack as `draft`, interview owners, and compare outputs with and without the pack. Good pilot measures include unsupported claims, review cycles, brand corrections, and time spent locating authoritative context.

### 2. Controlled use

Move to `team`, activate the pack, add owner review through CODEOWNERS or an equivalent control, run lint in CI, and generate context plus a receipt at execution time. Store generated bundles outside source control.

### 3. Scoped expansion

Add complete overlays only when a region, business unit, product, or locale has material differences. Keep inheritance shallow. A new overlay needs its own owners, classification, review dates, evidence, and all required sections.

### 4. Operational governance

Move to `enterprise` only after durable contacts and access controls exist. Track stale documents, exception expiry, context-related incidents, claim removals, and agent workflows consuming each profile. Treat changes to promises, prohibited claims, classification, and active status as controlled changes.

## Repository patterns

Small company:

```text
company-context/
├── COMPANY.md
├── CUSTOMER.md
├── OFFER.md
├── VOICE.md
└── DESIGN.md
```

Enterprise with complete overlays:

```text
company-context/
├── global/
│   ├── COMPANY.md
│   ├── CUSTOMER.md
│   ├── OFFER.md
│   └── VOICE.md
└── eu-enterprise/
    ├── COMPANY.md      # extends ../global/COMPANY.md
    ├── CUSTOMER.md     # extends ../global/CUSTOMER.md
    ├── OFFER.md        # extends ../global/OFFER.md
    └── VOICE.md        # extends ../global/VOICE.md
```

Separate repositories are preferable when classifications, legal entities, or model-access policies differ materially. Classification in YAML is never a substitute for repository permissions.

## Pull-request control

At minimum, route approvals by file:

```text
/company-context/**/COMPANY.md   @strategy-owner
/company-context/**/CUSTOMER.md  @research-owner
/company-context/**/OFFER.md     @revenue-ops-owner @legal-owner
/company-context/**/VOICE.md     @brand-owner
/company-context/**/DESIGN.md    @design-systems-owner
```

Require CI to run:

```bash
companymd lint ./company-context/global --workspace-root ./company-context --strict
companymd lint ./company-context/eu-enterprise --workspace-root ./company-context --strict
```

High-risk changes should include source evidence and an explicit rollback. An agent may prepare the pull request and summarize the semantic diff; branch protection and human review enforce the decision.

## Agent integration

Put an instruction near the work it governs:

```markdown
## Company context

Before product, sales, marketing, support, or visual work:

1. Resolve the explicit subject with `companymd context ./company-context --subject <id> --profile <profile> --compact`; this validates the selected context and stops on errors.
2. Build the narrowest relevant context profile.
3. Treat verified claims and active decisions as authoritative within scope.
4. Keep assumptions and open questions visibly uncertain.
5. Never invent a price, proof point, promise, customer fact, or visual rule.
6. Propose source-context changes separately and request owner approval.
```

Do not paste the entire pack into every agent session. A smaller profile reduces disclosure, contradiction, and irrelevant instruction pressure.

## Security and privacy checklist

- Repository access is at least as restrictive as the highest linked file.
- The selected model, retention mode, connectors, logs, and observability stack are approved for that classification.
- Context bundles are temporary and excluded from version control.
- Sources in claim metadata reveal no embedded tokens or sensitive query parameters.
- Customer language is de-identified unless a lawful, approved purpose requires otherwise.
- Secrets scanning covers Markdown and generated artifacts.
- The organization has a revocation path for a false or prohibited claim.

## What to measure

Measure whether Company.md changes operating quality:

- unsupported-claim rate;
- human corrections per deliverable;
- time to first acceptable draft;
- contradictions found before publication;
- stale-context age;
- exception count and age;
- percentage of outputs using the correct scope and profile;
- incidents caused by over-classified or outdated context.

Lint conformance alone is not success. A perfectly structured document can still contain vague, untrue, or unactionable strategy; never turn the result into a truth score.


## Groups, companies, products, and artifact bindings

A registry named `companymd.yaml` is optional for a single pack and recommended for portfolios. It uses schema `companymd/registry/v1`. `subjects` contains stable `id`, `kind` (`group`, `company`, `product`, or `brand`), local `pack`, optional `parent` and unique case-insensitive `aliases`. Organizational parent relationships do not automatically inherit company prose, claims, offers or visual rules. Use document `extends` separately for intentionally shared context.

```yaml
schema: companymd/registry/v1
subjects:
  - id: example-holdings
    kind: company
    pack: ./global
  - id: product-a
    kind: product
    parent: example-holdings
    pack: ./product-a
    artifacts:
      presentation:
        design: ./product-a/presentation/DESIGN.md
        templateSkill: ./product-a/skills/product-slides/SKILL.md
  - id: product-b
    kind: product
    parent: example-holdings
    pack: ./product-b
    artifacts:
      presentation:
        design: ./product-b/DESIGN.md
```

All registry paths resolve relative to the registry file and must exist inside the authorized workspace. The selected pack must match its subject ID or declare that product in its scope. A presentation design may differ from the application's `links.design`. `template` can bind an actual local template file; `templateSkill` binds an existing skill entrypoint by path. These are explicit requirements recorded with hashes, not a fuzzy skill-name search. No product-specific template skill is required when the generic artifact capability and the design are sufficient.

`companymd resolve <workspace> --subject product-a --artifact presentation` explains selection. `companymd context` also performs resolution and validation, so a separate resolve/lint step is unnecessary during ordinary agent work. An explicit subject wins over the current directory; without one, the nearest registered pack or a single unambiguous subject is selected. A portfolio root with multiple choices returns an ambiguity error. Unknown subjects never fall back to another brand. Each call produces a fresh selection; callers must not reuse another product's old bundle.

The default discovery/source boundary is the nearest Git root, or the supplied input directory outside Git. Pass `--workspace-root <authorized-directory>` for shared packs or a broader explicitly authorized portfolio. Every source, inherited base, design and template is canonicalized, and symlinks escaping the boundary are rejected. A standalone overlay referencing a sibling now needs an explicit common workspace root. No recursive search through sibling workspaces is performed.

Use `--artifact presentation` to require `visual` and an actual DESIGN.md. A shared design outside the pack or belonging to another registered product nested inside it needs an explicit artifact binding. `--require-design` applies the same presence requirement to other visual work. `--compact` removes only inherited sections whose prose is byte-for-byte identical after the parser's newline normalization to a later section of the same role. Unique prohibitions, introductions, metadata and source digests remain. A full pack lint in CI still validates every companion; runtime profiles load only roles required by the task.

Before claiming a multi-product workflow is ready, run the same brief with each subject, switch subjects in a single agent session, and test ambiguity, wrong-brand bindings, inherited prohibitions and missing templates. A combined deck requires an explicit co-branding choice; it is not implicit inheritance.
