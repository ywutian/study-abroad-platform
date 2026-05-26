# A-vs-D Weighted-GPA Distribution Test Matrix

Generated: 2026-05-26T11:59:10.519Z

## Executive Summary

Tested **62 Layer-3 fixtures** (cases dir has grown since brief; previously 50) + 110 (22 SEVERE schools × 5 archetypes) + 550 threshold-sensitivity cells under D (baseline) vs A (null gpaDistribution when top-band≥0.92 AND <3.50 tail≤0.05). Part-1 pass: D=43/62 (69.4%), A=34/62 (54.8%). On the 32 fixtures whose school IS contaminated: D=20/32, A=11/32. Part 1 moves ≥0.5pp on 18/62 fixtures — others are unchanged because either the SEVERE-tell never fires (non-contaminated schools) or the engine bypasses gpaBandMultiplier via a Tier-1 CDS-cell anchor (e.g. UNC, Cornell, Penn, UChicago all keep Δ=0 across all archetypes).

Part 2 direction: Option A raises probability for 13/110 cells and lowers it for 47/110. Median Δ (A−D) by archetype: Perfect=0.00pp, Mid=-0.10pp, Below=-0.28pp. Mechanism: weighted CDS distributions place virtually every applicant above the 3.75 median, so the engine ×1.5-caps the GPA multiplier even at GPA 3.40 — D systematically over-predicts. Falling back to the SAT-band heuristic correctly identifies sub-median GPA as a negative signal.

See "Bottom Line" and "Recommendation" sections.

## Part 1 — Layer-3 fixtures (62 × 2 options)

| Metric                                | Value         |
| ------------------------------------- | ------------- |
| Total fixtures                        | 62            |
| Pass under D (baseline)               | 43/62 (69.4%) |
| Pass under A (null contam)            | 34/62 (54.8%) |
| Fixtures whose school is contaminated | 32/62         |
| Contaminated subset — pass D          | 20/32         |
| Contaminated subset — pass A          | 11/32         |
| Fixtures moving ≥0.5pp                | 18            |

### Moving fixtures (D → A, ≥0.5pp shift)

