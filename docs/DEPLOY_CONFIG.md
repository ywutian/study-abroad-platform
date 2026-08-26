# Deploy Configuration

**Last updated:** 2026-08-24

GCP Cloud Run deploy config got fixed 10+ times — VPC connector, Cloud SQL,
secrets, Cloud Run flags — across **five** workflows that each inline the same
constants, including an explicit _"sync deploy config between CI and manual
workflow"_. The shared values kept drifting because nothing tied them together.

## Single source of truth

`.github/deploy-config.json` declares the canonical shared constants:

| Key                                  | Value                                           | Used by                                            |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| `vpcConnector`                       | `study-abroad-connector`                        | every `--vpc-connector` flag                       |
| `artifactRegistry`                   | `study-abroad/api`                              | every `…-docker.pkg.dev/$PROJECT/<here>` image     |
| `regionSecret`                       | `GCP_REGION`                                    | every `--region` (via `${{ secrets.GCP_REGION }}`) |
| `projectSecret`                      | `GCP_PROJECT_ID`                                | project id                                         |
| `services.prod` / `services.staging` | `study-abroad-api` / `study-abroad-api-staging` | `gcloud run deploy` target                         |

Deploy workflows (`ci.yml`, `deploy-staging.yml`, `preview.yml`,
`preview-cleanup.yml`, `school-media-backfill.yml`) still inline these values in
their `gcloud` commands — but `check-deploy-config-drift.ts` enforces that every
inline value matches the canonical source, so they can no longer diverge.

## Guardrail

`pnpm lint:deploy-drift` (in `lint:all`) asserts, across all deploy workflows:

- the VPC connector name matches `vpcConnector`,
- the Artifact Registry image matches `artifactRegistry`,
- the region comes from `${{ secrets.GCP_REGION }}` — **never a hardcoded region**.
- the production image digest is attested and verified against the source commit
  and signer workflow before both migration and Cloud Run deployment.

Read-only over the YAML — zero deploy risk, runs locally.

## Scheduled jobs (Cloud Scheduler — `CRON_DRIVER=http`)

Production runs **no in-process `@Cron` timers**. A timer needs background CPU,
and this service deploys with `--cpu-throttling` + `min-instances=0`, where CPU
exists only during a request — timers there starve, blow the client-side Redis
deadline, trip the circuit breaker, and single-flight crons silently skip
(#553: 60–85 breaker trips/day for a month; AccountPurgeService never completed
a run). Instead, schedules arrive **as requests**:

- `.github/cron-jobs.json` — generated manifest, one entry per `@Cron`
  (`pnpm lint:cron-manifest --update`; freshness enforced in `lint:all` and
  proven by `scripts/gate-proofs/check-cron-manifest.proof.ts`).
- `scripts/ci/sync-cloud-scheduler.mjs` — on each prod deploy, upserts one
  Cloud Scheduler job per entry (`api-cron-<name>` → `POST
/api/v1/internal/cron/<name>/run`, header `x-cron-secret`), prunes stale
  `api-cron-*` jobs. Console edits don't survive the next deploy — the
  manifest is the source of truth.
