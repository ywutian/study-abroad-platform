# Codex E2E Runbook

> 本文定义 Codex 在发版门禁中的固定动作。目标是让每次 E2E 门禁都有稳定节奏、稳定产物和稳定收口方式。
> 如本轮是“全产品面专项审计”，请先生成 full-surface inventory，再按本 Runbook 的批次执行思想收口。

## 1. 目标

- 在人工介入前，先清除明显工程故障。
- 用一致的方式生成证据、记录状态、沉淀问题和回归结果。
- 避免把环境问题、权限问题或明显坏链路扔给非技术测试者。
- 强制把以下四类体验质量维度显式落表：布局合理性、AI 输出合理性、跨端复用合理性、专业留学中介感。

## 2. 执行顺序

在每次执行前，Codex 先读取以下标准：

- [JOURNEY_REGISTRY.md](./JOURNEY_REGISTRY.md)
- [FULL_SURFACE_REGISTRY.md](./FULL_SURFACE_REGISTRY.md)
- [FULL_SURFACE_REUSE_PLAYBOOK.md](./FULL_SURFACE_REUSE_PLAYBOOK.md)
- [FULL_SURFACE_GAP_CHECKLIST.md](./FULL_SURFACE_GAP_CHECKLIST.md)
- [RELEASE_IMPACT_MAPPING.md](./RELEASE_IMPACT_MAPPING.md)
- [AI_AGENT_EVALUATION_RUBRIC.md](./AI_AGENT_EVALUATION_RUBRIC.md)
- [CROSS_PLATFORM_REUSE_RUBRIC.md](./CROSS_PLATFORM_REUSE_RUBRIC.md)
- [PROFESSIONAL_CONSULTANCY_RUBRIC.md](./PROFESSIONAL_CONSULTANCY_RUBRIC.md)

如本轮是全产品面专项审计，再额外读取：

- [FULL_SURFACE_REGISTRY.md](./FULL_SURFACE_REGISTRY.md)
- [FULL_SURFACE_REUSE_PLAYBOOK.md](./FULL_SURFACE_REUSE_PLAYBOOK.md)
- [FULL_SURFACE_GAP_CHECKLIST.md](./FULL_SURFACE_GAP_CHECKLIST.md)
- `MEMORY.md`

如果本轮是新的 release gate，先生成执行包：

```bash
pnpm release-gate:generate --release-id <release-id> --candidate-version <candidate-version> --environment pre-release
```

生成包默认位于：

```text
e2e-report/releases/<release-id>/
```

其中：

- `codex-run-config.json` 是机器可读配置
- `run-codex-audit.sh` 是当前推荐执行命令
- `codex-runtime-result.md` 是 Codex 首轮执行结果摘要
- `human-handoff.md` 是人工接力清单
- `user-journey-audit-section.md` 是可直接追加到 `docs/USER_JOURNEY_AUDIT_LOG.md` 的 section 草稿
- `human-task-cards/` 是发给非技术测试者的任务卡

标准运行命令：

```bash
pnpm release-gate:run --config e2e-report/releases/<release-id>/codex-run-config.json
```

### Full-surface bootstrap 命令

```bash
pnpm full-surface:generate --audit-date YYYY-MM-DD
```

该命令会生成：

- `e2e-report/full-surface-YYYY-MM-DD/route-inventory.json`
- `e2e-report/full-surface-YYYY-MM-DD/capability-inventory.json`
- `e2e-report/full-surface-YYYY-MM-DD/journey-overlay.json`
- `docs/FULL_SURFACE_AUDIT_LOG_YYYY-MM-DD.md`
- `docs/FULL_SURFACE_AGENT_REVIEW_YYYY-MM-DD.md`

后续各批次执行时，必须持续回填这些 dated 文档和 `MEMORY.md`，而不是把结论留在聊天里。

如本轮是全产品面专项审计，先执行：

```bash
pnpm full-surface:generate --audit-date YYYY-MM-DD
```

然后使用：

- `e2e-report/full-surface-YYYY-MM-DD/manifest.json`
- `e2e-report/full-surface-YYYY-MM-DD/route-inventory.json`
- `e2e-report/full-surface-YYYY-MM-DD/capability-inventory.json`
- `docs/FULL_SURFACE_AUDIT_LOG_YYYY-MM-DD.md`
- `docs/FULL_SURFACE_AGENT_REVIEW_YYYY-MM-DD.md`

作为全量执行入口和回填台账。

### 2.1 阶段 0：环境 gate

Codex 必须先确认：

- 候选环境 URL、版本号、提交 SHA 明确。
- API / Web / Mobile / Admin / 第三方依赖具备最小可用性。
- 关键账号和测试数据可登录、可进入主要页面。
- `journey_id` 注册表与本次门禁集已确定。
- 本轮旅程的 `externalPrerequisites` 已检查。
- 如 `A11 / SJ-3` 需要 Android remote push，则必须先确认 `apps/mobile/android/app/google-services.json` 和真机 dev build 是否已准备。

