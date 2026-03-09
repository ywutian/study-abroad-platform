# 组队 (Teams) — Frontend Implementation Plan

This document is the **frontend section** of the teams feature plan. It assumes the design report (`teams-feature-design-report.md`) and project conventions: PageHeader + PageContainer, find-college–style Tabs, middleware `PROTECTED_PATTERNS`, and i18n under a dedicated namespace. Paths are relative to repo root (`apps/web/`).

---

## 1. Route and middleware

- **Do NOT add `/teams` to `PROTECTED_PATTERNS`.**  
  Guests must be able to view `/teams` and `/teams/[id]` (discover list and team detail) without being redirected to login. Reference: `apps/web/src/middleware.ts` — only routes matching `PROTECTED_PATTERNS` (or `ADMIN_PATTERNS`) trigger the cookie check and redirect.

- **Create / join / my require login:**
  - **Frontend:** When a guest clicks “创建队伍” (Create team) or “我的队伍” (My teams), redirect to login with `callbackUrl` so they return to the same page after auth. Use the same pattern as other protected actions: build login URL with `searchParams.set('callbackUrl', pathname)` (middleware already restricts `callbackUrl` to internal paths via `/^\/[\w\-/]*$/`).
  - **API:** Protected endpoints (create, join, leave, invite, disband, my list, accept-invite) return **401** when unauthenticated; frontend shows toast and/or redirects to login with `callbackUrl` when appropriate (e.g. after 401 on “我的队伍” or on create/join action).

---

## 2. Pages and structure

### 2.1 List: `apps/web/src/app/[locale]/(main)/teams/page.tsx`

- **Layout:** `PageContainer` with `maxWidth="7xl"`.
- **Header:** `PageHeader` with:
  - `title`: teams list title (e.g. “组队” / “Teams”).
  - `description`: short subtitle from i18n.
  - `icon`: `Users`.
  - `color`: `amber`.
  - `actions`: primary button “创建队伍” → navigates to `/teams/create` (or opens CreateTeamDialog). If user is not logged in, navigate to login with `callbackUrl=/teams/create` (or current path).
- **Tabs (find-college style):**
  - **TabsList:** Two tabs: “我的队伍” | “发现队伍”.
  - **Tab state from URL:** `?tab=my` | `?tab=discover` (or path-based `/teams/my`, `/teams/discover` if preferred). Read with `useSearchParams().get('tab')`; default to `discover` when no query. On tab change, update URL (e.g. `router.replace` with `?tab=my` or `?tab=discover`) so state is shareable and back button works.
  - **TabsContent “我的队伍”:**
    - If not logged in: show empty state or CTA “登录后查看我的队伍” with login link (callbackUrl = current path).
    - If logged in: `useQuery` for `GET /teams/my`; grid of `TeamCard`; empty state when no teams (copy: “您还未加入任何队伍” + CTA “去发现队伍” → switch to discover tab).
  - **TabsContent “发现队伍”:**
    - Filter bar: school (or country), tags, join policy (OPEN / INVITE_ONLY), sort (e.g. newest / most members). Only in discover tab.
    - `useQuery` for `GET /teams` (discover) with filters/sort params; grid of `TeamCard`.
    - Empty: no results → “没有找到匹配的队伍” + “清空筛选”; no public teams at all → “暂无公开队伍” + CTA “创建第一支队伍” (redirect to login if guest).

### 2.2 Detail: `apps/web/src/app/[locale]/(main)/teams/[id]/page.tsx`

- **Back:** Back button (e.g. to `/teams` or referrer).
- **Hero (above fold):**
  - Team name (H1).
  - School badge + tags (if any).
  - Join policy badge (OPEN / 需邀请).
  - Member count (e.g. “5/12 人”).
  - **Primary CTA:** Join / 申请加入 / 已加入 / 已申请 / 队伍已满 (and for members: 邀请成员 or 退出队伍; for owner: link to settings). Guest: CTA “登录后加入” / “登录以申请” → login with `callbackUrl=/teams/[id]`.
- **Below fold:**
  - Description (collapsible if long).
  - Member list (avatars, names, role badges); empty state “暂无成员…” when no members.
- **Owner:** Link to “设置” → `/teams/[id]/settings`.

### 2.3 Create: `apps/web/src/app/[locale]/(main)/teams/create/page.tsx`

