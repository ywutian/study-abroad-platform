# AI Agent Harness deterministic evaluation v2

**Date:** 2026-08-24
**Dataset:** `agent-harness-comparison-v2`
**Execution:** deterministic, offline, fully synthetic

## Purpose and evidence boundary

This evaluation expands the original eight-case architecture smoke benchmark
into a repeatable regression gate. It proves bounded planning, tool selection,
permission refusal, retry/fallback, deduplication, and budget behavior against
known expectations. It does not call a production model and is not a claim
about real-user answer quality, factual accuracy, or statistical production
success.

No prompts, tool arguments/results, conversations, memories, credentials, or
user identifiers enter the report. CI uploads only the sanitized aggregate and
per-case counters.

## Dataset composition

| Category             | Fixtures | Main boundary                                                   |
| -------------------- | -------: | --------------------------------------------------------------- |
| Core business        |       40 | Direct answer, delegation, and normal business tools            |
| Multi-turn context   |       20 | 12-20 prior messages and supplemental observation               |
| Tool boundary        |       20 | Distinct arguments and cross-round duplicate prevention         |
| Permission/security  |       15 | Protected writes, advisory external calls, scope, unknown tools |
| Failure/recovery     |       15 | First-call failure followed by retry or fallback                |
| Budget/extreme input |       10 | 16-call cap and two supplemental-round cap                      |
| **Total**            |  **120** |                                                                 |

Every fixture runs three times in each mode. That produces 360 executions for
Legacy ReWOO and 360 for Harness v1. The dataset covers all six Agent types,
both Chinese and English locales, and all 45 production Tool metadata entries.
The production-tool list is frozen: adding a Tool without updating this dataset
fails CI.

## Results

| Metric                    | Legacy ReWOO | Harness v1 |     Delta |
| ------------------------- | -----------: | ---------: | --------: |
| Passed executions         |      150/360 |    360/360 |      +210 |
| Task success rate         |       41.67% |       100% | +58.33 pp |
| Tool precision            |       87.07% |       100% | +12.93 pp |
| Tool recall               |       43.72% |       100% | +56.28 pp |
| Refusal accuracy          |           0% |       100% |   +100 pp |
| Duplicate executions      |            0 |          0 |         0 |
| Duplicate calls prevented |            0 |         30 |       +30 |
| Modeled tokens            |      106,575 |    148,890 |   +42,315 |
| Modeled latency           |     9,738 ms |  14,907 ms | +5,169 ms |

Harness adds approximately 39.7% modeled tokens and 53.1% modeled latency in
this deliberately tool-heavy dataset. The main source is the observation and
supplemental-planning pass after tool execution. These are architecture cost
signals, not measured provider bills or production P95 latency.

## Hard gates

The benchmark fails when any of the following occurs:

- Fixture count, category quota, repetition count, Agent/locale coverage, or
  45/45 Tool coverage drifts.
- A Harness expected action, refusal, failure, retry, fallback, delegation, or
  duplicate-prevention outcome differs.
- Harness task success, tool precision, tool recall, or refusal accuracy is not
  100% on the deterministic dataset.
- A successful side effect is duplicated, a case exceeds 16 executed tools, or
  Harness no longer improves task success over Legacy ReWOO.
- Modeled token overhead exceeds 45% or modeled latency overhead exceeds 60%
  relative to Legacy ReWOO on the frozen dataset.
- Fixture bodies, tool arguments, context text, or synthetic error payloads
  appear in the report.

Run locally with:

```bash
pnpm harness:benchmark --output /tmp/ai-agent-benchmark/report.json
```

CI runs the same command before API tests and stores the sanitized artifact for
90 days.

## Remaining evidence gap

This closes deterministic architecture coverage, not model-quality coverage.
The versioned 240-case semantic corpus and grader calibration now exist in
[`AI_AGENT_SEMANTIC_EVALUATION_V1_2026-08-24.md`](./AI_AGENT_SEMANTIC_EVALUATION_V1_2026-08-24.md).
Its Codex-authored reference remains calibration evidence. A production-quality
claim still requires repeated deployed OpenAI-compatible Agent outputs and an
independent blind review, with factuality, usefulness, tokens, cost, and
latency reported separately from this deterministic gate.
