# Audit Report — Weighted GPA Contamination in `School.gpaDistribution`

**Date**: 2026-05-25
**Severity**: 🟡 Engine miscalibration risk (Tier B — no auto-fix applied)
**Triggered by**: Agent D (overnight intel sweep, PR #293) flagging Smith/Davidson CDS C11 as likely weighted

## Finding

43 schools (out of ~196 with `gpaDistribution` populated) show `3.75-4.00` band percentages implausibly high for their admit selectivity. The pattern strongly suggests these CDS C11 values are **weighted GPA on a >4.0 scale**, not unweighted as the engine assumes.

## Severity buckets

| Bucket      | Criteria                          | Count  |
| ----------- | --------------------------------- | ------ |
| 🔴 SEVERE   | top-band ≥85% AND admit-rate ≤15% | **22** |
| 🟠 HIGH     | top-band ≥70% AND admit-rate ≤25% | 14     |
| 🟡 MODERATE | top-band ≥60% AND admit-rate ≤35% | 7      |
| OK          | (all others)                      | 126    |

## SEVERE cases (sample — full list at `/tmp/gpa-audit.tsv`)

| School       | Admit % | Top-band % | US News |
| ------------ | ------- | ---------- | ------- |
| Caltech      | 2.57%   | 99.0%      | 7       |
| MIT          | 4.55%   | 97.0%      | 2       |
| Princeton    | 4.42%   | 96.0%      | 1       |
| Yale         | 4.75%   | 96.0%      | 5       |
| Stanford     | 3.80%   | 95.0%      | 3       |
| Harvard      | 3.65%   | 94.6%      | 3       |
| Northeastern | 5.22%   | 94.5%      | 53      |
| Columbia     | 3.86%   | 94.0%      | 12      |
| Duke         | 5.71%   | 94.0%      | 7       |
| UCLA         | 8.97%   | 93.4%      | 15      |
| Dartmouth    | 5.40%   | 93.0%      | 18      |
| Brown        | 5.39%   | 93.0%      | 9       |
| JHU          | 6.44%   | 92.4%      | 9       |
| Barnard      | 8.84%   | 92.2%      | 12      |
| Cornell      | 8.41%   | 91.0%      | 12      |
| Penn         | 5.38%   | 90.0%      | 6       |
| UChicago     | 4.79%   | 89.6%      | 12      |
| Vanderbilt   | 5.86%   | 89.0%      | 18      |
| WUStL        | 12.06%  | 89.0%      | 24      |
| CMU          | 11.66%  | 85.2%      | 24      |
| UCB          | 11.04%  | 85.0%      | 24      |
| Smith        | 21.00%  | 97.0%      | 16      |

## Why this is suspicious

CDS C11 spec says values should be on a **4.0 scale** (unweighted). But schools just pass through what high schools report:

- Many US high schools report GPA on 5.0+ scales (weighted by honors/AP/IB)
- Schools don't normalize before reporting to CDS C11
- Result: "perfect 4.00" band actually contains all students with weighted ≥4.0, which at a feeder high school could mean unweighted 3.5

Independent verification:

- Compass Education Group "Typical Stanford Admit" data: unweighted 3.95+, weighted 4.4+ (mean)
- Stanford's own admissions: median admitted unweighted ~3.96, but reported in C11 as "4.00 or above"

## Engine impact

Engine path `gpaBandMultiplier` (data-driven):

```
applicant_gpa4 = (gpa / scale) * 4.0   // e.g., 3.85 unweighted = 3.85
percentile = cumulative-from-bottom in school's distribution
multiplier = clamp(0.5 + percentile, 0.15, 1.5)
```

For Stanford applicant with **3.85 unweighted GPA**:

- Maps to band `3.50-3.74` (since 3.85 → 3.85 < 3.75 in 4-bucket)
  - wait actually 3.85 ≥ 3.75 so it's in `3.75-4.00` band
- Stanford's distribution: 95% in `3.75-4.00`, 4% in `3.50-3.74`, ...
- Percentile of band: `(0 below) + 95/2 = 47.5%`
- Multiplier: `0.5 + 0.475 = 0.975` (slight penalty)

For Stanford applicant with **3.6 unweighted**:

- Maps to band `3.50-3.74`
- Percentile: `0 + (4/2) = 2%`
- Multiplier: `0.5 + 0.02 = 0.52` (47% probability reduction)

The 3.6 unweighted at Stanford gets penalized to 0.52× even though such a candidate could plausibly be a strong hook (athlete, URM, etc.) — engine's data-driven path is too brittle when distribution is weighted.

## Recommended actions (TIER B — for morning review)

Three options ranked by safety:

### Option A — engine-level detection (recommended)

Add to `normalizeGpaDistribution()`:

```typescript
if (topBand >= 0.85 && schoolAdmitRate <= 0.15) {
  return null; // signal: distribution is likely weighted, use SAT fallback
}
```

Tradeoff: ~22 elite schools lose data-driven path → fall back to SAT-band heuristic. SAT heuristic is calibrated against unweighted; should be more reliable than weighted distribution.

### Option B — data-level metadata flag

Add `metadata.provenance.gpaDistribution.scaleType: "weighted" | "unweighted" | "unknown"` and update engine to handle weighted case (scale weighted applicant GPA correspondingly).

Tradeoff: more complex, requires applicant input to specify `gpaScale: "weighted"` field, which most apps don't capture.

### Option C — null out severe cases (data-only)

Direct SQL:

```sql
UPDATE "School" SET "gpaDistribution" = NULL,
  metadata = jsonb_set(metadata, '{provenance,gpaDistribution,quality_flag}',
                       '"likely_weighted_per_audit_2026_05_25"')
WHERE id IN (...22 SEVERE schools);
```

Tradeoff: loses data; engine falls back to SAT path. Same effect as Option A but data-side instead of engine-side. Reversible.

## Suggested decision

**Option A**, because:

- No data loss in DB (data remains accurate for analytical use)
- Engine code change is small + reversible
- Already adheres to existing pattern (engine has heuristic SAT fallback that's calibrated for unweighted)

But this requires engine code change which is Tier B per overnight safety rule. **Defer to morning user decision.**

## Files

- Full TSV of 43 suspicious rows: `/tmp/gpa-audit.tsv`
- Engine logic: `apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:171-198` (`normalizeGpaDistribution`)
- Where Stanford/etc. data came from: `cds-c9c21-*.json` LLM cache (load script `scripts/load-cds-c9-c21.ts`)
