# Dashboard Data Invariants

This document defines the **must-hold contracts** between the
prediction / dashboard / school-list modules. Each invariant has a
business reason, a code enforcement point, the user-visible symptom
when violated, and a regression test.

If you add a new field that interacts with these contracts (e.g.,
a new readiness item, a new prediction precondition), update this
document **in the same PR** so future contributors can audit the
chain.

## History

- **2026-05 Phase 1** (this PR): added 4 invariants to fix the
  production "105 predictions + 0 schools + 欢迎来 Lumni + Grade D"
  contradiction. Without these contracts, the dashboard could show
  internally inconsistent state to users — a P0 trust issue.

## Invariants

### I1: `predictionsCount > 0 ⟹ profile is prediction-eligible`

**Definition of prediction-eligible** — all three must hold:

1. **GPA present** — any GPA signal: cumulative `gpa`, grade-level
   `gpa9`–`gpa12`, or per-semester `semesterGpas`. GPA is the single
   most predictive input; without it a prediction just echoes the
   school's overall admit rate.
2. **Basic info present** — a target major OR a grade level.
3. **≥ 1 target school** in the user's `SchoolListItem` (the anchor).

**Business reason**: with sparse profile data the prediction model's
signals are too few — output probabilities become misleadingly
confident. A pure completeness-percentage threshold is _not_ a safe
gate: a profile with test scores + activities + awards + schools but
no GPA scores ~75% yet still cannot produce a credible prediction.
The gate is therefore field-explicit, not score-based.

**Enforced at**: `apps/api/src/modules/prediction/prediction.service.ts`
inside `runPredictionWithLock` when `validateInputs=true` (the
user-facing `predict()` entry sets this true; internal
`predictForApplicationAnalysis` sets false). On violation it throws
`PreconditionFailedException` (HTTP 412) with code
`PREDICTION_PROFILE_INSUFFICIENT`, a localized `message`, and
`details.blockers` (`PredictionBlocker[]`).

**Single source of truth**: `evaluatePredictionEligibility` in
`apps/api/src/modules/profile/prediction-eligibility.util.ts`. It is
consumed by **all** of: the `POST /predictions` 412 backstop, the
`/profiles/me/readiness` endpoint (`overall.canRunPrediction` +
`overall.predictionBlockers`), and the `/profiles/me/completeness`
endpoint. The web UI and mobile gate their "run prediction" affordance
on the readiness/completeness flags, so the gate and the UI can never
disagree. If you change the predicate, every reader updates atomically.

**Violation symptom**: a user with an ineligible profile but non-zero
predictions count, or a "run prediction" button enabled in the UI that
the backend then rejects with an opaque 412.

**Test**: `prediction.invariants.spec.ts` and
`prediction-eligibility.util.spec.ts`.

### I2: `predictionsCount > 0 ⟹ schoolId ∈ user.SchoolListItem`

**Business reason**: a prediction is meaningful only against a school
the user is actually considering. Predicting against arbitrary
schoolIds (admin tools, bugs, replay attacks) creates "orphan"
records that pollute calibration data and confuse the user.

**Enforced at**: `apps/api/src/modules/prediction/prediction.service.ts`
inside `runPredictionWithLock` when `validateInputs=true`. Throws
`BadRequestException` with code `PREDICTION_INVALID_SCHOOL_IDS` and
the list of unauthorized schoolIds.

**Violation symptom (legacy)**: existing orphan records in the DB
(predictions made before this guard was added) still exist. The
dashboard handles them via `validPredictionsCount` filtering (see I3
below) — they're not shown but not deleted either.

**Test**: `prediction.invariants.spec.ts` (Phase 1).

### I3: `dashboard.stats.predictions = COUNT WHERE schoolId ∈ user.SchoolListItem`

**Business reason**: the dashboard's prediction tally must reflect
_currently usable_ predictions. A user who removed schools after
running predictions should see the count drop to reflect their
current school list — not the historical raw count.