环境 gate 的输出必须写入：

- `release_id`
- `registry_version`
- `environment`
- `build_version`
- `gate_time`
- `gate_result`
- `known_blockers`
- `external_prerequisites_checked`

### 2.2 阶段 1：影响分析

Codex 必须生成本次 `Impact Set`：

- 读取本次改动涉及的模块、页面、接口和共享组件。
- 映射到受影响的 `journey_id`。
- 标注每条旅程的：
  - `execution_owner`
  - `validation_type`
  - 是否属于 `Baseline Smoke`
  - 需要引用的 rubric

### 2.3 阶段 2：首轮执行

对每条由 Codex 执行的旅程，必须产出：

- 进入态截图
- 结果态截图
- 失败态截图或错误摘录
- `record.json`
- 初步状态 `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED`
- 本旅程已检查的 `quality_dimensions_checked`
- 本旅程声明的 `external_prerequisites`
- 对四个体验维度的简短判断摘要（如适用）
- 如存在 capability gate，再补一句“已通过哪些子检查 / 剩余 blocker 是什么”

#### `record.json` 最少字段

```json
{
  "release_id": "2026-04-xx-rc1",
  "registry_version": "2026-04-01.v3",
  "journey_id": "A1",
  "execution_owner": "codex",
  "validation_type": "objective",
  "impact_mapping_used": ["auth-onboarding", "profile-bootstrap"],
  "external_prerequisites": [],
  "blocked_by_external_prerequisites": [],
  "environment": "staging",
  "build_version": "web-2026.04.01-rc1",
  "status": "PASS",
  "quality_dimensions_checked": ["layout", "ai-quality"],
  "account": "demo@example.com",
  "preconditions": ["seed loaded"],
  "steps_summary": ["..."],
  "user_visible_result": "...",
  "evidence": ["...png", "...txt"],
  "issue_links": [],
  "notes": ""
}
```

### 2.4 阶段 3：人工反馈收口

Codex 读取人工反馈后必须：

1. 先去重，不允许同一问题重复建单。
2. 把问题归类为：
   - code bug
   - data issue
   - environment issue
   - design/content issue
   - expected but confusing
3. 每条都补一段“可复现描述”。
4. 每条都映射回 `journey_id` 和 `step_no`。
5. 如果问题属于以下任一类，必须显式标注，不允许并入泛泛的“UX 问题”：
   - 布局合理性
   - AI 输出合理性
   - 跨端复用不合理
   - 不符合专业留学中介定位

### 2.5 阶段 4：修复后复验

- 修复后先做定向回归。
- 门禁关键旅程修复后，默认追加一次 `Baseline Smoke`。
- 如果涉及共享基础设施、登录、导航、通知、AI 主链路、权限，必须重新评估是否触发 `Full Audit`。

### 2.6 阶段 5：最终收口

Codex 必须同步更新：

- `e2e-report/releases/<release-id>/...`
- `docs/USER_JOURNEY_AUDIT_LOG.md`
- 发版门禁总表
- 问题单状态

最终输出只能是：

- `READY`
- `CONDITIONAL`
- `HOLD`

## 3. 旅程分工默认值

| 旅程范围             | 默认执行          | 说明                                        |
| -------------------- | ----------------- | ------------------------------------------- |
| `A1-A10`             | Codex             | 先跑 objective 主链路                       |
| `A11`                | Codex + human     | Codex 负责基础链路，人工负责真机体验        |
| `C1-C5`              | Codex 或 internal | 高权限链路                                  |
| `SJ-1 / SJ-2 / SJ-4` | Codex             | Web/MCP objective 为主                      |
| `SJ-3`               | Codex + human     | 通知列表由 Codex 跑，真实触达感受由人工补位 |

旅程是否 active、是否属于 Baseline Smoke，以 [JOURNEY_REGISTRY.md](./JOURNEY_REGISTRY.md) 为准。

对声明了 `externalPrerequisites` 的旅程，Codex 必须先把 capability gate 写清楚，再决定是否分发给人工。
如果 blocker 仅来自 `blocking_policy = conditional` 的 capability gate，Codex 仍应把相关旅程分发给人工去看核心体验，只是要在 handoff 中明确“不要把该条件能力缺失误判成页面坏了”。

## 4. 四个体验质量维度的执行要求

### 4.1 布局合理性

- 对关键页面必须检查：
  - 信息层级是否清楚
  - 是否出现明显拥挤/空洞/重心失衡
  - overlay、toast、空态、加载态是否破坏整体节奏
- 至少保留一张能体现布局判断的截图。
- 判定时引用 [CROSS_PLATFORM_REUSE_RUBRIC.md](./CROSS_PLATFORM_REUSE_RUBRIC.md) 和页面布局观察。

### 4.2 AI Agent 功能与输出合理性

