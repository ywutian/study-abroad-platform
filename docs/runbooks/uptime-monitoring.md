# Uptime Monitoring Runbook

## What this is

Cloud Monitoring uptime check + alert policy that polls the API's `/health`
endpoint every 5 minutes and emails `ywu1286@gmail.com` when the response
body does not contain `"status":"ok"` for ~10 minutes continuously.

This exists because in 2026-03/04 the API ran in `"status":"degraded"` for
~6 weeks (Redis pointed at a never-existed Memorystore IP) without anyone
noticing. CI's canary smoke test had been configured to accept `degraded`
as a pass condition, so each weekly deploy quietly shipped on top of the
broken state. Both gaps are now closed:

1. This monitoring setup surfaces degraded-for-10-min within email latency.
2. `.github/workflows/ci.yml` canary + smoke tests validate deploy-critical
   checks (HTTP 200 + database ok) against the canary URL only. Redis-only
   degradation warns but does not block deploy because the app has fallbacks.

## Infra facts

- **GCP project:** `study-abroad-prod-2025`
- **Region:** `us-central1`
- **Service monitored:** Cloud Run `study-abroad-api`
- **Endpoint:** `https://study-abroad-api-1032896108391.us-central1.run.app/health`
- **Response contract (success):** HTTP 200 with JSON body containing
  `"status":"ok"` at path `data.status`. The endpoint is `@Public()`,
  so the probe needs no auth.

## Provisioning (first-time setup)

These commands were run by the operator. Kept here for
disaster-recovery / re-provisioning. IaC (Terraform) is deliberately
skipped at this stage — three small artifacts aren't worth the overhead
and the runbook is the source of truth.

### 1. Email notification channel

```bash
gcloud beta monitoring channels create \
  --project=study-abroad-prod-2025 \
  --display-name="Yitian gmail" \
  --type=email \
  --channel-labels=email_address=ywu1286@gmail.com \
  --description="Primary on-call email for study-abroad-api"
```

Capture the returned channel id (format `projects/.../notificationChannels/NNN`).

### 2. Uptime check

```bash
gcloud monitoring uptime create study-abroad-api-health \
  --project=study-abroad-prod-2025 \
  --resource-type=uptime-url \
  --resource-labels=host=study-abroad-api-1032896108391.us-central1.run.app,project_id=study-abroad-prod-2025 \
  --path=/health \
  --port=443 \
  --protocol=https \
  --period=5 \
  --timeout=10 \
  --matcher-type=contains-string \
  --matcher-content='"status":"ok"' \
  --status-codes=200
```

The `--matcher-content='"status":"ok"'` is the critical part: a 200 response
body that says `"status":"degraded"` will NOT match and the check will fail.
This is intentional for uptime monitoring even though CI deploy smoke tests
allow Redis-only degradation.

### 3. Alert policy

Authored as a YAML file because the `--notification-channels` flag takes
channel names and is clearer written out. Save as `/tmp/uptime-alert-policy.yaml`,
substituting the channel id from step 1 and the check id from step 2:

```yaml
displayName: 'study-abroad-api /health degraded'
combiner: OR
conditions:
  - displayName: 'Uptime check /health failing'
    conditionThreshold:
      filter: |
        metric.type="monitoring.googleapis.com/uptime_check/check_passed"
        AND resource.type="uptime_url"
        AND metric.labels.check_id="study-abroad-api-health"
      comparison: COMPARISON_LT
      thresholdValue: 1
      duration: 600s # 10 minutes sustained
      trigger:
        count: 1
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_FRACTION_TRUE
notificationChannels:
  - projects/study-abroad-prod-2025/notificationChannels/NNNNNNNN
alertStrategy:
  autoClose: 86400s # auto-close after 24h if never recovers (avoids zombie alerts)
```

Apply:

```bash
gcloud alpha monitoring policies create \
  --project=study-abroad-prod-2025 \
  --policy-from-file=/tmp/uptime-alert-policy.yaml
```

## Verification

### Right after creation

```bash
# Uptime check should return SUCCESS for each region
gcloud monitoring uptime list-configs --project=study-abroad-prod-2025 --format=yaml

# Alert policy should be ENABLED
gcloud alpha monitoring policies list --project=study-abroad-prod-2025 \
  --format='value(displayName,enabled)'
```

Expected: uptime check shows green across all probing regions; policy `enabled=True`.

### Fire-drill (do this at least once, ideally in a low-traffic window)

The cheapest way to prove the alert actually fires is to disable the
current Redis secret version, wait for Cloud Run to recycle, watch `/health`
flip to `degraded`, then wait for the email.

