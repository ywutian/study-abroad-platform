# UI Upgrade Closeout

## Scope

- Shared token source: completed
- Landing marketing surface: completed
- Web / Mobile page shell contract: completed
- Governance rules and registry metadata: completed
- Route family broad migration: in progress

## Migrated samples

- Web `marketing`: `/:locale` landing
- Web `tool`: `/:locale/dashboard`
- Web `ai`: `/:locale/prediction`
- Web `community`: `/:locale/teams`
- Web `admin`: `/:locale/admin`
- Mobile shell samples: `TeamsScreen`, `VaultScreen`, `PeerReviewScreen`, `ReferralScreen`

## Remaining surfaces

- 非 landing 的 applicant / community / admin 页面仍需继续逐页替换到解释性原语与新 shell 变体
- Mobile 关键 screens 已接 shared token，但仍需单页移除历史 `LinearGradient` 使用
- `teams` 相关 route 已接 community shell，但 `TeamsPageClient.tsx` 仍有旧式硬编码双语文案债务
- About / forum / profile / ranking / hall 等现有页面仍有历史 gradient / glow / arbitrary typography 债务

## Allowlist residuals

- `apps/web/src/app/[locale]/(main)/cases/_components/EssayDetailPanel.tsx` serif 阅读例外保留

## Verification snapshot

- `pnpm --filter web exec tsc --noEmit` ✅
- `pnpm --filter study-abroad-mobile exec tsc --noEmit` ✅
- `pnpm --filter web lint:i18n` ✅
- `pnpm --filter study-abroad-mobile lint:i18n` ✅
- `pnpm full-surface:generate` ✅
- `pnpm --filter web lint:quality` reports existing repo debt outside this landing refactor:
  - `27` error(s)
  - `22` warning(s)
- `pnpm --filter web lint:typography` reports existing repo debt across legacy surfaces:
  - `169` error(s)
  - `144` warning(s)
- `pnpm --filter study-abroad-mobile lint:quality` reports existing repo debt:
  - `225` warning(s)
- Existing screenshot harnesses identified:
  - `e2e/core-pages.spec.ts`
  - `e2e/admin-and-misc-pages.spec.ts`
- Playwright screenshot run: not executed in this turn because no local web server was started for `http://localhost:4100`
- Mobile visual smoke / snapshot automation: not added in this turn; still pending follow-up

## Zero-match checks

- landing forbidden classes removed: `bg-elegant-aurora`, `text-gradient-elegant`, `landing-hero-orb`, `card-glow::before`, `console-glow`
- landing serif root tokens removed: `--font-serif`, `--font-heading`
- landing numeric arbitrary text sizes in touched files reduced to token / standard scale
- registry regenerated with `ui_layer`, `page_contract_variant`, `migration_status`, `ai_explanatory_surface`

## Exit rule

- Closeout 只有在 route registry 中无未说明的遗漏、allowlist 有 owner、lint 命中归零或有明确豁免时才算完成。
