---
name: canary-rollout
description: Roll out a feature-flagged change through 0%→5%→25%→100% canary stages with monitoring gates between each stage. Codifies the post-decision-memo step — what ops actually does after a gate passes. Use after any /iterate-prompt-with-blind-eval PASS, or any high-risk feature behind essay_debate_enabled / prediction-v5 / new-algo-style flags.
---

# Canary Rollout

After a feature passes gate evaluation, this is what ops does next. Locks in the promotion ladder, monitoring criteria per stage, and rollback triggers so flag-flipping isn't done by vibes.

## When to use

- Decision memo recommends "flip flag" (e.g., `PR9_DECISION.md` says "ADMIN flips `essay_debate_enabled` 0% → 5%")
- New ML model deployed in shadow → ready for canary traffic
- Backend behavior change behind a feature flag — anything where rolling back means "set percentage back to 0" not "revert PR"

Do NOT use for: hotfixes (no flag, ship straight to 100%), config-only changes, internal admin tooling.

## The 4-stage ladder

```
Day 0: 0% → 5%  (warmup)
Day 2: 5% → 25% (acceleration)
Day 5: 25% → 100% (saturation)
Day 14: remove flag (default-on, code cleanup)
```

Each stage has its own promotion gate. Failing a gate **does not** auto-rollback — it **holds at current percentage** until the cause is understood. Rollback is a separate explicit decision.

### Stage 1: 0% → 5% (warmup)

**Promotion criteria**: gate PASS in decision memo, PR merged to main, prod deploy green, on-call ack.

**ADMIN action**: flip the flag in the admin UI:
```
Feature: essay_debate_enabled (or feature name)
Rules JSON: { "percentage": 5 }
```

**Monitor for 48h**:
- Sentry: any new errors in the feature's modules → annotate
- Server warn logs specific to the feature (e.g., `[sycophancy-2.0]`, `[template-fatigue]`, `[hedge-sycophancy]` for essay-debate)
- Real-user complaint rate (qualitative — gather from `#user-feedback` channel)
- Latency p95 / p99 for the new endpoint(s)

**Promotion gate** (Day 2):
- [ ] 0 prod-impacting errors attributable to this feature
- [ ] Server warn-log rate stable or declining
- [ ] Real-user complaint count = 0 (or < 1 per 100 actions)
- [ ] Latency p95 within +20% of pre-flag baseline

### Stage 2: 5% → 25% (acceleration)

**Promotion criteria**: Stage-1 gate passed AND 48h elapsed.

**ADMIN action**: update flag percentage to 25.

**Monitor for 72h**: same as Stage 1 + add:
- Sample 10 random real-user sessions from logs; manually check feature output quality
- Compare lumni-vs-control ratio in production vs eval (if instrumented)
- DB query plan changes (if feature added new queries)

**Promotion gate** (Day 5):
- [ ] Stage-1 criteria still met
- [ ] Manual quality sample: ≥ 80% rated "good or above" by ops reviewer
- [ ] DB load p95 within +30% of pre-flag baseline

### Stage 3: 25% → 100% (saturation)

**Promotion criteria**: Stage-2 gate passed AND 72h elapsed.

**ADMIN action**: update flag percentage to 100.

**Monitor for 7 days**: same as Stage 2 + add:
- Cost per turn / per request (LLM call cost on AI features)
- Cache hit rate if feature uses Redis
- A/B comparison if rule has `userIds` exclusion list for control group

**Promotion gate** (Day 14):
- [ ] Stage-2 criteria still met for 7 consecutive days
- [ ] Cost per turn within projected envelope
- [ ] Cache hit rate ≥ target (e.g., 80%+ for cached LLM analysis)

### Stage 4: remove flag (cleanup)

**Promotion criteria**: Stage-3 stable for 7 days.

**Engineering action** (PR):
- Remove the flag check from code: `if (await featureFlag.isEnabled(...))` → unconditional code path
- Remove flag definition from admin seed data (or mark `archived: true`)
- Delete dead code paths the flag was gating off
- Update BRIEF.md to drop the "behind flag X" notes

This is a cleanup PR, not a rollout PR — same author as feature, fast review.

## Rollback triggers (any stage)

Set on call → revert percentage to **0** immediately when:

| Trigger | Threshold | Action |
|---|---|---|
| Sentry error rate spike attributable to feature | > 10 events / 5 min | 0% + investigate |
| Real-user SYCOPHANTIC / quality complaint rate | > 5% in any 24h | 0% + reopen prompt iteration |
| Latency p99 > 2× baseline | sustained 15 min | 0% + perf-loop |
| DB connection pool saturation | > 90% sustained 5 min | 0% + index review |
| Cost spike | > 3× projected | 0% + cache audit |

**Rollback ≠ failure**. Rolling back to 0% is the *cheap* path back to safety; staying at 25% with degradation is the expensive path.

## Required infrastructure

- **Feature flag service** with Redis caching (60s TTL) — `common/feature-flags/`
- **Admin UI** to update flag percentage live (`admin/feature-flags`)
- **Sentry alerts** scoped to feature modules
- **Structured warn logs** (`[feature-name-warn-type]`) the feature emits per known-bad pattern
- **Quality sampling dashboard** (or saved Looker query / SQL script) for Stage-2 reviews

## Per-stage communication template

After each promotion, drop a 3-line update in the team channel:

```
🚀 [essay-debate] promoted 5% → 25%
✅ stage-1 metrics: 0 prod errors / 0 complaints / p95 +12%
📊 stage-2 monitor: 72h sample 10 sessions, see /admin/debate-eval
```

## Don't-do list

- ❌ Skip a stage because "metrics look fine" — the time-elapsed criterion exists to catch slow-burn bugs (memory leaks, cache invalidation, etc.)
- ❌ Roll back without writing down what triggered it — even a 1-line note prevents repeated mistakes
- ❌ Promote across a weekend/holiday — on-call coverage matters
- ❌ Run 2 canaries simultaneously on overlapping features — attribution becomes impossible
- ❌ Forget Stage 4 (remove flag) — dead flags accumulate; they become traps for new dev

## Quick reference

```
Stage 1: 0% → 5%   Day 0 → Day 2   48h watch  → gate at Day 2
Stage 2: 5% → 25%  Day 2 → Day 5   72h watch  → gate at Day 5
Stage 3: 25% → 100% Day 5 → Day 12  7d watch  → gate at Day 12
Stage 4: remove flag Day 12 → Day 14 cleanup PR
```

## Related skills

- `/iterate-prompt-with-blind-eval` — produces the decision memo that triggers Stage 1
- `/feedback-triage` — handles any user complaints that surface during stages
- `/perf-loop` — if latency rollback trigger fires
