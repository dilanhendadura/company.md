# Compatibility

Company.md is a business-context layer. It is deliberately compatible with agent instruction files, website discovery files, and visual standards instead of competing with them.

## Responsibility map

| Convention | What it should contain | How Company.md integrates |
| --- | --- | --- |
| `AGENTS.md` | Repository workflow, commands, constraints, and scoped agent instructions | Point the agent to the nearest pack and require lint/context/receipt steps |
| `CLAUDE.md` | Persistent Claude Code project instructions | Add a short routing rule; keep company truth in the Company.md pack |
| `GEMINI.md` | Persistent Gemini CLI project context and imports | Import or route to the generated context bundle for the task |
| `llms.txt` | A curated index to website content for inference-time discovery | Link public, sanitized Company.md documentation when a company chooses to publish it |
| `DESIGN.md` | Visual rationale, tokens, components, and prohibitions | Link it from `COMPANY.md`; the `visual` profile loads it after business constraints |
| Company.md | Company, customer, offer, voice, claims, scope, ownership, and evidence | Acts as the reviewed business source for any compatible agent |

Do not duplicate the complete pack inside vendor-specific instruction files. Duplication makes ownership unclear and lets claims drift. Keep a small routing contract in the agent file and generate a task-specific bundle with the CLI.

## Codex

Install the packaged plugin:

```bash
codex plugin marketplace add dilanhendadura/company.md
codex plugin add company-md@company-md
```

Invoke the skill with `$company`, or discover it through `/skills`. The repository also ships [`integrations/AGENTS.md`](../integrations/AGENTS.md), which can be copied to the appropriate scope in a working repository.

## Other coding agents

The portable contract is:

1. locate the nearest applicable `COMPANY.md`;
2. run `companymd lint <pack>`;
3. generate the narrowest profile with `companymd context`;
4. use the generated bundle for the current task only;
5. leave source changes in `draft` for owner approval;
6. preserve the receipt beside file-based outputs.

Agents that support hierarchical project instructions can store these six routing rules in their native instruction file. Agents that support direct file inclusion can load the generated bundle explicitly. Company.md does not claim native vendor support until that integration has a checked-in, reproducible test.

## Scope and overlays

The root pack can define organization-wide context. More specific packs or overlays can specialize it by:

- business unit;
- product or offer;
- customer segment;
- region;
- locale;
- channel.

Specific context wins only inside its declared scope. A local pack cannot silently downgrade classification, remove prohibited claims, or broaden a commercial promise.

## Public website discovery

`llms.txt` is useful for public website discovery; Company.md may contain internal or confidential context. Do not publish a full internal pack merely to make it discoverable. If a public subset is intentional, create a separate sanitized public pack and link it from the website's `llms.txt`.
