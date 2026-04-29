# Verified Real CDS Pipeline

This pipeline is intentionally conservative: Tavily discovers leads, but only
multi-validated official data may be imported as real.

## 1. Audit Current Real Coverage

```bash
pnpm --filter api audit:verified-cds
```

Buckets are intentionally separate:

- `verifiedReal`: strict import with official source, original formula, and at
  least two validators.
- `partialReal`: one or more verified fields, usually OOS without international.
- `legacyOfficialUnverified`: older official imports that predate the strict
  validator metadata. Do not count these as newly verified until rechecked.
- `heuristic`: estimate only; not real data.
- `noPublicRealData`, `blocked`, `manualReview`: terminal or review states.

## 2. Discover Leads With 15 Tavily Keys

Dry-run queue:

```bash
pnpm --filter api cds:marathon -- --dry-run --limit 40
```

Live discovery:

```bash
pnpm --filter api cds:marathon -- \
  --target-exhausted-keys 15 \
  --fields intlAcceptanceRate,oosAcceptanceRate \
  --max-stages 5 \
  --max-results 8
```

The marathon writes:

- `tavily-marathon-ledger-YYYY-MM-DD.json`
- `tavily-marathon-registry-YYYY-MM-DD.json`

Restart with the same command; the ledger is resumable.

## 3. Extract And Verify

For each candidate URL, verify:

- official school/system source
- first-time first-year C1 residency table
- applicants/admitted counts retained in notes
- math matches rates within 0.1 percentage points
- at least two validators agree

Example import-ready row:

```json
{
  "schoolNameNorm": "north dakota state university",
  "cycleYear": 2024,
  "sourceUrl": "https://www.ndsu.edu/.../NDSU_CDS_2024-2025.xlsx",
  "applicants": {
    "total": 7228,
    "inState": 2055,
    "outOfState": 5058,
    "international": 115
  },
  "admitted": {
    "total": 6864,
    "inState": 1925,
    "outOfState": 4839,
    "international": 100
  },
  "rates": {
    "acceptanceRate": 94.96,
    "intlAcceptanceRate": 86.96,
    "oosAcceptanceRate": 95.67
  },
  "notes": "C1 first-time first-year: Intl 100/115=86.96%; OOS 4839/5058=95.67%.",
  "verification": {
    "status": "VERIFIED_REAL",
    "sourceType": "CDS_OFFICIAL",
    "extractionMethod": "xlsx_parser",
    "officialSource": true,
    "validators": [
      { "name": "xlsx-cell-parser", "method": "parser", "passed": true },
      { "name": "manual-formula-review", "method": "manual", "passed": true }
    ]
  }
}
```

## 4. Import Strictly

Strict mode is the default:

```bash
pnpm --filter api exec tsx scripts/import-cds-bundle.ts \
  --input scripts/cds-data/roundXX-cds-bulk-YYYY-MM-DD.json \
  --direct-db \
  --live
```

Rows without `verification.status` of `VERIFIED_REAL` or `PARTIAL_REAL`, without
an official source, without two validators, or without matching count formulas
are rejected.

Legacy imports can still be replayed only with explicit opt-out:

```bash
pnpm --filter api exec tsx scripts/import-cds-bundle.ts \
  --input scripts/cds-data/legacy.json \
  --direct-db \
  --allow-unverified
```

## 5. Mark Terminal Non-Real States

After review, terminal states from the marathon ledger can be written to
provenance:

```bash
pnpm --filter api cds:mark-terminal -- \
  --input scripts/cds-data/tavily-marathon-ledger-YYYY-MM-DD.json \
  --live
```

This does not turn estimates into real data. It only records why real data is
unavailable.
