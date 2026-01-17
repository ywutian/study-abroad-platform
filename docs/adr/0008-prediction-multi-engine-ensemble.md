# ADR-0008: Prediction Multi-Engine Ensemble Architecture

- Status: accepted
- Date: 2026-02-09
- Decision-makers: Engineering Team
- Tags: prediction, ai, ensemble, memory-system

## Context

The original prediction system (v1) relied on a single AI engine (GPT-4o-mini) that produced identical probabilities (~35%) for vastly different schools (e.g., MIT vs Boston College). Root causes identified:

1. **AI anchoring**: The AI model anchored on an example probability value (`0.35`) embedded in the prompt template.
2. **No statistical baseline**: The AI had no reference point for calibration against actual school selectivity.
3. **Single point of failure**: If the AI engine failed or returned invalid results, the system had no fallback beyond a basic statistical formula.
4. **No personalization**: The prediction did not leverage the AI Agent memory system that already stored user preferences, decisions, and school entities.
5. **No confidence quantification**: Users received a single probability number with no indication of certainty.
6. **No feedback loop**: No mechanism to collect actual admission outcomes for model calibration.

Industry benchmarks (CollegeVine, CAPS framework) demonstrate that multi-engine ensemble approaches with calibration feedback consistently outperform single-model systems.

## Decision

Replace the single-engine prediction with a **three-engine weighted ensemble** architecture:

### Engine 1: Statistical Engine (Always available)

- Uses the unified scoring utility (`common/utils/scoring.ts`)
- Deterministic: `probability = baseRate × 1.2^((overallScore - 50) / 10)`
- Provides the calibration anchor for other engines

### Engine 2: AI Engine (GPT-4o-mini, may fail)

- Receives the statistical baseline as a "calibration hint" in the prompt
- Post-processing: clamp to [0.05, 0.95] and limit deviation from stats baseline (max 3×)
- Returns structured factors and improvement suggestions

### Engine 3: Historical Data Engine (Requires ≥10 verified cases)

- Matches against `AdmissionCase` records for the specific school
- Similarity-weighted admission rate calculation
- Confidence scales with sample size

### Fusion Strategy

Dynamic weighted ensemble with weights that adapt based on engine availability:

- All three available: stats 25%, AI 40%, historical 35%
- No historical data: stats 35%, AI 65%
- AI failed: stats 45%, historical 55%
- Only stats: 100%

Historical engine weight further adjusted by `sampleCount / 100` to reduce influence when sample size is small.

### Memory System Integration

- **Pre-prediction**: Read user DECISION, PREFERENCE, FACT memories and SCHOOL entities to provide personalized context to the AI engine and apply micro-adjustments (±2% max)
- **Post-prediction**: Write prediction results as DECISION memories and update SCHOOL entities

### Confidence Intervals

Each prediction includes `probabilityLow` and `probabilityHigh` based on data completeness:

- High confidence (5+ data points): ±4%
- Medium (3-4 data points): ±7%
- Low (0-2 data points): ±11%

### Calibration Feedback Loop

- `PATCH /predictions/:schoolId/result` — Users report actual outcomes
- `GET /predictions/calibration` — Aggregated bucket statistics for model tuning

## Consequences

### Positive

- Differentiated predictions: Schools with 5% vs 50% acceptance rates now produce meaningfully different probabilities
- Transparency: Users can inspect individual engine scores and weights
- Resilience: System degrades gracefully (3 engines → 2 → 1)
- Personalization: Memory-enhanced predictions reflect user's unique context
- Calibratable: Feedback loop enables continuous accuracy improvement
- Auditable: `engineScores` JSON stored per prediction for debugging

### Negative

- Increased latency: ~2-5s per prediction (AI engine call dominates)
- Increased complexity: Three engines + fusion logic + memory integration
- Cold start: Historical engine is useless until sufficient admission cases are collected
- Memory dependency: If `MemoryManagerService` is unavailable, personalization degrades (handled with try/catch)

### Neutral

- `modelVersion` field tracks v1 → v2 migration; both versions coexist in the database
- `@@unique([profileId, schoolId])` constraint means only the latest prediction per school is retained (existing duplicates were removed during migration)
- Frontend UI complexity increased but provides significantly better user experience
