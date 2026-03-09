# 组队 (Teams) Feature — Design Analysis Report

**Product context:** Study-abroad platform with Dashboard, Schools, Cases, Forum, Prediction, Timeline, Chat, Hall, etc. This document analyzes the **standalone 组队 section** where teams are first-class entities (same-school application groups, prep groups, timeline-sharing groups). Output is design decisions and rationale only; no code.

---

## 1. User Journeys (End-to-End)

### Journey A: New user discovers 组队 → browses public teams → joins (OPEN or request/invite for INVITE_ONLY)

| Step | Screen / Decision point                                                                            | Success state                                                                                          | Error state                                                                                | Where user lands next        |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------- |
| 1    | **Entry:** Main nav "组队" or More → 组队, or Dashboard/Forum CTA "去组队"                         | —                                                                                                      | —                                                                                          | `/teams` (default tab: 发现) |
| 2    | **List:** 发现队伍 — cards with name, school, tags, member count, join policy                      | List loads                                                                                             | Network error → retry; empty → empty state                                                 | Same page                    |
| 3    | **Filter/sort:** School, tags, join policy (OPEN / INVITE_ONLY), sort (newest / members)           | Filtered list                                                                                          | No results → empty state with "clear filters"                                              | Same page                    |
| 4    | **Click card** → team detail                                                                       | Navigate to detail                                                                                     | —                                                                                          | `/teams/[id]`                |
| 5a   | **OPEN team:** Primary CTA "加入队伍"                                                              | Join request sent; toast "加入成功"; user becomes member; detail updates (member list, leave CTA)      | Team full → disabled CTA + copy "队伍已满"; already member → show "已加入" / leave         | Stay on `/teams/[id]`        |
| 5b   | **INVITE_ONLY team:** Primary CTA "申请加入"                                                       | Opens "申请加入" form (optional message) → submit → toast "申请已提交"; CTA becomes "已申请" / pending | Already applied → "您已申请，请等待回复"; not logged in → redirect to login with returnUrl | Stay on `/teams/[id]`        |
| 6    | **Not logged in** (from step 2 or 4): List visible with blurred or disabled join; CTA "登录后加入" | Login/register → return to previous URL                                                                | —                                                                                          | `/teams` or `/teams/[id]`    |

**Decision points:** (1) Which tab on entry — default 发现. (2) OPEN vs INVITE_ONLY — one-tap join vs request flow. (3) Guest vs logged-in — what’s visible and what’s gated.

---

### Journey B: User creates a team → sets metadata → shares/invites → manages members

| Step | Screen / Key actions                                                                                                                                                      | Success state                        | Error state                                      | Where user lands next             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ | --------------------------------- |
| 1    | **Entry:** Empty state "创建第一支队伍" or list header CTA "创建队伍"                                                                                                     | —                                    | Not logged in → login with returnUrl             | `/teams/create` or modal (see IA) |
| 2    | **Create form:** Name (required), description (optional), school/tags (optional), visibility (PUBLIC / UNLISTED), join policy (OPEN / INVITE_ONLY), maxMembers (optional) | Validation passes                    | Validation error inline; duplicate name → toast  | Same step                         |
| 3    | **Submit:** Create team                                                                                                                                                   | 201; toast "队伍创建成功"            | 4xx/5xx → toast + stay on form                   | `/teams/[id]` (new team)          |
| 4    | **Post-create:** Detail page with empty members (only creator). Actions: "复制邀请链接" / "邀请成员" (email or in-app)                                                    | Link copied toast; invite sent toast | Invite fail → toast                              | Stay on `/teams/[id]`             |
| 5    | **Manage members (owner):** Member list with role (owner/member), kick (non-owner), transfer ownership (optional), leave (owner must transfer first or disband)           | Kick/transfer success toast          | Last owner cannot leave without transfer/disband | Same page                         |

**Recommendation:** Create flow = **single page** (no stepper) with clear required vs optional; **preview** before submit is optional (can be "创建并查看" to reduce steps). Share/invite is **post-create on detail**, not a step in create.

---

### Journey C: Existing member opens "我的队伍" → enters team → sees members/activity → leaves or (if owner) disbands

| Step | Screen / Key actions                                                                                                                                   | Success state                                                             | Error state                                                  | Where user lands next |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- |
| 1    | **Entry:** 组队 section → tab "我的" or direct link `/teams?tab=my`                                                                                    | List of my teams                                                          | Empty → empty state "您还未加入任何队伍" + CTA "去发现"      | `/teams` (tab 我的)   |
| 2    | **Click card** → team detail                                                                                                                           | Detail loads with member list, activity (optional), settings (owner only) | Not member / link expired → 404 or "无权限" (see edge cases) | `/teams/[id]`         |
| 3    | **Detail:** Above fold: name, school, join policy, member count, primary action (leave / invite / settings). Below: description, member list, activity | —                                                                         | —                                                            | Same                  |
| 4    | **Leave:** Button "退出队伍" → confirmation dialog "确定退出？您将失去成员身份。"                                                                      | Toast "已退出"; redirect to `/teams` (我的) or list without this team     | Owner → "请先转移队长或解散队伍"                             | `/teams`              |
| 5    | **Owner — Disband:** Settings or dropdown "解散队伍" → confirmation "解散后不可恢复，确定吗？"                                                         | Toast "队伍已解散"; redirect to `/teams`                                  | —                                                            | `/teams`              |

