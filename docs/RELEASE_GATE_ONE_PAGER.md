# 发版门禁一页版

> 给团队直接执行的版本。目标不是解释体系，而是让一轮 release gate 能按同一口径快速跑完。

## 1. 先看什么

- 流程标准：[QA_RELEASE_GATE_SOP.md](./QA_RELEASE_GATE_SOP.md)
- Codex 执行标准：[CODEX_E2E_RUNBOOK.md](./CODEX_E2E_RUNBOOK.md)
- 旅程事实源：[JOURNEY_REGISTRY.md](./JOURNEY_REGISTRY.md)
- 影响映射：[RELEASE_IMPACT_MAPPING.md](./RELEASE_IMPACT_MAPPING.md)

## 2. 角色分工

| 角色                | 只做这些                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| `Codex`             | 环境预检、生成 gate 包、首轮 E2E、证据归档、问题初判、修复后复跑、更新总表 |
| `人工测试者`        | 布局、文案、真机体验、AI 自然度、专业感、跨端是否自然                      |
| `release owner`     | 确认本轮 scope、决定 `READY / CONDITIONAL / HOLD`                          |
| `environment owner` | 共享预发环境、测试账号、样本数据、真机安装条件、第三方配置                 |

## 3. 固定执行顺序

### Step 1. 生成一轮 gate 包

```bash
pnpm release-gate:generate \
  --release-id <release-id> \
  --candidate-version <build-version> \
  --environment pre-release
```

输出目录默认在：

```text
e2e-report/releases/<release-id>/
```

关键文件：

- `codex-run-config.json`
- `release-gate-master.md`
- `codex-run-plan.md`
- `human-task-cards/*.md`

### Step 2. Codex 先跑

```bash
pnpm release-gate:run --config e2e-report/releases/<release-id>/codex-run-config.json
```

Codex 跑完后会自动回填：

- `codex-runtime-result.md`
- `release-gate-master.md`
- `human-handoff.md`
- `user-journey-audit-section.md`

### Step 3. 人工只接手可进入的旅程

只看：

- `human-handoff.md`
- `human-task-cards/*.md`

规则：

- `ready_for_human = yes` 才分发
- 非技术测试者不看日志、不看接口、不搭环境
- 问题统一走 [templates/e2e-issue-report.md](./templates/e2e-issue-report.md)

### Step 4. Codex 收口

- 读取人工反馈
- 去重、复现、归类
- 修复后定向复跑
- 必要时补跑 `Baseline Smoke`
- 更新 `release-gate-master.md` 和 `user-journey-audit-section.md`

### Step 5. release owner 只看总表

最终只根据：

- `release-gate-master.md`
- 证据目录
- 问题单

做三选一：

- `READY`
- `CONDITIONAL`
- `HOLD`

## 4. 这轮必须怎么判

### 状态

| 状态      | 什么时候用                     |
| --------- | ------------------------------ |
| `PASS`    | 用户可见结果完成，证据完整     |
| `ISSUE`   | 能完成，但有明确体验问题       |
| `BROKEN`  | 主链路失败                     |
| `BLOCKED` | 因环境、权限或外部依赖无法验证 |
| `SKIPPED` | 预先批准不执行，不允许临时跳过 |

### 放行结论

| 结论          | 什么时候用                                               |
| ------------- | -------------------------------------------------------- |
| `READY`       | 没有未批准的 `BROKEN / BLOCKED`                          |
| `CONDITIONAL` | 只有非阻塞 `ISSUE`，或只剩 `conditional capability gate` |
| `HOLD`        | 有未关闭 `BROKEN`、硬 `BLOCKED` 或缺证据                 |

## 5. 四个强制体验维度

每轮都必须显式给结论：

- 布局合理性
- AI Agent 功能与输出合理性
- Web / Mobile 复用合理性
- 专业留学中介感

如果主链路能完成，但这四项里有明显问题，不能直接判 `PASS`。

## 6. 当前特殊规则：A11 / SJ-3

`A11` 和 `SJ-3` 现在拆成两层：

1. mobile 核心运行态 / 页面级行为
2. Android remote push / notification-open

第二层现在是 `conditional capability gate`，不是默认核心 stop condition。

这意味着：

- 没有 [google-services.json](../apps/mobile/android/app/google-services.json) 时，`A11 / SJ-3` 仍可写 `BLOCKED`
- 但如果 mobile 核心页面、跨端语义、通知列表/未读数/删除已通过，整轮 release gate 可以判 `CONDITIONAL`
- 不再把这件事误写成“startup crash”或“app 整体不可用”

## 7. 每轮最少交付物

- 1 份 `release-gate-master.md`
- 1 份 `codex-runtime-result.md`
- 1 份 `human-handoff.md`
- 1 份 `user-journey-audit-section.md`
- 每条 journey 的 `record.json`
- 每条 journey 至少 2 张截图

## 8. 团队最常用入口

- 流程说明：[QA_RELEASE_GATE_SOP.md](./QA_RELEASE_GATE_SOP.md)
- Codex 操作细则：[CODEX_E2E_RUNBOOK.md](./CODEX_E2E_RUNBOOK.md)
- 模板入口：[templates/release-gate-master.md](./templates/release-gate-master.md)
- 样例包：[examples/AI_FIRST_RELEASE_GATE_SAMPLE.md](./examples/AI_FIRST_RELEASE_GATE_SAMPLE.md)
- 脚本说明：[../scripts/release-gate/README.md](../scripts/release-gate/README.md)
