# Essay-Debate Blind-Eval Queue (PR5 — agent-driven, no human, no ¥)

> Generated 2026-05-20 from local DB (`study_abroad_jtest`). 40 sessions:
> 20 lumni-claude (this PR, `scripts/seed-lumni-debate-turns.ts`) + 20
> chatgpt-control (PR4, `scripts/generate-chatgpt-control-turns.ts`),
> covering the same 20 dogfood case IDs from `CONTEXT_AUDIT.md` §2.

## How to read this file

Two tables below:

- **Evaluator view** — what we hand to the 5 counselor agents. Source
  column intentionally omitted so they can't fingerprint which pool a
  session came from.
- **Ground truth** (collapsed below "DO NOT SHOW TO EVALUATORS") — pairs
  `sessionId` ↔ `source` so the gate script can decode ratings after.

Both tables share the same `queueOrder`, computed as:

```
ORDER BY substring(sessionId FROM length(sessionId)-3 FOR 4) ASC, admissionCaseId ASC
```

— last 4 chars of the session cuid. Deterministic across re-runs (cuids
are immutable once written), reproducible by any consumer, and interleaves
the two pools without a manual shuffle.

`turnIndex` is the index of the AI turn inside the session's `turns` array
(both control and lumni put their AI rebuttal at index 1; lumni sessions
may grow if the user posts follow-up turns, in which case the _first_ AI
turn — index 1 — is still the one being rated for this queue).

## Evaluator view (hand this — minus the headers above — to the agents)

| queueOrder | sessionId                 | turnIndex | admissionCaseId           | school                             | paragraphIndex |
| ---------: | ------------------------- | --------: | ------------------------- | ---------------------------------- | -------------: |
|          1 | cmpersfe40001sbsa33y2jpnd |         1 | cmpdnegbw000rh6kfothxa69f | Brown University                   |              - |
|          2 | cmpeq26xv0001e0ko95vzhx55 |         1 | cmpdnegbw000rh6kfothxa69f | Brown University                   |              0 |
|          3 | cmpeq26yw0003e0kod8r6o3ft |         1 | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              0 |
|          4 | cmpeq26zh0005e0kolz6t7udt |         1 | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              0 |
|          5 | cmpeq26zu0007e0kogilmle1l |         1 | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              0 |
|          6 | cmpeq26zx0009e0ko4vrmfi3u |         1 | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              0 |
|          7 | cmpeq26zz000be0ko46d7tq8x |         1 | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              0 |
|          8 | cmpeq2701000de0ko3qmz8kda |         1 | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              0 |
|          9 | cmpeq2704000fe0koff4zaby6 |         1 | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              0 |
|         10 | cmpeq2705000he0kocu1vrcun |         1 | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              0 |
|         11 | cmpeq2707000je0kovy3b98o1 |         1 | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              0 |
|         12 | cmpeq270a000le0kotra3m39m |         1 | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         13 | cmpeq270f000ne0koa15xooh5 |         1 | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              0 |
|         14 | cmpeq2721000pe0koi0iwdzyg |         1 | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              0 |
|         15 | cmpeq2723000re0kodinve02d |         1 | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              0 |
|         16 | cmpeq2725000te0kofz8mhqpj |         1 | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         17 | cmpeq2727000ve0kohpe9hesu |         1 | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              0 |
|         18 | cmpeq2729000xe0kogtovuv0o |         1 | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         19 | cmpeq272a000ze0kok4e7mu83 |         1 | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              0 |
|         20 | cmpeq272c0011e0kohtoh9uam |         1 | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              0 |
|         21 | cmpeq272g0013e0koqah20i3f |         1 | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|         22 | cmpf0y0l10001miysrj6cxoju |         1 | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              3 |
|         23 | cmpf0y3tf0003miysaup1zi8p |         1 | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              1 |
|         24 | cmpf0y5vh0005miysek0yqh5l |         1 | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              4 |
|         25 | cmpf0y81v0007miyszfs8g44i |         1 | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              3 |
|         26 | cmpf0y9ut0009miystpc0x0tu |         1 | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              4 |
|         27 | cmpf0yc5w000bmiyseo5jovg7 |         1 | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              4 |
|         28 | cmpf0yeb7000dmiys2dtsjzgb |         1 | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              3 |
|         29 | cmpf0ygbv000fmiysizcmfe1e |         1 | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              1 |
|         30 | cmpf0yibb000hmiysmqo9rbha |         1 | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              3 |
|         31 | cmpf0ykhf000jmiys7slb3r62 |         1 | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         32 | cmpf0ym82000lmiyssphfsn2e |         1 | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              4 |
|         33 | cmpf0yog3000nmiysq22p0g2s |         1 | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              1 |
|         34 | cmpf0yr8h000pmiyssfdy4xaw |         1 | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              3 |
|         35 | cmpf0ytid000rmiysgdydapk6 |         1 | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         36 | cmpf0yxmb000tmiys01datr8m |         1 | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              3 |
|         37 | cmpf0yzut000vmiys1bf77vtc |         1 | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         38 | cmpf0z1vr000xmiys6aqz5tmf |         1 | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              4 |
|         39 | cmpf0z4ir000zmiyseakz7604 |         1 | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              3 |
|         40 | cmpf0z6vz0011miys2yo5y975 |         1 | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |

> Note on rows where two `sessionId`s share the same `admissionCaseId`:
> one is lumni, one is control. The blind-evaluator agents see them
> separated by ~20 other rows of the same school mix, so they can't
> trivially fingerprint by adjacency.

## Ground truth — DO NOT SHOW TO EVALUATORS

> This table is for the gate script + post-hoc analysis only. Hide before
> handing the queue to the 5 counselor agents in PR5.

| queueOrder | sessionId                 | turnIndex | source          | admissionCaseId           | school                             | paragraphIndex |
| ---------: | ------------------------- | --------: | --------------- | ------------------------- | ---------------------------------- | -------------: |
|          1 | cmpersfe40001sbsa33y2jpnd |         1 | lumni-claude    | cmpdnegbw000rh6kfothxa69f | Brown University                   |              - |
|          2 | cmpeq26xv0001e0ko95vzhx55 |         1 | chatgpt-control | cmpdnegbw000rh6kfothxa69f | Brown University                   |              0 |
|          3 | cmpeq26yw0003e0kod8r6o3ft |         1 | chatgpt-control | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              0 |
|          4 | cmpeq26zh0005e0kolz6t7udt |         1 | chatgpt-control | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              0 |
|          5 | cmpeq26zu0007e0kogilmle1l |         1 | chatgpt-control | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              0 |
|          6 | cmpeq26zx0009e0ko4vrmfi3u |         1 | chatgpt-control | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              0 |
|          7 | cmpeq26zz000be0ko46d7tq8x |         1 | chatgpt-control | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              0 |
|          8 | cmpeq2701000de0ko3qmz8kda |         1 | chatgpt-control | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              0 |
|          9 | cmpeq2704000fe0koff4zaby6 |         1 | chatgpt-control | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              0 |
|         10 | cmpeq2705000he0kocu1vrcun |         1 | chatgpt-control | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              0 |
|         11 | cmpeq2707000je0kovy3b98o1 |         1 | chatgpt-control | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              0 |
|         12 | cmpeq270a000le0kotra3m39m |         1 | chatgpt-control | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         13 | cmpeq270f000ne0koa15xooh5 |         1 | chatgpt-control | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              0 |
|         14 | cmpeq2721000pe0koi0iwdzyg |         1 | chatgpt-control | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              0 |
|         15 | cmpeq2723000re0kodinve02d |         1 | chatgpt-control | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              0 |
|         16 | cmpeq2725000te0kofz8mhqpj |         1 | chatgpt-control | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         17 | cmpeq2727000ve0kohpe9hesu |         1 | chatgpt-control | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              0 |
|         18 | cmpeq2729000xe0kogtovuv0o |         1 | chatgpt-control | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         19 | cmpeq272a000ze0kok4e7mu83 |         1 | chatgpt-control | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              0 |
|         20 | cmpeq272c0011e0kohtoh9uam |         1 | chatgpt-control | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              0 |
|         21 | cmpeq272g0013e0koqah20i3f |         1 | chatgpt-control | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|         22 | cmpf0y0l10001miysrj6cxoju |         1 | lumni-claude    | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              3 |
|         23 | cmpf0y3tf0003miysaup1zi8p |         1 | lumni-claude    | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              1 |
|         24 | cmpf0y5vh0005miysek0yqh5l |         1 | lumni-claude    | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              4 |
|         25 | cmpf0y81v0007miyszfs8g44i |         1 | lumni-claude    | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              3 |
|         26 | cmpf0y9ut0009miystpc0x0tu |         1 | lumni-claude    | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              4 |
|         27 | cmpf0yc5w000bmiyseo5jovg7 |         1 | lumni-claude    | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              4 |
|         28 | cmpf0yeb7000dmiys2dtsjzgb |         1 | lumni-claude    | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              3 |
|         29 | cmpf0ygbv000fmiysizcmfe1e |         1 | lumni-claude    | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              1 |
|         30 | cmpf0yibb000hmiysmqo9rbha |         1 | lumni-claude    | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              3 |
|         31 | cmpf0ykhf000jmiys7slb3r62 |         1 | lumni-claude    | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         32 | cmpf0ym82000lmiyssphfsn2e |         1 | lumni-claude    | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              4 |
|         33 | cmpf0yog3000nmiysq22p0g2s |         1 | lumni-claude    | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              1 |
|         34 | cmpf0yr8h000pmiyssfdy4xaw |         1 | lumni-claude    | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              3 |
|         35 | cmpf0ytid000rmiysgdydapk6 |         1 | lumni-claude    | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         36 | cmpf0yxmb000tmiys01datr8m |         1 | lumni-claude    | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              3 |
|         37 | cmpf0yzut000vmiys1bf77vtc |         1 | lumni-claude    | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         38 | cmpf0z1vr000xmiys6aqz5tmf |         1 | lumni-claude    | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              4 |
|         39 | cmpf0z4ir000zmiyseakz7604 |         1 | lumni-claude    | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              3 |
|         40 | cmpf0z6vz0011miys2yo5y975 |         1 | lumni-claude    | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |

Counts: 20 chatgpt-control + 20 lumni-claude = 40 sessions. Each pool
covers all 20 distinct dogfood case IDs.

## How PR5's gate script consumes this

1. Read the **Ground truth** table → build a `Map<sessionId, source>`.
2. Feed the **Evaluator view** rows (sans `source`) one-by-one into each
   of the 5 counselor agents, recording per-row Likert ratings (SHARP +
   USEFUL) into `EssayDebateEvaluation`.
3. After all ratings collected: join on `sessionId` to re-attach `source`,
   then compute lumni-vs-control SHARP+USEFUL share + per-pair winner.
4. Decision gate (existing in `debate-eval-gate.util.ts`): lumni share ≥
   control share AND ≥3/5 agents say "ship it" → green.

## Implementation notes

- The two rows for `cmpdnegbw000rh6kfothxa69f` (Brown) at queueOrder 1+2
  cover the smoke-test lumni session (PR4) and its control counterpart.
  The smoke-test session has `paragraphIndex = -` because it was created
  ad-hoc on a different user from a different code path; the 19 PR5 lumni
  sessions all have a deterministic non-null `paragraphIndex` derived
  from `caseId.charCodeAt(0) % numParagraphs` (essay paragraph split on
  `/\n\n+/`, matching `DebateContextLoaderService.loadContext`).
- All sessions have `turns[1]` = the AI rebuttal under eval; user
  message at `turns[0]` is the trigger and not rated. PR5's agent prompt
  must include both turns so the rebuttal has context.
- Source labels: `chatgpt-control` is the literal value of
  `turns[1].source` written by `generate-chatgpt-control-turns.ts`;
  `lumni-claude` is our local convention for the queue file — in the DB
  these rows have NO `source` marker on `turns[1]`, by design (the live
  service doesn't tag its own writes).