- Single-page form: **name** (required), description, school, tags, visibility (PUBLIC / UNLISTED), join policy (OPEN / INVITE_ONLY), maxMembers (optional).
- On success: redirect to `/teams/[id]` (new team). On validation/API error: inline errors and/or toast; stay on form.
- If guest lands on `/teams/create`, redirect to login with `callbackUrl=/teams/create` (middleware does not protect `/teams/create`; so either protect this path in middleware or handle in page: if no auth, redirect client-side to login with callbackUrl).

**Note:** To keep `/teams` and `/teams/[id]` public while protecting create: do **not** add `/teams` to `PROTECTED_PATTERNS`. Add only `/teams/create` and `/teams/[id]/settings` to `PROTECTED_PATTERNS`, so that create and settings require auth at the edge; “我的队伍” and join/apply are guarded by API 401 + frontend redirect on action.

### 2.4 Settings: `apps/web/src/app/[locale]/(main)/teams/[id]/settings/page.tsx`

- Edit: name, visibility, join policy.
- **Disband:** Button “解散队伍” → `AlertDialog` (“确定解散？解散后不可恢复。”) → on confirm call API then redirect to `/teams`; toast “队伍已解散”.
- Only team owner can access; otherwise 403/404 and show error or redirect.

### 2.5 Join by link: handle `apps/web/src/app/[locale]/(main)/teams/join/page.tsx` (or same route with query)

- **URL:** `/teams/join?token=...`.
- **Behavior:** Page or redirect that calls accept-invite API (e.g. `POST /teams/join` or `POST /teams/invites/accept` with token). On success redirect to `/teams/[id]`. On error (expired/invalid): show error message (“邀请链接已失效或无效”) + link “浏览其他队伍” → `/teams?tab=discover`.
- If user not logged in, redirect to login with `callbackUrl=/teams/join?token=...`, then after login land back and retry accept.

---

## 3. Components

### 3.1 TeamCard

- **Location:** `apps/web/src/components/features/teams/TeamCard.tsx` (or under `teams/page.tsx`’s `_components/`).
- **Structure:** `TouchCard` or `Card`; content:
  - Team name (e.g. `text-title`).
  - School + tags (e.g. `text-caption`), member count, join policy badge (`Badge`).
  - Action: “查看” (link to `/teams/[id]`) or “加入” (primary button; guest → login with callbackUrl).
- **Design system:** Use `Badge`, `text-title`, `text-caption` from project; match existing card spacing and borders.

### 3.2 Empty states

- Use `EmptyState` from `@/components/ui/empty-state`:
  - **Option A:** `type="custom"` and pass `title` / `description` / `action` from `teams.empty.*` (e.g. `teams.empty.my`, `teams.empty.discover`, `teams.empty.noMembers`).
  - **Option B:** Add a `teams` preset to `EmptyState` (and optionally `teamsMy`, `teamsDiscover`, `teamsNoMembers`) in `empty-state.tsx` and use `type="teams"` with preset copy; or reuse existing presets (e.g. `empty`, `no-results`) plus custom copy via props.
- **Copy:**
  - 我的 empty: “您还未加入任何队伍” + CTA “去发现队伍”.
  - 发现 no results: “没有找到匹配的队伍” + “清空筛选”.
  - Detail no members: “暂无成员，分享邀请链接邀请队友加入.”.

### 3.3 Dialogs

- **CreateTeamDialog (optional):** Alternative to full-page create; same fields; on success navigate to `/teams/[id]`. Use `Dialog` from `@/components/ui`.
- **ApplyToTeamDialog:** Optional message + submit; “申请加入” flow for INVITE_ONLY. Use `Dialog`.
- **InviteMemberDialog:** Invite by email or copy link. Use `Dialog`.
- **ConfirmLeaveDialog / ConfirmDisbandDialog:** Use `AlertDialog` from `@/components/ui/alert-dialog` (title + description + Confirm / Cancel). Confirm leave → API leave → toast + redirect to `/teams`. Confirm disband → API disband → toast + redirect to `/teams`.

---

## 4. i18n keys

All keys under namespace `teams.*` and `nav` for 组队. Add to `apps/web/src/messages/en.json` and `apps/web/src/messages/zh.json`.

