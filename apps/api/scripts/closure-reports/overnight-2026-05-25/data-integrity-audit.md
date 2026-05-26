# School Table Data Integrity Audit (beyond weighted GPA)

**Date**: 2026-05-26
**Scope**: 243 School rows in prod (`study-abroad-prod-2025`)
**Reviewer**: data-model-reviewer agent
**TSV**: `/tmp/data-integrity-violators.tsv` (78 rows)

---

## Check 1: SAT range sanity (400–1600, sat25 ≤ sat75)

```sql
SELECT id, name, sat25, sat75 FROM "School"
WHERE (sat25 IS NOT NULL OR sat75 IS NOT NULL)
  AND NOT (
    (sat25 IS NULL OR (sat25 >= 400 AND sat25 <= 1600))
    AND (sat75 IS NULL OR (sat75 >= 400 AND sat75 <= 1600))
    AND (sat25 IS NULL OR sat75 IS NULL OR sat25 <= sat75)
  );
```

**Violators**: 0 — **CLEAN**. Severity: INFO.

(Also verified SAT subscore consistency: satMath25/75 ∈ [200,800], satReading25/75 ∈ [200,800], 25 ≤ 75, and sat25 ≈ satMath25 + satReading25. All clean.)

---

## Check 2: ACT range sanity (1–36, act25 ≤ act75)

```sql
SELECT id, name, act25, act75 FROM "School"
WHERE (act25 IS NOT NULL OR act75 IS NOT NULL)
  AND NOT (
    (act25 IS NULL OR (act25 >= 1 AND act25 <= 36))
    AND (act75 IS NULL OR (act75 >= 1 AND act75 <= 36))
    AND (act25 IS NULL OR act75 IS NULL OR act25 <= act75)
  );
```

**Violators**: 0 — **CLEAN**. Severity: INFO.

---

## Check 3: Acceptance-rate sanity (0–100)

```sql
SELECT … FROM "School"
WHERE "acceptanceRate" NOT BETWEEN 0 AND 100
   OR "oosAcceptanceRate" NOT BETWEEN 0 AND 100
   OR "intlAcceptanceRate" NOT BETWEEN 0 AND 100
   OR "edAcceptanceRate" NOT BETWEEN 0 AND 100
   OR "eaAcceptanceRate" NOT BETWEEN 0 AND 100
   OR "ed2AcceptanceRate" NOT BETWEEN 0 AND 100
   OR "transferAcceptanceRate" NOT BETWEEN 0 AND 100
   OR "yieldRate" NOT BETWEEN 0 AND 100;
```

**Violators**: 0 out-of-range — **CLEAN**.

### Check 3b: Fractional-vs-percent convention drift

Sub-check: schools where one rate is sub-1 while overall is normal (suggests fraction stored where percent expected).

```sql
SELECT … WHERE rate > 0 AND rate < 1 AND "acceptanceRate" >= 5;
```

**Violators**: 9 rate values across 5 schools — **BLOCKING**.

| School                            | overall | oos      | intl     | ed       | ea       |
| --------------------------------- | ------- | -------- | -------- | -------- | -------- |
| University of Chicago             | 4.79    | —        | 1.92     | **0.16** | **0.11** |
| Pomona College                    | 6.76    | **0.06** | **0.04** | 12.54    | —        |
| Amherst College                   | 9.01    | **0.08** | 2.65     | 29.39    | 61.00    |
| Williams College                  | 9.99    | **0.09** | **0.04** | 27.04    | —        |
| University of Michigan, Ann Arbor | 15.64   | 18.00    | **0.11** | —        | **0.18** |

These values are 100× too small. UMich oosAcceptanceRate=18 is correct; intl=0.11 should likely be 11 or similar. The 0.06–0.16 family looks consistent with **someone stored a fraction (e.g. 0.0006) and a downstream multiplier dropped a step**. Impact: prediction engine reads these as 0.06% acceptance, materially distorting odds at HYPSM-class schools.

**Severity: BLOCKING** — fix before any prediction re-run.

---

## Check 4: gpaDistribution bands sum ∈ [0.95, 1.05]

```sql
WITH parsed AS (… SUM of bands …)
SELECT … FROM parsed
WHERE total NOT BETWEEN 0.95 AND 1.05 AND total NOT BETWEEN 95 AND 105;
```

