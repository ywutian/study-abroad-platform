# ADR-0017: School Data Provenance Tiering

- Status: proposed
- Date: 2026-04-13
- Decision-makers: platform, data, prediction
- Tags: school-data, provenance, prediction, frontend

## Context

The school catalog currently compresses multiple data-quality states into a binary
`verified/supplemental` model. That hides useful seeded and scraped values, and it prevents
prediction, governance, and admin tooling from distinguishing between federal data, partner edits,
public scraping, seed defaults, future community input, and AI inference.

We need a field-level provenance contract that keeps values visible while making their trust level
explicit across ingestion, APIs, prediction, and UI rendering.

## Decision

We will store canonical field provenance in `School.metadata.provenance` and project it into API
`fieldSources`.

The contract includes:

- `TrustTier = OFFICIAL | PARTNER | SCRAPED | SEED | COMMUNITY | INFERRED`
- per-field `source`, `fetchedAt`, optional review metadata, and optional confidence for inferred
  values
- derived staleness rather than persisted staleness

Operational rules:

- readers accept both legacy `{ source, at }` records and the canonical schema during migration
- all school writes go through `SchoolWriteService` with explicit provenance
- frontend always shows non-null values and pairs them with trust badges/tooltips
- prediction excludes `COMMUNITY` and `INFERRED`, and discounts `SCRAPED` / `SEED` in completeness
  and confidence instead of changing raw values
- admin data-quality reporting includes tier distribution, prediction-eligible coverage,
  top-200 official coverage, and stale-field reporting

Governance rules and scheduled checks enforce the write path, monitor SLO coverage, and refresh
stale official data through existing sync services.

## Consequences

### Positive

- Users can see more values without confusing seed or scraped data for official facts.
- Prediction systems gain explicit trust weighting instead of relying on null checks.
- Data ingestion and admin edits share one provenance-aware write path.
- Admin tooling gets measurable quality, freshness, and coverage signals.

### Negative

- API and frontend consumers must migrate away from binary `verified/supplemental` assumptions.
- Existing records need backfill before the new schema is fully populated everywhere.
- Some UI surfaces become more complex because display now includes provenance metadata.

### Neutral

- `fieldSources` remains the response field name for compatibility.
- Provenance stays JSON-backed inside `School.metadata` instead of moving into a separate table.
