/**
 * Product analytics abstraction.
 *
 * Goals:
 *  - Zero-config dev experience: `trackEvent` just logs to the console so
 *    engineers can verify funnels locally without touching env files.
 *  - Provider-agnostic: consumers call `trackEvent('team_card_swiped', {...})`
 *    without importing any SDK. The sink is chosen by
 *    `NEXT_PUBLIC_ANALYTICS_SINK` — future PostHog / Mixpanel integrations
 *    plug in here without touching call sites.
 *  - PII-safe by default: callers are responsible for not passing raw email /
 *    names / free-text; this module never inspects payload contents to avoid
 *    giving a false sense of safety.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

type Sink = 'console' | 'none' | 'posthog' | 'mixpanel';

function resolveSink(): Sink {
  if (typeof window === 'undefined') return 'none';
  const raw = (process.env.NEXT_PUBLIC_ANALYTICS_SINK ?? '').toLowerCase();
  if (raw === 'posthog' || raw === 'mixpanel' || raw === 'none') return raw;
  // Default: verbose in dev, silent in prod until a real sink is configured.
  return process.env.NODE_ENV === 'development' ? 'console' : 'none';
}

const sink: Sink = resolveSink();

/**
 * Fire-and-forget event tracking. Safe to call from render paths — no
 * network activity when the sink is 'none'.
 */
export function trackEvent(name: string, props: EventProps = {}): void {
  if (sink === 'none') return;

  if (sink === 'console') {
    console.debug('[analytics]', name, props);
    return;
  }

  // Future: PostHog / Mixpanel dynamic imports keyed off `sink`. We bail
  // silently today so production builds don't pull in any SDK until a team
  // explicitly opts in.
  if (typeof window === 'undefined') return;
}

// ── Impression dedupe ──────────────────────────────────────
// Card impressions fire during render; without dedupe the same card would
// log once per React re-render. Keep a bounded in-memory set of keys with
// a 60s TTL so repeated renders of the same deck stay quiet.

const SEEN_IMPRESSIONS = new Map<string, number>();
const IMPRESSION_TTL_MS = 60_000;
const IMPRESSION_CAP = 500;

function gcImpressions(now: number) {
  if (SEEN_IMPRESSIONS.size < IMPRESSION_CAP) return;
  for (const [key, ts] of SEEN_IMPRESSIONS) {
    if (now - ts > IMPRESSION_TTL_MS) SEEN_IMPRESSIONS.delete(key);
  }
}

/**
 * Deduplicated impression event. Call on every render of a given card —
 * only the first call within the TTL window hits the sink.
 */
export function trackImpression(dedupeKey: string, name: string, props: EventProps = {}): void {
  const now = Date.now();
  const last = SEEN_IMPRESSIONS.get(dedupeKey);
  if (last != null && now - last < IMPRESSION_TTL_MS) return;
  SEEN_IMPRESSIONS.set(dedupeKey, now);
  gcImpressions(now);
  trackEvent(name, props);
}

// ── Team-domain event names (typed for discoverability) ────
// Keep the names stable — downstream funnel definitions will key off them.

export const TEAM_EVENTS = {
  poolViewed: 'team_pool_viewed',
  cardImpression: 'team_card_impression',
  cardSwiped: 'team_card_swiped',
  cardCreated: 'team_card_created',
  cardPublished: 'team_card_published',
  matchActivated: 'team_match_activated',
} as const;

// ── Dashboard event taxonomy (Phase 4) ─────────────────────
// Surfaces user actions on the dashboard for funnel analysis. Names
// follow snake_case and are stable contracts — funnel definitions in
// docs/analytics-funnels.md key off them. Add new events here BEFORE
// calling trackEvent so consumers get autocomplete + the analytics
// review can audit the catalog in one place.
//
// See plan: dashboard-commit-agent-merry-platypus.md Phase 4

export const DASHBOARD_EVENTS = {
  // Quick Ask AI — the dashboard's primary AI surface
  quickAskSubmitted: 'dashboard_quick_ask_submitted',
  quickAskSuggestionClicked: 'dashboard_quick_ask_suggestion_clicked',
  // 2026-05 Gap C closure: tracks discoverability of the full
  // /ai workspace via the QuickAsk "Open full AI workspace" link.
  quickAskWorkspaceLinkClicked: 'dashboard_quick_ask_workspace_link_clicked',
  // Quick Add School — the popover that adds schools without leaving dashboard
  quickAddSchoolOpened: 'dashboard_quick_add_school_opened',
  quickAddSchoolAdded: 'dashboard_quick_add_school_added',
  // EssayCoach + DecisionPanel — Phase 2c/2a surfaces
  essayCoachCtaClicked: 'dashboard_essay_coach_cta_clicked',
  decisionPanelImpression: 'dashboard_decision_panel_impression',
  // 2026-05 Gap A closure: outcome-label CTA on PipelineStrip decision
  // rows. Activates funnel F6 (data-flywheel adoption) — measures the
  // fraction of decided rows that flow into prediction calibration.
  outcomeLabelCtaClicked: 'dashboard_outcome_label_cta_clicked',
  // Hub — workspace navigation
  hubLinkClicked: 'dashboard_hub_link_clicked',
  hubStatClicked: 'dashboard_hub_stat_clicked',
  // 2026-05 Gap D closure: first-visit tour engagement. Activates
  // funnel F7 (tour outcome → D7 retention correlation).
  tourCompleted: 'dashboard_tour_completed',
  tourSkipped: 'dashboard_tour_skipped',
} as const;
