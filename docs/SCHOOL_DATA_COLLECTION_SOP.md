# School Data Collection SOP (No-Sample Era)

**Last reviewed**: 2026-05-14
**Owner**: Data operations
**Authoritative policy**: [ADR-0020](adr/0020-prediction-no-sample-calibration.md), [PREDICTION_ACCURACY_STRATEGY.md](PREDICTION_ACCURACY_STRATEGY.md)

> This SOP exists because, under our no-sample policy, prediction accuracy is bounded by how complete and current the school's **publicly available, full-applicant-pool** data is. Filling these gaps is now the highest-leverage accuracy investment.

---

## 1. Data sources we accept

In strict priority order. Always cite the source URL when you record a value.

| Tier                                       | Source                                                                                                                                            | Examples                                             | When to use                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| **Tier 1 — Official, full pool**           | School's Common Data Set (CDS) PDF; school institutional research (IR) / Office of Institutional Research page; federal IPEDS / College Scorecard | `https://oira.harvard.edu/common-data-set/`          | First choice — always try here first                           |
| **Tier 2 — Aggregator citing official**    | Clastify, BigFuture, Naviance, US News (only when the underlying source is named)                                                                 | `https://www.clastify.com/blog/acceptance-rates/...` | Acceptable as MEDIUM confidence with a citation                |
| **Tier 3 — News / official press release** | School admission stat announcements, university press office, Daily Cal etc.                                                                      | `https://www.brown.edu/news/2024-01-25/...`          | Acceptable for _policy_ fields (e.g. `needBlindInternational`) |
| **❌ DO NOT use**                          | This platform's user-reported outcomes; agency blogs that don't cite a source; "based on past students" estimates                                 | —                                                    | Prohibited — see ADR-0020                                      |

**Rule**: Any value you write must trace back to a URL where the school or a federal data source published the number. If you can't find one, leave the field as `null` and mark the row "INSUFFICIENT_PUBLIC_DATA" in your tracking sheet.

---

## 2. Where the data ends up

| Schema field                              | Type          | What it means                                                                                   |
| ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| `School.acceptanceRate`                   | Decimal(5,2)  | Overall first-year admit rate (percentage, e.g. 4.55)                                           |
| `School.intlAcceptanceRate`               | Decimal(5,2)? | First-year admit rate for international applicants only                                         |
| `School.oosAcceptanceRate`                | Decimal(5,2)? | Out-of-state freshman admit rate (for US publics)                                               |
| `School.needBlindInternational`           | Boolean?      | `true` = verified need-blind for intl; `false` = verified need-aware; `null` = not yet reviewed |
| `School.sat25`, `sat75`, `act25`, `act75` | Int?          | Composite score 25th / 75th percentile for enrolled freshmen                                    |
| `School.testingPolicy`                    | enum          | `REQUIRED \| OPTIONAL \| BLIND \| UNKNOWN`                                                      |
| `School.hasEarlyDecision`                 | Boolean       | Whether the school offers ED at all                                                             |

(See `apps/api/prisma/schema.prisma` for the full School model.)

Each write should also populate `School.metadata.provenance.<field>` with `{ source, sourceUrl, confidence, dataYear, reviewedBy, reviewedAt }`. The current admin edit dialog and the `BulkUpdateSchoolRates` endpoint both handle this automatically.

---

## 3. Daily workflow

### Step 1 — Pull the action list

Open `/admin/schools/data-health`. The dashboard ranks schools by `importanceWeight × gapWeight` so the top of the list is where each hour of work pays back the most.

Use the **Focus** filter to pick a campaign:

- `intl` — fix `intlAcceptanceRate` + `needBlindInternational` (most impactful for Chinese applicants)
- `rounds` — fix `acceptanceRate` + `oosAcceptanceRate`
- `academic` — fix SAT/ACT distribution + `testingPolicy`
- `all` — combined gap score

Aim for batches of 20-30 schools per session.

### Step 2 — Find the source

For each school in the action list:

1. **CDS first.** Try one of these URL shapes:
   - `https://oir.<domain>/common-data-set/`
   - `https://ir.<domain>/cds/`
   - `https://<domain>/about/institutional-research/`
   - Google: `"<school name>" "common data set" filetype:pdf`

2. **Map CDS sections to our fields**:

   | Our field            | CDS section                                                                                                    |
   | -------------------- | -------------------------------------------------------------------------------------------------------------- |
   | `acceptanceRate`     | Section C1 (Applicants → Admits → Enrolled)                                                                    |
   | `intlAcceptanceRate` | Section B (enrolled intl) or Section C7 (rare). If only enrolled is published, compute carefully or leave null |
   | `sat25` / `sat75`    | Section C9 (25th and 75th percentile composite)                                                                |
   | `act25` / `act75`    | Section C9 (ACT composite percentiles)                                                                         |
   | `oosAcceptanceRate`  | Section C1 (out-of-state vs in-state breakdown — only for US publics)                                          |
   | `testingPolicy`      | Section C8                                                                                                     |
   | `hasEarlyDecision`   | Section C21 (early decision plan offered?)                                                                     |

3. **If CDS doesn't break out international**, try the school's admission stats page (e.g. `<domain>/admission/apply/admission-statistics`). Many top schools publish "Class of YYYY: X intl admitted from Y intl applicants" — this is acceptable as HIGH confidence.

