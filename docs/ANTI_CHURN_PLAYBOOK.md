# Anti-Churn Playbook

How we stop "building, then rebuilding the same thing days later." Grounded in
how large engineering orgs (Google, Amazon, Meta) actually work, mapped to the
three rework patterns this repo keeps hitting, and wired to enforcement that
fails closed.

> **Thesis.** Almost every back-and-forth is the same mistake: doing the thinking
> (or the throwing-away) in an **expensive medium** — `main`, a merged PR, a
> production deploy — that belongs in a **cheap medium** — a half-page note, a
> sandbox branch, or a lint rule. The fix is always: move the thinking and the
> mistakes upstream into something cheap, then **record the decision + its
> invariant** so it can't silently un-happen.

---

## 1. The number (so it's not a feeling)

`pnpm churn:report` measures rework as _a code file re-edited within 14 days of
its previous commit_ — an approximation of GitClear's "lines revised < 2 weeks
after being authored."

| Window       | Churn rate    | Reference                                                                |
| ------------ | ------------- | ------------------------------------------------------------------------ |
| Last 30 days | **~11.7%** 🔴 | GitClear longitudinal baseline ≈ 3–4% healthy; ≈ 7%+ is the warning band |

The hottest re-touched files line up exactly with the qualitative clusters
below — `prediction.service.ts` (27× in 60d), `counselor/counselor-modifiers.ts`
(23×), `prediction/page.tsx` (8× in 30d), `dashboard.service.ts` (15×),
`_components/hero-section.tsx` (10×).