**Out-of-range** (neither 1.0 nor 100): 0 — **CLEAN** (SMU 110% fix held).

### Check 4b: Mixed convention (fraction vs percent)

```sql
SELECT bucket, COUNT(*) FROM (…) GROUP BY bucket;
```

| Bucket                                             | Schools |
| -------------------------------------------------- | ------- |
| fractional (0–1) — **expected per schema comment** | 184     |
| **percentage (0–100) — convention drift**          | **12**  |

The 12 percentage-format schools (totals ~100):

| School                      | Total  | Format |
| --------------------------- | ------ | ------ |
| Seton Hall University       | 101    | pct    |
| Whitman                     | 100.1  | pct    |
| Clarkson University         | 100.1  | pct    |
| University of Vermont       | 100.01 | pct    |
| Baruch                      | 100.00 | pct    |
| University of Maine         | 100.00 | pct    |
| University of Pittsburgh    | 100    | pct    |
| Reed                        | 100.0  | pct    |
| Augustana university        | 100.0  | pct    |
| Pacific Lutheran University | 100.0  | pct    |
| Pitzer                      | 99.9   | pct    |
| Macalester                  | 99.9   | pct    |

Per `schema.prisma:1423` the documented shape is `{ "3.75-4.00": 0.91, ... }` (fractional). The 12 outliers store percentages — they will be interpreted as 100× too large in `gpaBandMultiplier` → catastrophic GPA-percentile blow-up.

**Severity: BLOCKING.**

---

## Check 5: Round-rate consistency

### 5a: `oosAcceptanceRate > acceptanceRate + 30`

3 violators (all public; one is a true outlier, others sanity-flag only):

| School                     | overall | oos   | delta  |
| -------------------------- | ------- | ----- | ------ |
| San Diego State University | 35.97   | 87.06 | +51.09 |
| SUNY Binghamton University | 38.61   | 79.18 | +40.57 |
| Cal Poly San Luis Obispo   | 29.96   | 62.08 | +32.12 |

