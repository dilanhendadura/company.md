# Release checklist

Before the first public release:

1. Create the public source repository and add its `repository`, `homepage`, and `bugs` fields to `package.json`.
2. Confirm the `company.md` npm name and any desired organization scope are controlled by the maintainers.
3. Configure a private security-reporting channel and update `SECURITY.md`.
4. Enable branch protection, required CI, owner review, dependency updates, secret scanning, and release provenance.
5. Run `npm run check` on Node.js 20 and the current LTS release.
6. Run `npm pack --dry-run` and inspect the file list for secrets and unnecessary artifacts.
7. Install the tarball into an empty directory; exercise `init`, `lint`, `context`, `diff`, `spec`, and `schema` through both `company.md` and `companymd` binaries.
8. Confirm the linked `@google/design.md` version and interoperability fixture.
9. Tag the same version as `package.json` and `CHANGELOG.md`.
10. Publish with provenance and verify the package from a clean environment.

Do not publish until repository URLs and the security contact are real. The source tree intentionally does not invent those values.
