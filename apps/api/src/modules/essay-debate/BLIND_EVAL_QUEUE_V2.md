# Essay-Debate Blind-Eval Queue V2 (PR7 — v2-prompt regen, agent-driven, no human, no ¥)

> Generated 2026-05-20 from local DB (`study_abroad_jtest`). 40 sessions:
> 20 lumni-v2 (this PR, `scripts/seed-lumni-debate-turns-v2.ts`, running
> against `DEBATE_PROMPT_VERSION = 'v2'` from PR6 `75d84918`) + 20
> chatgpt-control (unchanged from PR4 `scripts/generate-chatgpt-control-turns.ts`,
> reused verbatim), covering the same 20 dogfood case IDs from
> `CONTEXT_AUDIT.md` §2.

## How this differs from `BLIND_EVAL_QUEUE.md` (PR5)

- **Lumni pool is v2-prompt regen, not v1.** PR6 banned 8 concession
  opening phrases and added the hard "must reference prior commentary"
  rule. Every lumni-v2 row in this queue was authored by the
  `EssayDebateService` running PR6's v2 prompt; v1 lumni sessions from
  PR5 are untouched and left in DB as audit trail.
- **Control pool is identical.** PR4 ChatGPT-control turns weren't
  regenerated — the control surface didn't change between PR5 and PR7,
  and regenerating would just add cost + noise. The 20 control sessions
  here are the SAME rows that appear in `BLIND_EVAL_QUEUE.md`.
- **Source labels differ.** Lumni rows have `turns[].source = 'lumni-v2'`
  in DB (v1 lumni had no marker). The gate decoder uses this to bucket
  ratings into the v1-vs-v2-vs-control comparison.
- **queueOrder is different from V1.** Same hash function
  (`substring(sessionId FROM length(sessionId)-3 FOR 4)`) but the 20
  v2 lumni session cuids are different from the 20 v1 lumni session
  cuids, so the interleave order shifts. Reproducible by any consumer
  who runs the same SELECT against the DB.

## How to read this file

Two tables below:

- **Evaluator view** — hand to the 5 counselor agents. `source` column
  intentionally omitted so they can't fingerprint which pool a session
  came from.
- **Ground truth** (under "DO NOT SHOW TO EVALUATORS") — pairs
  `sessionId` ↔ `source` so the gate script can decode ratings
  post-hoc.

Both tables share the same `queueOrder`, computed as:

```
ORDER BY substring(sessionId FROM length(sessionId)-3 FOR 4) ASC, admissionCaseId ASC
```

— last 4 chars of the session cuid. Deterministic across re-runs (cuids
are immutable once written), reproducible by any consumer, and interleaves
the two pools without a manual shuffle.

`turnIndex` is the index of the AI turn under eval inside the session's
`turns` array. For both pools `turnIndex = 1` (turn 0 is the user
challenge, turn 1 is the AI rebuttal — the only AI turn in these single-
round sessions).

## Evaluator view (hand this — minus the headers above — to the agents)

| queueOrder | sessionId                 | turnIndex | admissionCaseId           | school                             | paragraphIndex |
| ---------: | ------------------------- | --------: | ------------------------- | ---------------------------------- | -------------: |
|          1 | cmpeq272g0013e0koqah20i3f |         1 | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|          2 | cmpf2suq70003xdnf71u05529 |         1 | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              3 |
|          3 | cmpf2vg3e0003rwm4qndr57we |         1 | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              1 |
|          4 | cmpf2vps1000brwm4u0px7j9n |         1 | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|          5 | cmpf2vd8v0001rwm498f17qoz |         1 | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              4 |
|          6 | cmpeq26zh0005e0kolz6t7udt |         1 | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              0 |
|          7 | cmpeq2701000de0ko3qmz8kda |         1 | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              0 |
|          8 | cmpeq2707000je0kovy3b98o1 |         1 | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              0 |
|          9 | cmpeq272c0011e0kohtoh9uam |         1 | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              0 |
|         10 | cmpeq2704000fe0koff4zaby6 |         1 | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              0 |
|         11 | cmpf2srqx0001xdnfgbabalt3 |         1 | cmpdnegbw000rh6kfothxa69f | Brown University                   |              3 |
|         12 | cmpf2t2020009xdnf6501ba1f |         1 | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              3 |
|         13 | cmpf2vrqx000drwm4p7pdcy9r |         1 | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              4 |
|         14 | cmpeq2721000pe0koi0iwdzyg |         1 | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              0 |
|         15 | cmpeq2723000re0kodinve02d |         1 | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              0 |
|         16 | cmpeq26zx0009e0ko4vrmfi3u |         1 | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              0 |
|         17 | cmpeq2727000ve0kohpe9hesu |         1 | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              0 |
|         18 | cmpeq2725000te0kofz8mhqpj |         1 | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         19 | cmpeq26xv0001e0ko95vzhx55 |         1 | cmpdnegbw000rh6kfothxa69f | Brown University                   |              0 |
|         20 | cmpf2vnbo0009rwm4rlmuia7o |         1 | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              3 |
|         21 | cmpf2t97e000fxdnfyqlak7lg |         1 | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              3 |
|         22 | cmpeq26zu0007e0kogilmle1l |         1 | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              0 |
|         23 | cmpeq270a000le0kotra3m39m |         1 | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         24 | cmpeq272a000ze0kok4e7mu83 |         1 | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              0 |
|         25 | cmpf2vi8b0005rwm4j3bunl0s |         1 | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              3 |
|         26 | cmpeq26yw0003e0kod8r6o3ft |         1 | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              0 |
|         27 | cmpf2tbrz000hxdnffermoh82 |         1 | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              1 |
|         28 | cmpeq270f000ne0koa15xooh5 |         1 | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              0 |
|         29 | cmpf2vwli000hrwm4qz2soz34 |         1 | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|         30 | cmpf2t3wd000bxdnf036pqnxr |         1 | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              4 |
|         31 | cmpeq2705000he0kocu1vrcun |         1 | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              0 |
|         32 | cmpf2tege000jxdnfs2xgstnq |         1 | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              3 |
|         33 | cmpf2sxff0005xdnfst8gt015 |         1 | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              1 |
|         34 | cmpf2vkve0007rwm4l2gyt6yd |         1 | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         35 | cmpf2tgsx000lxdnfo31lt7wq |         1 | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         36 | cmpf2vu03000frwm404c1tbvv |         1 | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              3 |
|         37 | cmpeq26zz000be0ko46d7tq8x |         1 | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              0 |
|         38 | cmpeq2729000xe0kogtovuv0o |         1 | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         39 | cmpf2t659000dxdnf55lavlz1 |         1 | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              4 |
|         40 | cmpf2szjm0007xdnfif10x30p |         1 | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              4 |