**Severity: WARNING** — possible (CSU campuses' OOS pool is small and self-selecting), but worth a manual sanity check.

### 5b: ED rate < 0.7× overall

3 violators (excluding fractional-drift entries already in Check 3b):

| School                    | overall | ed    | ratio                |
| ------------------------- | ------- | ----- | -------------------- |
| University of Chicago     | 4.79    | 0.16  | 0.03 (covered by 3b) |
| Colorado State University | 88.64   | 31.81 | 0.36                 |
| Colorado School of Mines  | 58.00   | 31.81 | 0.55                 |

The Colorado pair share identical ED/EA values from the **wrong school's CDS** (`coloradocollege.edu`). See "Cross-contamination" below.

### 5c: ED rate > 3× overall

8 violators:

| School                                    | overall | ed        | ratio | likely fabrication?                                                                    |
| ----------------------------------------- | ------- | --------- | ----- | -------------------------------------------------------------------------------------- |
| Northeastern University                   | 5.22    | 43.05     | 8.25  | **yes** — Northeastern's actual ED admit rate has been reported around 25–30%, not 43% |
| **University of California, Los Angeles** | 8.97    | **40.00** | 4.46  | **yes — UCLA does not offer ED at all**                                                |
| Tulane University                         | 13.98   | 59.40     | 4.25  | **yes** — provenance shows `1156/1946=59.4` which looks like aggregate not ED-only     |
| Dartmouth College                         | 5.40    | 19.18     | 3.55  | plausible (Dartmouth ED is ~20%)                                                       |
| Columbia University                       | 3.86    | 13.23     | 3.43  | plausible                                                                              |
| Amherst College                           | 9.01    | 29.39     | 3.26  | plausible                                                                              |
| Grinnell College                          | 12.68   | 40.80     | 3.22  | plausible                                                                              |
| Duke University                           | 5.71    | 17.33     | 3.04  | plausible                                                                              |

**Severity: WARNING** overall, **BLOCKING** for UCLA / Northeastern / Tulane (likely fabricated; see X-FABRICATED + X-CROSS_CONTAMINATION below).

### 5d: EA rate < 0.5× overall

5 violators; 2 are fractional-drift (UMich, UChicago — already in 3b). The other 3:

| School                    | overall | ea    | ratio                      |
| ------------------------- | ------- | ----- | -------------------------- |
| Colorado State University | 88.64   | 20.57 | 0.23 (cross-contamination) |
| Colorado School of Mines  | 58.00   | 20.57 | 0.35 (cross-contamination) |
| Manhattan School of Music | 78.94   | 36.00 | 0.46                       |

---

## Check 6: Duplicate detection

### 6a: Exact `nameNorm` duplicates

**0** — unique constraint holds.

### 6b: Probable duplicates (short-form + no external IDs)

| Row                                                         | Issue                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **UMN** (id `cmks30b1e00119vii…`) — **all key fields NULL** | Almost certainly a duplicate/orphan of `University of Minnesota, Twin Cities` (which exists) |
| Reed                                                        | No ipedsId/scorecardId; possibly distinct (Reed College, OR) but no full-name twin in DB     |
| Baruch                                                      | Same — likely Baruch College (CUNY)                                                          |
| Pitzer / Whitman / Macalester                               | Same — LACs, no full-name twin                                                               |

**Severity for UMN: BLOCKING** (zero-data orphan that clutters search + breaks join semantics). The other 5 short-names need a separate normalization pass but are not blocking; they all carry full data otherwise.

---

## Check 7: CLOSED ClosureTargets where the School column is still NULL

```sql
WITH ct AS (SELECT ct.*, to_jsonb(s.*) AS row FROM "ClosureTarget" ct JOIN "School" s ON s.id = ct."entityId"
            WHERE ct.status='CLOSED' AND ct."entityType"='School')
SELECT … WHERE jsonb_typeof(row -> field) = 'null';
```

**Violators**: 34 (out of 5,471 CLOSED CTs = 0.62%). All 34 are real sync drift, split:

| Pattern                                                                                                  | Count | Verdict                                                                          |
| -------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `description` / `descriptionZh` marked CLOSED, notes say "Composed from X.edu About", School column NULL | 16    | **Sync drift** — closure run wrote CT but never wrote the column                 |
| `edAcceptanceRate` CT marked CLOSED, notes describe OOS Section C1 residency data (not ED)               | 17    | **Wrong field tag** — closure was actually for `oosAcceptanceRate`, mis-tagged   |
| `oosAcceptanceRate` CT for RIT, notes describe Early Decision I admit rate 72.2%                         | 1     | **Wrong field tag** — mirror image (closure was actually for `edAcceptanceRate`) |

Affected schools for description sync drift: Augustana, Baruch, Macalester, Pacific Lutheran, Pitzer, Reed, Wheaton (MA), Whitman.

Affected schools for ed↔oos field-tag swap: Appalachian State, Cal State Fullerton, Cal State Sacramento, FIU, Idaho State, NDSU, Old Dominion, San Jose State, Towson, UMass Boston, UMass Lowell, UNC Wilmington, UTSA, U Toledo, Wayne State, Wright State, U Rhode Island, RIT.

**Severity: WARNING** — operationally annoying (CT board shows green but column is empty), but the prediction engine just reads as null. The wrong-field tagging is mildly dangerous because if the engine ever re-imports from CT, it could write OOS data into the ED column.

---

## Check 8: Cycle-year consistency in `metadata.provenance`

```sql
WITH per_field AS (… (kv.value->>'cycleYear')::int AS year …)
SELECT span_years, COUNT(*) FROM (…) GROUP BY span_years;
```

| `MAX(year) – MIN(year)` | Schools |
| ----------------------- | ------- |
| 0                       | 119     |
| 1 (2023 ↔ 2024)         | 101     |

**Severity: INFO** — span=1 is the expected steady-state for CDS data: different fields publish on different cycles, so the same school can legitimately have 2023 SAT data and 2024 acceptance data. No schools span >1 year. Not a bug.

---

## Check 9: Engine-consumed fields present for usNewsRank ≤ 30

```sql
SELECT COUNT(*) FILTER (WHERE … IS NULL), ... FROM "School" WHERE "usNewsRank" <= 30;
```

| Field               | Missing in top-30 | Note                                                                                                                                                                                                 |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| acceptanceRate      | 0 / 69            | clean                                                                                                                                                                                                |
| sat25 / sat75       | 0 / 69            | clean                                                                                                                                                                                                |
| **gpaDistribution** | **30 / 69**       | most gaps are LACs + arts schools (RISD, Juilliard, Berklee, Cooper Union, Pomona, Williams, Amherst, Swarthmore, Carleton, Bowdoin, Wellesley, Middlebury, Bates, Hamilton, Haverford, Colby, etc.) |

Note: `usNewsRank ≤ 30` matches 69 rows because the rank is shared across LAC + national university + specialty buckets.

**Severity: WARNING** — known gap; LACs/arts schools rarely publish CDS C9 GPA bands. Engine should handle null gracefully (verify path), and a `gpaBandMultiplier` fallback should be set explicitly rather than silent.

---

## Check 10: Intl rate >> overall (intl usually lower)

```sql
SELECT … WHERE "intlAcceptanceRate" > "acceptanceRate" + 30;
```

| School                      | overall | intl      | delta  |
| --------------------------- | ------- | --------- | ------ |
| University of South Florida | 43.19   | **89.90** | +46.71 |

Provenance is empty for this row. USF's intl acceptance rate around 89.9% looks plausible for a moderately-selective state public that recruits intl, but the **89.90 specifically with no source** is a red flag.

**Severity: WARNING.**

(Williams/Pomona/UChicago/UMich intl values <0.5 are caught by Check 3b above.)

---

## Bonus checks (all clean)

- SAT subscore ranges + 25 ≤ 75: 0 violators
- `sat25 ≈ satMath25 + satReading25` (within ±20): 0 violators
- `graduationRate / retentionRate / percentNeedMet / loanDefaultRate` ∈ [0,100]: 0 violators
- Hook fields: `legacyClassPct / athleteClassPct / firstGenClassPct` ∈ [0,1]; multipliers ∈ [0,50]: 0 violators

---

## Cross-contamination flagged separately

Discovered while inspecting Check 5: 4 schools have ED/EA values traced to the wrong source PDF.

| School                                    | ED    | EA    | Source URL claimed                                                                                                                                                                                  |
| ----------------------------------------- | ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Colorado School of Mines**              | 31.81 | 20.57 | `coloradocollege.edu/.../CDS_2024-2025.pdf` **← Colorado College, not Mines**                                                                                                                       |
| **Colorado State University**             | 31.81 | 20.57 | `coloradocollege.edu/.../CDS_2024-2025.pdf` **← Colorado College, not CSU**                                                                                                                         |
| **University of California, Los Angeles** | 40.00 | 50.00 | UCLA's own CDS, but the **notes literally say** _"C21 indicates no early decision and no early action plan, so no counts reported"_ — the values are fabricated despite the source flagging absence |
| **Tulane University**                     | 59.40 | 10.00 | Tulane CDS; formula `1156/1946=59.4` reads like overall admits/applied not ED-only                                                                                                                  |

All four were extracted in the `CDS_LLM_EXTRACT_2026_04` wave by the LLM CDS extractor. The pattern: the extractor returned numbers even when the source said "no ED/EA plan" or when it confused one school's PDF with another's.

**Severity: BLOCKING** — these directly drive `roundMultiplier` in prediction. UCLA being told it has 40% ED is a major model-behavior bug.

---

## Severity rollup

| Severity     | Distinct issues                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BLOCKING** | **5** — (1) 5 schools w/ fractional-drift sub-1 rates · (2) 12 schools w/ percentage-format gpaDistribution · (3) UMN orphan row · (4) Colorado School of Mines + Colorado State cross-contaminated ED/EA from Colorado College PDF · (5) UCLA ED/EA fabricated despite source saying "no ED/EA" |
| **WARNING**  | 6 — OOS-too-high (3 CSU/SUNY), ED-low (2 Colorado pair), ED-high suspicious (Tulane, Northeastern — actually BLOCKING-grade once you check the source), EA-low (3), CLOSED-but-NULL CT (34 rows, 0.6% drift), top-30 missing gpaDistribution (30 rows, mostly LAC/arts), USF intl 89.9%          |
| **INFO**     | SAT/ACT ranges, subscores, graduation/retention/needMet/loanDefault ranges, hook fields, cycle-year span=1                                                                                                                                                                                       |