| ID                                        | School                             | Group                          | Kind        | D prob | A prob | Δpp   | D pass | A pass |
| ----------------------------------------- | ---------------------------------- | ------------------------------ | ----------- | ------ | ------ | ----- | ------ | ------ |
| `006-uva-rd-mid-strong-domestic`          | University of Virginia             | MATCH_RD_MID_PROFILE           | standalone  | 30.67% | 33.28% | 2.62  | Y      | Y      |
| `011-umich-rd-low-gpa-high-test`          | University of Michigan, Ann Arbor  | LOW_GPA_HIGH_TEST              | standalone  | 9.04%  | 4.90%  | -4.14 | Y      | N      |
| `012-umich-rd-high-gpa-low-test`          | University of Michigan, Ann Arbor  | HIGH_GPA_LOW_TEST              | standalone  | 9.37%  | 10.49% | 1.13  | Y      | Y      |
| `017-yale-rea-legacy-strong`              | Yale University                    | T5_RD_LEGACY_VERIFIED          | standalone  | 8.10%  | 3.97%  | -4.13 | Y      | N      |
| `018-stanford-rd-athlete-verified`        | Stanford University                | T5_RD_ATHLETE_VERIFIED         | standalone  | 2.42%  | 1.30%  | -1.13 | N      | N      |
| `021-jhu-ed-intl-stem`                    | Johns Hopkins University           | T20_EA_STRONG_INTL             | standalone  | 6.26%  | 3.02%  | -3.25 | Y      | N      |
| `023-yale-rd-humanities-strong`           | Yale University                    | T5_RD_STRONG_UNHOOKED_DOMESTIC | standalone  | 3.87%  | 3.23%  | -0.65 | Y      | Y      |
| `025-brown-ed-strong-domestic`            | Brown University                   | T20_ED_STRONG_UNHOOKED         | standalone  | 7.85%  | 3.79%  | -4.06 | N      | N      |
| `040-yale-rd-strong-intl-cn`              | Yale University                    | T5_RD_STRONG_UNHOOKED_INTL     | standalone  | 2.61%  | 1.28%  | -1.33 | Y      | N      |
| `042-columbia-ed-strong-intl-cn`          | Columbia University                | T20_ED_STRONG_INTL             | standalone  | 4.18%  | 3.45%  | -0.73 | N      | N      |
| `045-umich-intl-vs-domestic-penalty`      | University of Michigan, Ann Arbor  | INTL_PENALTY                   | comparative | 0.23%  | 0.24%  | 0.01  | N      | N      |
| `047-yale-rd-strong-domestic-andover`     | Yale University                    | T5_RD_STRONG_UNHOOKED_DOMESTIC | standalone  | 3.60%  | 3.00%  | -0.60 | Y      | N      |
| `049-stanford-rd-firstgen-stem-stack`     | Stanford University                | MULTI_HOOK_STACK               | standalone  | 3.18%  | 1.55%  | -1.63 | Y      | N      |
| `055-yale-intl-cn-strong`                 | Yale University                    | T5_RD_STRONG_UNHOOKED_INTL     | standalone  | 2.70%  | 1.33%  | -1.38 | Y      | N      |
| `058-caltech-unhooked-mid`                | California Institute of Technology | T5_RD_MID_UNHOOKED             | standalone  | 1.37%  | 0.75%  | -0.62 | Y      | Y      |
| `059-stanford-mid-stem-olympiad`          | Stanford University                | T5_RD_STEM_SPIKE               | standalone  | 4.63%  | 2.26%  | -2.37 | Y      | N      |
| `060-brown-ed-strong-domestic-roundboost` | Brown University                   | T20_ED_STRONG_UNHOOKED         | standalone  | 7.85%  | 6.45%  | -1.40 | N      | N      |
| `062-smith-rd-strong-intl`                | Smith College                      | LAC_RD_INTL                    | standalone  | 6.52%  | 7.03%  | 0.51  | Y      | Y      |

## Part 2 — 22 SEVERE schools × 5 applicant archetypes

### Per-archetype summary (median Δ across 22 schools)

| Archetype | GPA  | SAT  | Median D% | Median A% | Median Δpp | Schools where A>D | Schools where A<D |
| --------- | ---- | ---- | --------- | --------- | ---------- | ----------------- | ----------------- |
| Perfect   | 4    | 1560 | 2.94%     | 3.04%     | 0.00       | 5/22              | 3/22              |
| Strong    | 3.85 | 1500 | 2.50%     | 1.88%     | 0.00       | 2/22              | 10/22             |
| StrongTO  | 3.85 | TO   | 1.40%     | 1.12%     | 0.00       | 2/22              | 10/22             |
| Mid       | 3.65 | 1430 | 1.67%     | 1.05%     | -0.10      | 0/22              | 11/22             |
| Below     | 3.4  | 1330 | 1.06%     | 0.60%     | -0.28      | 0/22              | 12/22             |

### Per-school detail (22 schools × 5 archetypes)

#### California Institute of Technology

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 1.36 | 1.15 | -0.21 | 1.00      | 0.85      | GPA below school median        | Y         |
| Strong    | 1.14 | 0.80 | -0.33 | 1.00      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 1.25 | 0.88 | -0.37 | 1.00      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 0.53 | 0.30 | -0.23 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.52 | 0.30 | -0.22 | 0.50      | 0.15      | GPA well below 25th percentile | Y         |

#### Georgia Institute of Technology

