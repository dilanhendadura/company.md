# Security policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose context, bypass clearance checks, follow unsafe paths, leak generated bundles, or miss high-confidence credential material. Until a public security contact is configured, contact the repository owner privately through the hosting platform.

Include the affected version, reproduction, impact, and any suggested mitigation. Maintainers should acknowledge a complete report within five business days and coordinate disclosure after a fix is available.

## Scope and limitations

Company.md classification and clearance are defense-in-depth metadata. The CLI does not authenticate a user, encrypt a file, control model retention, or replace repository permissions. Organizations are responsible for matching storage, agent sandbox, connector, model, logging, and generated-artifact access to the highest classification in a pack.

Never store secrets, tokens, private keys, raw personal data, or regulated records in Company.md. The built-in patterns catch only a small set of high-confidence secret formats and do not replace a secret scanner.