**Confirmation/feedback:** All destructive actions (leave, kick, disband) use modal confirm; success = toast + navigation where appropriate.

---

## 2. Information Architecture

### 2.1 Where 组队 sits in the product

- **Recommendation: Main nav + More**
  - **Main nav:** Add "组队" as a primary item (with Dashboard, Schools, Prediction, Cases, Forum). **Rationale:** Teams are a core social/application construct; making them first-class matches the "standalone section" goal and raises discoverability. Current nav has five items; adding a sixth is acceptable; alternatives (replacing one or only in More) underplay the feature.
  - **More (mega-menu):** Also include 组队 under **Discovery & Community** (with Hall, Chat, Timeline, etc.). **Rationale:** Some users think of "finding a team" as community; duplicate entry supports both mental models (core tool vs community) and gives a second path from "More" without forcing everyone to use main nav.

- **Mobile:** Do **not** add 组队 to the bottom tab bar (keep Home, Cases, Prediction, Profile). **Rationale:** Tab bar is reserved for highest-frequency surfaces; 组队 can live in the hamburger drawer under a "组队" or "Community" group. If metrics later show very high usage, consider promoting.

### 2.2 Structure inside 组队: single entry with tabs vs separate nav items

- **Recommendation: Single entry with tabs (我的 / 发现).**
  - **Single route:** `/teams` with a tab or query: `/teams?tab=my` and `/teams?tab=discover` (or path `/teams/my` and `/teams/discover` if you prefer path-based).
  - **Pros:** One place for "all team things"; clear mental model (my teams vs find teams); less nav clutter; consistent with patterns like Forum (categories/tabs inside one section).
  - **Cons:** One more click to switch context (my vs discover). Mitigation: default tab can be "发现" for new users and "我的" for returning users with memberships (optional).
  - **Alternative (separate "我的队伍" and "发现队伍" in nav):** More clicks from other pages and more nav items; not recommended.

### 2.3 Hierarchy and URLs

- **Hierarchy:** 组队 → List (tabs: 我的 | 发现) → Team detail → (member list, settings, invite).
- **Recommended URLs:**

| URL                     | Use                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `/teams`                | List; tab = 我的 or 发现 (query or path)                                                               |
| `/teams/create`         | Create team (full page)                                                                                |
| `/teams/[id]`           | Team detail (members, activity, primary CTA)                                                           |
| `/teams/[id]/settings`  | Team settings (name, visibility, join policy, disband) — **full page** for clarity and bookmarkability |
| `/teams/join?token=...` | Invite link entry; redirect to `/teams/[id]` after join or show error                                  |

- **Dialog vs full page:**
  - **Dialog:** Apply to join (message), invite by email (simple form), confirm leave/kick/disband, "copy link" feedback.
  - **Full page:** Create team, team settings, team detail. Rationale: enough content and state; back button and URL are expected; settings need room for multiple fields and destructive action.

---

## 3. Key Screens and Content Priorities

### 3.1 List view (我的队伍 / 发现队伍)

- **Card fields (each card):**
  - **Primary:** Team name.
  - **Secondary:** School (if set), tags (e.g. 1–3), member count (e.g. "3/10"), join policy badge (OPEN / 需邀请 or INVITE_ONLY).
  - **Optional:** Creator name or "由 XXX 创建" for discover; last activity time for 我的.
- **Sort options:** 发现 — 最新创建 / 成员最多 / 即将满员。我的 — 最近活跃 / 最新加入。
- **Filters (发现):** School (or country), tags, join policy (OPEN / INVITE_ONLY).
- **Empty states:**
  - 我的队伍 empty: "您还未加入任何队伍" + short value prop + CTA "去发现队伍" (→ 发现 tab).
  - 发现 empty (no search/filter): "暂无公开队伍" + CTA "创建第一支队伍".
  - No search/filter results: "没有找到匹配的队伍" + "调整筛选条件" or "清空筛选".

### 3.2 Team detail page

- **Above the fold (no scroll):**
  - Team name (H1).
  - School + tags (if any).
  - Join policy badge + member count (e.g. "5/12 人").
  - **Primary CTA:** Join / 申请加入 / 已加入 / 已申请 / 队伍已满 (see edge cases). For members: "邀请成员" or "退出队伍"; for owner: "管理" or "设置" entry.
- **Below the fold:**
  - Description (collapsible if long).
  - Member list (avatars + names, role badges).
  - Optional: activity feed or placeholder for future activity.
- **Layout hint:** Primary CTA always visible (sticky on mobile or fixed in header area) so join/apply is one tap after scroll.

### 3.3 Create-team flow