4. **For `needBlindInternational`**, use the school's official financial aid page only. Sample-vetted sources are listed in [seed-intl-schools.ts](../apps/api/prisma/seed-intl-schools.ts) — extend that file when you confirm a new school.

### Step 3 — Write the data

Two paths:

**A. One-off via admin UI** (5-10 schools at a time):
Go to `/admin/schools`, find the row, click **Edit**. The edit dialog records provenance automatically (you must paste the source URL).

**B. Bulk via API** (20+ schools at once):
Use `POST /admin/schools/rates/bulk-update`. Each row needs `{ schoolId, intlAcceptanceRate, source, sourceUrl, dataYear, confidence }`. See `apps/api/src/modules/admin/admin-school-rates.service.ts` for the schema. Set `dryRun: true` first to validate.

### Step 4 — Refresh the dashboard

Click **Refresh** on `/admin/schools/data-health`. The schools you fixed should drop off (or move down) the list.

---

## 4. Confidence levels

When recording provenance, use:

- **HIGH** — School's own statistics page or CDS PDF on the school's domain. Numeric values match exactly.
- **MEDIUM** — Aggregator (Clastify, BigFuture, US News profile) that cites the school's number. The aggregator's number must match a quotation traceable to the school.
- **LOW** — A reasonable estimate from a single secondary source without a clear primary. _Avoid writing these to the database_; leave `null` instead.

The counselor engine reads `fieldTrustWeights` from provenance:

- HIGH (TIER `OFFICIAL`) → weight 1.0
- MEDIUM (TIER `MANUAL_REVIEW`) → weight 0.6
- HEURISTIC → weight 0.5
- Missing → weight 0.0 (engine falls back to selectivity heuristic and widens the confidence interval)

---

## 5. Quality checks before you save

1. **Sanity range**:
   - `acceptanceRate`, `intlAcceptanceRate`, `oosAcceptanceRate`: 0.5 ≤ value ≤ 99.0 (stored as percentage)
   - `intlAcceptanceRate` should usually be **lower** than overall. Exceptions: Penn State, UF, UWisc, Purdue (intl pool is self-selected and often less competitive than OOS-domestic). Flag in `notes` field if you find an exception.
   - `sat25 < sat75`, both in `[400, 1600]`
   - `act25 ≤ act75`, both in `[1, 36]`
2. **Year tagging**: Always record `dataYear` (e.g. `"2024-2025"`). A 4-year-old number is still useful with the right year tag; an unlabeled number is dangerous.
3. **`needBlindInternational`**:
   - Verified `true` only when the school's own page says "need-blind for international applicants" AND "meets full demonstrated need" — both are required. Border cases like Georgetown ("need-blind but limited aid") should stay `null`.
   - Verified `false` only when the school's page is explicit about need-aware status (e.g. Stanford, Cornell, Penn). Don't infer "false" from absence of a need-blind statement.
   - Default for unreviewed schools is `null`.

---

## 6. Known recurring patterns

| Pattern                                                                            | What to do                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ivy-tier school doesn't publish intl admit rate                                    | Cite Clastify as MEDIUM. Do not estimate from "X% of enrolled are intl" — yield rates differ                                                                                       |
| Public state university — `oosAcceptanceRate` exists, `intlAcceptanceRate` doesn't | Most US publics classify intl as OOS but their admit yields differ. Record `oosAcceptanceRate`; leave `intlAcceptanceRate` null unless the school publishes a separate intl number |
| Old CDS (2019-20 or earlier) is the only source                                    | Acceptable if dataYear tag is honest. Open a follow-up ticket to recheck once a newer CDS appears                                                                                  |
| School announces a policy change mid-cycle (e.g. Brown 2024)                       | Update `needBlindInternational` only after the policy is **in effect** for incoming applicants. Past-cycle predictions should not be retroactively edited                          |

---

## 7. What to do if you can't find data

Mark the row in your tracking sheet as `INSUFFICIENT_PUBLIC_DATA` and leave the field as `null` in the database. The counselor engine handles `null` by using a selectivity-tiered heuristic and widening the confidence interval. **Do not** write a "best guess" — that's exactly the silent-bias-amplification pattern we're avoiding.

For high-priority schools (Top 50) where data is truly unobtainable, file a ticket with title `data-gap-{school-name}` and include the URLs you checked.

---

## 8. Tracking

Maintain a campaign spreadsheet (template TBD) with columns:

- school name
- field worked on
- source URL
- dataYear
- value entered
- confidence (HIGH/MEDIUM)
- reviewer
- reviewed-at date
- notes

Spot-checks: every 50 rows, a second reviewer pulls 5 random rows and reverifies the source. Disagreements get logged.

---

## 9. Related runbooks

- [PREDICTION_ACCURACY_STRATEGY.md](PREDICTION_ACCURACY_STRATEGY.md) — Phase C roadmap
- [DATA_SOURCES.md](DATA_SOURCES.md) — College Scorecard / IPEDS sync, automated paths
- [adr/0017-school-data-provenance.md](adr/0017-school-data-provenance.md) — How provenance is stored
- [adr/0020-prediction-no-sample-calibration.md](adr/0020-prediction-no-sample-calibration.md) — Why this work matters
