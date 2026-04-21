# ADR-2026-04-19 · UI Language Upgrade Baseline

## Status

Accepted

## Context

- `UI_LANGUAGE_RESEARCH_FRAMEWORK.md` 定义了营销层 / 工具层 / AI 洞察层的页面语言。
- `DESIGN_SYSTEM.md v2.1` 明确禁止 glow shadow、AI SaaS aurora、text gradient clip 与任意阴影扩档。
- 现有 Web / Mobile theme、page shell 与 landing 组件长期平行演化，造成 token 漂移与回退风险。

## Decision

1. `packages/shared/src/design/tokens.ts` 成为 Web / Mobile 的设计语义主源。
2. Web 通过 root layout 注入 shared CSS variables，`globals.css` 只消费语义 token，不再自持事实源。
3. Web / Mobile `PageHeader` / `PageContainer` 统一改为 `variant` 驱动，而不是装饰性 `color` 驱动。
4. Landing 与 AI surface 统一使用解释性模式：`AdmissionTierBadge`、`AIDisclosure`、`StatusDot/StatusBadge`。
5. 页面 chrome 退出 serif；阅读型内容可通过 allowlist 明确保留。
6. 防退化通过 lint / typography / mobile quality / registry metadata / allowlist / closeout 共同保证。

## Consequences

- 新页面必须先声明 `ui_layer` 与 `page_contract_variant`。
- 旧的 hero gradient / glow / text gradient 实现不再进入默认 UI。
- 兼容字段如 `PageHeader.color` 暂时保留，但只作为向后兼容映射，不再是推荐入口。
