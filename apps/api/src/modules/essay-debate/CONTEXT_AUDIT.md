# Essay Debate — Context Audit (Day 1 deliverable)

> Phase 2 V1 PR1, Day 1 of the 7-day plan from the 27-agent debate verdict.
>
> This doc is the contract PR2 will implement against. PR1 (this PR) ships
> only the schema + endpoint skeleton + Redis daily-budget counter. PR2
> wires real Claude calls and pulls the 6 context classes below.

## 1 — Six context classes injected per debate turn

The "essay debate" feature lets a user argue back against the AI paragraph
commentary already attached to a gallery essay (`AdmissionCase.aiAnalysisCache`,
populated by PR #253) or to their own draft (`Essay`). Every turn the
backend must assemble these 6 classes of context before calling Claude:

| #   | Class                                                                                           | Source (table / module)                                                                | Existing fetch path                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **School** — target school metadata: name, US-news/QS rank, prompts, admit rate, testing policy | `School` table via `school` module                                                     | `apps/api/src/modules/school/school.service.ts` → `SchoolService.findById(id)` returns the full record with `SchoolRanking[]` and `essayPrompts` Json. The shared `SCHOOL_BASIC_SELECT` / `SCHOOL_NAME_RANK_SELECT` in `apps/api/src/common/constants/prisma-selects.ts` are the canonical projections.                                |
| 2   | **Profile** — applicant snapshot: GPA, test scores, activities, awards                          | `Profile` + `AdmissionCase` snapshot fields                                            | For the debating user: `apps/api/src/modules/profile/profile.service.ts` → `ProfileService.getMyProfile(userId)`. For the gallery case being debated: `AdmissionCase` rows already carry an anonymised profile snapshot (`gpa9..12`, `testScores`, `activities`, `awards`) — read directly from `case-query.service.ts`.               |
| 3   | **Essay full text** — the prose being debated                                                   | `AdmissionCase.essayContent` (gallery) **or** `Essay.content` (user-owned draft)       | Gallery: `apps/api/src/modules/essay/essay-gallery.service.ts` → `EssayGalleryService.findOne(caseId)` (already returns `essayContent`). User draft: `apps/api/src/modules/profile/profile-essay.service.ts` → `getEssayById(userId, essayId)`. The PR1 skeleton already accepts both via `admissionCaseId` / `essayId`.               |
| 4   | **Original prompt** — the application prompt this essay answers                                 | `AdmissionCase.essayPrompt` (string) or `Essay.essayPromptId → EssayPrompt` (verified) | Gallery: `essayPrompt` column on the same row fetched in (3). User draft: `apps/api/src/modules/essay/essay-prompt.service.ts` → `EssayPromptService.findById(essayPromptId)`. Fall back to `Essay.prompt` (free-form) when no `essayPromptId`.                                                                                        |
| 5   | **Result** — admit/reject + year + round                                                        | `AdmissionCase.{result, year, round}`                                                  | Same row fetched in (3); enum `AdmissionResult ∈ {ADMITTED, REJECTED, WAITLISTED, …}`. For user-owned essays this class is empty — debate runs without it.                                                                                                                                                                             |
| 6   | **Existing AI paragraph commentary** — the AI verdict the user is arguing against               | `AdmissionCase.aiAnalysisCache` (JSON, keyed by locale; PR #253)                       | `apps/api/src/modules/essay/essay-ai.service.ts` constants `PARAGRAPH_PROMPT_VERSION` + `buildParagraphAnalysisSystemPrompt`. `EssayGalleryService.analyzeParagraphs(caseId, locale)` already bypasses the cache when a `schoolName` override is passed; PR2 will reuse the same payload shape for the `aiResponse` half of each turn. |

### Implementation notes for PR2

- Build a small `DebateContextLoader` service that takes
  `{ admissionCaseId?, essayId?, paragraphIndex?, locale }` and returns
  the 6 classes as a single typed object. The loader fans out in parallel
  (Promise.all) — none of the fetches depend on each other.
- Truncate aggressively before Claude: school prompts → 1, profile → just
  GPA + 3 top activities + top award, essay → only the paragraphs adjacent
  to `paragraphIndex` (±1) plus the targeted paragraph. The full essay is
  ~600 tokens already, so cap at ~2,500 input tokens.
- The `existing AI commentary` (class 6) is the prior turn's `aiResponse`
  after the first turn — only the first turn reaches into
  `aiAnalysisCache`.

## 2 — 20 real dogfood candidates (local DB snapshot, 2026-05-20)

Pulled with:

```sql
SELECT ac.id, s.name, ac.result, ac."verificationLevel",
       ac."aiAnalysisCache" IS NOT NULL AS has_ai, ac.year
FROM "AdmissionCase" ac JOIN "School" s ON s.id = ac."schoolId"
WHERE ac."essayContent" IS NOT NULL
  AND ac."verificationLevel" IN ('L2','L3')
ORDER BY ac."createdAt" DESC LIMIT 22;
```

The local seeded snapshot currently has 186 L2 verified essays but only 3
`aiAnalysisCache`-populated rows (precompute hasn't run in this worktree).
The 20 below are all L2 verified with essay text — PR2's dogfood pass
should warm `aiAnalysisCache` with the precompute script first.

| #   | Case ID                   | School                             | Result   | Year | Has aiAnalysisCache | Notes |
| --- | ------------------------- | ---------------------------------- | -------- | ---- | ------------------- | ----- |
| 1   | cmpdnegbw000rh6kfothxa69f | Brown University                   | ADMITTED | 2022 | no                  | L2    |
| 2   | cmpdnegbo000ph6kfnlo83j6t | Washington University in St. Louis | ADMITTED | 2022 | no                  | L2    |
| 3   | cmpdnegbb000nh6kf94vzdq3a | Brown University                   | ADMITTED | 2022 | no                  | L2    |
| 4   | cmpdnegay000lh6kf6o167s8b | University of Pennsylvania         | ADMITTED | 2022 | no                  | L2    |
| 5   | cmpdnegar000jh6kfvrqqxo58 | Yale University                    | ADMITTED | 2022 | no                  | L2    |
| 6   | cmpdnegae000hh6kfr5k0760u | Harvard University                 | ADMITTED | 2022 | no                  | L2    |
| 7   | cmpdnega6000fh6kftyckvz43 | Northwestern University            | ADMITTED | 2017 | no                  | L2    |
| 8   | cmpdneg9c000dh6kf6h7g1hu1 | Cornell University                 | ADMITTED | 2017 | no                  | L2    |
| 9   | cmpdneg94000bh6kflhd0j41i | University of California, Berkeley | ADMITTED | 2017 | no                  | L2    |
| 10  | cmpdneg8r0009h6kforaeu5qp | University of Pennsylvania         | ADMITTED | 2017 | no                  | L2    |
| 11  | cmpdneg8j0007h6kfr2l36e9i | Stanford University                | ADMITTED | 2019 | no                  | L2    |
| 12  | cmpdneg7z0005h6kfz3li3bfa | Duke University                    | ADMITTED | 2018 | no                  | L2    |
| 13  | cmpdneg7l0003h6kfubgtv56e | Harvard University                 | ADMITTED | 2018 | no                  | L2    |
| 14  | cmpdneg4z0001h6kfuvmnwckw | Harvard University                 | ADMITTED | 2018 | no                  | L2    |
| 15  | cmpdn3mdq000tqewfgjszi5zb | Harvard University                 | ADMITTED | 2021 | no                  | L2    |
| 16  | cmpdn3mdn000rqewf5la5rnep | University of Notre Dame           | ADMITTED | 2019 | no                  | L2    |
| 17  | cmpdn3mdl000pqewfdnllbbks | Yale University                    | ADMITTED | 2021 | no                  | L2    |
| 18  | cmpdn3mdh000nqewf1ub0zdu7 | University of California, Berkeley | ADMITTED | 2019 | no                  | L2    |
| 19  | cmpdn3mdf000lqewf0zljnxyd | Georgetown University              | ADMITTED | 2020 | no                  | L2    |
| 20  | cmpdn3mda000jqewf4e2ifmja | Dartmouth College                  | ADMITTED | 2019 | no                  | L2    |

**Bonus — 3 cases that already have aiAnalysisCache** (use these first for
end-to-end dogfood without waiting for precompute):

- `cmpb90gk0006b3v5o25hmqmt7` — UC Berkeley · ADMITTED · 2025 · L1
- `cmpb90gjf005v3v5o9w1mjgxc` — MIT · ADMITTED · 2025 · L1
- `cmpb90gjs00633v5ol1abxh1i` — Yale · ADMITTED · 2025 · L1

### Gaps in context coverage

For the 20 L2 rows above:

- **Class 6 (`aiAnalysisCache`)** is empty for all 20 — run
  `scripts/precompute-gallery-analysis.ts` against them before dogfood.
- **Class 4 (`essayPrompt`)** — check per-row; most L2 rows from the
  harvest pipeline carry the original prompt.
- **Class 5 (`round`)** — all 20 are null (`-` in DB). Result + year
  are present.
- **Class 2 (profile snapshot)** — variable. Some carry `gpa11`/`testScores`
  arrays, others only `gpaRange`/`satRange`. PR2's loader must tolerate
  both shapes.

## 3 — External counselor blind-eval outreach list (5 people, ¥200 each)

Template only — owner to fill in actual contacts. Each evaluator gets the
same 5 paired AI-vs-debate transcripts (anonymised, no identifying info)
and rates which response is more useful on a 1-5 Likert.

| #   | Name  | Role / firm                                | Contact method       | Notes                                                                                 |
| --- | ----- | ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------- |
| 1   | _TBD_ | Senior counselor (US-focused, 5+ yrs)      | WeChat / email       | Prefer someone from a non-Big-3 firm so feedback isn't dominated by Big-3 house style |
| 2   | _TBD_ | Junior counselor / writing coach           | WeChat               | Should have read at least 50 application essays                                       |
| 3   | _TBD_ | Former admissions officer (any T20 school) | LinkedIn             | Highest-signal voice; pay extra if needed                                             |
| 4   | _TBD_ | Independent essay consultant (non-firm)    | Substack DM / WeChat | Tends to be less guarded about negative feedback                                      |
| 5   | _TBD_ | Bilingual counselor (CN ↔ EN essays)       | WeChat               | Specifically rate translation/voice issues                                            |

Deliverable expected from each:

- 5 paired ratings (A vs B, blinded to which is debate vs base AI)
- 2-3 sentences per pair on which one a real applicant should listen to
- One overall verdict: "would you let your students see this feature?" Y/N + why

Decision gate (Day 7): at least 3 of 5 evaluators say "yes, ship it" AND
median per-pair rating of the debate response ≥ base AI response, otherwise
PR2 ships behind a feature flag and we re-debate.
