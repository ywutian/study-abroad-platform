# Feedback Loop — DEFERRED (2026-05-06)

**Status**: Documented, NOT implementing now.

**Decision context**: After Phase B+C lands the prediction system is methodologically sound (industry-standard-plus rule-based with CDS C9 + real ED/EA + CIP) and code-pipeline closed. The ML feedback loop (outcome reporting → verification → calibration → drift detection) is **deliberately deferred** to focus on shipping Phase B+C and other product work.

This document captures what's missing, the empirical state today, what triggers a future revisit, and concrete implementation notes so the work can resume cold without re-discovery.

---

## What's deferred

The 4 missing pieces that would convert the system from open-loop to closed-loop:

| #   | Component                                                                                 | Status                   | Effort estimate                                              |
| --- | ----------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| 1   | User-facing **outcome reporting UX**                                                      | Not built                | ~1 week                                                      |
| 2   | **Verification path** (admin/counselor/document) for `SELF_REPORTED → COUNSELOR_VERIFIED` | Not built                | 2-3 weeks (admin batch only); 4-6 weeks (counselor accounts) |
| 3   | **Auto-calibration trigger** (Platt scaling against verified outcomes)                    | Framework built, dormant | ~2 days when data exists                                     |
| 4   | **Drift monitoring dashboard** (predicted vs actual)                                      | Not built                | ~1 week                                                      |

---

## Current state evidence (as of 2026-05-06)

### Feedback data inventory

```sql
SELECT 'PredictionOutcomeLabelRecord' AS table, COUNT(*),
  SUM(CASE WHEN status='SELF_REPORTED' THEN 1 ELSE 0 END) AS self_rep,
  SUM(CASE WHEN status IN ('COUNSELOR_VERIFIED','DOCUMENT_VERIFIED') THEN 1 ELSE 0 END) AS verified
FROM "PredictionOutcomeLabelRecord";
-- → 10 / 10 self_rep / 0 verified

SELECT COUNT(*) FROM "PredictionResult" WHERE "actualResult" IS NOT NULL;
-- → 5

SELECT COUNT(*) FROM "SchoolCalibration";
-- → 3 (manually-injected, not from outcomes)
```

**Calibrator's `getVerifiedOutcomeSamples()` returns empty** because no record has `COUNSELOR_VERIFIED` or `DOCUMENT_VERIFIED` status. Platt scaling is dormant.

### Code paths already in place (waiting for data)

- [PredictionCalibrationService.getPlattCalibration()](apps/api/src/modules/prediction/prediction-calibration.service.ts) — full implementation, returns `null` when samples < threshold
- [PredictionCalibrationService.getSchoolCalibrations()](apps/api/src/modules/prediction/prediction-calibration.service.ts) — Redis cached, ready to apply when populated
- [PredictionReportingService.reportActualResult()](apps/api/src/modules/prediction/prediction-reporting.service.ts) — endpoint exists; creates `PredictionOutcomeLabelRecord` with status `SELF_REPORTED`
- API endpoint: `PATCH /predictions/:schoolId/result` ([prediction.controller.ts:117-148](apps/api/src/modules/prediction/prediction.controller.ts:117)) accepts `ReportResultDto`
- Frontend: `latestOutcomeLabel` field IS displayed in [PredictionHistoryTab.tsx:92](<apps/web/src/app/[locale]/(main)/prediction/_components/PredictionHistoryTab.tsx:92>)

### What's missing on top of this scaffolding

1. **Frontend report-outcome CTA** — no "Report your admission result" button in the prediction page
2. **Verification UI / workflow** — no admin batch-review page, no counselor accounts, no document → outcome bridge
3. **Auto-calibration cron** — no scheduled job calling `recomputeAllCalibrations()`
4. **Drift dashboard** — no UI showing per-school predicted-vs-actual divergence

---

## Re-trigger conditions

Pick any one of these as the signal to invest in feedback loop:

- **Time-based**: 6 months elapsed since 2026-05-06, regardless of progress on other dimensions
- **User pull**: ≥10 user requests for "I want to share my admission result"
- **Marketing readiness**: Product wants to claim "calibrated against real outcomes" externally
- **Data partnership**: Counselor/admissions partnership opens batch outcome import path
- **Scale**: Active user base grows to point where 50+ outcomes/cohort/year is realistic

---

## Implementation notes (for future-self resuming cold)

### Quickest path to a closed loop (3 weeks of focused work)

#### Step 1 (Week 1): User outcome reporting UX

Add to [PredictionHistoryTab.tsx](<apps/web/src/app/[locale]/(main)/prediction/_components/PredictionHistoryTab.tsx>):

