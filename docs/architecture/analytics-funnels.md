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

## Maintenance

When you add a new dashboard surface or interaction:

1. Add the event constant to `DASHBOARD_EVENTS` in `analytics.ts`
   (don't inline raw strings — names key off this catalog).
2. Add an entry to the catalog table above (event / trigger /
   properties / surface).
3. If the event participates in an existing funnel, update that
   funnel's diagram.
4. If the event introduces a new funnel concept, add a new F-section.
5. Confirm PII safety: never log raw user text, emails, names, or
   anything that wouldn't survive a GDPR data export request.
