# 发版门禁总表模板

> 一次 release 一份。正式放行只看这张表和关联证据。

## Release 信息

| 字段                  | 内容                             |
| --------------------- | -------------------------------- |
| `release_id`          |                                  |
| `registry_version`    | `2026-04-01.v3`                  |
| `impact_mapping_used` | `docs/RELEASE_IMPACT_MAPPING.md` |
| `候选版本`            |                                  |
| `commit / tag`        |                                  |
| `环境`                |                                  |
| `release owner`       |                                  |
| `environment owner`   |                                  |
| `门禁开始时间`        |                                  |
| `门禁结束时间`        |                                  |
| `最终结论`            | `READY / CONDITIONAL / HOLD`     |

## 总表

| journey_id | title                        | baseline_smoke | execution_owner | validation_type | quality_dimensions_checked                  | tester | status | evidence_link | issue_link | waiver | decision | notes |
| ---------- | ---------------------------- | -------------- | --------------- | --------------- | ------------------------------------------- | ------ | ------ | ------------- | ---------- | ------ | -------- | ----- |
| A1         | 注册 → 首次登录 → onboarding | yes            | codex           | objective       | layout, consultancy-quality                 |        |        |               |            |        |          |       |
| A3         | AI 选校推荐                  | yes            | codex           | objective       | ai-quality, consultancy-quality             |        |        |               |            |        |          |       |
| A11        | 移动端一致性                 | yes            | codex + human   | experiential    | layout, cross-platform, consultancy-quality |        |        |               |            |        |          |       |
| SJ-3       | Mobile 通知页                | no             | codex + human   | experiential    | cross-platform, consultancy-quality         |        |        |               |            |        |          |       |

## 外部前置能力 / Capability Gates

| journey_id | capability scope                             | blocking policy | missing means                                                             | unblock action                                                                                           | current status | note |
| ---------- | -------------------------------------------- | --------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------- | ---- |
| A11        | Android remote push / 真机 notification-open | conditional     | 如缺失，相关子检查应记 `BLOCKED`（外部依赖），不得误记为产品启动/页面崩溃 | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |                |      |
| SJ-3       | 真 remote push 到达 / 通知打开行为           | conditional     | 如缺失，相关子检查应记 `BLOCKED`（外部依赖），不得误记为产品启动/页面崩溃 | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |                |      |

## 体验质量维度总览

| 维度                      | 是否本轮必查 | 负责人                 | 当前结论 | 备注 |
| ------------------------- | ------------ | ---------------------- | -------- | ---- |
| 布局合理性                | yes          | codex + human          |          |      |
| AI Agent 功能与输出合理性 | yes          | codex + human          |          |      |
| Web / Mobile 复用合理性   | yes          | codex + human          |          |      |
| 专业留学中介感            | yes          | human 主判，codex 预判 |          |      |

## 放行判定

### READY

- 无未批准的 `BROKEN`
- 无未批准的 `BLOCKED`
- 所有门禁旅程都有状态和证据

### CONDITIONAL

- 仅存在已批准的非阻塞 `ISSUE`
- 所有 waiver 都有 owner 和时间

### HOLD

- 任一关键旅程 `BROKEN`
- 任一未批准 `BLOCKED`
- 有空白条目或缺失证据

## Waiver 记录

| journey_id | issue | owner | reason | expires_at |
| ---------- | ----- | ----- | ------ | ---------- |
|            |       |       |        |            |

## 本次门禁结论摘要

- 本次 Codex 首轮拦截的问题：
- 本次人工补位发现的问题：
- 修复后复跑结果：
- 仍需跟踪的已知问题：
- 参考样例：`docs/examples/AI_FIRST_RELEASE_GATE_SAMPLE.md`
