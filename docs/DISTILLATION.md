# Distillation Phase 1

## Summary

Phase 1 adds a deterministic synthetic benchmark corpus plus a static-teacher blend path.

- Synthetic benchmark profiles are stored in `BenchmarkProfile` with `cohortTag=distill-corpus-v1`.
- Profile-scoped teachers like CollegeVine still write into `CompetitorPrediction`.
- School-scoped static teachers like CampusReel write per-school lookup tables into `StaticTeacherSnapshot`.
- Live serving only uses directly-computable static teachers in Phase 1.
- `run-distillation.ts` compares both pre-Platt and post-Platt injection points before we commit to any later recalibration work.
- The live blend is injected after our major competitiveness adjustment, feeder boost, and round multiplier, then passed through Platt calibration.

## Commands

Generate or refresh the synthetic corpus:

```bash
pnpm --filter api benchmark:profile-bank --n=200 --cohort=distill-corpus-v1
```

Run profile-scoped benchmark collection for a cohort:

```bash
pnpm --filter api benchmark:run --profile-cohort=distill-corpus-v1 --max-profiles=20 --source=collegevine --limit=20
```

Harvest CampusReel static lookup tables:

```bash
pnpm --filter api benchmark:harvest-static --source=campusreel-static --top=50
```

Produce the dry-run distillation report:

```bash
pnpm --filter api benchmark:distillation --profile-cohort=distill-corpus-v1 --max-profiles=20 --limit-schools=20
```

## Blend Math

Phase 1 serves the pre-Platt variant.

Injection point semantics:

- Our probability entering distillation is already adjusted for program competitiveness, feeder signal, and application round.
- Distillation then blends teacher signal into that adjusted probability.
- Platt calibration runs after the Phase 1 blend.
- This keeps the teacher signal aligned with the same applicant-round/program context we are already serving.

- Teachers with no valid probability for the current `(profile, school)` are ignored.
- `teacherEnsemble = Σ(w_i * t_i) / Σ(w_i)` over teachers with signal.
- `w_i` is the configured trust weight for that source.
- `TeacherSignal.confidence` is informational only in Phase 1 and does not yet modify source weight.
- If fewer than 2 teachers have signal, `disagreementFactor = 1`.
- Otherwise `MAE` is the mean absolute pairwise difference across teacher probabilities.
- `disagreementFactor = clamp01((0.15 - MAE) / 0.10)`.
- `effectiveW = BASE_BLEND_WEIGHT × disagreementFactor`.
- If exactly 1 teacher has signal, `effectiveW = min(effectiveW, SINGLE_TEACHER_CAP)`.
- `blendedPrePlatt = (1 - effectiveW) × ourProbPrePlatt + effectiveW × teacherEnsemble`.

Dry-run candidates:

- Pre-Platt candidate served probability:
  - if Platt is active, `candidateServedPrePlatt = Platt(blendedPrePlatt)`
  - otherwise `candidateServedPrePlatt = blendedPrePlatt`
- Post-Platt candidate:
  - `baselineServed = Platt(ourProbPrePlatt)` if active, else `ourProbPrePlatt`
  - `candidateServedPostPlatt = (1 - effectiveW) × baselineServed + effectiveW × teacherEnsemble`

Fixed Phase 1 constants:

- `DISTILLATION_BLEND_WEIGHT=0.2`
- `DISTILLATION_TEACHER_WEIGHT_COLLEGEVINE=0.6`
- `DISTILLATION_TEACHER_WEIGHT_CAMPUSREEL_STATIC=0.3`
- `SINGLE_TEACHER_CAP=0.4`
- `DISAGREEMENT_FULL_WEIGHT_MAE=0.05`
- `DISAGREEMENT_ZERO_WEIGHT_MAE=0.15`

## Teacher Pipelines

### CollegeVine

- Source key: `collegevine`
- Collection path: existing Playwright benchmark flow
- Storage: `CompetitorPrediction`
- Phase 1 status: offline signal only, used by dry-run diagnostics but not live serving

### CampusReel Static

- Source key: `campusreel-static`
- Collection path: direct HTTP fetch of school acceptance-calculator pages
- Storage: `StaticTeacherSnapshot`
- Live evaluation:
  - nearest SAT bucket if SAT exists
  - nearest GPA bucket if GPA exists
  - average available axes
  - if neither axis exists, no teacher signal
  - ACT-only profiles use GPA-only static-teacher signal in Phase 1

## Adding Another Teacher

- Profile-scoped personalized teachers should integrate with the existing benchmark adapter flow and write to `CompetitorPrediction`.
- School-scoped static teachers should implement `StaticTeacher`, register in `StaticTeacherRegistryService`, and persist lookup tables in `StaticTeacherSnapshot`.
- Live serving should stay constrained to directly-computable teacher signals unless a later phase adds a stable online lookup layer such as kNN or recalibration.
