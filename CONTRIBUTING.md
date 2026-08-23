# Contributing to Company.md

Company.md is intended to become a small, interoperable standard. Contributions should make agent behavior more predictable without turning the format into a universal company database.

## Development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run check
```

Run the local CLI with:

```bash
npm run dev -- lint examples/northstar --format pretty
```

## Proposing a format change

Open an issue before a breaking schema or semantic change. Include:

- the concrete agent or governance failure;
- why prose, an extension key, or an additional section cannot solve it;
- examples from at least two different organization shapes;
- compatibility and migration impact;
- expected linter behavior, including false-positive risk;
- security and privacy consequences.

Core fields should be universal, stable, inspectable, and usable without proprietary infrastructure. Organization-specific needs belong in namespaced extension keys until repeated usage demonstrates a common abstraction.

## Pull requests

- Keep specification, schema, templates, CLI, and tests aligned.
- Add a failing test before fixing a linter bug.
- Preserve unknown fields and sections.
- Do not add network calls to lint or context generation.
- Do not weaken fail-closed behavior for drafts, deprecated content, invalid packs, or clearance.
- Use fixtures that are fictional and contain no credentials or personal data.
- Run `npm run check` before requesting review.

By contributing, you agree that your contribution is licensed under Apache-2.0.