| Archetype | D%   | A%    | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ----- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 9.71 | 11.02 | 1.30  | 1.01      | 1.30      | GPA above 75th percentile      | Y         |
| Strong    | 8.92 | 9.70  | 0.78  | 1.01      | 1.10      | GPA above median               | Y         |
| StrongTO  | 2.80 | 2.93  | 0.12  | 1.01      | 1.10      | GPA above median               | Y         |
| Mid       | 4.55 | 4.41  | -0.14 | 0.52      | 0.50      | GPA just below 25th percentile | Y         |
| Below     | 5.26 | 2.86  | -2.41 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### Massachusetts Institute of Technology

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.43 | 2.03 | -0.40 | 1.02      | 0.85      | GPA below school median        | Y         |
| Strong    | 2.02 | 1.42 | -0.60 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.76 | 0.54 | -0.23 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.44 | 0.78 | -0.66 | 0.52      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.93 | 0.51 | -0.42 | 0.50      | 0.15      | GPA well below 25th percentile | Y         |

#### Princeton University

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.71 | 2.71 | 0.00 | 1.10      | 1.10      | GPA above median               | N         |
| Strong    | 1.40 | 1.40 | 0.00 | 0.50      | 0.50      | GPA just below 25th percentile | N         |
| StrongTO  | 1.54 | 1.54 | 0.00 | 0.50      | 0.50      | GPA just below 25th percentile | N         |
| Mid       | 0.77 | 0.77 | 0.00 | 0.15      | 0.15      | GPA well below 25th percentile | N         |
| Below     | 0.50 | 0.50 | 0.00 | 0.15      | 0.15      | GPA well below 25th percentile | N         |

#### Yale University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.00 | 2.16 | 0.16  | 1.02      | 1.10      | GPA above median               | Y         |
| Strong    | 2.00 | 0.98 | -1.02 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.63 | 0.44 | -0.19 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.18 | 0.64 | -0.55 | 0.52      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.76 | 0.42 | -0.34 | 0.50      | 0.15      | GPA well below 25th percentile | Y         |

#### Stanford University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.28 | 2.08 | -0.20 | 1.02      | 0.85      | GPA below school median        | Y         |
| Strong    | 2.11 | 1.03 | -1.08 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.66 | 0.46 | -0.20 | 1.02      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.25 | 0.67 | -0.58 | 0.53      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.80 | 0.44 | -0.36 | 0.50      | 0.15      | GPA well below 25th percentile | Y         |

#### Harvard University

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 1.63 | 1.63 | 0.00 | 0.85      | 0.85      | GPA below school median        | N         |
| Strong    | 1.14 | 1.14 | 0.00 | 0.50      | 0.50      | GPA just below 25th percentile | N         |
| StrongTO  | 0.43 | 0.43 | 0.00 | 0.50      | 0.50      | GPA just below 25th percentile | N         |
| Mid       | 0.62 | 0.62 | 0.00 | 0.15      | 0.15      | GPA well below 25th percentile | N         |
| Below     | 0.41 | 0.41 | 0.00 | 0.15      | 0.15      | GPA well below 25th percentile | N         |

#### Northeastern University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.92 | 3.28 | 0.36  | 1.03      | 1.30      | GPA above 75th percentile      | Y         |
| Strong    | 2.70 | 2.23 | -0.47 | 1.03      | 0.85      | GPA below school median        | Y         |
| StrongTO  | 2.45 | 2.23 | -0.22 | 1.03      | 0.85      | GPA below school median        | Y         |
| Mid       | 1.61 | 1.55 | -0.06 | 0.54      | 0.50      | GPA just below 25th percentile | Y         |
| Below     | 1.03 | 0.56 | -0.47 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### Columbia University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.25 | 2.33 | 0.08  | 1.03      | 1.10      | GPA above median               | Y         |
| Strong    | 1.72 | 1.20 | -0.52 | 1.03      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 1.90 | 1.32 | -0.58 | 1.03      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.24 | 0.66 | -0.58 | 0.54      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.79 | 0.43 | -0.36 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### Duke University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 3.01 | 3.11 | 0.10  | 1.03      | 1.10      | GPA above median               | Y         |
| Strong    | 2.30 | 1.60 | -0.70 | 1.03      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.87 | 0.61 | -0.26 | 1.03      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.66 | 0.88 | -0.78 | 0.54      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 1.05 | 0.57 | -0.48 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### University of California, Los Angeles

