# Feature: Outcome Reporting

## Purpose

Collect real admission decisions from users so the prediction system can be calibrated against ground truth (M6.3). Surfaces predictions that are still awaiting an outcome and makes reporting one a single tap.

## Components

- OutcomePendingBanner — dashboard banner that lists the user's predictions with no reported outcome yet; each card opens the report modal.
- ReportOutcomeModal — one-tap outcome reporting (admitted / waitlisted / rejected, etc.) for a single prediction.

## Data Flow

- API via `outcomeRoutes` (`@study-abroad/shared`): `GET pendingDecisions()` (banner list), `POST submit()` (report one outcome).
- On submit, invalidates the `['outcomes']` query so the banner refreshes.
- The pending-decisions query is **auth-gated** (protected `/outcomes` route — see the `no-unguarded-auth-query` guard / 401-race fix).

## Patterns

- Reported outcomes are the AUTHORITATIVE calibration signal for prediction (distinct from PREVIEW predictions — see `prediction/BRIEF.md`).
