# System Accuracy Audit - 2026-04-19

## Executive Verdict

- Overall verdict: **明确存在偏差/缺陷**
- Prediction probability: **证据不足无法宣称准确**
- School facts: **明确存在偏差/缺陷**
- Application analysis content: **证据不足无法宣称准确**
- Agent/tool behavior: **证据不足无法宣称准确**
- Governance: **明确存在偏差/缺陷**

## What Is Actually Verified

- Existing readonly specs still pass: `pnpm --filter api test -- --runInBand src/modules/prediction/prediction-calibration.service.spec.ts src/modules/profile/profile-application-analysis.service.spec.ts src/modules/profile/application-analysis-workflow.service.spec.ts` -> exit code 0.
- Prediction accuracy headline only accepts COUNSELOR_VERIFIED / DOCUMENT_VERIFIED ADMITTED or REJECTED outcomes.
- Official-source truth was collected for 15 schools inside the Top 50 + UC scope.
- Fixture-based agent behavior assertions now enforce tools, keywords, forbidden content, and JSON fields.

## What Is Unverified

- Probability accuracy cannot be published when verified outcome sample is 0.
- Application-analysis content quality remains 证据不足无法宣称准确 because sampled real and synthetic cases could not be replayed through a deterministic harness.
- Live tool-routing assertions remain partially unverified because the current agent endpoint does not expose tool-call traces in audit mode.

## School Fact Drift Matrix

- Scope schools in audit target: 91
- Official truth coverage inside scope: 15
- Official-source field accuracy: 52.5%
- Schools with at least one mismatch: 10

| School                                | Surface          | Field               | Expected                             | Actual          | Status   |
| ------------------------------------- | ---------------- | ------------------- | ------------------------------------ | --------------- | -------- |
| Stanford University                   | school_record    | standardDeadline    | January 5                            | January 1       | mismatch |
| Stanford University                   | school_record    | earlyDeadlinePolicy | Restrictive Early Action: November 1 | REA: November 1 | match    |
| Stanford University                   | school_record    | testingPolicy       | REQUIRED                             | REQUIRED        | match    |
| Stanford University                   | analysis_runtime | testingPolicy       | REQUIRED                             | REQUIRED        | match    |
| Harvard University                    | school_record    | standardDeadline    | January 1                            | January 1       | match    |
| Harvard University                    | school_record    | earlyDeadlinePolicy | Restrictive Early Action: November 1 | REA: November 1 | match    |
| Harvard University                    | school_record    | testingPolicy       | REQUIRED                             | REQUIRED        | match    |
| Harvard University                    | analysis_runtime | testingPolicy       | REQUIRED                             | REQUIRED        | match    |
| Harvard University                    | school_record    | intlAidPolicy       | NEED_BLIND                           | NEED_BLIND      | match    |
| Massachusetts Institute of Technology | school_record    | intlAidPolicy       | NEED_BLIND                           | NEED_BLIND      | match    |
| Princeton University                  | school_record    | intlAidPolicy       | NEED_BLIND                           | NEED_BLIND      | match    |
| Yale University                       | school_record    | intlAidPolicy       | NEED_BLIND                           | NEED_BLIND      | match    |

## Prediction Accuracy

- Verified sample count: 0
- Verdict: 证据不足无法宣称准确
- Message: No verified ADMITTED/REJECTED outcomes were found in the selected window.
- Brier: n/a
- ECE: n/a
- Baseline Brier: n/a
- Baseline ECE: n/a
- Tier monotonicity: n/a

- No verified slice metrics were available.

## Application Analysis Quality

- Endpoint probe: auth_blocked (Endpoint reachable but blocked by auth (HTTP 401).)
- Real sampled cases: 5
- Synthetic sampled cases: 12
- Executed cases: 0
- Real pass rate: n/a
- Synthetic pass rate: n/a
- Fabricated insight count: n/a
- Overconfidence count: n/a

## Agent/Eval Coverage Gaps

- Fixture behavior audit: 14 passed / 0 failed / 1 skipped (pass rate 100.0%).
- Live behavior audit: 4 passed / 0 failed / 1 skipped (pass rate 100.0%).
- Workflow smoke: PASS (ADMITTED/SELF_REPORTED (legacy-v3-enterprise))
- Served prediction flow is present, but calibration freshness, label hygiene, shadow feedback, and persistence completeness all weaken runtime accuracy claims.
- Real and synthetic samples were assembled, but application-analysis content accuracy remains unverified because the audit could not execute a deterministic replay harness.

## Governance Authenticity

