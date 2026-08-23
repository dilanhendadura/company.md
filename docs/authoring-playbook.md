# Authoring playbook

This playbook is for a human owner working with a coding agent to create or refresh a Company.md pack. The agent organizes and challenges the material; accountable people decide what becomes active.

## Before the interview

Choose the adoption level before authoring: use `starter` for a first guided draft, `team` for shared operational use, and `enterprise` only when owners and escalation paths are ready for strict validation. If useful sources already exist, run `companymd adopt <workspace>` first and preserve every source file.

Give the agent read access only to approved sources needed for the pack. Prefer a source list over a broad drive mount. Useful inputs include:

- current strategy and operating-model decisions;
- product catalog and quoting rules;
- win/loss research and customer interview transcripts;
- approved case studies and claims;
- legal and compliance claim guidance;
- brand voice and visual standards;
- documented exclusions, escalation paths, and negative tests.

Do not provide credentials, raw customer exports, special-category personal data, or material that the target repository is not permitted to hold.

## Agent workflow

Use this instruction with a coding agent:

```text
Create or update this Company.md pack.

1. Read SPEC.md and run `companymd lint` before editing.
2. Inventory the supplied sources by owner, date, scope, and authority.
3. Ask one focused interview question at a time. Start with contradictions and
   unknowns that could change customer, offer, or claim decisions.
4. Record sourced facts as verified claims, explicit policy choices as decisions,
   and unresolved beliefs as assumptions. Never upgrade a status yourself.
5. Use concrete prose. Preserve negative constraints and unknowns.
6. Keep every document in draft while authoring.
7. Run lint, show the semantic diff, and open a reviewable change.
8. Ask the declared owners to approve content and activate it.
```

## Interview sequence

### Company

1. In one sentence, what do customers pay the company to change?
2. What exactly is sold today, and what is only planned?
3. Which customers are deliberately prioritized?
4. What creates revenue, what changes price, and what must an agent never quote from memory?
5. Which beliefs alter real product or commercial decisions?
6. Which differences have evidence, and which are positioning choices?
7. What work, market, promise, or optimization is outside the boundary?

### Customer

1. What observable situation makes a company a fit before demographics are considered?
2. What does the problem cost in time, money, risk, or status?
3. Which objections are legitimate constraints rather than sales resistance?
4. What event creates budget and urgency?
5. What exact words appear repeatedly in interviews, calls, tickets, or searches?
6. Who decides, blocks, approves, uses, and lives with the outcome?
7. Which anti-ICP signals predict a bad outcome?

### Offer

1. Which packages can be sold now, and in which markets?
2. What is always included, explicitly excluded, or supplied by the customer?
3. What drives price, and which system is authoritative for current numbers?
4. Which proof is approved, scoped, current, and reproducible?
5. Which promise can delivery keep every time?
6. Which phrases, implications, guarantees, or regulated claims are prohibited?
7. When must a person approve price, scope, terms, proof, or timing?

### Voice

1. Which recognizable role or object should the writing resemble?
2. What should it never resemble?
3. Which behavioral rule follows from each voice principle?
4. Which customer words should be preserved verbatim?
5. Which overused phrases should be replaced, and with what?
6. What changes across product, support, sales, social, and executive channels?
7. Which before/after examples represent recurring, high-value work?

## Evidence discipline

Register a claim when getting it wrong could alter a purchase, contractual expectation, regulated statement, product decision, or public comparison. Reference the smallest stable source that supports it.

Use:

- `verified` for checked evidence;
- `decision` for deliberate policy or positioning;
- `assumption` when work may proceed but uncertainty must remain visible;
- `deprecated` when history matters but new output must not reuse it.

An agent should flag contradictions instead of averaging them. The source with the newest date is not automatically authoritative; ownership and decision rights matter.

## Activation checklist

- All required sections contain specific, non-placeholder content.
- No secrets or unnecessary personal data are present.
- Companions point to the correct root company id.
- Material claims have a status, source, owner, and date where applicable.
- Pricing and public-proof sources are explicitly named.
- Negative boundaries and claims to avoid survived editing.
- Classification matches repository and model access.
- Owners reviewed the scopes for which they are accountable.
- `companymd lint --strict` passes or every accepted exception is documented and time-bounded.
- A human with the right decision authority changes status to `active`.
- The declared `schema` is `companymd/context/v1`; a competing `COMPANY.md` dialect was migrated through an explicit adapter rather than overwritten.