```bash
# 1. See what secret version Cloud Run currently pins
gcloud run services describe study-abroad-api \
  --project=study-abroad-prod-2025 --region=us-central1 \
  --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | grep REDIS

# 2. Disable the pinned version
gcloud secrets versions disable <N> --secret=redis-url --project=study-abroad-prod-2025

# 3. Force Cloud Run to pull (pins to a non-existent-yet :99 forces new revision that'll fail; better: flip label)
gcloud run services update study-abroad-api \
  --project=study-abroad-prod-2025 --region=us-central1 \
  --update-labels=uptime-test=$(date +%s)

# 4. Watch /health flip
watch -n 15 'curl -s https://study-abroad-api-1032896108391.us-central1.run.app/health | python3 -c "import json,sys; print(json.load(sys.stdin)[\"data\"][\"status\"])"'

# 5. After email arrives, restore
gcloud secrets versions enable <N> --secret=redis-url --project=study-abroad-prod-2025
gcloud run services update study-abroad-api \
  --project=study-abroad-prod-2025 --region=us-central1 \
  --update-labels=uptime-test-done=$(date +%s)
```

Expected email arrival: 10–15 min after `/health` first reports degraded
(5 min for uptime to notice + 10 min sustained-failure threshold, minus
overlap).

## Redis recovery loop

Redis is best-effort for deploy gating, but it is still part of the runtime
health contract. Use this sequence when `/health` reports
`checks.redis.status=degraded`.

```bash
# 1. Confirm the current public symptom.
curl -s https://study-abroad-api-1032896108391.us-central1.run.app/health \
  | python3 -m json.tool

# 2. Confirm the Secret Manager value currently used for new revisions.
gcloud secrets versions access latest \
  --secret=redis-url \
  --project=study-abroad-prod-2025

# 3. Confirm Memorystore exists, is READY, and matches the secret host.
gcloud redis instances list \
  --region=us-central1 \
  --project=study-abroad-prod-2025

# 4. Confirm Cloud Run has the VPC connector required for Memorystore.
gcloud run services describe study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --format='value(spec.template.metadata.annotations."run.googleapis.com/vpc-access-connector")'

# 5. Check recent Redis errors from the API.
gcloud run services logs read study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --limit=300 \
  | grep -iE 'redis|memorystore|ECONN|ENOTFOUND|ETIMEDOUT|NOAUTH|WRONGPASS|circuit'
```

After changing `redis-url` or Memorystore config, force a new Cloud Run
revision. Existing instances do not reread Secret Manager env vars.

```bash
gcloud run services update study-abroad-api \
  --region=us-central1 \
  --project=study-abroad-prod-2025 \
  --update-labels=redis-secret-refresh=$(date +%s)
```

Expected verification after the new revision starts:

- `/health.data.uptime` resets to a small value for the new pod.
- `/health.data.checks.database.status` is `ok`.
- `/health.data.checks.redis.status` returns to `ok`, or stays visible as
  `degraded` while the reconnect loop keeps retrying.
- `/admin/cache-health` as an admin shows
  `connection.runtime.lastReconnectAttemptAt`,
  `connection.runtime.nextReconnectAt`, and any `lastErrorKind/message`.

## Operations

### Pause (e.g. during planned maintenance)

```bash
# Snooze alert policy for 2 hours
gcloud alpha monitoring policies update <POLICY_ID> \
  --project=study-abroad-prod-2025 \
  --no-enabled
# ... do maintenance ...
gcloud alpha monitoring policies update <POLICY_ID> \
  --project=study-abroad-prod-2025 \
  --enabled
```

### Change email recipient

```bash
# Add additional channel first, THEN add it to the policy (never leave the
# policy with an empty notificationChannels list — it will silently fire to
# nobody).
gcloud beta monitoring channels create \
  --project=study-abroad-prod-2025 \
  --display-name="<new recipient>" \
  --type=email \
  --channel-labels=email_address=<addr>
# Then edit the policy YAML to reference both old+new channels, apply via
# `gcloud alpha monitoring policies update <POLICY_ID> --policy-from-file=...`
```

### Delete (e.g. tearing down staging)

```bash
gcloud alpha monitoring policies delete <POLICY_ID> --project=study-abroad-prod-2025
gcloud monitoring uptime delete study-abroad-api-health --project=study-abroad-prod-2025
# Keep notification channel unless nothing else uses it
```

## Why these thresholds

- **5-minute period** is the shortest Cloud Monitoring allows without going
  premium. Short enough to catch spiking failures, long enough to not
  spend budget.
- **10-minute sustained-failure threshold** avoids pages on transient
  glitches (cold starts, brief network blips). Most real problems last
  longer than 10 min; most false positives don't.
- **`autoClose=24h`** guarantees we don't leak zombie alerts if the email
  recipient misses the mail and the issue self-heals (e.g. Upstash free
  tier resets at 00:00 UTC).

## Known blind spots (intentional, for test-phase)

- **No Slack/PagerDuty integration** — email is sufficient while user count
  is near zero. Add before real-user launch.
- **Single notification channel** — if ywu1286@gmail.com inbox is
  unreachable, alert is invisible. Add a second channel before first
  paying customer.
- **No SLO / error-budget tracking** — just binary up/down.
- **No per-dependency alerts** — we only alert on the aggregate
  `data.status` rollup. For finer breakdown, look at Cloud Logging:
  `textPayload:"Redis error"` / `textPayload:"database"`.
