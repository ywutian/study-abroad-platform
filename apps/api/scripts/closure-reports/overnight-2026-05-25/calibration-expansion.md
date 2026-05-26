# Calibration Spec Expansion Report — 2026-05-26

## Phase 1 — Baseline (50 fixtures, no engine changes)

**Result: 45/45 gated pass + 5 wontFix** (matches `OVERNIGHT_BRIEFING_2026-05-25-data.md`).

WontFix breakdown (documented engine gaps, not regressions):

- 016 Harvard legacy strong (legacy hook neutralized by design)
- 017 Yale legacy strong (legacy hook neutralized by design)
- 018 Stanford athlete (athlete hook neutralized by design)
- 019 Princeton athlete (athlete hook neutralized by design)
- 045 UMich intl-vs-domestic-penalty delta (intl penalty modeling gap)

## Phase 2 — 12 new edge-case fixtures added

Files created (`apps/api/gold-cases/counselor-calibration/cases/`):

1. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/051-stanford-to-unhooked-perfect.json` — Stanford RD TO, GPA 4.00, no SAT, domestic
2. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/052-stanford-to-unhooked-strong.json` — Stanford RD TO, GPA 3.85, no SAT, domestic
3. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/053-mit-to-unhooked-perfect.json` — MIT RD TO, GPA 4.00, no SAT, domestic
4. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/054-harvard-to-intl-cn.json` — Harvard RD TO intl-CN, GPA 4.00, TOEFL only
5. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/055-yale-intl-cn-strong.json` — Yale RD intl-CN, GPA 3.85, SAT 1550
6. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/056-princeton-athlete-hook.json` — Princeton RD athlete, GPA 3.50/SAT 1400 (wontFix expected)
7. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/057-upenn-legacy-hook.json` — UPenn RD legacy, GPA 3.85/SAT 1480 (wontFix expected)
8. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/058-caltech-unhooked-mid.json` — Caltech RD mid unhooked, GPA 3.65/SAT 1450 (below 25th)
9. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/059-stanford-mid-stem-olympiad.json` — Stanford RD with USAMO Qualifier, GPA 3.75/SAT 1500
10. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/060-brown-ed-strong-domestic-roundboost.json` — Brown ED strong unhooked, GPA 3.95/SAT 1540
11. `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/061-northeastern-high-tier.json` — Northeastern RD (HIGH-tier weighted-GPA school, unweighted input)
12. `/Users/yitianwu/Documents/style-abroad-platform/apps/api/gold-cases/counselor-calibration/cases/062-smith-rd-strong-intl.json` — Smith RD intl-CN (weighted-GPA contamination, unweighted input)

## Phase 3 — Re-run with 62 fixtures

**Result: 52/55 gated pass + 7 wontFix**

Per-new-fixture verdicts:

| #   | ID                                  | Engine prob | Expected range                | Verdict                                          |
| --- | ----------------------------------- | ----------- | ----------------------------- | ------------------------------------------------ |
| 051 | stanford-to-unhooked-perfect        | 3.72%       | [1.5%, 6.0%]                  | PASS                                             |
| 052 | stanford-to-unhooked-strong         | 3.55%       | [1.0%, 4.5%]                  | PASS                                             |
| 053 | mit-to-unhooked-perfect             | 4.44%       | [1.5%, 7.0%]                  | PASS                                             |
| 054 | harvard-to-intl-cn                  | 1.84%       | [0.5%, 4.0%]                  | PASS                                             |
| 055 | yale-intl-cn-strong                 | 6.12%       | [1.5%, 8.5%]                  | PASS                                             |
| 056 | princeton-athlete-hook              | 2.81%       | wontFix (in 35-85% intuition) | wontFix as expected (engine ×1.0 hook by design) |
| 057 | upenn-legacy-hook                   | 3.39%       | wontFix (in 10-32% intuition) | wontFix as expected (engine ×1.0 hook by design) |
| 058 | caltech-unhooked-mid                | 1.53%       | [0.1%, 2.5%]                  | PASS                                             |
| 059 | stanford-mid-stem-olympiad          | 3.64%       | [4.0%, 22.0%]                 | **FAIL** (low by 0.36pp)                         |
| 060 | brown-ed-strong-domestic-roundboost | 13.47%      | [15.0%, 38.0%]                | **FAIL** (low by 1.53pp)                         |
| 061 | northeastern-high-tier              | 2.82%       | [4.0%, 18.0%]                 | **FAIL** (low by 1.18pp)                         |
| 062 | smith-rd-strong-intl                | 6.52%       | [6.0%, 28.0%]                 | PASS (at floor)                                  |

## Conclusion (200 words)

The 12 new edge cases successfully exercise paths Phase 1's 50 fixtures did not cover, and surface **three genuine engine signals** worth investigating (not classified as regressions because Phase 1 still passes 45/45 unchanged):

1. **059 USAMO olympiad lift missing (3.64% vs ≥4%):** Engine's award multiplier is not delivering the academic-spike lift that industry data shows for sub-median GPA olympiad qualifiers. Worth checking `counselor-modifiers.ts` award scoring — currently the spike doesn't compensate for sub-median GPA/SAT at T5.

2. **060 Brown ED round multiplier undershoot (13.47% vs ≥15%):** Engine's `edAcceptanceRate` anchor of 14.4% is being slightly attenuated; for strong USACO Platinum + ED applicants the post-modifier prob should exceed the anchor, not match it. Suggests award lift in ED path may also be under-weighted.

3. **061 Northeastern HIGH-tier weighted-GPA contamination (2.82% vs ≥4%):** This is the Tier B audit signal. Engine produces 2.82% for a strong unweighted 3.85 GPA at a 5.22% acceptance school — over-penalty. Aligns with the Tier B audit finding that weighted-GPA contamination in 43 schools (NEU included as HIGH tier) deflates probability when unweighted GPA is supplied. Strongest evidence yet that the audit's contamination concern materially impacts predictions.

Fixtures 051-055, 058, 062 confirm TO penalty path, intl path, and below-25th SAT path are operating as expected. Fixtures 056-057 confirm the documented hook-neutralization policy. **No engine regression**; three new follow-up tickets recommended (award lift + Tier B contamination remediation).

## Report path

Reports written to `/Users/yitianwu/Documents/study-abroad-platform/apps/api/gold-cases/counselor-calibration/reports/report-2026-05-26T11-59-08-043Z.{md,json}`
