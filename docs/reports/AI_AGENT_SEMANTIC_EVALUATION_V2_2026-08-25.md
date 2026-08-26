# AI Agent semantic evaluation v2

**Date:** 2026-08-25

**Dataset:** `agent-semantic-eval-v2-280`

**Rubric:** `agent-semantic-rubric-v2`

**Execution:** offline Codex-authored reference and deterministic grader calibration

## Outcome and evidence boundary

The repository now has a frozen 280-case semantic corpus with an explicit
OWASP Agentic Top 10 risk matrix. The deterministic gate, schema validation,
negative controls, tests, documentation, and sanitized report form a closed
calibration loop.

The reference result is **not production-model evidence**. Codex authored and
self-reviewed the reference outlines. The deployed OpenAI-compatible Agent did
not generate these outputs, no independent reviewer scored them, and no human
admissions expert reviewed them. A production claim requires deployed-Agent
outputs for this exact dataset and an identity-blinded independent review.

## Frozen dataset

| Dimension           | Coverage |
| ------------------- | -------: |
| Scenario families   |       56 |
| Variants per family |        5 |
| Total cases         |      280 |
| Agents              |        6 |
| Locales             |        2 |
| Semantic categories |   8 × 35 |
| Typical             |       95 |
| Edge                |       85 |
| Adversarial         |      100 |

All fixtures are synthetic. No real applicant material, credentials, memory,
conversation, session, tool arguments, or production response is stored in the
dataset or committed report.

## OWASP Agentic risk coverage

| Risk                             | Cases |
| -------------------------------- | ----: |
| Prompt injection                 |    10 |
| Sensitive information disclosure |    15 |
| Supply chain                     |    10 |
| Data and model poisoning         |    10 |
| Improper output handling         |     5 |
| Excessive agency                 |    10 |
| System prompt leakage            |    10 |
| Vector and embedding weaknesses  |     5 |
| Misinformation                   |    10 |
| Unbounded consumption            |     5 |

Every risk has at least five frozen cases. Permission expansion, approval
bypass, sensitive disclosure, and output-contract violations are hard failures;
they cannot be offset by a higher average semantic score.

## Calibration result

| Control                         |   Count |   Correct result |
| ------------------------------- | ------: | ---------------: |
| Passing Codex references        |     280 |     280 accepted |
| Empty output                    |     280 |     280 rejected |
| Missing expected tool           |     155 |     155 rejected |
| Forbidden tool                  |      55 |      55 rejected |
| Forbidden output/privacy canary |      60 |      60 rejected |
| Missing required concept        |     185 |     185 rejected |
| **Negative controls**           | **735** | **735 rejected** |

The calibration hard-gate pass rate and macro score are both 1.0. Independent
review count and human-expert review count are both zero. These numbers prove
the repository-owned rules distinguish the defined controls; they do not prove
that the deployed model has a 100% success rate.

## Reproduction

```bash
pnpm harness:semantic-eval \
  --output /tmp/ai-agent-semantic-eval-v2/report.json

pnpm harness:semantic-eval \
  --submission /absolute/path/to/blind-reviewed-production-packet.json \
  --output /tmp/ai-agent-semantic-eval-v2/production-report.json
```

Only the sanitized aggregate report may be retained as a CI artifact. Raw
prompts, responses, tool arguments, reviewer notes, and synthetic credentials
must remain outside the repository with owner-only permissions and be deleted
after the review and discrepancy process closes.

## Closed loop and remaining production evidence

The v2 calibration loop is complete:

`risk inventory → frozen fixtures → schema/static gates → negative controls → tests → sanitized report`

The separate production-quality loop is not fabricated and remains:

`deployed-Agent capture → candidate blinding → independent scoring → discrepancy review → sanitized gate → failure-cluster regression cases`

Until that second loop completes, product-quality statements must cite only the
deterministic Harness benchmark and this calibration result, with their stated
evidence boundaries.
