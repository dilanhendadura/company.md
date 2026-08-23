# BMAD adapter

Treat Company.md as an existing governed context source during project-context discovery. Preserve existing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, brand, and product documentation; run `companymd adopt` to inventory them before proposing changes.

Reference the nearest active Company.md pack from agent instructions instead of duplicating it in generated project context. Load a task-specific context bundle at execution time and keep generated bundles outside version control.