**Enforced at**: `apps/api/src/modules/user/dashboard.service.ts`
via `validPredictionsCount` (post-query 2-step: first compute the
user's schoolIds, then count predictions where `schoolId IN [...]`).

This invariant **does not delete** orphan records — the prediction
history page intentionally retains them. Only the dashboard count is
sanitized.

**Violation symptom**: production "105 predictions + 0 schools" —
exactly what this PR closes.

**Test**: `dashboard.service.spec.ts` Phase 1 Bug 3 test.

### I4: `timeline.status === 'ready' ⟹ schoolListCount > 0`

**Business reason**: vacuous-truth defense. Without schools, there
are no timelines, so `missingTimelineCount === 0` is trivially true.
The old code interpreted this as "ready 10/10 ✓" — confusing users
into thinking they had completed application planning when in fact
they hadn't even chosen schools.

**Enforced at**: `apps/api/src/modules/user/dashboard.service.ts`
in `buildWorkbench` where the timeline readiness item is computed:
`schoolListCount === 0 ? 'blocked' : (...)`. The contribution score
is similarly clamped: `schoolListCount === 0 ? 0 : (...)`.

**Violation symptom**: dashboard showing "时间线闭环 10/10 ✓" for
a user with 0 schools.

**Test**: `dashboard.service.spec.ts` Phase 1 Bug 4 test.

### I5: `balancedSchoolList === true ⟹ reach > 0 ∧ target > 0 ∧ safety > 0`

**Business reason**: definition of "balanced". Already enforced; no
gap.

**Enforced at**: `apps/api/src/modules/user/dashboard.service.ts`:
`balancedSchoolList = schoolTiers.reach > 0 && schoolTiers.target > 0 && schoolTiers.safety > 0`.

**Test**: covered by existing dashboard.service.spec.ts.

### I6: `decisionPanel.shown ⟹ pipeline.accepted + waitlisted + rejected + withdrawn > 0`

**Business reason**: the Decision Hub surface is meant for **Stage G**
(decision phase) users. Showing it to a brand-new user with no
applications submitted (or to a submitted-but-not-decided user) is
mistargeted UX and adds noise to the dashboard.

**Enforced at**: `apps/web/.../dashboard/_components/dashboard-decision-panel.tsx`
in the early return: `if (decisionsTotal === 0) return null;`.
Same gate as PipelineStrip's `hasMaterial` check (intentionally
parallel — the two surfaces stay in lockstep).

**Violation symptom**: empty Decision Hub card on a new account, or
the card showing for a user with only SUBMITTED schools (no decisions
yet).

**Test**: `dashboard-decision-panel.test.tsx` (Phase 2a) — "renders
nothing when only NOT_STARTED / IN_PROGRESS / SUBMITTED" case.

### I7: `essayCoach.shown ⟹ user has at least 1 EssayAIResult`

**Business reason**: the Essay Coach card surfaces the user's latest
AI feedback. Without any AI runs, there's nothing to show.

**Enforced at**:

- Backend: `apps/api/src/modules/user/dashboard.service.ts`
  `buildEssayCoach` returns `null` when the `essayAIResult.findFirst`
  query has no row.
- Frontend: `dashboard-essay-coach.tsx` returns null when
  `data == null`.

**Violation symptom**: card flashes empty content for users with no
AI runs.

**Test**: `dashboard-essay-coach.test.tsx` (Phase 2c) — "renders
nothing when data is undefined/null" cases.

## Future Invariants (Phase 2+)

These are stubbed for the upcoming phases:

- **I8 (Phase 2b)**: `assessment signal shown ⟹ user has at least 1 AssessmentResult`
- **I9 (Phase 6 #44)**: `committedSchool.shown ⟹ user has at least 1 EnrollmentChoice`

Each phase PR adds the invariant here in the same PR as the
implementation, plus a `*.spec.ts` test.

## Maintenance

When you add a new dashboard signal or prediction precondition:

1. Define the invariant in plain language ("X holds when Y")
2. Add an enforcement point (service-level guard, not UI-only)
3. Add a regression test (`*.spec.ts`)
4. Update this document
5. If the invariant straddles modules (prediction + dashboard +
   profile), use a shared util (like `profile-completeness.util.ts`
   for the completeness percentage, or `prediction-eligibility.util.ts`
   for the prediction gate) to keep the predicate in one place —
   drift here causes the same class of bug PRs #178/#179 eliminated
   for type contracts. (I1 itself drifted this way in 2026-05: the
   readiness endpoint used `score ≥ 45 && schools > 0` while the
   predict endpoint used `completeness ≥ 40` — fixed by the shared
   `evaluatePredictionEligibility` predicate.)
