# Full Surface Agent Review · 2026-04-19

> 本文件记录多 Agent 视角下的 Batch 规划、分诊规则和阶段性结论。当前版本用于 Batch 0 启动与后续批次承接。

## 审查元信息

| 字段                            | 值                   |
| ------------------------------- | -------------------- |
| `full_surface_registry_version` | `2026-04-10.v3`      |
| `journey_registry_version`      | `2026-04-10.v4`      |
| `route_scope`                   | `web 67 / mobile 48` |
| `capability_scope`              | `16`                 |
| `journey_overlay_scope`         | `21`                 |

## Batch 0 结论

- 已确认当前仓库此前只有 journey 级事实源，没有 full-surface registry。
- Web 存在大量 shell-only 文件；它们不应算独立页面，但必须绑定到对应 route 检查。
- Mobile 真实应区分 standalone routes 与 `_layout` 壳层；后者必须单列为专项检查。
- `A11 / SJ-3` 的 Android remote push 继续保留为 conditional capability gate，不与 mobile 核心运行态混淆。
- `MEMORY.md` 之前不存在，本轮需要显式建立以沉淀易漏点与重复使用说明。

## CLAUDE 五类分诊默认口径

| 类别                  | 默认适用                                         |
| --------------------- | ------------------------------------------------ |
| `CODE_BUG`            | 页面崩溃、错误渲染、请求契约不一致、错误恢复失效 |
| `DATA_ISSUE`          | seed / 样本 / 后台数据缺失导致的空态或误导       |
| `UX_CONFUSION`        | badge、概率、置信度、策略分层等用户误解          |
| `NEW_FEATURE`         | inventory 中发现不存在但产品目标要求的新能力     |
| `INDUSTRY_SUGGESTION` | 顾问口吻、留学业务逻辑、推荐解释是否专业         |

## 后续批次执行矩阵

| batch                             | agents                                                                                            | 主要对象                         | 预期产物                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- |
| `batch-1-applicant-web-auth`      | `design-reviewer`, `i18n-specialist`, `applicant-simulator`, `test-engineer`                      | web / auth                       | 对应 batch summary + route/capability records |
| `batch-2-applicant-ai-business`   | `ai-prompt-engineer`, `study-abroad-expert`, `applicant-simulator`, `test-engineer`               | prediction / recommendation / ai | 对应 batch summary + route/capability records |
| `batch-3-mobile`                  | `mobile-specialist`, `design-reviewer`, `i18n-specialist`, `applicant-simulator`, `test-engineer` | mobile                           | 对应 batch summary + route/capability records |
| `batch-4-admin-data-security-mcp` | `architect`, `data-model-reviewer`, `security-reviewer`, `design-reviewer`, `test-engineer`       | admin / security / mcp           | 对应 batch summary + route/capability records |
| `batch-5-forced-closure`          | `integration-checker`, `test-engineer`, `user-journey-auditor`                                    | closure                          | 对应 batch summary + route/capability records |

## 文档闭环要求

- 每个批次结束后，必须同步更新 `FULL_SURFACE_AUDIT_LOG`、`FULL_SURFACE_AGENT_REVIEW`、`MEMORY.md` 和相关模板。
- Journey 层的变更只回填摘要到 `docs/USER_JOURNEY_AUDIT_LOG.md`，不把 full-surface 明细塞进去。
- 所有发现都必须落入复用手册或 gap checklist，避免下次再次遗漏。