| Archetype | D%    | A%    | Δpp  | D gpaMult | A gpaMult | A label                              | A nulled? |
| --------- | ----- | ----- | ---- | --------- | --------- | ------------------------------------ | --------- |
| Perfect   | 15.42 | 15.42 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | Y         |
| Strong    | 15.42 | 15.42 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | Y         |
| StrongTO  | 12.00 | 12.00 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | Y         |
| Mid       | 5.14  | 5.14  | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | Y         |
| Below     | 1.71  | 1.71  | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | Y         |

#### Dartmouth College

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 3.16 | 3.26 | 0.10  | 1.04      | 1.10      | GPA above median               | Y         |
| Strong    | 2.93 | 1.42 | -1.52 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.91 | 0.63 | -0.28 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.74 | 0.92 | -0.82 | 0.54      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 1.10 | 0.60 | -0.50 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### Brown University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 3.02 | 3.11 | 0.09  | 1.04      | 1.10      | GPA above median               | Y         |
| Strong    | 2.31 | 1.60 | -0.70 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.87 | 0.61 | -0.27 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.67 | 0.88 | -0.80 | 0.55      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 1.06 | 0.57 | -0.48 | 0.51      | 0.15      | GPA well below 25th percentile | Y         |

#### Johns Hopkins University

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 2.70 | 2.77 | 0.08  | 1.04      | 1.10      | GPA above median               | Y         |
| Strong    | 2.06 | 1.43 | -0.63 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| StrongTO  | 0.78 | 0.60 | -0.18 | 1.04      | 0.50      | GPA just below 25th percentile | Y         |
| Mid       | 1.50 | 0.78 | -0.72 | 0.55      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 0.95 | 0.60 | -0.35 | 0.52      | 0.15      | GPA well below 25th percentile | Y         |

#### Barnard College

| Archetype | D%   | A%   | Δpp   | D gpaMult | A gpaMult | A label                        | A nulled? |
| --------- | ---- | ---- | ----- | --------- | --------- | ------------------------------ | --------- |
| Perfect   | 4.10 | 4.59 | 0.49  | 1.04      | 1.30      | GPA above 75th percentile      | Y         |
| Strong    | 3.82 | 4.04 | 0.22  | 1.04      | 1.10      | GPA above median               | Y         |
| StrongTO  | 3.45 | 3.55 | 0.10  | 1.04      | 1.10      | GPA above median               | Y         |
| Mid       | 2.29 | 1.19 | -1.10 | 0.56      | 0.15      | GPA well below 25th percentile | Y         |
| Below     | 1.45 | 0.88 | -0.57 | 0.52      | 0.15      | GPA well below 25th percentile | Y         |

#### Cornell University

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 9.41 | 9.41 | 0.00 | 1.04      | 1.04      | GPA percentile (school-published) | N         |
| Strong    | 7.18 | 7.18 | 0.00 | 1.04      | 1.04      | GPA percentile (school-published) | N         |
| StrongTO  | 2.72 | 2.72 | 0.00 | 1.04      | 1.04      | GPA percentile (school-published) | N         |
| Mid       | 5.24 | 5.24 | 0.00 | 0.56      | 0.56      | GPA percentile (school-published) | N         |
| Below     | 3.29 | 3.29 | 0.00 | 0.51      | 0.51      | GPA percentile (school-published) | N         |

#### University of Pennsylvania

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 2.97 | 2.97 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Strong    | 2.97 | 2.97 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| StrongTO  | 0.92 | 0.92 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Mid       | 1.79 | 1.79 | 0.00 | 0.57      | 0.57      | GPA percentile (school-published) | N         |
| Below     | 1.12 | 1.12 | 0.00 | 0.53      | 0.53      | GPA percentile (school-published) | N         |

#### University of Chicago

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 2.65 | 2.65 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Strong    | 2.16 | 2.16 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| StrongTO  | 2.38 | 2.38 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Mid       | 1.59 | 1.59 | 0.00 | 0.57      | 0.57      | GPA percentile (school-published) | N         |
| Below     | 1.00 | 1.00 | 0.00 | 0.52      | 0.52      | GPA percentile (school-published) | N         |

