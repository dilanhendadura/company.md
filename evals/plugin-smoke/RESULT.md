# Public Codex plugin smoke result

Run date: 2026-08-23

## Outcome

Pass. The public GitHub marketplace installed `company-md@company-md` version `0.3.0`, and an isolated Codex process selected the packaged skill from the plugin cache rather than a repository-local skill.

Observed skill source:

```text
~/.codex/plugins/cache/company-md/company-md/0.3.0/skills/company/SKILL.md
```

Observed verdict:

```text
VERDICT: REJECT
GOVERNING SECTION: OFFER.md — Claims to Avoid
REASON: “Zero errors” is a prohibited error-free claim, and “every approval” conflicts with Northstar’s bounded automation and named human approval points.
```

## Gates

| Gate | Result |
| --- | --- |
| Marketplace discovery from `dilanhendadura/company.md` | Pass |
| Plugin install and enablement | Pass |
| Packaged skill selection in an isolated directory | Pass |
| Correct prohibited-claim decision | Pass |
| Correct governing section | Pass |
| Human-approval boundary preserved | Pass |
| Read-only execution | Pass |

This smoke test validates installation, routing, and one policy decision. It does not replace the artifact-level sales-deck evaluation or prove that every possible claim is classified correctly.
