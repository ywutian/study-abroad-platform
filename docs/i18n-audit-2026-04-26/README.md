# 国际化逐页逐组件审计报告

审计日期：2026-04-26

## 结论摘要

本次按“页面/组件 inventory -> 翻译 key ledger -> 候选问题回看源码上下文 -> 问题分级”的方式完成静态全量审计。现有 i18n 脚本仅作为辅助信号；最终问题均回到具体页面、组件或翻译 key 做了上下文确认。

覆盖结果：

| 项目 | 数量 |
| --- | ---: |
| 页面 / shell / 组件审计条目 | 849 |
| Web + Mobile 翻译 key ledger | 8672 |
| 候选可见文本处置项 | 374 |
| 已确认问题 | 18 |
| P1 | 3 |
| P2 | 9 |
| P3 | 6 |

交付物：

- `surface-audit-table.csv`：逐页、逐 shell、逐组件清单，含状态和备注。
- `translation-key-ledger.csv`：逐 key 的 zh/en 对照和问题标记。
- `text-candidate-disposition.csv`：逐个候选用户可见文本的处置记录，含 confirmed issue / exempt / low-risk / translated dynamic。
- `coverage-check.csv`：防遗漏门禁，校验发现的页面、组件、key 和候选文本是否全部进入台账。
- `findings.csv`：已确认问题、优先级、上下文和建议修复方式。
- `terminology.csv`：术语一致性建议。
- `risk-register.csv`：仍需运行时/产品确认的遗漏风险。
- `summary.json`：计数汇总。

## 主要问题

P1：

- `I18N-001` Web admin activity templates dialog 仍有硬编码英文 label、title、placeholder。
- `I18N-002` Web admin data-review bulk import 校验 message 仍是硬编码英文。
- `I18N-008` Mobile teams screen 同时存在手写 locale 分支和硬编码英文按钮/Tab/空状态。

P2：

- Web root error boundary 是英文兜底，未按 locale 或双语兜底处理。
- Web resume 编辑详情页图标按钮的 `aria-label` 是硬编码英文。
- Web submit-case、education-form、resume builder 多处 select label、template 文案、placeholder 没有走翻译 key。
- Mobile recommendation budget 选项绕过了已有 `recommendation.budgetOptions.*` 翻译。
- Mobile `prediction.uncertaintyHint` 英文存在 `Watchout` 拼写/表达问题。
- Mobile applicant-facing application analysis 文案泄漏 `Recourse`、`canonical`、`Web/uncommon-app` 等内部术语。

P3：

- Mobile profile/export 少量低频文案未本地化。
- Web admin payments 的 plan 标签绕过已有计划名翻译。
- Web landing footer 中文 locale 保留整句英文 tagline。
- Web case detail 中文 related-cases 标题没有使用传入的 `{school}`，语义弱于英文。
- Web admin ML 术语存在“Canonical / Recourse / Counterfactual”混用，需要先定术语策略。

## 审计方法

1. 枚举 Web `apps/web/src/app` 下全部 route、layout、loading、error、not-found 和页面内组件。
2. 枚举 Web `apps/web/src/components`、Mobile `apps/mobile/src/app`、`screens`、`components`。
3. 建立 zh/en 翻译 key ledger，逐 key 对照结构、值和上下文风险。
4. 建立 `text-candidate-disposition.csv`，对所有硬编码候选、手写 locale 分支、已有脚本豁免文件、翻译质量候选逐项处置。
5. 对 confirmed issue 回看源码上下文，将确认问题写入 `findings.csv`，非阻塞但需要产品判断的术语问题写入 `risk-register.csv` 和 `terminology.csv`。

## 验证记录

已运行：

- `pnpm --filter web lint:i18n`
- `pnpm --filter web lint:i18n-english`
- `pnpm --filter study-abroad-mobile lint:i18n`
- 自定义全量 source inventory / key ledger 生成检查
- `node docs/i18n-audit-2026-04-26/generate-audit-artifacts.mjs`

重要观察：

- 现有脚本可以通过，但仍会漏掉常量数组、React Native 手写 locale 分支、被豁免文件、resume template definitions 等用户可见文案。
- Web `lint:i18n` 仍报告 `components/features/hall/ReviewModuleCard.tsx` 的 dynamic key warning：`hall.modules.modules` 前缀提示为非阻塞动态 key 警告；静态 key 均存在。
- 因此后续不能把 CI 通过视为 i18n 审计通过，需要补强静态检查规则。

## 剩余风险

本次没有启动 Web/Mobile 逐路由截图走查，因此 `risk-register.csv` 保留了运行时布局、AI 输出语言和 API 动态 label 的风险。建议先修 P1/P2，再做 zh/en 截图回归，避免在已知文案问题上重复截图。