**Track the 30-day number over time** — the metric inflates across longer
windows (revisits compound), so compare like-for-like windows, and watch the
trend against _your own_ trailing baseline rather than an absolute target. Never
use churn to rank people; it's a system signal — high churn can equally mean a
hard problem or unclear requirements (DORA: improve over time, don't compete /
single-metric goals — <https://dora.dev/guides/dora-metrics/>).

---

## 2. The three patterns we actually hit — and the enterprise cure for each

### Pattern ① Designing in `main` (UI / architecture)

**Our incident.** The `/prediction` layout: PR #408 rebuilt it as a workbench
master-detail; _the same day_ #410 killed its internal scrollbars; #411 killed
"the last" one; #426 split it again. The workbench itself had already been
rebuilt once (#143). We used `main` as the sandbox.

**How big orgs prevent it**

| Practice                                                                                                                                                                                                                                                                                         | What it is                                                                                                                                                                                                                                                | Lightest-weight version for us |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Design doc / RFC before code** — [Google](https://www.industrialempathy.com/posts/design-docs-at-google/), [Amazon 6-pager / PR-FAQ](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/), [RFCs at Uber/Stripe](https://blog.pragmaticengineer.com/rfcs-and-design-docs/) | A **half-page** in the PR description or an ADR: _Problem / Options / Decision / Invariant_. Google's own trigger: write one if ≥3 of {unsure of approach, senior input helps, design is contentious, cross-cutting}. **Sleep on it once** before coding. |
| **Spike / prototype / tracer bullet** — [Pragmatic Programmer](https://www.codingblocks.net/podcast/the-pragmatic-programmer-tracer-bullets-and-prototyping/), [agile spikes](https://www.mountaingoatsoftware.com/blog/spikes)                                                                  | A throwaway exploration to answer _one_ unknown. Open `spike/<q>`, **timebox 2h**, answer "does it overflow at 15+ schools?", carry the **answer** into the real PR, **delete the branch**. The throwing-away happens off-trunk.                          |
| **ADR — decision + consequences** — [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html)                                                                                                 | We already use `docs/adr/`. Record the **invariant**, not just the choice, so a newcomer (or future-you) can't "blindly reverse" it.                                                                                                                      |
| **Defining layout invariants up front** — [CSS-Tricks grid blowout](https://css-tricks.com/preventing-a-grid-blowout/)                                                                                                                                                                           | Already in `.claude/rules/frontend.md` ("4 ironclad rules") and enforced by `no-missing-min-w-in-grid-container`. The single highest-leverage anti-churn move for a solo UI dev: **promote each hard-won layout rule to a lint guard**.                   |

### Pattern ② Dependency / build flip-flop

**Our incident.** zod pinned to 3 (#111) → knip crashed (#419) → knip pinned to
purge zod 4 (#424) → zod 4 allowed back (#434) → _still_ fixing a Vercel
type-check at HEAD. Plus "passes locally, fails on Vercel" recurring.

**How big orgs prevent it**

| Practice                                                                                                                                                                                     | What it is                                                                                                                                                                                                             | What we did (ADR-0021)                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google One-Version Rule** — [oneversion](https://opensource.google/documentation/reference/thirdparty/oneversion), [SWE@Google ch.21](https://abseil.io/resources/swe-book/html/ch21.html) | Exactly one version of a dep; two coexisting majors = a _diamond dependency_ that resolves randomly at runtime — literally our zod 3↔4.                                                                                | `pnpm lint:dep-pins` asserts zod's allowed majors `{3, 4}` (4 = knip-only). A third major or an app bump fails the build.                                                           |
| **Frozen lockfile _everywhere_** — [pnpm](https://pnpm.io/cli/install)                                                                                                                       | `--frozen-lockfile` is the default in CI but **not** locally — that asymmetry _is_ "works locally, fails on Vercel."                                                                                                   | Pre-push **Step 0** runs `pnpm install --frozen-lockfile` so drift fails before the push, the same way CI/Vercel fail.                                                              |
| **Build-env parity** — [Vercel package managers](https://vercel.com/docs/package-managers), [Corepack](https://corepack.org/)                                                                | Pin package-manager + Node so local == CI == prod resolve identically. A redundant type-check under divergent env config is an anti-pattern (it fails on the divergence, not a real defect — exactly the HEAD commit). | `engines.node: "20.x"` in root **and `apps/web`** (Vercel reads the web project's `package.json`) **and `apps/api`**; `.nvmrc=20`; already `node:20-alpine` + CI `NODE_VERSION=20`. |
| **No blanket dedupe in unrelated work**                                                                                                                                                      | A full `pnpm dedupe` is a large, risky resolution change.                                                                                                                                                              | We deliberately did **not** run it (lockfile has ~30 dedup-able dupes); guarded the _contested_ packages instead. A dedupe, if wanted, is its own reviewed PR.                      |

### Pattern ③ Abstracting too late + read-time/​write-time desync

**Our incidents.** The cron single-flight helper wasn't extracted until the
_5th+_ cron (`withCronLock`, #451). And a value computed at read-time in a
response mapper was invisible to the reminder scheduler's SQL `WHERE` → reminders
silently never fired (#436 → #437).

**How big orgs prevent it**

| Practice                                                                                                                                                                                                                    | What it is                                                                              | Rule for us                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule of Three** — [Fowler/Roberts](https://en.wikipedia.org/wiki/Rule_of_three_%28computer_programming%29)                                                                                                                | Extract on the **third** occurrence — waiting for the 5th is _later_ than required.     | Extract a helper/SSOT at the **3rd** real repeat…                                                                                                                                                                                      |
| **"The Wrong Abstraction"** — [Sandi Metz](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction), [AHA programming](https://kentcdodds.com/blog/aha-programming)                                                      | "Duplication is far cheaper than the wrong abstraction."                                | …**only if the three share the same _reason to change_.** Looks-alike ≠ couple. If an abstraction grows boolean/param flags to serve callers, inline it back.                                                                          |
| **Persist-vs-compute + consumer-driven contracts** — [Pact](https://pactflow.io/what-is-consumer-driven-contract-testing/), [CQRS read-model staleness](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) | A value computed only at read-time is invisible to anything querying the stored column. | If **any** non-presentation consumer (cron, aggregate, another `where:{col}`) needs the value → **persist it**. If you must compute at read, `grep` every consumer and apply the transform there too, and pin it with a contract test. |

---

## 3. The 6-gate protocol (run it before/while you work — 10 seconds)

```
1. >1 day / changes layout / changes architecture? → half-page design note, sleep on it      (Pattern ①)
2. Any "not sure this will work" point?            → spike branch, timebox; don't sandbox in main (Pattern ①)
3. Touching a dep version / lockfile / build?      → run `pnpm install --frozen-lockfile` before push (Pattern ②)
4. Third time writing the same thing?              → extract — iff the three share one reason to change (Pattern ③)
5. Will this value be read by a cron / SQL / elsewhere? → persist it; don't only compute at read time   (Pattern ③)
6. Did this bug/decision just cost rework?         → turn it into a lint/test/ADR so it can't recur (/close-the-loop)
```

Gate 6 is the flywheel and the thing a solo dev has instead of a reviewer:
**make the machine the reviewer.** Google's pre-merge review exists to catch
issues "when it is still relatively cheap to make changes"
(<https://abseil.io/resources/swe-book/html/ch09.html>); with no second person,
encode each rule as a fail-closed guard — exactly what `no-uncapped-array`,
`no-missing-min-w-in-grid-container`, and now `lint:dep-pins` do.

---

## 4. What's enforced in this repo

| Mechanism                                          | Enforces                                      | Where                                                                                   |
| -------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm lint:dep-pins`                               | One-Version Rule for contested deps (zod)     | `scripts/check-dep-pins.ts`, in `lint:all` + pre-push                                   |
| Pre-push **Step 0** frozen-lockfile                | local == CI == Vercel lockfile state          | `.husky/pre-push`                                                                       |
| `engines.node: "20.x"` + `.nvmrc`                  | Node 20 across local/CI/Vercel/Docker         | root + `apps/web` + `apps/api` `package.json`                                           |
| [ADR-0021](adr/0021-dependency-version-pinning.md) | the recorded dep/build decisions + invariants | `docs/adr/`                                                                             |
| `pnpm churn:report`                                | the trend number                              | `scripts/churn-report.ts`                                                               |
| PR template "Design note" section                  | the half-page gate for non-trivial changes    | `.github/PULL_REQUEST_TEMPLATE.md`                                                      |
| Existing layout/contract lints                     | Patterns ① & ③ invariants                     | `no-missing-min-w-in-grid-container`, `no-uncapped-array`, `no-unguarded-auth-query`, … |

---

## Sources

Design/architecture churn — Google design docs
(<https://www.industrialempathy.com/posts/design-docs-at-google/>), Amazon
working-backwards (<https://workingbackwards.com/concepts/working-backwards-pr-faq-process/>),
RFCs/design docs survey (<https://blog.pragmaticengineer.com/rfcs-and-design-docs/>),
ADRs (<https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>,
<https://martinfowler.com/bliki/ArchitectureDecisionRecord.html>), spikes/tracer
bullets (<https://www.mountaingoatsoftware.com/blog/spikes>), Google code review
(<https://abseil.io/resources/swe-book/html/ch09.html>), Amazon leadership
principles "disagree and commit" (<https://www.aboutamazon.com/about-us/leadership-principles>),
grid blowout (<https://css-tricks.com/preventing-a-grid-blowout/>).

Dependency/build thrash — One-Version Rule
(<https://opensource.google/documentation/reference/thirdparty/oneversion>,
<https://abseil.io/resources/swe-book/html/ch21.html>), pnpm frozen-lockfile
(<https://pnpm.io/cli/install>), Renovate best practices
(<https://docs.renovatebot.com/upgrade-best-practices/>), Vercel package managers
(<https://vercel.com/docs/package-managers>), Corepack (<https://corepack.org/>).

Churn metrics + abstraction timing — Nagappan & Ball, relative code churn
(<https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icse05churn.pdf>),
GitClear churn definition
(<https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality>),
DORA metrics (<https://dora.dev/guides/dora-metrics/>), Rule of Three
(<https://en.wikipedia.org/wiki/Rule_of_three_%28computer_programming%29>), Sandi
Metz "The Wrong Abstraction" (<https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction>),
AHA programming (<https://kentcdodds.com/blog/aha-programming>), Pact consumer-driven
contracts (<https://pactflow.io/what-is-consumer-driven-contract-testing/>), CQRS
(<https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs>).
