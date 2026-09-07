# AI Provider Consolidation — 2026-09-07

<!-- section:change-identity -->

## 1. Change Identity

[DECISION] Change ID: AI-PROVIDER-CONSOLIDATION-2026-09-07. Move production
chat and embeddings off two failing third-party gateways onto the official
OpenAI API under a single credential, and make provider failures legible.
Requester/owner: user. Status: **implemented and merged; production NOT
switched — blocked on OpenAI account credits.**

<!-- section:executive-summary -->

## 2. Executive Summary

Production AI was served by two gateways, both of which failed within eleven
days, and both failures were misreported by our own error mapping as
authentication problems. Three separate investigations — #632 on 2026-08-26,
and twice in this session — chased a credential that was never wrong.

The root cause in every case was an account balance. The root cause of the
_misdiagnosis_ was that the provider layer collapsed distinct HTTP statuses
into `AUTHENTICATION` and redacted the upstream error body, so the word
"quota" never reached a log line.

Five changes landed. Chat and embeddings now both target `api.openai.com`
under one secret. Production still serves the previous revision because the
OpenAI account has no credits: the canary answers HTTP 429
`insufficient_quota` and the pre-promotion gate correctly refuses to shift
traffic.

<!-- section:evidence -->

## 3. Gateway State (all measured, not inferred)

[RUNTIME] `xh.v1api.cc` — balance $0.00225. Pre-deducts a request's maximum
possible cost, so identical calls succeed at `max_tokens=1` and fail at 1024
with **403 `insufficient_user_quota`**. Embeddings had been silently degrading
to FTS-only since 2026-08-26; `PersistentMemoryService` stores rows without a
vector and falls back to full-text search rather than erroring, so no user
would have seen a failure.

[RUNTIME] `claude-relay.liziqiao.com` — returns **HTTP 400** for `gpt-5.4` as
of 2026-09-07, observed on canary `01035-les`. Our request is unchanged:
diffing the provider path between `4e110794` (which passed acceptance on
2026-08-31) and `4c19d1b9` shows nothing that reaches the wire. The gateway's
response changed. It also has no `/v1/embeddings` route — unauthenticated
probes return 404 there while `/v1/chat/completions` returns 401, so the route
genuinely does not exist.

[RUNTIME] `api.openai.com` — endpoint, credential, model name and request
shape all verified working. Canary `01037-zif` reached
**429 `insufficient_quota`**, which requires successful authentication; an
invalid key answers 401. `gpt-5.4` is OpenAI's own model name, already in
`MODEL_CATALOG` under current families with published pricing — the gateway
had been forwarding it verbatim.

[DECISION] The user's local TLS failure against `xh.v1api.cc` is SNI-level
path interference, not a gateway fault: against the same IP and port, an
arbitrary nonexistent SNI completes a TLS 1.3 handshake while the real
hostname does not. Do not infer gateway health from that workstation.

<!-- section:changes -->

## 4. Changes Merged

[DECISION] #653 — returned chat to claude-relay so `main` could deploy at all,
undoing #649's switch to the drained gateway.

[DECISION] #652 — split HTTP 403 off `AUTHENTICATION` into `PERMISSION_DENIED`,
and put the HTTP status into the error message. Two construction sites needed
changing; fixing only `routedError()` left `chat()` opaque because the stream
collector re-wraps and dropped the status. The spec caught that: `httpStatus`
and `code` matched while `message` did not.

[DECISION] #654 — pointed both chat and embeddings at `api.openai.com` under
`openai-platform-api-key`. Dropped `reasoning_effort`, which OpenAI does not
accept as `none` and which was inert on the routed path anyway.

[DECISION] #655 — report the upstream error slug. A bounded 2 KiB peek at the
error body, matched against a fixed allowlist, emitting only the matched
constant. Redaction is preserved and pinned by a test asserting an unmatched
body leaves no trace. An existing spec caught that awaiting `read()` on a
half-dead peer wedges the error path; the peek now races a 250 ms timer.

[DECISION] #656 — closed a real hole in the deploy-drift gate. `LLM_PROVIDER`,
`OPENAI_MODEL` and `OPENAI_BASE_URL` were checked with `text.includes()`, which
any value carrying the canonical one as a prefix satisfies, so
`OPENAI_BASE_URL=https://api.openai.com/v1-evil.example` passed a green gate.
No proof had probed it because the old seed replaced the whole URL rather than
appending to it.

<!-- section:verification -->

## 5. Verification

[RUNTIME] CI on `main` at `b353fe6f`: Type Check, Unit Tests, E2E Tests, Lint,
Prediction Gate, Security Scan, Secret Scan, SAST, Application Analysis
Governance, Browser Extension, Web Release Runtime Gate, Web E2E, Docker Build,
SBOM — all green.

[RUNTIME] Local: API 4,685 tests / 354 suites; web 435 tests / 66 files;
mobile `tsc --noEmit` clean; 10 root guardrails pass; 36/36 gate proofs hold.

[RUNTIME] Local runs showed 4 API suites and 11 web tests failing under a host
load average of 38–65 from unrelated containers. Each was re-run in isolation
with a generous timeout and passed, and the same commit is green on CI. The
failures were host contention, not defects. This machine is not a reliable
test instrument while that load persists.

[RUNTIME] #655 verified in production behaviour, not just in tests — the same
failure, before and after:

    01036-mip   Routed OpenAI RATE_LIMIT (HTTP 429)
                embedding_http_429
    01037-zif   Routed OpenAI RATE_LIMIT (HTTP 429: insufficient_quota)
                embedding_http_429_insufficient_quota

<!-- section:release-decision -->

## 6. Release Decision

[DECISION] Production is **not** switched. `study-abroad-api-01031-qub` holds
100% of traffic on the previous configuration. Four deploys reached the canary
and were refused promotion by Harness acceptance; rollback ran each time and
production was never affected.

[OPEN] **The OpenAI account needs credits.** This is the only remaining
blocker and requires the account owner. Once funded, re-running the deploy is
sufficient — no code or configuration change is needed, `main` already carries
the OpenAI configuration.

[OPEN] Production chat has very likely been broken since some point after
2026-08-31 and nobody would have noticed: the platform has no real users, and
the last genuine LLM call in production logs is from that date. Earlier claims
in this session that production chat was healthy were inferences from "it runs
the configuration that passed on 08-31", which did not survive the far end
changing.

[OPEN] The credential in `openai-platform-api-key:2` was pasted into a chat
transcript and should be rotated. Version 1 held a shell fragment from a
mis-paste and is disabled. After rotation, add the new key as version 3 and
update `secretVersion` in `.github/deploy-config.json` plus the two bindings in
`ci.yml`; the drift gate and its proof derive from that config and need no edit.

[OPEN] #650 (chat via the official DeepSeek API) remains open as an alternative
provider and now conflicts with `main`. It is not superseded — it is a
different answer to the same question — and is left for the owner to decide.
