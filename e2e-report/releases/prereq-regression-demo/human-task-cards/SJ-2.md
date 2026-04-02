# 人工 E2E 测试任务卡

| 字段               | 内容                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| `release_id`       | `prereq-regression-demo`                                                      |
| `journey_id`       | `SJ-2`                                                                        |
| `registry_version` | `2026-04-01.v3`                                                               |
| `persona`          | `applicant`                                                                   |
| `platform`         | `web`                                                                         |
| `execution_owner`  | `human`                                                                       |
| `validation_type`  | `objective`                                                                   |
| `重点体验维度`     | 布局合理性 / 专业留学中介感                                                   |
| `参考 Rubric`      | docs/CROSS_PLATFORM_REUSE_RUBRIC.md / docs/PROFESSIONAL_CONSULTANCY_RUBRIC.md |

## 你要验证什么

确认 web 通知的文案、层级和动作反馈自然，不打断产品专业感。

## 入口

- Web 通知中心 / Notifications page

## 操作步骤

1. 打开通知中心并查看最近通知。
2. 进入通知页并尝试已读、全部已读或删除。
3. 观察未读数、列表状态和文案反馈。

## 你应该看到什么

- 通知动作反馈清楚、不吵闹。
- 未读状态和页面内容变化符合直觉。
- 整体语气和视觉不削弱专业感。

## 重点观察

- 布局合理性
- 专业留学中介感