| Key                           | en                                                               | zh                                         |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `nav.teams`                   | Teams                                                            | 组队                                       |
| `nav.descriptions.teams`      | Find or create teams for same-school applications and prep       | 发现或创建队伍，一起申请、备考、共享时间线 |
| `teams.title`                 | Teams                                                            | 组队                                       |
| `teams.description`           | Find or create teams                                             | 发现或创建队伍                             |
| `teams.myTeams`               | My Teams                                                         | 我的队伍                                   |
| `teams.discover`              | Discover                                                         | 发现队伍                                   |
| `teams.create`                | Create Team                                                      | 创建队伍                                   |
| `teams.createTeam`            | Create Team                                                      | 创建队伍                                   |
| `teams.join`                  | Join                                                             | 加入                                       |
| `teams.leave`                 | Leave Team                                                       | 退出队伍                                   |
| `teams.invite`                | Invite                                                           | 邀请                                       |
| `teams.copyLink`              | Copy invite link                                                 | 复制邀请链接                               |
| `teams.settings`              | Settings                                                         | 设置                                       |
| `teams.disband`               | Disband Team                                                     | 解散队伍                                   |
| `teams.memberCount`           | {current}/{max} members                                          | {current}/{max} 人                         |
| `teams.joinPolicy.open`       | Open join                                                        | 开放加入                                   |
| `teams.joinPolicy.inviteOnly` | Invite only                                                      | 需邀请                                     |
| `teams.empty.my`              | You haven't joined any teams yet.                                | 您还未加入任何队伍。                       |
| `teams.empty.discover`        | No public teams yet.                                             | 暂无公开队伍。                             |
| `teams.empty.noResults`       | No teams match your filters.                                     | 没有找到匹配的队伍。                       |
| `teams.empty.noMembers`       | No members yet. Share the invite link to grow your team.         | 暂无成员，分享邀请链接邀请队友加入。       |
| `teams.errors.full`           | This team is full.                                               | 队伍已满。                                 |
| `teams.errors.inviteExpired`  | This invite link has expired or is invalid.                      | 邀请链接已失效或无效。                     |
| `teams.errors.forbidden`      | You don't have access to this team. Ask the owner for an invite. | 您无法查看此队伍，可向队长申请邀请。       |
| `teams.confirm.leave`         | Leave this team? You will lose your membership.                  | 确定退出？您将失去成员身份。               |
| `teams.confirm.disband`       | Disband this team? This cannot be undone.                        | 解散后不可恢复，确定吗？                   |

Additional keys as needed: `teams.view`, `teams.applyToJoin`, `teams.applied`, `teams.loginToJoin`, `teams.clearFilters`, `teams.goDiscover`, etc., with EN/ZH values in the same namespace.

---

## 5. Data and loading

- **Queries:**
  - **Discover:** `useQuery({ queryKey: ['teams', 'discover', filters], queryFn: () => apiClient.get('/teams', { params: filters }) })`.
  - **My teams:** `useQuery({ queryKey: ['teams', 'my'], queryFn: () => apiClient.get('/teams/my') })` (only when logged in).
  - **Detail:** `useQuery({ queryKey: ['teams', id], queryFn: () => apiClient.get(`/teams/${id}`) })`.
- **Mutations:** Create, join, leave, invite, disband, accept-invite. On success: `toast.success(...)` and `queryClient.invalidateQueries({ queryKey: ['teams'] })` (or more specific keys). On error: toast from API message or generic; optionally use `meta: { skipGlobalErrorToast: true }` and handle in component.
- **Loading:**
  - **List:** Skeleton grid matching `TeamCard` layout (e.g. same card size, placeholder lines for name, badge, button).
  - **Detail:** `LoadingState` or skeleton for hero + member list.
- **Auth:** For “我的队伍”, disable or hide query when user is not logged in; show empty state or login CTA. For create/join actions, redirect to login with `callbackUrl` on 401 if desired.

---

## Summary

| Area                 | Decision                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Middleware           | Do **not** add `/teams` to `PROTECTED_PATTERNS`; optionally add `/teams/create` and `/teams/[id]/settings` so only create/settings are edge-protected. |
| Guest UX             | Guests see list and detail; create / my / join gated by login redirect with `callbackUrl` and API 401.                                                 |
| List page            | PageContainer 7xl, PageHeader (Users, amber, 创建队伍), Tabs (我的 \| 发现) driven by `?tab=my` / `?tab=discover`, filter bar in discover only.        |
| Detail               | Back, hero (name, school, join policy, member count, primary CTA), description, member list, settings link for owner.                                  |
| Create/Settings/Join | Create and settings as full pages; join via `/teams/join?token=...` → API → redirect or error.                                                         |
| Components           | TeamCard (TouchCard/Card + Badge, text-title, text-caption); EmptyState custom or teams preset; dialogs with AlertDialog/Dialog.                       |
| i18n                 | All copy under `teams.*` and `nav.teams` / `nav.descriptions.teams` in en.json and zh.json.                                                            |
| Data                 | useQuery for list/detail; useMutation for create/join/leave/invite/disband; skeleton loading; toast + invalidateQueries on success/error.              |
