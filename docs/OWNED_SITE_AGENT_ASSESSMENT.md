# Owned-Site Agent Feasibility Assessment

This runbook covers the authorized assessment framework for the seven owned properties in the portfolio:

- `collegevine`
- `campusreel`
- `niche`
- `parchment`
- `college-raptor`
- `appily`
- `prepscholar`

The goal is exposure mapping, not stealth or evasion. The framework measures what a browser agent or a headed/manual-style workflow can access, which data-bearing surfaces exist behind each journey, and where role or session boundaries are actually enforced.

## Scope

- `prod`
  - read-only and reversible actions only
  - no destructive writes
  - no irreversible account changes
  - no billing or entitlement flips
- `staging`
  - full CRUD is allowed
  - partner and admin walkthroughs are allowed
  - entitlement and role-switch validation are allowed

The current implementation runs:

- `public` pass
  - guest-only crawl over public entrypoints
  - captures DOM, bootstrap JSON, REST, GraphQL, websocket, cookie, and storage surfaces when visible
- `browser` pass
  - authenticated browser automation by role using Playwright storage-state sessions
  - captures role guards, hidden network fields, pagination hints, export/download surfaces, and challenge points
- `desktop` pass
  - generates a headed/manual parity probe plan from browser findings
  - this is intentionally a checklist/scaffold, not an embedded desktop-agent runtime

## Default Manifest

The default scaffold lives in:

- [default-manifest.ts](../apps/api/src/common/owned-site-assessment/default-manifest.ts)

It contains:

- one journey catalog entry per `(site, environment, journey)`
- one target row per `(site, environment, role[, siteRole])`
- privilege transition scaffolding

Public production routes are wired to known public URLs where practical. Authenticated production, staging, and admin routes intentionally use `${ENV_VAR}` placeholders so operators can inject exact private URLs without hardcoding them in the repo.

To inspect the scaffold:

```bash
pnpm --filter api owned-site-assessment:manifest
```

To persist and customize it:

```bash
pnpm --filter api owned-site-assessment:manifest > tmp/owned-site-assessment.manifest.json
```

Then fill private URLs directly in the JSON file or export the corresponding environment variables before running the CLI.

## Session Files

Authenticated roles look for Playwright storage-state files under:

- `apps/api/.secrets/owned-site-assessment`

Default naming convention:

- `<site>.<environment>.<role>.storageState.json`
- `<site>.<environment>.<role>.<siteRole>.storageState.json`

Examples:

- `collegevine.prod.profiled_consumer.storageState.json`
- `college-raptor.staging.collaborator.counselor_admin.storageState.json`

Override the root directory with `--secrets-dir=/absolute/path`.

## CLI Usage

Default full run:

```bash
pnpm --filter api owned-site-assessment:run
```

Public-only run for the public production surfaces:

```bash
pnpm --filter api owned-site-assessment:run --pass=public --environments=prod
```

Focused browser pass for a subset of sites and roles:

```bash
pnpm --filter api owned-site-assessment:run \
  --pass=browser \
  --sites=collegevine,niche,parchment \
  --roles=profiled_consumer,institution_staff,admin_ops
```

Use a customized manifest:

```bash
pnpm --filter api owned-site-assessment:run \
  --manifest=/absolute/path/to/owned-site-assessment.manifest.json
```

Produce a headed parity scaffold:

```bash
pnpm --filter api owned-site-assessment:run --pass=browser,desktop --headed
```

Useful flags:

- `--sites=a,b,c`
- `--environments=prod,staging`
- `--roles=guest,profiled_consumer,admin_ops`
- `--max-targets=10`
- `--output-dir=/absolute/path`
- `--secrets-dir=/absolute/path`
- `--headed`

## Outputs

Each run writes to `tmp/owned-site-assessment/<timestamp>` by default.

Files:

- `bundle.json`
  - canonical machine-readable report bundle
- `manifest.resolved.json`
  - resolved manifest after environment-variable expansion
- `summary.md`
  - human-readable run summary

The bundle includes:

- coverage matrix
- privilege transition map
- defense backlog
- desktop probe plan
- full journey observations

## Observation Schema

Each journey observation records:

- visible DOM fields
- hidden fields inferred from bootstrap JSON or network payloads
- endpoint inventory
- auth/session mechanism hints
- UI-vs-API role guards
- pagination or lazy-load behavior
- export/download surfaces
- challenge or captcha points
- agent feasibility classification
- extraction preference

## Pending Config vs Missing Session

Targets land in different coverage states for different reasons:

- `pending-config`
  - target-level private URLs or all journey entrypoints still contain unresolved `${ENV_VAR}` placeholders
- `missing-session`
  - the role requires auth, but no storage-state file exists
- `partial`
  - some journeys ran, but not all configured journeys produced observations
- `complete`
  - all configured journeys produced observations

This separation is important because a `pending-config` issue is a manifest/setup gap, while `missing-session` is an operator/session-management gap.

## Desktop Parity

The `desktop` pass currently generates a headed/manual parity checklist instead of driving a desktop agent directly. That is deliberate:

- the repo already supports Playwright-based browser assessment
- the assessment output needs to remain reproducible and reviewable
- the parity plan is meant to tell operators which 3 flows per site/environment are worth verifying in a headed/manual session

Each probe item includes:

- target id
- journey id and label
- entry URL
- why the flow is high-value
- a short browser-pass excerpt when one exists
- a short list of manual verification steps

## Current Limitations

- The runner does not attempt to fill forms or submit non-trivial workflows automatically.
- The runner treats unresolved private routes as configuration gaps instead of guessing internal URLs.
- The `desktop` pass is a probe plan, not a full desktop-control runtime.
- Storage-state sessions must be prepared outside the runner.

## Recommended Workflow

1. Export the default manifest and fill private prod/staging/admin URLs where needed.
2. Prepare storage-state files for the authenticated roles you want to assess.
3. Run `public` first to get the guest exposure map.
4. Run `browser` for the highest-value authenticated roles.
5. Review `summary.md` and `bundle.json`.
6. Use the generated desktop parity plan for headed/manual follow-up on the top three flows per site/environment.
