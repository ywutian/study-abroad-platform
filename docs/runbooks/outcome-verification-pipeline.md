# Outcome Verification Pipeline — Plan A

Last updated: 2026-05-09

## Why this exists

The prediction system is structurally complete (counselor-cold-start-v1.7-launch) but **cannot promote calibration or claim accuracy until verified outcomes accumulate**. Today:

```
verifiedCount = 0
calibrationPromotionAllowed = false
externalAccuracyClaimAllowed = false
```

This is enforced by `apps/api/scripts/verify-prediction-launch.ts` (`outcomeInventory.verifiedCount >= 50` and `>= 200` thresholds).

Until verified outcomes exist, every "improve accuracy" task is bounded by heuristic priors. **Building this pipeline is the only way the bound moves.**

## Current state (2026-05-09)

| Signal                                         | Count               |
| ---------------------------------------------- | ------------------- |
| `AdmissionCase` rows total                     | 99                  |
| `AdmissionCase` `isVerified=true`              | 8                   |
| `AdmissionCase` `reviewStatus = AUTO_APPROVED` | 20                  |
| `PredictionResult` rows                        | 476                 |
| `PredictionResult` rows with `actualResult`    | 5                   |
| `OutcomeStatus = SELF_REPORTED` rows           | 10 (all `ADMITTED`) |

The data exists but is not flowing into a verified label pipeline.

## Required outcome volume

| Stage                  | Verified outcomes               | Unlocks                                                                   |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Cold-start (today)     | 0                               | Heuristic only                                                            |
| Bootstrap              | ≥ 50                            | Platt scaling per selectivity tier in `prediction-calibration.service.ts` |
| Production calibration | ≥ 200                           | External accuracy claims, public ECE/Brier reporting                      |
| Per-cohort isotonic    | ≥ 50 / cohort × 5 cohorts = 250 | Cohort-specific calibration curves                                        |

The shortest realistic path to ≥ 50 is **users self-reporting after the next admit cycle (Mar–May)**.

## Pipeline design

```
┌──────────────┐      ┌─────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ User submits │──▶   │ SELF_REPORT │──▶   │ Verification     │──▶   │ VERIFIED         │
│ outcome      │      │ status      │      │ workflow (admin) │      │ status, used in  │
│              │      │             │      │                  │      │ Platt fitting    │
└──────────────┘      └─────────────┘      └──────────────────┘      └──────────────────┘
       ▲
       │  prompt
       │
┌──────┴────────────┐
│ Outcome reminder  │
│ (post-decision    │
│  email + UI)      │
└───────────────────┘
```

### Stage 1 — Collection (already exists)

- `OutcomeStatus.SELF_REPORTED` rows can be created via the existing prediction outcome endpoint
- Verified by `verification-report/launch/contract.json` fixture: `selfReportedStatusSupported: true`
- Required to-do: surface a "report your outcome" prompt at the right moment in the user flow

### Stage 2 — Verification

Three verification mechanisms, in order of automation:

| Method                | Trust level | Implementation                                                                                                                                                                        |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain-tied email** | High        | User clicks confirmation link sent to `<student>@<school>.edu` after self-report; matches student email domain to admitting school. Auto-flips status to `VERIFIED`.                  |
| **Document upload**   | High        | User uploads admission letter PDF; admin reviews in batch (similar to existing AdmissionCase review).                                                                                 |
| **Pattern detection** | Medium      | Auto-flag suspicious self-reports: same IP submitting multiple ADMITTED outcomes; outcomes inconsistent with user profile (e.g. 2.0 GPA → admitted Stanford). Defer to manual review. |

The contract is already in place — `PredictionOutcomeLabelStatus` supports
`SELF_REPORTED`, `REQUEST_EVIDENCE`, `COUNSELOR_VERIFIED`,
`DOCUMENT_VERIFIED`, `REJECTED`, `CONFLICTED`, and `CENSORED`. Admin review can
therefore request evidence or reject a label without converting it into
calibration truth.