> Note on rows where two `sessionId`s share the same `admissionCaseId`:
> one is lumni-v2, one is chatgpt-control. They are interleaved by
> session-cuid hash so adjacent rows almost never share a case.

## Ground truth — DO NOT SHOW TO EVALUATORS

> For the gate script + post-hoc analysis only. Hide before handing the
> queue to the 5 counselor agents.

| queueOrder | sessionId                 | turnIndex | source          | admissionCaseId           | school                             | paragraphIndex |
| ---------: | ------------------------- | --------: | --------------- | ------------------------- | ---------------------------------- | -------------: |
|          1 | cmpeq272g0013e0koqah20i3f |         1 | chatgpt-control | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|          2 | cmpf2suq70003xdnf71u05529 |         1 | lumni-v2        | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              3 |
|          3 | cmpf2vg3e0003rwm4qndr57we |         1 | lumni-v2        | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              1 |
|          4 | cmpf2vps1000brwm4u0px7j9n |         1 | lumni-v2        | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|          5 | cmpf2vd8v0001rwm498f17qoz |         1 | lumni-v2        | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              4 |
|          6 | cmpeq26zh0005e0kolz6t7udt |         1 | chatgpt-control | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              0 |
|          7 | cmpeq2701000de0ko3qmz8kda |         1 | chatgpt-control | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              0 |
|          8 | cmpeq2707000je0kovy3b98o1 |         1 | chatgpt-control | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              0 |
|          9 | cmpeq272c0011e0kohtoh9uam |         1 | chatgpt-control | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              0 |
|         10 | cmpeq2704000fe0koff4zaby6 |         1 | chatgpt-control | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              0 |
|         11 | cmpf2srqx0001xdnfgbabalt3 |         1 | lumni-v2        | cmpdnegbw000rh6kfothxa69f | Brown University                   |              3 |
|         12 | cmpf2t2020009xdnf6501ba1f |         1 | lumni-v2        | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              3 |
|         13 | cmpf2vrqx000drwm4p7pdcy9r |         1 | lumni-v2        | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              4 |
|         14 | cmpeq2721000pe0koi0iwdzyg |         1 | chatgpt-control | cmpdneg7l0003h6kfubgtv56e | Harvard University                 |              0 |
|         15 | cmpeq2723000re0kodinve02d |         1 | chatgpt-control | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              0 |
|         16 | cmpeq26zx0009e0ko4vrmfi3u |         1 | chatgpt-control | cmpdnegar000jh6kfvrqqxo58 | Yale University                    |              0 |
|         17 | cmpeq2727000ve0kohpe9hesu |         1 | chatgpt-control | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              0 |
|         18 | cmpeq2725000te0kofz8mhqpj |         1 | chatgpt-control | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         19 | cmpeq26xv0001e0ko95vzhx55 |         1 | chatgpt-control | cmpdnegbw000rh6kfothxa69f | Brown University                   |              0 |
|         20 | cmpf2vnbo0009rwm4rlmuia7o |         1 | lumni-v2        | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           |              3 |
|         21 | cmpf2t97e000fxdnfyqlak7lg |         1 | lumni-v2        | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 |              3 |
|         22 | cmpeq26zu0007e0kogilmle1l |         1 | chatgpt-control | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              0 |
|         23 | cmpeq270a000le0kotra3m39m |         1 | chatgpt-control | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         24 | cmpeq272a000ze0kok4e7mu83 |         1 | chatgpt-control | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley |              0 |
|         25 | cmpf2vi8b0005rwm4j3bunl0s |         1 | lumni-v2        | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 |              3 |
|         26 | cmpeq26yw0003e0kod8r6o3ft |         1 | chatgpt-control | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis |              0 |
|         27 | cmpf2tbrz000hxdnffermoh82 |         1 | lumni-v2        | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              1 |
|         28 | cmpeq270f000ne0koa15xooh5 |         1 | chatgpt-control | cmpdneg7z0005h6kfz3li3bfa | Duke University                    |              0 |
|         29 | cmpf2vwli000hrwm4qz2soz34 |         1 | lumni-v2        | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  |              0 |
|         30 | cmpf2t3wd000bxdnf036pqnxr |         1 | lumni-v2        | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              4 |
|         31 | cmpeq2705000he0kocu1vrcun |         1 | chatgpt-control | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley |              0 |
|         32 | cmpf2tege000jxdnfs2xgstnq |         1 | lumni-v2        | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         |              3 |
|         33 | cmpf2sxff0005xdnfst8gt015 |         1 | lumni-v2        | cmpdnegbb000nh6kf94vzdq3a | Brown University                   |              1 |
|         34 | cmpf2vkve0007rwm4l2gyt6yd |         1 | lumni-v2        | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 |              0 |
|         35 | cmpf2tgsx000lxdnfo31lt7wq |         1 | lumni-v2        | cmpdneg8j0007h6kfr2l36e9i | Stanford University                |              0 |
|         36 | cmpf2vu03000frwm404c1tbvv |         1 | lumni-v2        | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              |              3 |
|         37 | cmpeq26zz000be0ko46d7tq8x |         1 | chatgpt-control | cmpdnegae000hh6kfr5k0760u | Harvard University                 |              0 |
|         38 | cmpeq2729000xe0kogtovuv0o |         1 | chatgpt-control | cmpdn3mdl000pqewfdnllbbks | Yale University                    |              0 |
|         39 | cmpf2t659000dxdnf55lavlz1 |         1 | lumni-v2        | cmpdnega6000fh6kftyckvz43 | Northwestern University            |              4 |
|         40 | cmpf2szjm0007xdnfif10x30p |         1 | lumni-v2        | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         |              4 |

