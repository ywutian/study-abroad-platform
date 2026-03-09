# Activity Tier/Weighting — Research and Design Options

## 1. What the research says

### 1.1 Common 4-Tier framework (College Vine, IvyD, counselors)

- **Tier 1**: National/international recognition, rare achievement, or major leadership (e.g. national debate champion, international youth orchestra, founded impactful nonprofit).
- **Tier 2**: State-level recognition or highly selective programs (e.g. All-State, Governor's School).
- **Tier 3**: Significant leadership or long-term deep involvement (e.g. club founder, captain, with real time commitment).
- **Tier 4**: General participation, no leadership or distinction.

Tiers are defined by **level of achievement / scope**, not by a fixed list of activity names.

### 1.2 Common App

- Uses ~30 **categories** (Academic, Art, Debate/Speech, Research, Work, Other, etc.). Activity **name and description** are free text; there is no official "predefined activity list with weights."

### 1.3 Holistic review (depth vs prestige)

- Admissions often value **depth of commitment and demonstrable impact** over prestige. "Angular" profiles (deep in 1–2 areas) can beat scattered high-prestige items.
- **Unknown activities** are not automatically unimportant: if the **description** shows role, hours, outcomes, and impact, they can still be Tier 2/3.
- So: "activities we don't know = mostly unimportant" should **not** be a hard rule. Better: **known high-prestige activities get a bonus; unknown activities still score by depth/leadership/diversity, with no extra penalty.**

### 1.4 Our codebase

- **Awards** already use a reference table + tier: `Competition` has `tier` (1–5), `Award` can link via `competitionId`; scoring uses tier. Unlinked awards use level-based fallback.
- **Activities** today: free name + category enum + role/description/hours; score = count + leadership keywords + total hours + diversity. No "known activity" list or tier.

---

## 2. Design options

| Option                          | Approach                                                                                                                                                                                                           | Pros                                                            | Cons                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| **A. Activity reference table** | New `ActivityTemplate` (like Competition): name, nameZh, category, tier(1–4). Activity can optionally link `activityTemplateId`. Scoring: tier-based prestige bonus for linked; unlinked use current formula only. | Consistent with Award/Competition; maintainable; supports i18n. | Need seed data and UI to pick template.                             |
| **B. Name matching only**       | Maintain a list of "high-prestige" names/aliases; match `activity.name` to assign tier; no schema change.                                                                                                          | Quick to implement.                                             | Fragile to typos, language mix, synonyms.                           |
| **C. Tier field only**          | Add `tier` (1–4) on Activity; user or admin sets it when editing. Score by tier.                                                                                                                                   | Simple, no list.                                                | No objective anchor for "famous" activities; users may over-report. |

**Recommendation**: Prefer **A** (reference table + optional link). If MVP must be minimal, start with **C**, then add **A** later.

---

## 3. Recommended scoring (option A)

- **Known activities** (have `activityTemplateId`): Keep current formula (count + leadership + depth + diversity), then **add prestige points by tier** (e.g. tier1 +N, tier2 +M). Total still clamped 0–100.
- **Unknown activities** (no template link): **Use current formula only**, no extra penalty. They still get points for leadership, hours, diversity; they just don't get the prestige bonus.

This matches "we give known activities extra weight" without "unknown = unimportant."

---

## 4. Summary

- **Should we curate activities?** Yes. Prefer **curating a set of known activities with tier/weight**, while still allowing free-form "other" activities that are scored by depth/leadership/diversity only.
- **"Unknown = mostly unimportant"**: Implement as **bonus for known, no penalty for unknown**, not as zero or negative weight for unknown.
- Can be done in phases: e.g. fix edit form + AI description first, then add ActivityTemplate + tier scoring.