### Stage 3 — Calibration promotion

When verified count crosses thresholds, auto-flip the launch verifier flags:

```typescript
calibrationPromotionAllowed: outcomeInventory.verifiedCount >= 50;
externalAccuracyClaimAllowed: outcomeInventory.verifiedCount >= 200;
```

Once `calibrationPromotionAllowed = true`, run Platt scaling per selectivity tier (cold-start framework already in place at `apps/api/src/modules/prediction/prediction-calibration.service.ts`).

## Concrete to-do list

### P0 (block calibration promotion)

- [ ] **Outcome reminder dispatcher** — cron job sends email at 5/15 and 5/30 to users whose `SchoolListItem` is past expected decision date and has no `OutcomeStatus`. Hooks into existing `notification` module.
- [ ] **In-app outcome prompt** — when user opens the prediction page after the decision month for any of their schools, show a non-dismissible card: "Did you hear back from Harvard? Help us improve predictions for next year's applicants."
- [x] **Admin batch verification UI** — calibration outcomes tab lists self-reported labels and can mark verified, request evidence, reject, conflict, or censor. Pattern flags are surfaced for reviewer priority.

### P1 (improve verification quality)

- [ ] **`.edu` email auto-verifier** — when a user with `<student>@<school>.edu` self-reports `ADMITTED` at that school, auto-flip to `VERIFIED` after 7-day cooldown (allows correction).
- [ ] **Document upload for outcomes** — extend `vault` module to accept admission letters, link to `OutcomeStatus`. Admin reviewer sees document inline.
- [x] **Anti-fraud heuristics (initial)** — flag low-probability admits, high-probability rejects, conflicting labels, many low-probability admits by profile, and immediate reports after prediction. Flags prioritize review only; they do not auto-reject.

### P2 (close the loop)

- [ ] **Calibration auto-promotion** — when launch verifier sees `verifiedCount >= 50`, surface in admin dashboard with one-click "promote v1.7-calibrated" workflow. Run Platt fitting in shadow mode for 14 days, then promote.
- [ ] **Per-cohort tracking** — when `verifiedCount >= 50` per cohort × selectivity tier, enable cohort-specific calibration. Cohorts of interest: `US_DOMESTIC`, `CN_INTL`, `KR_INTL`, `IN_INTL`, `RECRUITED_ATHLETE`, `URM`, `LEGACY`.

## Realistic timeline

This pipeline does not yield meaningful data until at least one full admit cycle completes. Earliest meaningful calibration:

```
2026-05-09 (today) ─── pipeline build
2026-08-15         ─── first reminder dispatch (start of new academic year)
2026-12-15         ─── early-decision results begin arriving
2027-04-01         ─── regular-decision results dominate
2027-05-15         ─── ≥50 verified achievable IF email reminder + .edu auto-verify both work
2027-06-01         ─── first calibration promotion possible
```

**Anyone planning to ship "accurate" predictions before 2027-05 is making a heuristic claim, not a data-backed one.** The pipeline above is the only way that changes.

## Acceptance criteria

This plan is "complete" when all of these hold:

- [ ] `apps/api/scripts/verify-prediction-launch.ts` reports `verifiedCount > 0` from real users (not seed data)
- [ ] At least one verification path is automated (currently nothing is)
- [ ] `OutcomeStatus = VERIFIED` is reachable via either `.edu` email or document upload, with an admin override fallback
- [ ] Outcome reminder email or in-app prompt has been sent in production at least once
- [ ] An admin can see, on a single screen, the full self-reported → verified pipeline status

## Out of scope (intentionally deferred)

- Cross-platform outcome aggregation (importing from r/A2C, College Confidential): blocked by ToS + selection bias
- Counselor-reported outcomes (admins entering data on behalf of users): future enhancement
- Verified outcome marketplace (paying users for verified outcomes): legal review required
