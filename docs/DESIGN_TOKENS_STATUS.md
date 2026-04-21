# Design Tokens · Admission Status

本文件记录录取档位相关的单一事实源，供 Web / Mobile / 未来 RN theme 对齐使用。

## Semantic Tiers

| Tier     | Meaning       | Semantic family | Web canonical           | Web bg derivation                      | Web fg derivation                            | Mobile value            |
| -------- | ------------- | --------------- | ----------------------- | -------------------------------------- | -------------------------------------------- | ----------------------- |
| `reach`  | 冲刺 / Reach  | `destructive`   | `var(--ds-destructive)` | `color-mix(... destructive 12%, card)` | `color-mix(... destructive 72%, foreground)` | `colors.error` family   |
| `target` | 匹配 / Target | `warning`       | `var(--ds-warning)`     | `color-mix(... warning 14%, card)`     | `color-mix(... warning 68%, foreground)`     | `colors.warning` family |
| `safety` | 保底 / Safety | `success`       | `var(--ds-success)`     | `color-mix(... success 12%, card)`     | `color-mix(... success 70%, foreground)`     | `colors.success` family |
| `likely` | 有望 / Likely | `primary`       | `var(--ds-primary)`     | `color-mix(... primary 10%, card)`     | `color-mix(... primary 72%, foreground)`     | `colors.primary` family |

## Notes

- Web 的 `--ds-status-*` 不再保存一套独立固定色值，而是直接别名到 DS 语义色。
- Mobile 继续使用显式 hex / rgba 输出，但必须从 shared token 的同一语义源派生，不允许重新发明 tier 色板。

## Source Files

- Shared tokens: `packages/shared/src/design/tokens.ts`
- Web CSS aliases: `apps/web/src/app/globals.css`
- Mobile adapter: `apps/mobile/src/utils/theme.ts`

## Usage Rules

- 页面层不直接写硬编码 tier 颜色。
- Web badge / progress / dot 必须走 `AdmissionTierBadge` / `StatusDot` 或对应 CSS var。
- Mobile badge / progress 必须走 shared token adapter，不再自建 `if/else` 色值。
- 新 tier 若进入产品语义，先扩展 shared token，再扩展页面组件。