- 对每个纳入门禁的 AI 入口，Codex 不能只验证“接口成功”。
- 必须至少判断：
  - 能力是否真的命中该 agent / mode 的目标
  - 输出是否基于输入和上下文
  - 输出是否具体、可执行、像真实顾问
  - 是否出现幻觉、越界、空泛套话
- 如果有多个 agent、tool path 或模式，至少覆盖主能力矩阵，而不是只测一个按钮。
- 具体 prompt bank 和通过标准，引用 [AI_AGENT_EVALUATION_RUBRIC.md](./AI_AGENT_EVALUATION_RUBRIC.md)。

### 4.3 Web / Mobile 复用合理性

- 对跨端旅程必须明确回答：
  - 数据语义是否一致
  - 交互结构是否等价
  - 是否因机械复用导致 mobile/web 任一端不自然
  - 是否遵守各自平台习惯
- 如果只是“功能都存在”，但平台体验不合理，不能判 `PASS`。
- 具体判据引用 [CROSS_PLATFORM_REUSE_RUBRIC.md](./CROSS_PLATFORM_REUSE_RUBRIC.md)。

### 4.4 专业留学中介感

- 对首页、档案、推荐、时间线、文书、AI 分析等旅程，Codex 需要做一次产品定位预判：
  - 文案是否可信、专业
  - 建议是否符合留学顾问服务逻辑
  - 视觉/语气是否削弱专业感
- 这项通常需要人工主判，但 Codex 必须先给出预判备注并引导人工重点看哪里。
- 判据引用 [PROFESSIONAL_CONSULTANCY_RUBRIC.md](./PROFESSIONAL_CONSULTANCY_RUBRIC.md)。

## 5. 人工补位触发条件

以下情况必须把旅程转给人工或追加人工复核：

- 视觉、布局、密度、层级明显异常
- 文案、翻译、语气需要主观判断
- 真机手势、键盘、滚动、权限弹窗体验
- AI 回答自然度、可信度、越界感受
- 通知点击后的真实感受
- Web / Mobile 是否复用得合理
- 整体是否像一个专业留学中介产品

以下情况默认不分发给人工：

- API 503
- 登录 401
- seed 缺失
- 构建失败
- 路由打不开
- 权限缺失

## 6. 证据规则

- 一条旅程最少两张截图：进入态、结果态。
- 失败必须附错误态截图。
- AI / MCP / 通知 / 多端同步要追加文本摘要。
- 如涉及四个体验质量维度中的任一项，证据里必须有一句维度判断摘要。
- 如旅程声明了 `externalPrerequisites`，证据里必须明确：
  - 本轮前置是否具备
  - 已通过的子检查
  - 剩余 blocker 的外部依赖是什么
  - 若该 blocker 是 `conditional`，还要明确“它不再拖住核心 gate，只作为条件能力结论保留”
- 证据目录命名规则：

```text
e2e-report/releases/<release-id>/<journey-id>/<executor-id>/
```

- `executor-id` 约定：
  - `codex`
  - `human-<name>`
  - `internal-<name>`

## 7. 状态判定规则

| 状态      | 判定方法                       |
| --------- | ------------------------------ |
| `PASS`    | 用户可见结果达成，证据完整     |
| `ISSUE`   | 主链路达成，但存在明确体验问题 |
| `BROKEN`  | 主链路失败或结果不可达         |
| `BLOCKED` | 明确受环境/权限/外部依赖阻塞   |
| `SKIPPED` | 预先批准不执行，不允许临时跳过 |

补充规则：

- 如果主链路可完成，但布局、AI 输出、跨端复用或专业感出现明显问题，默认至少记为 `ISSUE`，不能直接写 `PASS`。
- 如果只是 capability gate 缺失，例如 `A11 / SJ-3` 的 Android remote push 没有 FCM 配置，必须写成“外部前置 `BLOCKED`”，不能写成“startup crash”。
- 如果 `BLOCKED` 仅来自 `conditional` capability gate，则最终 release 结论默认降为 `CONDITIONAL`，而不是 `HOLD`。

## 8. 禁止事项

- 不要把明显坏链路分发给非技术测试者。
- 不要只凭聊天记录下最终结论。
- 不要用静态代码分析替代运行态体验。
- 不要在没有证据的情况下写 `PASS`。
- 不要把产品 bug 记成 `BLOCKED`。
- 不要把“AI 有返回”当成 AI 旅程通过。
- 不要把“两个端都有这个功能”当成跨端复用合理。

## 9. 试运行建议

首轮只挑小集合验证流程：

- 登录/注册
- 首页
- 一条 AI 旅程
- 一条 admin 旅程
- 一条 MCP 旅程
- 一条 mobile smoke

人工补位再跑：

- 一条 profile 页面
- 一条 AI 体验页
- 一条真机通知/交互页
- 一条视觉敏感页面
- 一条明确检验“像不像专业留学中介产品”的顾问型页面
