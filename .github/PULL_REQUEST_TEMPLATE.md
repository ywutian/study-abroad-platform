## Summary

<!-- Brief description of what this PR does and why -->

## Design note

<!--
For non-trivial changes — anything >1 day, or that touches layout, architecture,
data contracts, or dependency versions — fill this in BEFORE coding and sleep on
it once. Skip for trivial/mechanical PRs. See docs/ANTI_CHURN_PLAYBOOK.md.
-->

<details><summary>Design note (delete if trivial)</summary>

- **Problem:**
- **Options considered:**
- **Decision + why:**
- **Invariant** (the rule this must always hold, so it isn't relitigated later):

</details>

## Changes

<!-- List the specific changes made -->

-

## Related Issues

<!-- Link related issues: Closes #123, Fixes #456 -->

## Test Plan

<!-- How was this tested? What scenarios were verified? -->

- [ ] Unit tests pass (`pnpm --filter api test` / `pnpm --filter study-abroad-mobile test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Manual testing completed
- [ ] Edge cases verified

## Checklist

- [ ] Code follows [development standards](../CONTRIBUTING.md)
- [ ] Self-review completed
- [ ] Tests added/updated for new functionality
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] No sensitive data (API keys, credentials) in the diff
- [ ] Dependency/lockfile touched? Ran `pnpm install --frozen-lockfile` locally (anti-churn Gate 3)
- [ ] Rework this PR caused is now prevented by a lint/test/ADR (`/close-the-loop`, anti-churn Gate 6)

## Screenshots / Demo

<!-- If applicable, add screenshots or GIFs showing the changes -->
