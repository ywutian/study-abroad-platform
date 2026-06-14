# Feature: Prediction

## Purpose

Admission probability prediction for US colleges — school selection, multi-engine scoring, and result visualization.

## Components

- SchoolSelectorCard — search and select schools for prediction
- PredictionHeader — page header with stats summary
- DashboardSummary — overview of all prediction results
- PredictionResultList — workbench "scan" column: tier-grouped (Reach/Match/Safety) list of compact rows; no virtualizer / no nested scroll
- PredictionResultRow — compact fixed-height (`min-h-[68px]`) selectable row; selection drives the detail pane
- PredictionResultTierGroup — collapsible per-tier section header
- PredictionDetailPane — workbench "analysis" column: a single school's full reasoning (assessment / why / real cases / improve / history + feedback); always-rendered, no expand animation (replaced the old PredictionResultCard)
- EngineBreakdownPanel — stats/AI/historical engine score breakdown
- FactorsPanel — positive/negative/neutral admission factors
- ComparisonPanel — side-by-side school comparison
- SuggestionsPanel — actionable improvement suggestions
- RecommendedSchoolsBlock — AI-recommended schools by tier
- RateBreakdownPanel — acceptance rate context
- PredictionHistoryPanel — prediction version history
- ResultFeedbackButtons — user feedback on prediction accuracy

## Data Flow

- API: `POST /prediction`, `GET /prediction/history`
- Types re-exported from `@study-abroad/shared` (PredictionResult, PredictionResponse)
- Results classified into reach/match/safety tiers with confidence levels

## Patterns

- Static Tailwind class maps in `constants.ts` (TIER_CONFIG, ENGINE_CONFIG, IMPACT_CONFIG) — tier badges everywhere derive from `TIER_CONFIG[tier].badge` so palettes can't drift
- `benchmark-utils.ts` for probability color/formatting utilities
- Shared types only — no local type duplication
- Workspace tab is a `variant="workbench"` 3-column master-detail (selector │ tier-grouped row list │ detail pane); on mobile the detail opens in a bottom Sheet. Fixed-height rows keep variable/async content out of any windowed surface (the #407-class overlap fix)