Counts: 20 chatgpt-control + 20 lumni-v2 = 40 sessions. Each pool covers
all 20 distinct dogfood case IDs.

## How PR7's gate script consumes this

1. Read the **Ground truth** table → build a `Map<sessionId, 'lumni-v2' | 'chatgpt-control'>`.
2. Feed the **Evaluator view** rows (sans `source`) into each of the 5
   counselor agents, recording per-row Likert ratings (SHARP + USEFUL)
   into `EssayDebateEvaluation`.
3. After all ratings collected: join on `sessionId` to re-attach
   `source`, then compute lumni-v2-vs-control SHARP+USEFUL share +
   per-pair winner.
4. Decision gate (`debate-eval-gate.util.ts`): lumni-v2 share ≥ control
   share AND ≥3/5 agents say "ship it" → green to flip the v2 prompt to
   the canary path. PR7's optional bonus comparison: lumni-v2 share ≥
   lumni-v1 share (from PR5 ratings) — if YES we have evidence PR6's
   prompt iteration moved the needle.

## Implementation notes

- All 20 lumni-v2 sessions ran against `DEBATE_PROMPT_VERSION = 'v2'`
  (asserted by the seed script at run time — see
  `scripts/seed-lumni-debate-turns-v2.ts` first guard).
- `paragraphIndex` per case is deterministic:
  `caseId.charCodeAt(0) % numParagraphs`. The same rule used by PR5's
  v1 lumni batch, so v1-vs-v2 share a per-case paragraph scope (apples
  to apples).
- User-challenge text is byte-identical across PR4 control, PR5 v1
  lumni, and PR7 v2 lumni (verbatim copy of `buildUserChallenge()`).
  All three pools answer the same question per case.
- Two seed system users were used (`top-cases@system.local` and
  `system@studyabroad.internal`) because each script run consumes
  one turn against the 30/day per-user budget. This is a script-level
  detail — both users are flagged `system` and aren't real
  applicants. The gate decoder treats both as equivalent.
- The pool marker `turns[].source = 'lumni-v2'` is stamped post-hoc by
  the seed script (the live `EssayDebateService` deliberately doesn't
  write `source` on its own turns; that field is reserved for
  script-authored blind-eval pools).
