# Feature: Prediction

## Purpose

Admission probability prediction for US colleges — school selection, multi-engine scoring, and result visualization.

## Components

- SchoolSelectorCard — search and select schools for prediction
- PredictionHeader — page header with stats summary
- DashboardSummary — overview of all prediction results
- PredictionResultCard / PredictionResultList — individual and list result displays
- EngineBreakdownPanel — stats/AI/historical engine score breakdown
- FactorsPanel — positive/negative/neutral admission factors
- ComparisonPanel — side-by-side school comparison
- SuggestionsPanel — actionable improvement suggestions
- RecommendedSchoolsBlock — AI-recommended schools by tier
- RateBreakdownPanel — acceptance rate context
- PredictionHistoryPanel — prediction version history
- ResultFeedbackButtons — user feedback on prediction accuracy
- AiContextActions — CTAs to discuss results with AI agent

## Data Flow

- API: `POST /prediction`, `GET /prediction/history`
- Types re-exported from `@study-abroad/shared` (PredictionResult, PredictionResponse)
- Results classified into reach/match/safety tiers with confidence levels

## Patterns

- Static Tailwind class maps in `constants.ts` (TIER_CONFIG, ENGINE_CONFIG, IMPACT_CONFIG)
- `benchmark-utils.ts` for probability color/formatting utilities
- Shared types only — no local type duplication
