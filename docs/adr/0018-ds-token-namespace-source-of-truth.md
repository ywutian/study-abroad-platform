# ADR-0018: DS Token Namespace Source of Truth

- Status: accepted
- Date: 2026-04-19
- Decision-makers: platform engineering
- Tags: design-system, web, mobile, theming

## Context

The repo already injects `--ds-*` CSS variables into the web app from `packages/shared/src/design/tokens.ts`.
The regression was not caused by missing runtime definitions; it was caused by drift between:

1. the shared canonical token table,
2. `docs/DESIGN_SYSTEM.md`,
3. landing-local semantic derivations,
4. mobile theme expectations.

At the same time, there was no automated guard against:

- assigning literal colors directly to semantic aliases such as `--primary`,
- referencing an undefined `--ds-*` token,
- re-copying canonical DS colors inside the RN theme adapter.

## Decision

We treat `packages/shared/src/design/tokens.ts` as the single source of truth for DS v2.1 token values.

- Web consumes canonical values through `getThemeCssText()` which injects `:root/.dark` `--ds-*` variables.
- `globals.css` keeps semantic aliases (`--primary`, `--background`, etc.) and scope-specific derivations (`--landing-*`, `--status-*`), but it does not own canonical DS values.
- Mobile consumes the same shared token table via the RN theme adapter and may only add non-canonical adapter fields such as `successForeground` or overlay helpers.
- Admission tier tokens are semantic aliases:
  - `reach -> destructive`
  - `target -> warning`
  - `safety -> success`
  - `likely -> primary`

## Consequences

### Positive

- One canonical DS source now drives Web CSS vars and RN theme semantics.
- Changing a DS v2.1 color requires one source edit instead of parallel CSS and TS updates.
- Lint can detect alias bypasses and undefined `--ds-*` references before runtime regressions reach users.
- Landing and page-shell surfaces can remain thin consumers of shared semantics.

### Negative

- There is an extra indirection layer between `--primary` and its final value, which requires developers to understand source vs alias vs derivation.
- Mobile still needs explicit hex / rgba outputs because React Native cannot consume `oklch()` directly.

### Neutral

- Scope-specific tokens such as `--landing-*` remain valid, but only as derived aliases.
- Existing pages do not need full redesign to benefit from the source-of-truth alignment.
