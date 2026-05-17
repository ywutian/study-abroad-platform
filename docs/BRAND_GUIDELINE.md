# Brand Guideline — 校友广场 / Alumni Square

> Last updated: 2026-05-17
> Status: Living document — update whenever a user-facing module is named or renamed
> Enforced by: `scripts/check-deprecated-terms.ts` (pre-commit hook)

---

## 1. Module Naming Rules

1. **One name per module, in both languages.** Every user-facing module has exactly
   one canonical zh name and one canonical en name. Never invent ad-hoc variants
   in components or copy.
2. **Names are defined once, in i18n.** The canonical string lives in
   `apps/web/src/messages/{en,zh}.json` (and the mobile equivalents). Components
   render `t(...)` — they never hardcode a module name.
3. **No legacy aliases in shipped strings.** Once a module is renamed, the old
   name is deprecated immediately. Deprecated terms are listed in §3 and blocked
   by the pre-commit checker. Back-compat (e.g. legacy `?tab=` query values) is
   handled in routing logic, never by re-exposing the old name in UI.
4. **zh and en must stay conceptually aligned.** The en name is a brand
   translation, not a literal one — but it must convey the same idea. When you
   change one language, change the other in the same commit.

---

## 2. Term Table (zh ↔ en)

| zh canonical | en canonical    | Notes |
| ------------ | --------------- | ----- |
| 校友广场     | Alumni Square   | The community hub (formerly 功能大厅 / Feature Hall). Route: `/hall`. |
| 同伴反馈     | Peer Review     | Peer review experience inside the Square (formerly 锐评模式). |
| 认证录取榜   | Verified Admits | Verified-admit leaderboard / dashboard (formerly 认证排行). |
| 学长之路     | Senior's Path   | Prediction-challenge + outcome-learning tab. |
| 积分中心     | Points Center   | User-facing points & redemption surface. Route: `/points`. |
| 录取概率     | Admission Odds  | Prediction feature. Route: `/prediction`. |

> When adding a new module, add a row here **and** the i18n keys in the same PR.

---

## 3. Deprecated Terms (blocked by CI)

These strings must never appear in `apps/web/src` or `apps/mobile/src`. The
pre-commit hook fails on any hit.

| Deprecated  | Use instead |
| ----------- | ----------- |
| 功能大厅    | 校友广场    |
| Feature Hall | Alumni Square |
| 锐评模式    | 同伴反馈    |
| 认证排行    | 认证录取榜  |

---

## 4. Tone of Voice

- **Concise.** Prefer short, plain sentences over marketing prose. A label is a
  label — three words, not a slogan.
- **Encouraging, never judgmental.** The platform supports anxious applicants and
  their families. Frame feedback as growth ("areas to strengthen"), not failure.
- **Honest about uncertainty.** Never imply guarantees. Predictions are estimates;
  peer reviews are opinions; shared data is not fully verifiable. Disclaimers are
  part of the product, not legal boilerplate to hide.
- **Peer-to-peer, not authoritative.** The Square is alumni and applicants helping
  each other. Avoid an "expert verdict" voice; prefer "members suggest…".
- **Bilingual parity.** zh and en copy should feel equally natural to a native
  reader — translate the intent, not the words.

---

## 5. Adding or Renaming a Module

1. Pick the zh + en canonical names; add a row to the §2 term table.
2. Add the i18n keys to `apps/web/src/messages/{en,zh}.json` (+ mobile locales).
3. If renaming, add the old names to §3 and to `DEPRECATED_TERMS` in
   `scripts/check-deprecated-terms.ts`.
4. Run `npx tsx scripts/check-deprecated-terms.ts` and fix any remaining hits.
