import { Logger } from '@nestjs/common';

/**
 * Dead-man's-switch heartbeat for `@Cron` jobs.
 *
 * On a SUCCESSFUL run the job pings `<HEALTHCHECK_PING_BASE_URL>/<slug>`. If the
 * ping doesn't arrive within the heartbeat service's expected schedule + grace
 * window, the service (Healthchecks.io / Better Stack) alerts — catching "the
 * scheduled job silently stopped running", a failure mode that up/down uptime
 * monitoring cannot see. See docs/MONITORING.md (Layer 4).
 *
 * - **No-op when `HEALTHCHECK_PING_BASE_URL` is unset** (dev / not yet wired), so
 *   it's safe to ship before the heartbeat service exists, then arm it by setting
 *   one env var.
 * - **Never throws** — a heartbeat outage must not break the cron. Failures are
 *   logged at warn and swallowed.
 * - Bounded by a 5s timeout so a hung ping endpoint can't stall the job.
 */
export async function pingCronHeartbeat(
  slug: string,
  logger?: Logger,
): Promise<void> {
  const base = process.env.HEALTHCHECK_PING_BASE_URL;
  if (!base) return; // not configured — no-op

  const url = `${base.replace(/\/+$/, '')}/${slug}`;
  try {
    await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) });
  } catch (error) {
    logger?.warn(
      `Cron heartbeat ping failed for "${slug}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
