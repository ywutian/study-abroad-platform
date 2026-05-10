# Prediction System (Counselor Primary Launch)

> Last updated: 2026-05-08
> Served architecture: counselor-primary
> Current rule version: `counselor-cold-start-v1.7-launch`

## Current Contract

The launch prediction system serves probabilities from the deterministic counselor engine only. Legacy fusion, ML, and distillation services may remain in the repository for historical analysis or fallback, but they are not the served probability path for counselor-primary responses.

Each served prediction returns:

- `probability`: number for Tier 1-3, `null` for unavailable Tier 4
- `probabilityLow` / `probabilityHigh`: display range around the served probability
- `tier`: reach/match/safety-style UI tier for numeric predictions, or `unavailable`
- `confidence`, `sourceSummary`, and `uncertaintyReasons`
- `predictionMethod`: `counselor` or `insufficient_data`
- `servedTrace.counselor` for numeric predictions
- `modelVersion` / counselor rule version for replay

New counselor responses intentionally omit old shadow fields:

- `engineScores`
- `crossEngineConsistency`
- `servedTrace.shadow.fusion`

Web, mobile, and admin consumers must treat those fields as optional.

## Anchor Tiers

The counselor engine starts from a school-level anchor and then applies bounded modifiers. The final probability is clamped to `anchor x [0.3, 2.5]` and the absolute `[0.02, 0.98]` display range.

| Tier   | Anchor Source                                       | Behavior                                                          |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| Tier 1 | `SchoolCdsAdmitBand` cell-level CDS data            | Suppresses GPA/test modifiers already encoded in the matched cell |
| Tier 2 | Overall admit rate plus SAT/ACT bands               | Uses acceptance rate anchor plus profile modifiers                |
| Tier 3 | Overall admit rate only                             | Uses acceptance rate anchor with missing-data neutral fallbacks   |
| Tier 4 | No usable anchor or portfolio/audition-first school | Returns insufficient-data contract, not a numeric probability     |

Art/design schools and music conservatories gracefully decline because academic stats alone are not a reliable admissions signal for portfolio/audition-first review.

## Launch Modifiers

Counselor modifiers are deterministic, replayable, and cold-start safe:

- GPA uses validated CDS C9 distribution when available: step percentile with `multiplier = clamp(0.4 + 0.7 * percentile, 0.15, 1.3)`.
- SAT/ACT respects `testingPolicy`: BLIND ignores scores, REQUIRED no-score receives a hard penalty, selective OPTIONAL no-score receives a conservative penalty.
- ACT compares directly to `act25/act75` when present.
- ED/EA/ED2/REA uses real school round rates when present: `clamp(roundRate / overallRate, 1.0, 3.5)`, with anomalous `roundRate < overallRate` neutralized.
- Unsupported early rounds neutralize instead of applying heuristic boosts when explicit availability flags say the school does not offer that round.
- Self-reported athlete and legacy hooks are neutral until school-specific evidence is verified.
- Major selectivity resolves user text to CIP first, then falls back to fuzzy `SchoolProgram.programName`, then neutral.
- International and geography modifiers avoid double-penalizing international applicants.

## Persistence

Only numeric Tier 1-3 predictions are persisted to `PredictionResult` and `PredictionSnapshot`. Tier 4 unavailable responses are returned to the caller but do not write numeric history.

Outcome labels are stored separately in `PredictionOutcomeLabelRecord`. Self-reported labels close the user feedback loop, but calibration and promotion gates use verified labels only (`COUNSELOR_VERIFIED` or `DOCUMENT_VERIFIED`).

## Outcome Loop

Users can report admission results from web and mobile prediction surfaces. The API endpoint is:

```http
PATCH /predictions/:schoolId/result
```

Payload fields:

- `result`: `ADMITTED`, `REJECTED`, `WAITLISTED`, `DEFERRED`, or `WITHDRAWN`
- `round`: optional
- `isFinal`: optional
- `notes`: optional
- `evidenceUrl`: optional

Admin tooling can inspect self-reported and verified outcome counts. Accuracy jobs and promotion gates must ignore self-reported-only labels.

## Evaluation Gates

Launch verification produces reports in `verification-report/launch/`:

- `coverage.json`: full US school x archetype counselor coverage
- `data-quality.json`: counselor-used data source audit
- `manual-review.json`: classified data/coverage anomalies; no `UNREVIEWED` rows may remain
- `tier4.json`: unavailable contract smoke result
- `outcome-inventory.json`: outcome counts by status/result
- `contract.json`: prediction contract smoke result

Required commands are documented in `docs/runbooks/prediction-launch-runbook.md`.

## LLM And ML Policy

LLMs are not used to output served probabilities in the launch system. They may be added later for explanation, advice, anomaly detection, or source summarization, but not as an unverified numeric probability engine.

ML or calibrator promotion is deferred until verified outcome sample size is sufficient. Until then, counselor remains rule-versioned and replayable.

## Accuracy Statement

The current system is designed to be safe, bounded, transparent, and closed-loop ready. It does not claim formal predictive accuracy yet. Real calibration requires verified admission outcomes accumulated over time.
