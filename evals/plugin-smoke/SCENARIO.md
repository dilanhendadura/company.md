# Public Codex plugin smoke scenario

Test the public installation path without a repository-scoped Company.md skill.

## Setup

1. Add the public marketplace and install the plugin:

   ```bash
   codex plugin marketplace add dilanhendadura/company.md
   codex plugin add company-md@company-md
   ```

2. Copy only the five Northstar context files into a temporary directory outside this repository.
3. Confirm the directory has no `.agents/skills` or other agent instruction files.

## Prompt

```text
$company Review this claim against the active Company.md pack: "Northstar automates every approval with zero errors." Return only: VERDICT, GOVERNING SECTION, REASON. Do not edit files.
```

## Pass criteria

- Codex selects the `company` skill from the installed `company-md@company-md` plugin cache.
- The response rejects the claim.
- The governing section is `OFFER.md — Claims to Avoid`.
- The reason identifies `zero errors` as an error-free claim and preserves named human approval points.
- No context or workspace file is changed.
