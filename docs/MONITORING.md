# Production Health Monitoring & Alerting

Enterprise principle: **monitoring must be external and independent of the thing
it monitors.** A health-poller that runs _inside_ the app can't alert you when
the app (or its region) is down — that's the exact moment you need it. So the
layers below are ordered from "independent black-box" outward.

Stack: web on **Vercel**, API on **GCP Cloud Run**, PostgreSQL + Redis.

---

## 0. The probe target (shipped)

`GET https://www.lumniedu.com/api/v1/health/check`

- Public, unauthenticated, throttle-exempt. Reuses the same deep checks as the
  in-cluster `GET /health` (which is excluded from the `/api/v1` prefix and only
  reachable by Cloud Run's own probes, so it is **not** usable for external
  monitoring).
- Exercises the full path: **Vercel proxy → Cloud Run → DB + Redis**.
- Returns `200` when healthy or degraded-by-latency, **`503` when a core
  dependency is down** (DB unreachable / pending migrations). Body:
  `{ status: "ok"|"degraded"|"error", checks: { database, redis }, ... }`.
- (Optional) also monitor the **direct Cloud Run URL** to isolate the backend
  from Vercel — find it with `gcloud run services describe <svc> --format='value(status.url)'`.

---

## Layer 1 — GCP Cloud Monitoring uptime check (native, free tier)

Lives in the same project as the Cloud Run API; no new vendor. Free tier covers
1-minute checks from multiple regions.

```bash
# 1) Email notification channel ("the key email")
gcloud beta monitoring channels create \
  --display-name="Prod Alerts (oncall)" \
  --type=email \
  --channel-labels=email_address=ALERTS@YOURDOMAIN.com
# -> note the returned channel id: projects/$PROJECT_ID/notificationChannels/XXXX

# 2) Uptime check against the public deep-health endpoint
gcloud monitoring uptime create "lumni-api-health" \
  --resource-type=uptime-url \
  --resource-labels=host=www.lumniedu.com \
  --path="/api/v1/health/check" \
  --port=443 --protocol=https \
  --period=60s --timeout=10s

# 3) Alert policy: page after 2 consecutive failures (avoids single-blip noise),
#    notify the email channel from step 1. Create via Console
#    (Monitoring → Uptime → ⋮ → Add alert policy) or Terraform (below).
```

> Console quickstart (no CLI): Monitoring → **Uptime checks** → _Create_, point at
> `www.lumniedu.com` `/api/v1/health/check`, then **Add alert policy** and attach
> the email channel. Docs: https://docs.cloud.google.com/monitoring/uptime-checks/uptime-alerting-policies

Beyond up/down, add alert policies on **Cloud Run metrics** (5xx rate, p95
latency, container instance crashes) and **Cloud SQL / Redis** metrics — "slow"
and "erroring" matter as much as "down".

### Terraform (version-controlled — fits the repo's `lint:deploy-drift` culture)

```hcl
resource "google_monitoring_notification_channel" "email" {
  display_name = "Prod Alerts (oncall)"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "lumni-api-health"
  timeout      = "10s"
  period       = "60s"
  http_check {
    path         = "/api/v1/health/check"
    port         = 443
    use_ssl      = true
    accepted_response_status_codes { status_class = "STATUS_CLASS_2XX" }
  }
  monitored_resource {
    type   = "uptime_url"
    labels = { host = "www.lumniedu.com" }
  }
}

resource "google_monitoring_alert_policy" "api_down" {
  display_name = "API health check failing"
  combiner     = "OR"
  conditions {
    display_name = "Uptime check failed"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.api_health.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "120s" # 2 consecutive 60s failures
      trigger { count = 1 }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
      }
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}
```

---

## Layer 2 — Independent external monitor ("monitor the monitor", free)

GCP monitoring lives in GCP; if GCP/the project itself has a problem, it can't
reliably alert. A second, independent vendor closes that gap.

- **UptimeRobot** (free: 50 monitors, 5-min checks) — add two HTTP(s) monitors:
  1. `https://www.lumniedu.com/` (the Vercel front door)
  2. `https://www.lumniedu.com/api/v1/health/check` (deep API+DB+Redis)
     Alert contact = the same key email (+ ideally a Slack/SMS contact).
- Upgrade path if you want incident management + on-call + a status page:
  **Better Stack** (30s checks, escalation, status page).

---

## Layer 3 — Error alerting (Sentry — already wired)

Sentry is already integrated (`common/sentry/`). In the Sentry project, add
alert rules: "new issue" and "error rate spiked" → the key email / Slack. This
catches application exceptions that a health check (which only probes liveness)
never sees.

---

## Layer 4 — Cron dead-man's-switch (free, do later)

Up/down checks don't tell you a **scheduled job silently stopped running** — a
different failure mode from the ones hardened in `cron-lock.util` (which fix
_how_ a cron behaves, not _whether_ it ran). See
[[project_cron_single_flight_audit]].

- **Healthchecks.io** (free): create one check per `@Cron`, each with the cron's
  expected schedule + a grace window. Have the job `GET` its ping URL on success.
  If a daily job misses its window → alert. The codebase's crons already log
  completion; adding a single `fetch(pingUrl)` on success wires this up.

---

## The "key email"

- Use a **dedicated alias** (e.g. `alerts@…` / a group), not a personal inbox, so
  on-call can change without touching configs.
- **Don't rely on email alone** — it can delay or land in spam. Add at least one
  second channel (Slack webhook or SMS) on the _down_ policy.
- Tune for **2 consecutive failures** before paging (kills single-blip noise) and
  review/prune noisy alerts periodically to avoid alert fatigue.

## Quick reference

| Signal                            | Tool                     | Channel             |
| --------------------------------- | ------------------------ | ------------------- |
| API/web up-down (end-to-end)      | GCP uptime + UptimeRobot | email (+ Slack/SMS) |
| Cloud Run 5xx / latency / crashes | GCP alert policies       | email/Slack         |
| Application exceptions            | Sentry                   | email/Slack         |
| Cron didn't run                   | Healthchecks.io          | email               |
