# Dashboard Analytics Funnels

This document defines the **product analytics funnels** that key off
`DASHBOARD_EVENTS` (see `apps/web/src/lib/analytics.ts`). Each event
is a stable contract — funnel definitions below assume the event
name + property names will not change without a version bump.

If you change an event name or remove a property, **update this
document in the same PR** and call out the impact on existing
funnels in the PR description.

## History

- **2026-05 Phase 4** (this PR): wired 7 dashboard events for the
  first time. Pre-Phase-4 dashboard had ZERO event tracking, which
  meant any UX hypothesis had to be measured indirectly via
  backend-only signals (school list additions, prediction runs).

## Event catalog

| Event                                    | Trigger                                          | Properties                                                | Surface                          |
| ---------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | -------------------------------- |
| `dashboard_quick_ask_submitted`          | User submits the QuickAsk input form             | `source: 'typed'`, `messageLength: number`                | `dashboard-quick-ask.tsx`        |
| `dashboard_quick_ask_suggestion_clicked` | User clicks one of the 3 suggestion chips        | `suggestionIndex: 0\|1\|2`                                | `dashboard-quick-ask.tsx`        |
| `dashboard_quick_add_school_opened`      | User opens the QuickAddSchool popover            | (none)                                                    | `dashboard-quick-add-school.tsx` |
| `dashboard_quick_add_school_added`       | User clicks a school result and the add succeeds | `schoolId: string`, `resultsAtSelectTime: number`         | `dashboard-quick-add-school.tsx` |
| `dashboard_essay_coach_cta_clicked`      | User clicks "Continue →" on EssayCoach           | `essayId: string`, `type: 'review'\|'polish'`             | `dashboard-essay-coach.tsx`      |
| `dashboard_decision_panel_impression`    | DecisionPanel renders (dedup'd 60s TTL)          | `accepted`, `waitlisted`, `rejected`, `withdrawn: number` | `dashboard-decision-panel.tsx`   |
| `dashboard_hub_link_clicked`             | User clicks a WorkspaceHub link (16 options)     | `href: string`                                            | `dashboard-workspace-hub.tsx`    |
| `dashboard_hub_stat_clicked`             | User clicks a WorkspaceHub stat tile (9 options) | `href: string`                                            | `dashboard-workspace-hub.tsx`    |

## PII safety

Per the analytics.ts contract: callers never pass raw user text /
emails / names. The dashboard events follow this strictly:

- `dashboard_quick_ask_submitted` logs `messageLength` only, not the
  message content.
- `dashboard_quick_ask_suggestion_clicked` logs the chip index, not
  the chip text (locale-agnostic + PII-safe).
- `dashboard_quick_add_school_added` logs `schoolId` (already
  user-owned at that point — they just added it) + result count.
- `dashboard_essay_coach_cta_clicked` logs `essayId` (already
  user-owned) + result type.

## Active funnels

### F1: Dashboard AI conversion

```
dashboard_quick_ask_submitted              [step 1 — typed input]
  + dashboard_quick_ask_suggestion_clicked [step 1 — chip input]
                ↓
[FloatingChat conversation continues]
                ↓
[next-day return visit?]
```

**Question**: Of users who use Quick Ask once, how many come back
within 24h? Compares against the baseline of dashboard visit alone.

### F2: Quick Add School conversion

```
dashboard_quick_add_school_opened
                ↓ (denominator)
dashboard_quick_add_school_added
                ↓ (numerator)
[conversion rate]
```

**Question**: What fraction of popover opens result in an add?
Sub-question: does `resultsAtSelectTime` correlate with conversion
(do users abandon when the search is noisy)?

### F3: EssayCoach click-through

```
[dashboard rendered with essayCoach surface]
                ↓
dashboard_essay_coach_cta_clicked
                ↓
[user lands on /essays — measure with separate event]
```

**Question**: Compare CTR by `type: 'review'` vs `type: 'polish'`.
Hypothesis: review (with actionable suggestion) drives higher CTR.

### F4: Stage G engagement

```
dashboard_decision_panel_impression        [Stage G material exists]
                ↓
dashboard_hub_link_clicked { href: '/timeline' }  OR
dashboard_quick_ask_submitted                       (post-impression)
                ↓
[engagement signal]
```

**Question**: Are users who see the DecisionPanel more likely to
take any subsequent dashboard action than the baseline?

### F5: Hub navigation distribution

```
dashboard_hub_link_clicked + dashboard_hub_stat_clicked
        ↓ grouped by href
[which Hub destinations are actually used]
```

**Question**: Which 4 of the 16+ Hub links account for 80% of the
traffic? Use this to inform Phase 5 RSC code-split priorities (lazy
load the rarely-used routes).

## Future funnels (gaps to wire)

Several dashboard surfaces have been **shipped without analytics
wiring** — listed here so the gap is visible and gets closed before
each becomes a guessing-game.

### Gap A: Outcome labeling adoption (Phase 2.6 #26)

The "Label result" CTA on PipelineStrip decision rows links to
`/prediction?label=outcome&schoolId=…` but emits no event. We can't
currently answer "what fraction of decided rows get their outcome
labeled?" — and that fraction IS the data-flywheel adoption metric.

To close: add `dashboard_outcome_label_cta_clicked` with
`{ schoolId, decisionStatus }`. F6 below would activate immediately.

### Gap B: Referral entry traffic (Phase 2.6 #25)

The new "Invite & Earn" tile fires `dashboard_hub_link_clicked` with
`href: '/referral'` (it shares the existing Hub event). That works
for F5 distribution but doesn't separate "Invite tile interest" from
ambient Hub browsing.

To close: optional — add a dedicated tile-impression dimension or
accept the Hub event as good-enough proxy.

### Gap C: AI workspace migration (Phase 2.5d)

The "Open full AI workspace" link in QuickAsk is a `<Link>` with no
`onClick={trackEvent}`. We can't tell whether users actually
discover the full /ai workspace via this affordance vs landing
directly.

To close: add `dashboard_quick_ask_workspace_link_clicked` (no
properties needed — single-purpose event).

### Gap D: Dashboard tour engagement (Phase 2.7 #27)

The driver.js tour has `onComplete` / `onSkip` callbacks but no
trackEvent wiring. We can't currently answer "what fraction of
first-visit users complete the tour vs skip after step 1?" — which
is core onboarding signal.

To close: in the registerTour() call from `dashboard/page.tsx`, pass
`onComplete` and `onSkip` that emit `dashboard_tour_completed` and
`dashboard_tour_skipped` (with `lastStepReached` for the skip path).

## Active funnels

### F6: Outcome labeling adoption _(blocked on Gap A above)_

```
dashboard_decision_panel_impression          [Stage G surface viewed]
                ↓ (per ACCEPTED/REJECTED/WAITLISTED row)
dashboard_outcome_label_cta_clicked          [user starts to label]
                ↓
[backend PredictionResult.outcomeLabel = …]  [calibration data captured]
```

**Question**: What fraction of decided rows generate an outcome
label within 7 days of the decision appearing on the dashboard? This
is Lumni's **data-flywheel adoption rate** — the metric that
quantifies the moat.

### F7: Tour engagement _(blocked on Gap D above)_

```
[first dashboard visit] → tour auto-starts after 800ms
                ↓
dashboard_tour_skipped { lastStepReached: 1|2|3|4 }    OR
dashboard_tour_completed
                ↓
[7-day retention by tour outcome]
```

**Question**: Do users who **complete** the dashboard tour have
better D7/D14 retention than those who skip on step 1? If completion
correlates with retention, invest more in step quality; if it
doesn't, drop the tour entirely.

## Auxiliary telemetry (not DASHBOARD_EVENTS)

### Web Vitals → Sentry

`WebVitalsReporter` in `components/observability/web-vitals-reporter.tsx`
forwards Core Web Vitals (LCP / INP / CLS / FCP / TTFB) to Sentry as
breadcrumbs + transaction attributes. NOT a `DASHBOARD_EVENTS` event;
queryable in **Sentry Performance**, not the analytics pipeline.

Performance regression alarms should key off Sentry P75 thresholds:
| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | ≤2.5s | ≤4s | >4s |
| INP | ≤200ms | ≤500ms | >500ms |
| CLS | ≤0.1 | ≤0.25 | >0.25 |

### Feature-flag evaluations (`useFeatureFlag`)

The Phase 4 #35 hook fires no analytics event — flag evaluations are
intentionally invisible. If you want to **A/B test** an experience
gated by a flag, you must emit the experiment exposure event
yourself at the point the flag forks behavior (e.g., before rendering
the variant).

## Sampling & retention

- All `trackEvent` calls flow through `lib/analytics.ts` which **no-ops
  in development** (NODE_ENV !== 'production'). Local dev does not
  pollute production analytics.
- No client-side sampling — every event is sent. If a high-volume
  event is added (e.g., scroll), consider rate-limiting at the
  surface or sampling in `trackEvent` itself.
- Sentry breadcrumbs (Web Vitals) follow the existing
  `sentry.client.config.ts` `tracesSampleRate` (10% in prod).

## Maintenance

When you add a new dashboard surface or interaction:

1. Add the event constant to `DASHBOARD_EVENTS` in `analytics.ts`
   (don't inline raw strings — names key off this catalog).
2. Add an entry to the **Event catalog** table at the top.
3. If the event participates in an existing funnel, update that
   funnel's diagram.
4. If the event introduces a new funnel concept, add a new F-section.
5. If you shipped a surface **without** events, add a `Gap` entry to
   "Future funnels" so the absence is tracked.
6. Confirm **PII safety**: never log raw user text, emails, names,
   or anything that wouldn't survive a GDPR data export request.
7. Confirm **i18n safety**: never log translated labels — use stable
   identifiers (href, schoolId, suggestionIndex) so analytics joins
   across locale.
