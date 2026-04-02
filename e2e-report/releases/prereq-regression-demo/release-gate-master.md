# 发版门禁总表

| 字段                  | 内容                                             |
| --------------------- | ------------------------------------------------ |
| `release_id`          | `prereq-regression-demo`                         |
| `registry_version`    | `2026-04-01.v3`                                  |
| `impact_mapping_used` | `docs/RELEASE_IMPACT_MAPPING.md (2026-04-01.v1)` |
| `候选版本`            | `demo-2026.04.01`                                |
| `commit / tag`        | `HEAD`                                           |
| `环境`                | `pre-release`                                    |

## 总表

| journey_id | title                                        | baseline_smoke | execution_owner | validation_type | quality_dimensions_checked                            | tester | status | evidence_link | issue_link | waiver | decision | notes |
| ---------- | -------------------------------------------- | -------------- | --------------- | --------------- | ----------------------------------------------------- | ------ | ------ | ------------- | ---------- | ------ | -------- | ----- |
| A1         | 注册 → 首次登录 → onboarding 恢复            | yes            | codex           | objective       | 布局合理性 / 专业留学中介感                           |        |        |               |            |        |          |       |
| A2         | 填写档案                                     | yes            | codex           | objective       | 布局合理性 / 专业留学中介感                           |        |        |               |            |        |          |       |
| A3         | AI：首次选校推荐                             | yes            | codex           | objective       | AI Agent 功能与输出合理性 / 专业留学中介感            |        |        |               |            |        |          |       |
| A10        | 预测 / 案例库 / 排名                         | yes            | codex           | objective       | 布局合理性 / 专业留学中介感                           |        |        |               |            |        |          |       |
| A11        | 移动端一致性                                 | yes            | codex + human   | experiential    | 布局合理性 / Web / Mobile 复用合理性 / 专业留学中介感 |        |        |               |            |        |          |       |
| C1         | admin Dashboard                              | yes            | codex           | admin-only      | 布局合理性 / 专业留学中介感                           |        |        |               |            |        |          |       |
| SJ-2       | Web 通知中心 / 通知页                        | yes            | codex           | objective       | 布局合理性 / 专业留学中介感                           |        |        |               |            |        |          |       |
| SJ-4       | Admin 创建 MCP key → 外部 MCP 客户端调用工具 | yes            | codex           | objective       | AI Agent 功能与输出合理性 / 专业留学中介感            |        |        |               |            |        |          |       |
| SJ-3       | Mobile 通知页                                | no             | codex + human   | experiential    | Web / Mobile 复用合理性 / 专业留学中介感              |        |        |               |            |        |          |       |

## 外部前置能力 / Capability Gates

| journey_id | capability scope                                             | blocking policy | missing means                                                             | unblock action                                                                                                                                                       |
| ---------- | ------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A11        | Android remote push / notification-open on a physical device | conditional     | 如缺失，相关子检查应记 `BLOCKED`（外部依赖），不得误记为产品启动/页面崩溃 | Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device. |
| SJ-3       | Android remote push / notification-open on a physical device | conditional     | 如缺失，相关子检查应记 `BLOCKED`（外部依赖），不得误记为产品启动/页面崩溃 | Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device. |

## Impact 摘要

- 命中的规则: `notifications`
- 受影响旅程: `SJ-2`, `SJ-3`, `A11`
- 最终门禁集: `A1`, `A2`, `A3`, `A10`, `A11`, `C1`, `SJ-2`, `SJ-4`, `SJ-3`
- 是否建议 Full Audit: yes

## 体验质量维度总览

| 维度                      | 是否本轮必查 | 当前结论 | 备注 |
| ------------------------- | ------------ | -------- | ---- |
| 布局合理性                | optional     |          |      |
| AI Agent 功能与输出合理性 | optional     |          |      |
| Web / Mobile 复用合理性   | yes          |          |      |
| 专业留学中介感            | yes          |          |      |
