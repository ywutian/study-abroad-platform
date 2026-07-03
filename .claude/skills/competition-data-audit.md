---
name: competition-data-audit
description: The review gate for competition-data-update — independently verify fetched competition-schedule records BEFORE they are upserted, so a hallucinated date (plausible-looking, even with a real URL) never lands. Two layers — a deterministic structural gate (`db:audit:competition-data`) then an ADVERSARIAL re-fetch: an independent, skeptical auditor subagent re-reads each record's cited source and confirms the date is really there for the current season. Use right after competition-data-update's fetch and before the upsert, or to spot-audit dates already in the DB. Never trust the fetcher's own claim — re-read the source.
---

# /competition-data-audit — Verify fetched competition data

The `competition-data-update` skill fetches competition schedules from official
sites. This skill is its **independent reviewer** — the gate between "a subagent
said this date" and "this date is in the DB". The failure it exists to catch:
a subagent returns a **plausible, well-formed date with a real official URL** —
but the date is wrong / stale / invented (the classic "real source, hallucinated
value"). The acquisition skill fetches; this one **refuses to trust it** and
re-checks against the source.

## When to use

- **Always**, between `competition-data-update`'s fetch and its upsert. The fetch
  produces a `records.json`; only **audit-confirmed** records get upserted.
- To **spot-audit** dates already in the DB (export the current-season editions
  with `sourceMeta` to the record shape and run this).

## Procedure

### 1. Deterministic structural gate (cheap, first)

```bash
pnpm --filter api db:audit:competition-data <records.json> --season <YYYY-YYYY> --out passed.json
```

`audit-competition-data.ts` flags the mechanical fabrication tells — wrong
season, dates out of order (reg-open after event), dates implausibly far from
now (a 2019 or 2035 "deadline"), insane team sizes, malformed `sourceUrl`. It
exits non-zero on any flag and writes the survivors to `passed.json`. **A flagged
record is not fixed here — it's kicked back to re-fetch.** Passing means only
"not obviously fabricated"; it is NOT confirmation.

### 2. Adversarial re-fetch (the core — an independent skeptic)

For each record in `passed.json`, dispatch an **auditor subagent that did NOT
fetch it** (independence matters — a fetcher will rationalize its own answer).
Each auditor:

1. **Re-WebFetch the record's own `sourceUrl`** (and search the official site if
   the URL 404s / moved). Read the page.
2. Confirm the extracted date(s) **actually appear on that page** and are for the
   **target season** — not last year's, not a different competition's division.
3. **Default to REJECT on any ambiguity.** Prompt the auditor as a skeptic:
   "your job is to REFUTE this record; only CONFIRM if the source unambiguously
   states this exact date for this season." A source that merely _mentions_ the
   competition without the date ⇒ REJECT.
4. Return a verdict: `{ abbreviation, verdict: "CONFIRMED" | "REJECTED", reason, observedOnPage? }`.

Run several auditors in parallel (≤8). For the highest-tier / flagship
competitions, use 2 independent auditors and require both to CONFIRM (majority /
unanimous) — the deck's credibility rides on those.

### 3. Keep only CONFIRMED → upsert

Filter `passed.json` to the CONFIRMED verdicts, then:

```bash
pnpm --filter api db:seed:competition-data confirmed.json
```

REJECTED records: leave the field null (honest gap) OR re-queue for a fresh fetch
with a note on what the auditor couldn't verify. **Never upsert a REJECTED or
merely-structurally-passed record.**

### 4. Report

Per record: structural pass/flag, auditor verdict + reason. Totals: fetched →
structurally-valid → CONFIRMED → upserted. Rejections with reasons are the
valuable output — they're where the fetcher hallucinated or the source was thin.

## Hard rules

- **Independence**: the auditor is a _different_ subagent than the fetcher.
- **Skeptic by default**: CONFIRM only on an unambiguous source statement; else REJECT.
- **Re-read the source** — never confirm from the record's own fields alone.
- **Only CONFIRMED lands.** Structural-pass ≠ confirmed. No source ⇒ never upsert.
- Rejections are successes, not failures — they stopped a hallucination.