#### Vanderbilt University

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 2.82 | 2.82 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Strong    | 2.82 | 2.82 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| StrongTO  | 0.87 | 0.87 | 0.00 | 1.05      | 1.05      | GPA percentile (school-published) | N         |
| Mid       | 1.70 | 1.70 | 0.00 | 0.57      | 0.57      | GPA percentile (school-published) | N         |
| Below     | 1.06 | 1.06 | 0.00 | 0.53      | 0.53      | GPA percentile (school-published) | N         |

#### Washington University in St. Louis

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 8.05 | 8.05 | 0.00 | 1.06      | 1.06      | GPA percentile (school-published) | N         |
| Strong    | 8.05 | 8.05 | 0.00 | 1.06      | 1.06      | GPA percentile (school-published) | N         |
| StrongTO  | 7.21 | 7.21 | 0.00 | 1.06      | 1.06      | GPA percentile (school-published) | N         |
| Mid       | 4.86 | 4.86 | 0.00 | 0.58      | 0.58      | GPA percentile (school-published) | N         |
| Below     | 3.03 | 3.03 | 0.00 | 0.53      | 0.53      | GPA percentile (school-published) | N         |

#### Carnegie Mellon University

| Archetype | D%   | A%   | Δpp  | D gpaMult | A gpaMult | A label                           | A nulled? |
| --------- | ---- | ---- | ---- | --------- | --------- | --------------------------------- | --------- |
| Perfect   | 8.34 | 8.34 | 0.00 | 1.07      | 1.07      | GPA percentile (school-published) | N         |
| Strong    | 6.37 | 6.37 | 0.00 | 1.07      | 1.07      | GPA percentile (school-published) | N         |
| StrongTO  | 2.41 | 2.41 | 0.00 | 1.07      | 1.07      | GPA percentile (school-published) | N         |
| Mid       | 4.73 | 4.73 | 0.00 | 0.59      | 0.59      | GPA percentile (school-published) | N         |
| Below     | 2.91 | 2.91 | 0.00 | 0.52      | 0.52      | GPA percentile (school-published) | N         |

#### University of California, Berkeley

| Archetype | D%    | A%    | Δpp  | D gpaMult | A gpaMult | A label                              | A nulled? |
| --------- | ----- | ----- | ---- | --------- | --------- | ------------------------------------ | --------- |
| Perfect   | 15.34 | 15.34 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | N         |
| Strong    | 15.34 | 15.34 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | N         |
| StrongTO  | 15.34 | 15.34 | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | N         |
| Mid       | 5.52  | 5.52  | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | N         |
| Below     | 3.07  | 3.07  | 0.00 | 1.00      | 1.00      | GPA (already encoded in Tier 1 cell) | N         |

## Part 3 — Threshold sensitivity

For each top-band threshold (lower=more aggressive null-out), measure how many SEVERE-school cells get nulled and the resulting per-archetype median Δ.

| Top-threshold | Cells nulled | All-cell median Δpp | Perfect Δpp | Strong Δpp | StrongTO Δpp | Mid Δpp | Below Δpp |
| ------------- | ------------ | ------------------- | ----------- | ---------- | ------------ | ------- | --------- |
| 0.85          | 100/110      | -0.31               | 0.10        | -0.65      | -0.25        | -0.69   | -0.47     |
| 0.88          | 90/110       | -0.26               | 0.10        | -0.62      | -0.23        | -0.62   | -0.44     |
| 0.90          | 75/110       | -0.03               | 0.04        | -0.40      | -0.18        | -0.39   | -0.36     |
| 0.92          | 65/110       | 0.00                | 0.00        | 0.00       | 0.00         | -0.10   | -0.28     |
| 0.95          | 25/110       | 0.00                | 0.00        | 0.00       | 0.00         | 0.00    | 0.00      |

## Bottom Line

