# 国际化审计执行日志

审计目录：`docs/i18n-audit-2026-04-26`

## 执行原则

- 不把现有脚本通过当作结论。
- 每个发现必须能追溯到页面、组件或翻译 key。
- 每个页面、shell、组件、候选可见文本和翻译 key 都必须进入台账。
- 对无法仅靠静态源码确认的项目，进入 `risk-register.csv`，不得默认为通过。

## 执行步骤

| 步骤 | 动作 | 结果 |
| --- | --- | --- |
| 1 | 枚举 Web route / shell 文件 | 168 个 `page/layout/loading/error/not-found` 文件进入 `surface-audit-table.csv` |
| 2 | 枚举 Web 页面内组件 | 256 个 `apps/web/src/app` 下非 route/shell TS/TSX 文件进入台账 |
| 3 | 枚举 Web 共享组件 | 289 个 `apps/web/src/components` TS/TSX 文件进入台账 |
| 4 | 枚举 Mobile route / shell 文件 | 53 个 `apps/mobile/src/app` TS/TSX 文件进入台账，其中 48 route、5 shell |
| 5 | 枚举 Mobile screen 组件 | 42 个 `apps/mobile/src/screens` TS/TSX 文件进入台账 |
| 6 | 枚举 Mobile shared components | 41 个 `apps/mobile/src/components` TS/TSX 文件进入台账 |
| 7 | 展平 Web 翻译 key | `zh/en = 7264/7264`，进入 `translation-key-ledger.csv` |
| 8 | 展平 Mobile 翻译 key | `zh/en = 1408/1408`，进入 `translation-key-ledger.csv` |
| 9 | 提取候选用户可见文本 | 374 个候选项进入 `text-candidate-disposition.csv` |
| 10 | 逐候选处置 | 154 个 confirmed issue candidate，50 个 reviewed exempt，165 个 reviewed low-risk，5 个 translated/dynamic |
| 11 | 问题分级 | 18 个 confirmed finding：P1=3、P2=9、P3=6 |
| 12 | 防遗漏门禁 | `coverage-check.csv` 全部 PASS |
| 13 | 反向一致性校验 | confirmed text candidate 全部能映射到 finding；candidate 无空 disposition；surface issue 状态一致 |
| 14 | 最终验证 | Web/Mobile i18n 脚本通过；自建门禁返回 failingCoverage=0、emptyDisposition=0、confirmedWithoutFinding=0、keyFindingsWithoutFinding=0 |

## 已运行命令

```bash
pnpm --filter web lint:i18n
pnpm --filter web lint:i18n-english
pnpm --filter study-abroad-mobile lint:i18n
node docs/i18n-audit-2026-04-26/generate-audit-artifacts.mjs
```

验证结果：

- `pnpm --filter web lint:i18n`：通过；保留 1 个非阻塞 dynamic key warning（`components/features/hall/ReviewModuleCard.tsx`）。
- `pnpm --filter web lint:i18n-english`：通过。
- `pnpm --filter study-abroad-mobile lint:i18n`：通过。
- 自建覆盖门禁：通过，`coverageRows=10`、`candidates=374`、`keyRows=8672`，所有断链计数为 0。

## 关键发现

- 现有 i18n 脚本会漏掉常量数组、React Native 手写 locale 分支、`aria-label`、template definitions 和部分豁免文件。
- `text-candidate-disposition.csv` 是本轮防漏的核心证据，每个候选可见文本都有处置状态。
- `coverage-check.csv` 是本轮覆盖门禁，所有发现的页面、组件、key 和候选文本均进入台账。
- `I18N-012` 到 `I18N-016` 来自翻译 JSON 的术语/质量复核，不是源码硬编码候选，因此不会出现在 `text-candidate-disposition.csv` 的 `finding_id` 映射中；这些问题在 `translation-key-ledger.csv` 和 `findings.csv` 中追踪。

## 不纳入“已完全通过”的范围

以下项目不是静态源码审计能完全证明的内容，已在 `risk-register.csv` 保留：

- 每条 route 的真实浏览器截图和布局溢出。
- API / AI 返回的动态文本是否按 locale 输出。
- 管理后台 ML 术语是否应保留英文或改成中文术语。
- 真机移动端的通知、系统分享表单、系统弹窗展示语言。
