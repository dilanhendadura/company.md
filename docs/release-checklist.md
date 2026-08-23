# Release checklist

## Source and compatibility

- [ ] `package.json`, `CHANGELOG.md`, release tag, plugin manifest, and user-facing status agree on the version.
- [ ] Specification, schema, templates, implementation, and tests agree.
- [ ] Unknown front-matter keys and extra sections remain forward-compatible.
- [ ] The linked `@google/design.md` version and interoperability fixture pass.
- [ ] Material behavior changes include a migration and rollback note.

## Verification

- [ ] `npm run check` passes on Node.js 20 and 24.
- [ ] `npm run test:coverage` meets the checked-in thresholds.
- [ ] `npm run test:package` passes on Linux, macOS, and Windows.
- [ ] `npm audit --omit=dev --audit-level=high`, dependency review, and CodeQL pass.
- [ ] The canonical skill passes `quick_validate.py`.
- [ ] The packaged plugin passes `validate_plugin.py` and `npm run check:plugin`.
- [ ] `npm pack --dry-run` contains no secrets or unnecessary artifacts.
- [ ] Both `company.md` and `companymd` binaries work from a clean tarball install.

## Artifact claims

- [ ] Every claimed evaluation is reproducible from committed inputs and rubric.
- [ ] File-based outputs include a portable context receipt with source hashes.
- [ ] Visual artifacts are exported, rendered, and inspected for overflow, clipping, and design-system conformance.
- [ ] Blocked gates remain labeled blocked in the README and result file.

## Distribution

- [ ] The public Codex marketplace installs from `dilanhendadura/company.md` in a clean environment.
- [ ] The npm name is controlled by the maintainer and trusted publishing points to `.github/workflows/release.yml`.
- [ ] The GitHub release workflow publishes from a GitHub-hosted runner with OIDC and provenance.
- [ ] The published tarball and plugin are re-tested from their public locations.
- [ ] Repository URLs, security reporting, branch protection, CODEOWNERS, topics, discussions, and social preview are current.

## Launch integrity

- [ ] Quickstart was completed by someone who did not build the project.
- [ ] Demo commands run on `main` with a fresh environment.
- [ ] Launch copy distinguishes implemented, tested, proposed, and blocked capabilities.
- [ ] No demo or fixture includes confidential company or customer context.

Do not publish merely because a date arrived. Publish when the relevant gates pass, and name any intentionally open gate in the release notes.