```tsx
// On each PredictionResult card, when result.applicationRound is set
// and current date > school's typical decision date:
<Button onClick={() => openReportOutcomeModal(result)}>Report your admission result</Button>

// Modal component: ReportOutcomeModal
//   - Result: ADMITTED | REJECTED | WAITLISTED | DEFERRED | WITHDRAWN
//   - Round: ED | EA | RD | ED2 | REA | SCEA
//   - Optional: evidenceUrl (upload PDF/image to existing Vault)
//   - Notes (textarea, max 500 chars)
//   - Submit → POST /predictions/:schoolId/result (already exists)
```

Backend endpoint already accepts this — **only frontend work needed**.

Mobile equivalent: same modal pattern in `apps/mobile/src/screens/prediction`.

**Acceptance criteria**:

- New `PredictionOutcomeLabelRecord` row created with `status='SELF_REPORTED'`
- User sees "Reported on YYYY-MM-DD" indicator on the card
- Can edit/withdraw within 7 days of submission

#### Step 2 (Weeks 2-3): Admin batch verification (lowest-cost path)

Skip counselor accounts and document upload for v1. Build:

```
/admin/outcomes (new page)
  ├─ Filter: status / school / date range / has-evidence
  ├─ Table: profile (anon) | school | result | round | evidenceUrl | reportedAt | reviewer notes
  ├─ Action: "Approve" → status = COUNSELOR_VERIFIED, resolvedBy=adminId, resolvedAt=now()
  └─ Bulk action: "Approve selected"
```

Critical files:

- New: `apps/web/src/app/[locale]/(main)/admin/outcomes/page.tsx`
- New: `apps/web/src/app/[locale]/(main)/admin/outcomes/_components/outcome-review-table.tsx`
- New API endpoint: `POST /admin/outcomes/:id/verify` in [admin.controller.ts](apps/api/src/modules/admin/admin.controller.ts)
- Service method on [PredictionReportingService](apps/api/src/modules/prediction/prediction-reporting.service.ts): `verifyOutcomeRecord(id, reviewerId)` → updates record, invalidates calibration cache

**Trust model**: founder/admin manually inspects and approves. Document/counselor verification deferred further.

#### Step 3 (~2 days after Step 2): Auto-calibration cron

Add to [prediction.module.ts](apps/api/src/modules/prediction/prediction.module.ts) or a new scheduler:

```typescript
@Cron('0 4 * * 1') // every Monday 4am
async weeklyCalibrationRefresh() {
  const samples = await this.calibrationService.getVerifiedOutcomeSamples();
  if (samples.length >= 50) {
    await this.calibrationService.recomputePlattCalibration();
  }
  await this.calibrationService.recomputeSchoolMultipliers(); // works at any sample size
}
```

**Acceptance criteria**:

- `SchoolCalibration` table grows beyond manual-injected 3 rows
- Per-school multipliers visible in `/admin/calibrations`
- Predictions show calibration applied (`servedTrace.calibrationApplied = true`)

### What NOT to build in v1

- Counselor login + dashboard — heavy auth work, not needed if admin can review
- Document → outcome OCR bridge — complex, needs vault integration + OCR model
- Self-service drift dashboard — start with manual SQL queries against verified outcomes
- ML model retraining — no model exists, calibration multiplier is the right v1 abstraction

---

## Risk of deferring

| Risk                                                                      | Likelihood | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Predictions drift from reality without anyone noticing                    | Medium     | Manual quarterly spot-check of N=20 (profile, school) pairs vs. published outcomes                                                  |
| Marketing claim "we use real data" becomes false                          | Low        | Don't make that claim until feedback loop ships. Current claim should be "based on each school's published CDS data" — already true |
| Competitor (CollegeVine) catches up on methodology + already has outcomes | Medium     | Phase B+C methodology lead is durable for ~12 months; revisit if competitor publishes equivalent CDS C9 / real ED/EA                |
| Users report outcomes but data is lost (no UI to capture)                 | Low        | Outcome endpoint exists; users could be told via support to email founder, manually inserted                                        |
| Schema-level drift (CDS data goes stale year-over-year)                   | High       | **Separate concern** — CDS annual update is its own runbook, not part of feedback loop. Track in `data-sync-runbook.md`             |

---

## Tracking

When work resumes, link from this doc to:

- New tracking issue / PR
- Updated baseline (`baseline-YYYY-MM-DD.md`)
- Phase E completion record

This doc remains as **the** historical record of why Phase E was deferred and what was already in place at deferral time.

---

## Related docs

- [Pre-Phase-B baseline](baseline-2026-05-05.md) — state before Phase B+C
- [Counselor engine philosophy](../../../apps/api/src/modules/prediction/counselor/counselor-engine.service.ts) — why deterministic anchor + clip beats ML at cold-start
- [Plan v6 (current)](/Users/yitianwu/.claude/plans/context-driven-onboarding-cheeky-kahan.md) — Phase B+C plan
