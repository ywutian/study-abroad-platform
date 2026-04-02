# AI-First 发版门禁样例包

> 本样例展示一轮 release gate 在真实执行时应如何组合使用注册表、Impact 映射、任务卡、问题提报和门禁总表。

## 1. 样例背景

| 字段               | 内容                                                            |
| ------------------ | --------------------------------------------------------------- |
| `release_id`       | `2026-04-rc1`                                                   |
| `候选版本`         | `web-2026.04.01-rc1 / mobile-2026.04.01-rc1`                    |
| `改动摘要`         | onboarding 修复、AI 对话改动、mobile profile/notifications 调整 |
| `registry_version` | `2026-04-01.v3`                                                 |

## 2. Impact Set 生成示例

### 命中的改动区域

- 身份 / 注册 / onboarding
- AI agent 核心编排
- Mobile shell / shared API client
- 通知 / 未读数 / push

### 按映射规则得到的必跑旅程

- `A1`
- `A3`
- `A4`
- `A5`
- `A6`
- `A7`
- `A8`
- `A9`
- `A11`
- `SJ-2`
- `SJ-3`

### 为什么升级为高风险门禁

- 同时命中 `身份 + AI + mobile`
- 因此本轮至少跑 `Baseline Smoke + Impact Set`，并把 `A11 / SJ-3` 交给人工补位

## 3. 发版门禁总表示例

| journey_id | baseline_smoke | execution_owner | validation_type | status  | decision               | notes                                                                            |
| ---------- | -------------- | --------------- | --------------- | ------- | ---------------------- | -------------------------------------------------------------------------------- |
| `A1`       | yes            | codex           | objective       | PASS    | keep                   | onboarding 恢复链正常                                                            |
| `A3`       | yes            | codex           | objective       | PASS    | keep                   | 推荐结果与档案贴合                                                               |
| `A6`       | no             | codex           | objective       | ISSUE   | verify-after-fix       | 第 5 轮上下文变弱                                                                |
| `A11`      | yes            | codex + human   | experiential    | BLOCKED | conditional-capability | mobile 核心运行态已恢复，但 Android remote push 仍是 conditional capability gate |
| `SJ-3`     | no             | codex + human   | experiential    | BLOCKED | conditional-capability | 通知列表可用，但真 remote push / open 仍是 conditional capability gate           |

## 3.1 外部前置能力示例

| journey_id | capability scope                             | blocking policy | 缺失时标准判法                                                                         | 解锁条件                                                                                                 |
| ---------- | -------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `A11`      | Android remote push / 真机 notification-open | `conditional`   | 记 `BLOCKED`（外部依赖），不得写成 startup crash；release 结论默认降为 `CONDITIONAL`   | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |
| `SJ-3`     | 真 remote push 到达 / 通知打开行为           | `conditional`   | 记 `BLOCKED`（外部依赖），不得写成通知页整体不可用；release 结论默认降为 `CONDITIONAL` | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |

## 4. 人工任务卡示例

### 任务卡：`A11`

| 字段              | 内容                       |
| ----------------- | -------------------------- |
| `release_id`      | `2026-04-rc1`              |
| `journey_id`      | `A11`                      |
| `platform`        | `true-device`              |
| `execution_owner` | `human`                    |
| `validation_type` | `experiential`             |
| `重点体验维度`    | `跨端复用 / 布局 / 专业感` |

**你要验证什么**

> 请确认 mobile 档案页和 web 档案页表达的是同一套业务信息，同时 mobile 看起来不像桌面页面硬缩到手机上。

**操作步骤**

1. 登录指定 applicant 账号
2. 打开 mobile Profile
3. 查看完成度、基本信息、分数、活动和奖项入口
4. 对照 web Profile 的同一账号结果

**你应该看到什么**

- 业务信息一致
- mobile 不拥挤、不压字
- 操作顺序自然
- 整体看起来像专业顾问服务，不像 demo 页

## 5. 问题提报示例

| 字段              | 内容                                                    |
| ----------------- | ------------------------------------------------------- |
| `release_id`      | `2026-04-rc1`                                           |
| `journey_id`      | `A11`                                                   |
| `step_no`         | `3`                                                     |
| `execution_owner` | `human`                                                 |
| `validation_type` | `experiential`                                          |
| `标题`            | mobile Profile completion ring 压住文案，页面显得不专业 |
| `预期结果`        | 圆环和文字分层清楚，页面整洁                            |
| `实际结果`        | 百分比和说明文字重叠，看起来像布局坏掉                  |
| `严重性`          | `medium`                                                |
| `是否阻塞发版`    | `no`                                                    |
| `初步分类`        | `design-content issue`                                  |

## 6. 审计日志 section 片段示例

```md
### AI-First 执行信息

| 字段                                 | 内容        |
| ------------------------------------ | ----------- |
| Baseline Smoke 是否已先由 Codex 执行 | yes         |
| 本轮人工补位是否已完成               | yes         |
| 最终收口人                           | Codex       |
| 门禁结论                             | CONDITIONAL |

## 强制体验维度结论

| 维度                      | 是否覆盖 | 结论  | 证据 / 备注                     |
| ------------------------- | -------- | ----- | ------------------------------- |
| 布局合理性                | yes      | ISSUE | A11 profile ring 布局失衡       |
| AI Agent 功能与输出合理性 | yes      | ISSUE | A6 多轮末轮具体性下降           |
| Web / Mobile 复用合理性   | yes      | PASS  | 数据语义一致，mobile 已重新适配 |
| 专业留学中介感            | yes      | ISSUE | mobile 局部页面削弱成熟感       |
```

## 7. 这个样例想说明什么

- 不是所有问题都要人工先发现。
- Codex 先清障后，人工才去判断布局、专业感和真实手感。
- 最终放行结论来自总表，不来自聊天记录。