- The application-analysis governance layer currently reports candidate readiness from synthetic metrics rather than measured correctness, parity, or journey execution.
- Official-source truth currently covers high-risk deadline, testing-policy, and international-aid fields; UC testing semantics already drift across local surfaces.

## P0/P1/P2 Findings

### P0

- P0 Verified admit/reject outcomes are absent in the last audit window: prediction-accuracy-report returned 0 counselor/document-verified ADMITTED/REJECTED rows in the selected 365-day window. (probability calibration claims)
- P0 Application-analysis gate metrics are synthetic: runEvaluation derives policyCorrectnessRate from approvedEvidenceCount thresholds and hardcodes weakStateCorrectnessRate, fabricatedInsightCount, actionabilityMean, render passes, and journeyPassRate. (application-analysis release gate)

### P1

- P1 Calibration invalidation misses Platt cache: invalidateCalibrationCache clears SCHOOL_CALIBRATION_CACHE_KEY only, while getPlattCalibration caches under prediction:calibration:platt. (served calibration freshness)
- P1 ML tier gating counts unverified actualResult rows: countLabeledData uses predictionResult.actualResult != null rather than verified outcome-label statuses, so self-reported rows can unlock stronger ML tiers. (model tier selection)
- P1 University of California, Berkeley testingPolicy mismatches official source: Expected BLIND but local school_record currently resolves to OPTIONAL. (school_record:testingPolicy)
- P1 University of California, Davis testingPolicy mismatches official source: Expected BLIND but local school_record currently resolves to OPTIONAL. (school_record:testingPolicy)
- P1 University of California, Irvine testingPolicy mismatches official source: Expected BLIND but local school_record currently resolves to OPTIONAL. (school_record:testingPolicy)
- P1 University of California, Los Angeles testingPolicy mismatches official source: Expected BLIND but local school_record currently resolves to OPTIONAL. (school_record:testingPolicy)
- P1 No deterministic replay harness exists for /profiles/me/ai-analysis: The audit can sample real and synthetic cases, but it cannot safely execute and grade them without authenticated per-user replay or an offline harness. (application-analysis content audit)
- P1 Render and contract gates always pass: contractParityPass, webRenderPass, mobileRenderPass, and journeyPassRate are written as true/true/true/1 without executing downstream rendering or journey checks. (cross-surface parity gate)

### P2

- P2 Stanford University standardDeadline mismatches official source: Expected January 5 but local school_record currently resolves to January 1. (school_record:standardDeadline)
- P2 University of California, Berkeley standardDeadline mismatches official source: Expected December 1 but local school_record currently resolves to November 30. (school_record:standardDeadline)
- P2 University of California, Davis standardDeadline mismatches official source: Expected December 1 but local school_record currently resolves to Nov 30. (school_record:standardDeadline)
- P2 University of California, Irvine standardDeadline mismatches official source: Expected December 1 but local school_record currently resolves to Nov 30. (school_record:standardDeadline)
- P2 University of California, Los Angeles standardDeadline mismatches official source: Expected December 1 but local school_record currently resolves to November 30. (school_record:standardDeadline)
- P2 University of California, Merced standardDeadline mismatches official source: Expected December 1 but local school_record currently resolves to Nov 30. (school_record:standardDeadline)

## Recommended Fix Queue

- P0: Replace synthetic application-analysis gate metrics with scored gold-set execution and real render/journey checks.
- P0: Stop publishing any probability-accuracy claim until verified admit/reject outcomes exist in meaningful volume.
- P1: Invalidate both school calibration and Platt caches when calibration state changes.
- P1: Gate ML tier promotion on verified outcomes instead of raw actualResult.
- P1: Add a deterministic replay harness for `/profiles/me/ai-analysis` so sampled real and synthetic cases can be scored offline.
- P1: Align UC testing semantics across School data, analysis runtime, and user-facing tools.
- P2: Persist selectivityBand so slice analysis and post-hoc calibration audits are reproducible.

## Official Sources Used

- [Stanford University](https://admission.stanford.edu/apply/first-year/index.html)
- [Harvard University](https://college.harvard.edu/admissions/apply/first-year-applicants)
- [Massachusetts Institute of Technology](https://mitadmissions.org/help/faq/need-blind-admissions/)
- [Princeton University](https://admission.princeton.edu/apply/international-students)
- [Yale University](https://admissions.yale.edu/are-international-students-eligible-financial-aid-if-so-how-do-i-apply)
- [Amherst College](https://www.amherst.edu/system/files/media/Amherst%20College%20Catalog%20Section%20III.pdf)
- [University of California, Berkeley](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Davis](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Irvine](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Los Angeles](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Merced](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Riverside](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, San Diego](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Santa Barbara](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
- [University of California, Santa Cruz](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/)