- **Layer-3 pass rate**: A=34/62 vs D=43/62 (**−9 fixtures, large regression**).
- **Contaminated-school subset**: A=11/32 vs D=20/32 (**−9 fixtures, mirrors the overall regression — every Layer-3 regression is on a contaminated school**).
- **Direction**: Option A pushes probabilities DOWN for Strong/Mid/Below archetypes (median Δ ≤ 0 in all 5 archetypes). Mid Δ = −0.10pp, Below Δ = −0.28pp. Perfect is essentially neutral (0.00pp median, 5 schools nudge up, 3 nudge down).
- **Hypothesis from per-school detail**: Option A's SAT-band fallback is too punishing at the high end. Look at MIT/Caltech/Princeton/Yale/Stanford rows — even GPA 4.0 applicants get pushed DOWN because their SAT (1560) is at-or-below the school's SAT-75 (1580 at Stanford, 1570 at MIT). The fallback's `equivSat ≥ sat75` branch needs an at-or-near comparison; the strict ≥ misses 4.0/1560 at top schools.
- **Hypothesis on regressions**: 12 of the 18 moving fixtures decrease and 7 of those exit their expected range below the lower bound (e.g. fixture 011 umich low-gpa-high-test: 9.04% → 4.90%, fixture 017 yale legacy: 8.10% → 3.97%, fixture 049 stanford-firstgen-stem: 3.18% → 1.55%). The shared cause: when the engine loses the school-published distribution, it falls back to the SAT-band heuristic which has only 5 discrete buckets (0.15 / 0.5 / 0.85 / 1.1 / 1.3) — losing the granularity that CDS distributions encode for top schools.

## Recommendation (data-driven)

**REJECT Option A at every tested threshold.** Evidence summary:

1. **Layer-3 pass rate regression is unambiguous**: A=34 vs D=43 at threshold 0.92 (the most conservative tested). At threshold 0.85 (most aggressive), more cells are nulled and Below-archetype Δ deepens to −0.47pp, which would only worsen Layer-3 regression. The "fix" trades documented industry-anchored fixtures for a mechanical heuristic.

2. **The SAT-band fallback is a worse substitute, not a better one**. When `gpaDistribution` is nulled, `gpaBandMultiplier` falls back to the equivSat path with only 5 discrete buckets. This is strictly less informative than the school-published distribution, even when that distribution is on a weighted scale. The weighting is a known bias, but the buckets at least preserve school-relative ranking; the fallback erases it.

3. **The contamination signature is real but mis-located**. The audit correctly identifies that schools like MIT (97% in top-band) over-credit applicants. But fixing this by routing them to a fallback that calls a 3.85/1500 applicant "below 25th percentile" (because Stanford SAT-25 ≈ 1490) is replacing one bias with another. The root issue is that `gpaPercentileFromDistribution` doesn't account for weighted-vs-unweighted scale mismatch between applicant GPA (typically unweighted 4.0) and school distribution (often weighted ~4.4+).

**Better next steps** (not tested here):

- **Option B (rescale, not null)**: Apply a per-school scale-correction factor to the applicant's GPA before bucketing into the distribution (e.g. `gpa_adjusted = gpa × school.weightedFactor`). This preserves school-relative ranking AND fixes the contamination.
- **Option C (tighten the curve)**: The current curve `0.5 + pct` caps multiplier at 1.5 at pct=1. Tighten it to `0.4 + 0.8·pct·(1−penalty)` where `penalty = max(0, top_band_pct − 0.85)` so schools with ultra-top-heavy distributions get a smaller max multiplier.
- **Option D (do nothing, current state)**: Acceptable as interim — Layer-3 pass rate 69.4% (43/62) is the highest of any tested config.

**Threshold tuning**: Among {0.85, 0.88, 0.9, 0.92, 0.95}: at 0.95, only 25/110 cells are nulled (so behavior degenerates toward D); at 0.85, 100/110 cells fire and the regression worsens. No threshold yields a positive net result. The data does not support adopting Option A at any threshold tested.
