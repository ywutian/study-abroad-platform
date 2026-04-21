# UI Layer Surface Map

本文件定义 route family 到 UI layer / page contract variant 的固定映射。新增页面应先落这张表，再实现页面。

| Route family                                                                                              | UI layer    | Page contract variant | Notes                                        |
| --------------------------------------------------------------------------------------------------------- | ----------- | --------------------- | -------------------------------------------- |
| `/` `/about` marketing entry points                                                                       | `marketing` | `marketing`           | 营销层，允许低对比纹理，不允许 aurora / glow |
| `/login` `/register` `/forgot-password` `/reset-password` `/verify-email` `/onboarding`                   | `entry`     | `entry`               | 入口层，强调清晰与稳定，不用彩色 hero        |
| `/dashboard` `/schools` `/profile` `/essays` `/vault` `/settings` `/notifications` `/timeline` `/ranking` | `tool`      | `tool`                | 工具层，白 / 中性表面 + 边框分栏             |
| `/prediction` `/ai` `/assessment` `/uncommon-app` `/recommendation` `/chat`                               | `ai`        | `ai`                  | AI 洞察层，必须使用解释性模式组件            |
| `/teams` `/forum` `/cases` `/hall` `/followers`                                                           | `community` | `community`           | 社区层，沿用中性 surface，不用营销渐变       |
| `/admin/*`                                                                                                | `admin`     | `admin`               | 管理层，信息密度高，优先清晰度与层级稳定     |

## Enforcement

- `scripts/release-gate/full-surface-registry.ts` 应写入 `uiLayer` 与 `pageContractVariant`。
- 新页面默认状态为 `migration_status = in-progress`，直到 shell / token / lint / evidence 均完成。
- AI 相关页面若输出概率、建议、分层，必须将 `ai_explanatory_surface` 设为 `true`。
