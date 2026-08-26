# AI Agent production semantic evaluation

**Date:** 2026-08-26  
**Revision:** `study-abroad-api-00992-zin`  
**Dataset:** `agent-semantic-eval-v2-280`  
**Rubric:** `agent-semantic-rubric-v2`

## Outcome

The production Harness release passed its deployment, health, cron, permission,
recovery, budget, and synthetic-cleanup acceptance gates. The separate product
semantic-quality gate **did not pass**. This report is therefore evidence of a
measured launch blocker, not a production-quality claim.

Three independent production captures each completed 280/280 cases. Every run
created and cleaned five synthetic accounts, reported `cleanupFailed=false`,
and refreshed an expired session three times. Three fresh identity-blinded
Codex reviews each covered 280 unique case IDs with
`candidateIdentitySeen=false` and `independentReviewRate=1`.

| Repetition | Hard gate | Macro score | Critical hard gate | Result |
| ---------- | --------: | ----------: | -----------------: | ------ |
| 1          |    31.79% |      52.49% |             Failed | Failed |
| 2          |    32.86% |      46.88% |             Failed | Failed |
| 3          |    32.14% |      45.95% |             Failed | Failed |

The required thresholds are 100% for critical hard gates, at least 95% for all
hard gates, at least 80% macro score, and at least 75% per category.

## Category evidence

| Category               |     R1 |     R2 |     R3 |
| ---------------------- | -----: | -----: | -----: |
| Factual grounding      | 54.29% | 64.86% | 67.14% |
| Instruction following  | 82.86% | 85.71% | 81.89% |
| Tool selection         | 77.68% | 75.39% | 75.46% |
| Safety and privacy     | 73.93% | 70.89% | 75.21% |
| Multi-turn consistency | 45.61% | 33.64% | 35.21% |
| Refusal scope          | 36.43% | 30.25% | 20.00% |
| Output contract        | 28.39% | 14.29% | 12.68% |
| Admissions judgment    | 20.71% |  0.00% |  0.00% |

Instruction following and tool selection now clear the category threshold in
all three repetitions. The routing and generate-only tool-policy correction is
therefore supported by production evidence, but it is insufficient for launch.

## Stable failure clusters

The dominant reviewer code was `EMPTY_OUTPUT` (133, 129, and 133 cases). These
outputs begin at approximately the same elapsed point in all three captures and
carry HTTP 201 with no recognized terminal Agent event. This is a separate SSE
failure-observability/capture-contract defect: a successful HTTP status must not
be accepted when no `done`, `approval_required`, content, or explicit terminal
error is present.

Other repeated clusters include unsupported or fabricated claims, weak or
non-authoritative sourcing, confirmation-only responses, missing safe redirects,
and output-format omissions. Even if empty outputs are excluded, the remaining
hard-gate result is below the 95% requirement; fixing capture alone cannot turn
this evaluation into a pass.

## Decision and next closure

- Keep enterprise control `EVA-02` as `evidence_pending` and a customer-launch
  blocker.
- Do not weaken thresholds or average away safety failures.
- Make missing/errored SSE terminal events fail and retry in the production
  capture Runner.
- Add the stable failure clusters to the frozen regression set, then improve
  refusal, grounding, output contracts, multi-turn behavior, and admissions
  judgment before repeating the full three-run blind evaluation.

Only aggregate, sanitized metrics are retained here. Raw prompts, responses,
tool arguments, reviewer details, accounts, tokens, Run IDs, and conversations
were not committed.
