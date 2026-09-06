# GitHub Copilot adapter

Install `companymd install . --agent copilot` in the project. Copilot in VS Code supports `.agents/skills/company/SKILL.md`; an existing Codex or Cursor installation in that directory already supplies it.

For company or product work, use that skill to resolve the requested subject, generate one validated context, and follow explicit design/template bindings. Keep business facts in the source pack and preserve existing Copilot instructions. For a nested repository, check the host's parent-repository discovery setting. This installation provides the skill and runner; host discovery and artifact behavior still need validation in the actual Copilot/VS Code version used by the team.