- **Required:** Name only (min/max length).
- **Optional:** Description, school (search/select), tags, visibility (PUBLIC / UNLISTED), join policy (OPEN / INVITE_ONLY), maxMembers.
- **Flow:** One page with sections (basic info / 加入方式 / 可选). No stepper.
- **Preview:** Optional "预览" that shows how the card will look in 发现; main submit = "创建" → redirect to `/teams/[id]`.

---

## 4. Edge Cases and States

| Case                                                         | Where it appears                                                                                                                                     | Copy suggestion (EN / ZH)                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Team full (maxMembers reached)**                           | List card: badge "已满". Detail: primary CTA disabled or replaced with "队伍已满".                                                                   | EN: "This team is full." / ZH: "队伍已满。" Option: "有位置时通知我" (request when slot opens) — if product supports it; otherwise only disabled state. |
| **Invite expired / invalid link**                            | `/teams/join?token=...` or direct `/teams/[id]` with invalid token.                                                                                  | EN: "This invite link has expired or is invalid." / ZH: "邀请链接已失效或无效。" Action: "浏览其他队伍" → `/teams?tab=discover`.                        |
| **User not logged in**                                       | 发现 list and team detail. List: cards visible; join/apply CTA blurred or replaced with "登录后加入". Detail: same; CTA "登录以加入" / "登录以申请". | EN: "Log in to join or apply to teams." / ZH: "登录后可加入或申请队伍。"                                                                                |
| **Permission denied (e.g. open private/unlisted team link)** | User has no access to team (e.g. UNLISTED and no invite).                                                                                            | EN: "You don’t have access to this team. Ask the owner for an invite." / ZH: "您无法查看此队伍，可向队长申请邀请。"                                     |
| **Empty — 我的队伍**                                         | List tab 我的, no memberships.                                                                                                                       | EN: "You haven’t joined any teams yet." / ZH: "您还未加入任何队伍。" + CTA "去发现队伍".                                                                |
| **Empty — 发现, no results**                                 | Filters/search applied.                                                                                                                              | EN: "No teams match your filters." / ZH: "没有找到匹配的队伍。" + "清空筛选" or "调整条件".                                                             |
| **Empty — no members yet (after create)**                    | Detail page, member list.                                                                                                                            | EN: "No members yet. Share the invite link to grow your team." / ZH: "暂无成员，分享邀请链接邀请队友加入。"                                             |

---

## 5. Cross-Cutting

### 5.1 Mobile

- **Bottom nav:** Do not add 组队 to the 4-tab bar; keep 组队 in drawer (main or Community).
- **List:** Cards (not dense list) for tap targets and readability; same fields as desktop, possibly truncated (e.g. one line for tags).
- **Detail:** Single column; CTA sticky at bottom or below header so join/apply is always reachable.
- **Gestures:** No mandatory gesture; optional pull-to-refresh on list and detail.

### 5.2 Accessibility

- **Focus order on detail:** After page title/back: primary CTA (join/apply/leave) → member list (or "Skip to members" link) → description → secondary actions. Ensure focus is not trapped in modals.
- **Live regions:** Announce "加入成功" / "已退出队伍" / "邀请已发送" / "申请已提交" via `aria-live="polite"` (or toast with role status) so screen readers get immediate feedback.

### 5.3 i18n

- **User-facing strings to support in both en and zh:**
  - **Nav:** 组队 / Teams (and "我的" / "发现" if shown as labels).
  - **Buttons:** 创建队伍, 加入队伍, 申请加入, 退出队伍, 邀请成员, 复制链接, 管理 / 设置, 解散队伍, 去发现队伍, 清空筛选, etc.
  - **Empty states:** All copy from section 4 and 3.1.
  - **Errors:** Invalid/expired link, permission denied, team full, already applied, already member.
  - **Confirmations:** Leave, kick, disband (title + body + Confirm/Cancel).
- **Placement:** Use a dedicated namespace (e.g. `teams.*`) in `en.json` / `zh.json` (and mobile locales) for teams; reuse `common` for generic actions (Save, Cancel, Confirm).

---

## Summary Table (Quick Reference)

| Area               | Decision                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Nav                | 组队 in main nav + in More (Community)                                                    |
| Mobile nav         | In drawer only, not bottom tab bar                                                        |
| Internal structure | Single `/teams` with tabs 我的 / 发现                                                     |
| URLs               | `/teams`, `/teams/create`, `/teams/[id]`, `/teams/[id]/settings`, `/teams/join?token=...` |
| Create flow        | One page; required = name only; preview optional                                          |
| Dialog vs page     | Dialog: apply, invite, confirm leave/kick/disband. Page: create, detail, settings         |
| Team full          | Show "已满" in list and detail; CTA disabled; optional "通知我"                           |
| Guest              | Can see 发现 list and detail; join/apply gated with login CTA                             |
| i18n               | Full coverage for nav, buttons, empty states, errors, confirmations in en + zh            |

This report can be dropped into an implementation plan or handed to frontend/backend for the 组队 feature.
