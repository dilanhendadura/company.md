# Governance

Company.md is an open standard for governed business context. Changes optimize for reliable agent behavior, clear human ownership, interoperability, and migration safety—not the number of fields in the schema.

## Principles

1. **A concrete failure precedes a new rule.** Proposals must show an agent, authoring, or governance failure that current prose or extensions cannot handle safely.
2. **The four-file minimum stays understandable.** Enterprise controls may be optional or mode-specific; a small team must still be able to start in one conversation.
3. **Humans own company truth.** Agents may draft and validate context but never self-approve activation, evidence, classification downgrades, or commercial promises.
4. **Compatibility beats duplication.** Company.md integrates with agent instructions and visual standards rather than absorbing their responsibilities.
5. **Claims require evidence.** Project documentation distinguishes implemented, tested, proposed, and blocked capabilities.

## Roles

- **Maintainers** triage issues, review changes, manage releases, and protect compatibility.
- **Contributors** provide reproducible failures, sanitized fixtures, implementations, documentation, or evaluation results.
- **Adopters** validate the standard in real organization shapes and report where it succeeds or fails.
- **Document owners** govern an organization's own context. Project maintainers cannot approve or interpret a company's business truth.

## Change classes

| Class | Examples | Required evidence |
| --- | --- | --- |
| Patch | Documentation clarification, false-positive fix, compatible validator improvement | Tests or a reproducible documentation check |
| Compatible feature | Optional metadata, new CLI workflow, new integration | At least two organization shapes, schema/template/tests/docs agreement |
| Breaking change | Required field, changed precedence, removed behavior | Public proposal, migration plan, deprecation window, major format version |

Unknown front-matter keys and extra Markdown sections remain preserved within the current format version. New organization-specific needs should use extensions before requesting a core field.

## Decision process

1. Open a format proposal using the issue template.
2. Describe the concrete failure, affected organization shapes, security/privacy impact, false-positive risk, and compatibility plan.
3. Discuss alternatives, including prose guidance and extension keys.
4. Implement specification, schema, templates, CLI, tests, examples, and documentation together.
5. Merge only after CI passes and the required owner review is recorded.

Maintainers document material decisions in the pull request or linked discussion. Silence is not approval. Security reports follow [SECURITY.md](SECURITY.md), not the public proposal process.

## Releases and deprecation

- CLI releases follow semantic versioning.
- Context documents declare their format/dialect separately from the CLI version.
- Deprecations must identify a replacement and a migration path.
- A breaking format change requires a new dialect identifier and cannot reinterpret existing active documents in place.
- Release notes must state which gates passed, which remain open, and any known limitations.

## Becoming a maintainer

Maintainer access is earned through sustained, high-quality contributions, respectful review, and demonstrated care for compatibility and user safety. Existing maintainers approve new maintainers publicly. The project will expand this section before adding a second maintainer so the process does not depend on unwritten expectations.
