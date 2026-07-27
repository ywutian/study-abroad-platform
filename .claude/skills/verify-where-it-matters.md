---
name: verify-where-it-matters
description: Before claiming a change works, prove your evidence covers the path that actually runs in production. Anti-pattern this kills — "local green + CI green, therefore shipped and working", when the deployed path is a different implementation, or the check never ran at all. Forces — state the claim → enumerate every path that can produce the behaviour → mark which ones your evidence actually covers → design a discriminating (falsifiable) probe for the uncovered ones → run it, or say plainly which part is unverified. Use before saying "done"/"fixed"/"it works" for anything whose behaviour depends on the runtime, the platform, the CDN, the build mode, or CI. Not for pure logic changes fully covered by unit tests.
---

# Verify Where It Matters

`close-the-loop` puts a guardrail on the **code** so a bug can't recur.
This skill puts a guardrail on the **claim** so "it works" can't be false.

They run at different moments: close-the-loop after you fix, this one at the instant you're about
to say _done_.

## Why this exists (recurrence is documented)

| Incident                         | The evidence that looked conclusive                 | What was actually true                                                          |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| SEO zero-indexing (#507–#521)    | Local green; content visible in DevTools            | 3 of 4 bugs: content was **injected after hydrate**, absent from server HTML    |
| `NextIntlClientProvider` wrapper | typecheck + **381 unit tests** green                | Server-variant autocompletion silently dropped; only a real browser exposed it  |
| Image cache TTL (#522)           | Local `next start`: header changed. CI: 20/20 green | Vercel runs **its own** image optimizer — the setting did nothing in production |
| Stacked-PR CI                    | `gh pr checks` showed all pass                      | `ci.yml` **never dispatched**; the passing checks were unrelated workflows      |
| `pnpm lint` corruption           | CI Lint job green on every PR                       | Lint corrupted its own checkout; a _different job_ did the typechecking         |

Common shape: **the verification ran, it was green, and it exercised the wrong thing.**

## When to run it

Run before claiming success on anything where behaviour can differ by environment:

- Response headers, caching, CDN behaviour
- SSR / streaming / hydration output
- CSP, middleware, redirects, rewrites, route matching
- Image / font / asset optimization (framework vs. platform implementations)
- Anything you "verified" only via a local dev server
- Any CI result you're about to cite as proof

Skip it for pure logic changes fully covered by unit tests, and for local-only tooling.

## The loop

```
① state the claim → ② enumerate the paths → ③ mark real coverage
   → ④ design a DISCRIMINATING probe → ⑤ run it, or declare the gap
```

### ① State the claim as a falsifiable sentence

Not "I fixed caching." → **"A returning visitor no longer pays a network round-trip for the LCP image."**

If you can't phrase it so that a specific observation would prove it _false_, you don't have a
claim yet — you have a hope.

### ② Enumerate every path that can produce this behaviour

Write the list out. For this repo the usual axes:

| Axis          | Paths                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Build mode    | `next dev` · local production build (`next start`) · Vercel build                                              |
| Runtime owner | framework's own implementation · **platform-provided replacement** (Vercel image optimizer, edge network, CDN) |
| Request path  | direct origin hit · CDN HIT · CDN MISS · middleware-intercepted                                                |
| CI            | job actually dispatched? · which job? · fresh checkout per job?                                                |
| Client        | server HTML · post-hydration DOM                                                                               |

**The single highest-yield question: is the thing I configured actually the thing that runs in
production?** `minimumCacheTTL` is a real Next option that Vercel's optimizer simply doesn't use
that way. Local proved the wrong runtime, perfectly.

### ③ Mark which paths your evidence covers

Be blunt and write it down:

```
claim:    optimized images are browser-cacheable for 30 days
evidence: local `next start` curl        → covers: framework optimizer      ✅
          CI 20/20 green                 → covers: build + typecheck        ✅
          production                     → covers: NOTHING                  ❌  ← the only one that matters
```

If the row that matters is empty, you are not done, no matter how green the others are.

### ④ Design a DISCRIMINATING probe

A probe that passes for the wrong reason is worse than no probe. Ask: **what else could produce
this same reading?** — then eliminate it.

| Confounder                                | How to eliminate it                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stale CDN artifact                        | Request a **cache key nobody has used** (`?w=96` on an image, a fresh query param). Confirm `x-vercel-cache: MISS` + `age: 0` — now the response is provably from the current deploy       |
| Browser/local cache                       | `curl`, not the browser. Fresh connection                                                                                                                                                  |
| Hydration filling it in                   | `curl` the **server HTML**; never read the browser DOM to prove SSR                                                                                                                        |
| "The check passed" but never ran          | **Count the checks.** A normal PR here has ~20; ~5 means only no-branch-filter workflows ran. Confirm the job exists in `gh api .../jobs` and read its log output, not just its conclusion |
| Guard passes because it's inert           | **Plant a violation** and watch it fail (see `/close-the-loop` ⑤)                                                                                                                          |
| Config change looks applied but is cached | Next caches the computed `Cache-Control` alongside optimized images — clear `.next/cache/images` before re-reading                                                                         |

Write the probe so **both outcomes are informative**, and commit to the negative reading in advance:

```
w=96 (never requested) → MISS, age:0
  ├─ max-age=2592000  → derivation confirmed, claim holds
  └─ max-age=0        → my model of the platform is wrong; do NOT guess again, go read
```

### ⑤ Run it — or declare the gap in writing

If a path can't be verified before merge (production-only behaviour usually can't), then **say so
in the PR, in the words of the probe you'll run after deploy**:

> ⚠️ Cannot verify locally: `next start` runs the framework optimizer, not Vercel's. After deploy,
> re-check with an unused size and confirm the MISS response carries the long `max-age`.

Then actually run it after deploy and report the result — including if it failed. A claim that
quietly never got re-checked is the same failure as never checking.

## Discipline rules

- **Green ≠ covered.** Ask which path each green thing exercised, not how many are green
- **Count the checks before citing CI.** ~20 normal, ~5 = the real workflow never dispatched
  (a PR based on a non-`main` branch doesn't match `ci.yml`'s `pull_request.branches` filter;
  changing the base does **not** re-dispatch — close and reopen the PR)
- **`curl` the server, don't read the DOM**, for anything about SSR / headers / CSP / SEO
- **One probe, one confounder eliminated.** Name what else could have produced the reading
- **Write the failing interpretation before you run the probe** — it stops you from rationalising
- **"Not verified" is a valid, reportable state.** Vague is not

## Anti-patterns

| Anti-pattern                                         | Why it fails                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| "CI is green so it's fine"                           | CI may have tested a different checkout, a different job, or nothing at all       |
| "It works on my prod build"                          | Local prod build ≠ platform. Only true for code the framework itself runs         |
| "The header didn't change, must not be deployed yet" | Could be a stale CDN entry — use an unused cache key to tell the two apart        |
| Re-checking the same passing probe                   | It already told you what it can. Add a probe for an _uncovered_ path              |
| Silently dropping a post-deploy check                | The claim stays unverified forever, and nobody knows                              |
| Guessing at platform behaviour twice                 | After one wrong model, read the platform's docs/headers instead of guessing again |

## Related skills

- `/close-the-loop` — guardrail in the code, so the bug cannot recur (this skill is its counterpart
  for the claim). Its step ⑤ "PROVE the guardrail fires" is the same discipline applied to lint rules
- `/perf-loop` — its step ④ has the sibling trap: a harness whose bottleneck differs from
  production's cannot falsify your hypothesis
