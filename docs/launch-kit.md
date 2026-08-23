# Launch kit

This kit is designed for a transparent open-source launch. Replace any bracketed detail with evidence before publishing; never turn roadmap work into a shipped claim.

## Positioning

**Category:** governed context for company-aware AI.

**One-line promise:** Give every AI agent the same approved company context—without pasting it into every prompt.

**Problem:** AI workspaces know how to code but repeatedly improvise what a company sells, who it serves, what it can promise, and how it should sound.

**Mechanism:** four small Markdown files, an optional linked visual standard, validation, scoped context bundles, and source receipts.

**Proof:** a reproducible before/after evaluation and a clean-package smoke test. Keep the PowerPoint gate described as open until the rendered artifact is checked.

## 90-second demo

1. Show a blank folder and run the GitHub `companymd init` command from the README.
2. Open the four files and point to owner, status, review date, claims, and prohibited language.
3. Invoke `$company create a sales deck for this customer using our approved design`.
4. Show that the agent selects the `visual` profile and loads `DESIGN.md` last.
5. Show one unsupported claim being rejected or converted into an open question.
6. Open the output receipt and show the source paths and hashes.
7. Change an offer promise, run `companymd diff`, and show the reviewable semantic change.
8. End on: “Your agents should share company truth, not improvise it.”

Do not record the final demo until every shown command works from a clean machine on `main`.

## X launch post

> AI agents keep getting better at making things—and still improvise what your company sells, promises, and sounds like.
>
> I built Company.md: 4 governed Markdown files + optional DESIGN.md, a linter, scoped context, receipts, and a `$company` skill.
>
> Open source: https://github.com/dilanhendadura/company.md

Suggested follow-up thread:

1. Show the five-file diagram.
2. Show the one-line `$company` request.
3. Explain the critical distinction: `AGENTS.md` says how to work; Company.md says what the business may represent.
4. Show the receipt and semantic diff.
5. Share the honest eval result, including the open PowerPoint gate.
6. Ask teams to contribute a sanitized before/after artifact rather than only starring the repo.

## LinkedIn launch post

> Every team experimenting with AI eventually creates the same hidden tax: company context copied into prompts, docs, custom GPTs, and agent instructions—then allowed to drift.
>
> Company.md is an open standard for turning that context into four small, reviewable files: COMPANY.md, CUSTOMER.md, OFFER.md, and VOICE.md, with DESIGN.md when the output is visual.
>
> Coding agents can validate the pack, load only what a task needs, avoid unsupported claims, and leave a receipt showing which sources produced an artifact. Business owners still approve the truth.
>
> The repository includes a CLI, a Codex skill/plugin, enterprise governance, and a reproducible evaluation with its limitations visible.
>
> I would value pilots from teams willing to share sanitized before/after results: https://github.com/dilanhendadura/company.md

## Show HN title and text

**Title:** Show HN: Company.md – governed company context for AI agents

**Text:**

> I kept seeing coding agents receive detailed technical instructions while improvising basic business context: who the company serves, what the offer includes, which claims are allowed, and how the brand speaks.
>
> Company.md is an Apache-2.0 format and CLI built around four Markdown files plus optional DESIGN.md. It adds ownership, scope, classification, review dates, claim provenance, linting, semantic diffs, task-specific bundles, and source receipts. It complements AGENTS.md rather than replacing it.
>
> The repo includes a Codex skill/plugin and a checked-in before/after sales-deck evaluation. The semantic gates pass; the rendered PPTX gate is still explicitly open. Feedback on the format, false positives, and real enterprise adoption constraints would be especially useful.

## Launch sequence

### Before launch

- All required CI and security checks are green on `main`.
- Plugin installation works from the public repository.
- npm package is published with provenance, or README clearly uses the GitHub fallback.
- The demo contains no confidential context or invented customer proof.
- Repository description, topics, social preview, discussions, and pinned issue are ready.
- A two-minute quickstart has been tested by someone who did not build the project.

### Launch day

- Publish the repository release and demo.
- Post the concise problem/mechanism/proof story, not a feature inventory.
- Reply with working examples and acknowledge open gates directly.
- Route format debates to Discussions and reproducible defects to Issues.

### After launch

- Turn repeated questions into quickstart improvements within 48 hours.
- Invite sanitized showcase evaluations using the issue template.
- Track successful pack creation, valid-pack time, eval submissions, and returning contributors—not only stars.
- Publish what failed in the first external pilots and the changes those failures caused.

## Viral loop

The sustainable loop is:

```text
starter pack → useful artifact → shareable receipt/eval → community fixture → better standard
```

A star is useful distribution. A sanitized pack plus before/after evaluation is durable product evidence. Optimize the project for the second outcome.
