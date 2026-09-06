# BMAD adapter

Treat Company.md as an existing governed context source during project-context discovery. Preserve existing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, brand, and product documentation; run `companymd adopt` to inventory them before proposing changes.

Reference the Company.md pack or workspace registry from agent instructions instead of duplicating it in generated project context. Resolve the requested subject with `companymd context --subject <id>` when using a registry. Load a validated task-specific bundle at execution time and keep generated bundles outside version control.
