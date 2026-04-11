# Full Surface Route Check

> 每个 route surface 一份。用于 `route` 条目，不用于 capability 或 journey overlay。

## Metadata

| Field              | Value           |
| ------------------ | --------------- |
| `surface_id`       |                 |
| `platform`         |                 |
| `persona`          |                 |
| `route_or_entry`   |                 |
| `execution_owner`  |                 |
| `validation_type`  |                 |
| `agent_bundle`     |                 |
| `registry_version` | `2026-04-02.v1` |

## Functional Check

| Check                                            | Result | Evidence | Note |
| ------------------------------------------------ | ------ | -------- | ---- |
| Enter route successfully                         |        |          |      |
| Permission / session state correct               |        |          |      |
| One real state checked (loading / empty / error) |        |          |      |
| Primary CTA exercised                            |        |          |      |
| No unexplained crash / 4xx-5xx / console error   |        |          |      |

## Quality Dimensions

| Dimension                 | Covered  | Result                          | Evidence / Note |
| ------------------------- | -------- | ------------------------------- | --------------- |
| 布局合理性                | yes / no | PASS / ISSUE / BROKEN / BLOCKED |                 |
| AI Agent 功能与输出合理性 | yes / no | PASS / ISSUE / BROKEN / BLOCKED |                 |
| Web / Mobile 复用合理性   | yes / no | PASS / ISSUE / BROKEN / BLOCKED |                 |
| 专业留学中介感            | yes / no | PASS / ISSUE / BROKEN / BLOCKED |                 |

## Final Classification

| Field                 | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| `status`              | PASS / ISSUE / BROKEN / BLOCKED / SKIPPED                                |
| `feedback_category`   | CODE_BUG / DATA_ISSUE / UX_CONFUSION / NEW_FEATURE / INDUSTRY_SUGGESTION |
| `user_visible_result` |                                                                          |
| `next_action`         |                                                                          |