- `scripts/ci/assert-cron-manifest.mjs` — after traffic promotion, asserts four
  things and fails the deploy next to the rollback step if any is off: the
  dispatcher **refuses an unauthenticated caller** (401), the secret
  round-trips, the live registry matches the manifest exactly, and the service
  reports `driver=http` with **zero in-process timers** (the last one is what
  catches `CRON_DRIVER` silently dropping out of `--set-env-vars`, which would
  otherwise restore #553 with every check still green). Stale schedules are
  pruned in a **separate step after** this assert — rollback reverts traffic,
  not scheduler topology.
- The POST answers only after the job finishes (that's what holds the CPU), so
  the service deploys with `--timeout=1800` and scheduler jobs use
  `--attempt-deadline=1740s`. A job that outgrows ~29 minutes needs Cloud Run
  Jobs — split it rather than raising these.
- **Staging & preview set `CRON_DRIVER=http` with no `CRON_SECRET` and no
  scheduler jobs — scheduled work there is deliberately OFF** (the dispatcher
  is fail-closed 401). To exercise a job outside prod, set a `CRON_SECRET` and
  `curl -X POST -H "x-cron-secret: …" <url>/api/v1/internal/cron/<name>/run`,
  or run it in dev where `CRON_DRIVER=timer` fires timers in-process.
- Manual prod run: `gcloud scheduler jobs run api-cron-<name> --location=<region>`.
- **Alerting**: Cloud Monitoring policy _"Scheduled job did not run
  (study-abroad-api)"_ (created 2026-08-05) fires on a `Cron NOT RUN` log line
  or a 5xx from `/internal/cron/`, and emails the project's notification
  channel, rate-limited to one per hour.

  This replaced `pingCronHeartbeat`, deleted the same day. That helper was
  wired into four crons and pinged `<HEALTHCHECK_PING_BASE_URL>/<slug>` on
  success — but the variable was never configured in any environment, so the
  dead-man's-switch was a no-op, **and a unit test pinned the no-op as correct
  behaviour**. It also could not have caught anything Cloud Scheduler doesn't
  already record: Scheduler stores every attempt and its response, so the gap
  was never _detection_, it was that nobody was being told.

  A metric-based policy on `cloudscheduler.googleapis.com/job/attempt_count`
  would be the more direct expression, but that metric has no descriptor in
  this project until the jobs have actually produced attempts, and the API
  rejects a policy referencing it. Revisit once metrics exist.

### AI Agent Harness alerts

`AlertChannelService` is durable by default: it stores only an opaque alert
fingerprint, severity, trusted source label, occurrence count and timestamps in
Redis before a delivery is attempted. It never stores or forwards the original
alert title/message, tool arguments, trace ids, user ids or metadata. Cloud
Scheduler invokes `alert-channel-service-deliver-pending-alerts` every minute;
that job aggregates across instances, retries failed external delivery with
exponential backoff, records sanitized delivery status, and leaves an alert
active until an administrator acknowledges it.

Redis is the durable source of truth for the admin API/acceptance evidence. The
scheduled `AI Agent Harness alert monitor` GitHub Actions workflow checks that
queue every 15 minutes through the sanitized admin endpoint and fails while an
alert remains active, using the repository's existing protected administrator
credential. GitHub therefore supplies the default human notification path
without adding another webhook secret. The workflow logs severity counts only,
never alert ids, messages, tool arguments or user data. Production acceptance
proves the matching alert is persisted, then acknowledges its synthetic alert
so the monitor returns to green.

For a lower-latency or independent human notification path, configure exactly
one protected external channel in the deploy secret store:

- `ALERT_SLACK_WEBHOOK`, `ALERT_WECHAT_WEBHOOK`, `ALERT_DINGTALK_WEBHOOK`, or
  `ALERT_PAGERDUTY_ROUTING_KEY`; or
- `ALERT_EMAIL_ENABLED=true`, non-empty `ALERT_EMAIL_RECIPIENTS`, and
  `RESEND_API_KEY`.

An email configuration without `RESEND_API_KEY` is explicitly reported as
`email` unavailable and is **not** counted as delivered; do not use a placeholder
address such as `admin@example.com`. The admin Harness alert endpoint exposes
configured/unavailable channels, active opaque alerts, and their sanitized
delivery log. Acknowledgement removes the alert from both active and delivery
indexes; the database audit log retains the authorised actor/optional note.

One-time GCP setup (already-applied steps are idempotent):

```bash
gcloud services enable cloudscheduler.googleapis.com --project=<project>
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create cron-secret --data-file=- --project=<project>
# deploy SA = the service account GitHub Actions deploys with
gcloud projects add-iam-policy-binding <project> \
  --member="serviceAccount:<deploy-sa>" --role="roles/cloudscheduler.admin"
# Both SAs need to read the secret: the deploy SA reads it in the sync/assert
# steps, the Cloud Run runtime SA has it mounted as CRON_SECRET.
for SA in <deploy-sa> <cloud-run-runtime-sa>; do
  gcloud secrets add-iam-policy-binding cron-secret --project=<project> \
    --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
done
```

**Measured 2026-08-05: `gcloud scheduler jobs describe` prints the
`x-cron-secret` header value in plaintext.** (Probed with a throwaway job and a
dummy header, then deleted.) So the secret's real audience is _every principal
with `cloudscheduler.jobs.get`_, not just the deploy SA.

Today that is nobody extra — `study-abroad-prod-2025` has exactly one human
(`user:yunzhi@yungrace.com`, owner) plus the deploy and runtime service
accounts, and all three can already read the secret directly through
`roles/secretmanager.secretAccessor`. So the exposure is currently zero-width,
and the shared secret stands.

**It stops being acceptable the moment anyone else gets read access to this
project** — a Viewer, an auditor, a contractor, a CI integration. At that point
migrate to the Cloud Scheduler OIDC token flow documented in
`cron-secret.guard.ts` (scheduler job gets `--oidc-service-account-email`, the
guard verifies the token instead of comparing a string). Granting the first
extra principal is the trigger; do not wait for an incident.
`account-purge-service-scheduled-purge` sits behind this auth.

Rotating the secret: add a new `cron-secret` version, redeploy (the service
mounts `:latest`, and the sync step rewrites every scheduler job's header).

## Changing deploy config safely

1. Update the value in `.github/deploy-config.json` AND in every workflow that
   references it, in the **same PR**. `pnpm lint:deploy-drift` fails if you miss one.
2. **Per-environment secret names** (`database-url-proxy` vs `database-url-proxy-staging`,
   etc.) intentionally differ per env and are NOT drift-checked.
3. For risky command changes (new flags, VPC/Cloud SQL wiring), prefer a
   `gcloud run deploy --dry-run` (or deploy to **staging** first) before prod —
   this config cannot be fully validated locally.

## Not done here (deliberate)

This pass did **not** rewrite the deploy commands into a shared composite action
(`gcloud run deploy` logic is unverifiable without real GCP credentials, so a
blind rewrite would risk breaking prod deploys). The drift guard + single source
close the actual recurrence — _config silently diverging_ — without that risk. A
composite-action consolidation is a sensible, separately-verified follow-up.

## Merged ≠ production

This is the merged ≠ production boundary. `ci.yml` on `push` to `main`
deploys a tagged **GCP API validation revision** (`--no-traffic`, then an isolated
smoke test and Cron Registry check, then a direct atomic shift to 100%). The
workflow step retains the historical `canary` name, but no 5%/25% user-traffic
stage is used. The web app is a separate Vercel deploy. There is no
`deploy-prod.yml`.

A green merge therefore does **not** mean a student already sees the fix:

- API canary can pass while production traffic still sits on the previous
  revision.
- Vercel web can lag or fail independently of the API job.
- `migrate.sh` used to fail-soft user-visible seeds (calendar, forum chips,
  match pools). A green Cloud Run job was not proof those tables had rows.
- User-facing copy and `ACCOUNT_PURGE_ENABLED` can drift from each other
  unless `lint:deletion-promise` is green.

For the Agent Harness production revision, keep these non-secret values explicit
in the Cloud Run deploy command so release drift remains reviewable:

- `AI_AGENT_HARNESS_V1`, `AI_AGENT_HARNESS_MODE`,
  `AI_AGENT_APPROVALS_V1`, `AI_AGENT_CONTEXT_V1`
- `AI_AGENT_ACCEPTANCE_V1=true` enables admin-issued, one-shot synthetic
  acceptance grants; grants remain user-scoped, expire after five minutes, and
  can only inject failure or reduce a run budget.
- `AI_AGENT_MAX_TOKENS_PER_RUN`, `AI_AGENT_MAX_DURATION_MS`
- `AI_AGENT_APPROVAL_TTL_MS`, `AI_AGENT_RUN_TTL_MS`,
  `AI_AGENT_EXECUTION_LEASE_MS`, `AI_AGENT_CONTEXT_RECENT_MESSAGES`
- `AI_AGENT_RUN_RETENTION_DAYS=90`
- `AI_AGENT_TRACE_RETENTION_DAYS=30`
- `AI_AGENT_SKILLS_V1`, `AI_AGENT_SKILLS_EVOLUTION_V1`, and
  `AI_AGENT_SKILLS_AUTO_PUBLISH_V1`; startup validation enforces this dependency
  order and every flag defaults off outside reviewed deployment config.

`lint:ai-agent-env-docs` compares the validated `AI_AGENT_*` schema with both
`ENV_TEMPLATE.md` and the production Cloud Run deploy command. Adding or
removing a Harness setting without updating all three locations fails locally,
in pre-push, and in CI.

`lint:ai-agent-doc-facts` independently derives the Agent and ToolName counts
from source, checks ToolName/ToolMetadata exhaustiveness, and fails if the module
BRIEF or AI architecture keeps a stale count.

The production image is promoted by Artifact Registry digest. CI captures that
digest from the successful SHA-tagged Docker push, so digest pinning does not
depend on the broader Container Analysis API permission. CI then creates a
keyless GitHub SLSA provenance attestation after push, verifies its repository,
signer workflow, source commit and digest, and only then runs migrations and
`gcloud run deploy` with `IMAGE@sha256:...`. The short-SHA and `latest` tags are
discovery aliases, not deployment identities.

The post-promote closure is not complete until the stable URL is healthy, the
live Cron Registry matches the generated manifest, Cloud Scheduler is synced,
the Cloud SQL read-only backup/PITR gate passes, the sanitized Harness artifact
validates, the independent alert monitor is clear, and the previous production
revision remains available for rollback. CI invokes the production acceptance
runner through direct Node/tsx, not a nested package-manager command, so JSONL
evidence cannot be polluted by lifecycle output.

Do not write "landed on main, so production is fixed."
