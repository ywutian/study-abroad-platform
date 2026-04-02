# AI-First 发版门禁 E2E SOP

> 目标：把发版门禁从“人工全量探索”改成“Codex 先跑、人工补位、Codex 收口”的标准流程。本文是内部执行标准，不直接发给非技术测试者。
> 团队速查入口见 [RELEASE_GATE_ONE_PAGER.md](./RELEASE_GATE_ONE_PAGER.md)。

## 1. 适用范围

- 所有会影响用户可见体验的发布。
- 默认基于共享预发环境执行正式门禁；本地环境只用于 Codex 预检和修复复现。
- 默认继续复用既有 `journey_id`、`PASS / ISSUE / BROKEN / BLOCKED / SKIPPED` 状态和 `e2e-report/` 证据目录。
- 所有 active journeys 以 [JOURNEY_REGISTRY.md](./JOURNEY_REGISTRY.md) 为准。
- 运行时脚本的机器可读事实源分别是 `scripts/release-gate/registry.ts` 和 `scripts/release-gate/impact-mapping.ts`。

## 2. 角色与责任

| 角色                | 必须承担                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `Codex`             | 环境 gate、影响分析、首轮 smoke、可脚本化旅程执行、证据归档、问题初判、修复后复跑、门禁总表收口 |
| `人工测试者`        | 视觉/布局、文案理解、多步流程直觉、真机交互、AI 自然度、通知打开后的真实感受                    |
| `release owner`     | 确认本次 release scope、批准 waiver、给出最终 `READY / CONDITIONAL / HOLD` 决策                 |
| `environment owner` | 准备共享预发环境、账号、样本数据、构建号、第三方权限和真机安装条件                              |

## 3. 门禁覆盖模型

### 3.1 Baseline Smoke

- 每次发版都必须执行。
- 默认由 Codex 全跑。
- 固定 ID 清单以 [JOURNEY_REGISTRY.md](./JOURNEY_REGISTRY.md) 第 3 节为准。
- 最小覆盖：
  - 登录/注册
  - 首页或 dashboard
  - 一条核心申请者主旅程
  - 一条 AI 旅程
  - 一条移动端基础可用性旅程
  - 一条通知/同步旅程
  - 一条管理员或高权限旅程

### 3.2 Impact Set

- 所有被本次改动影响的旅程必须纳入门禁集。
- Codex 先根据代码改动生成 impact mapping，再由 release owner 确认。
- 映射规则以 [RELEASE_IMPACT_MAPPING.md](./RELEASE_IMPACT_MAPPING.md) 为准。
- 规则：
  - `objective` 旅程：Codex 先跑，必要时人工抽样复核。
  - `experiential` 旅程：Codex 先清障，再分发给人工。
  - `admin-only` 旅程：由 Codex 或内部 owner 执行。

### 3.3 Full Audit

- 触发条件：
  - 大版本发布
  - 身份、支付、通知、AI 主链路重构
  - 连续两次 release 出现门禁问题
  - 产品 owner 明确要求全量复核
- 执行顺序固定为：Codex 先跑全量，再安排人工做体验型抽样或重点复核。

### 3.4 外部前置能力 / Capability Gates

- 旅程注册表可以为某些旅程声明 `externalPrerequisites`。
- 这些前置不是“可选备注”，而是正式门禁事实。
- 每个前置都必须声明 `blocking_policy`：
  - `required`: 缺失时继续阻塞 release gate
  - `conditional`: 缺失时不阻塞核心 release gate，但必须保留为条件能力结论
- 如前置缺失：
  - 旅程应记为 `BLOCKED`（外部依赖）
  - 必须写明“已经通过的子检查”和“仍被哪个外部前置卡住”
  - 不得把这种情况记成“startup crash”或“页面完全不可用”
- 当前强制示例：
  - `A11`
  - `SJ-3`
  - Android remote push / notification-open on a physical device
  - `blocking_policy = conditional`
  - 依赖有效 `apps/mobile/android/app/google-services.json` 和重建后的 Android 真机 dev build

## 4. 四个强制体验质量维度

以下 4 项不再视为“可选体验补充”，而是正式门禁的一部分。凡是相关页面或旅程被纳入门禁集，都必须明确给出结论。

### 4.1 布局合理性

- 检查是否存在：
  - 信息层级混乱
  - 组件密度失衡
  - 明显拥挤、空洞或视觉重心错误
  - 反馈层、弹窗、overlay、空态、加载态布局不协调
- 结论必须基于真实页面，不接受只看组件代码推断。

### 4.2 AI Agent 功能与输出合理性

- 不能只验证“接口有返回”。
- 每条 AI 旅程至少要判断：
  - 功能是否真的按预期类型工作
  - 输出是否与用户输入和档案上下文一致
  - 输出是否可执行、可理解，而不是空话
  - 输出是否越界、胡说或不稳定
  - 输出语气是否符合专业留学顾问产品
- 涉及多个 agent / mode / tool path 时，必须覆盖各自主要能力，不允许只测一个 happy path 就把整个 AI 系统判为通过。

### 4.3 Web / Mobile 复用是否合理

- 既要检查跨端一致性，也要检查“有没有不该硬复用却被硬复用”的问题。
- 必查点：
  - 同一数据语义在 web/mobile 是否一致
  - 页面信息结构是否保留同一业务含义
  - 是否因为直接搬 web 设计导致 mobile 不自然
  - 平台特有交互是否被尊重，而不是机械复刻
- 结论不能只写“两个端都有”，必须写“复用合理 / 不合理”及原因。

### 4.4 专业留学中介感是否成立

- 整体体验必须从“专业留学顾问/中介产品”视角审视，而不是只看 CRUD 是否能完成。
- 必查点：
  - 文案是否专业、可信、不过度 AI 味
  - 推荐、分析、时间线、文书建议是否像真实顾问在提供服务
  - 页面是否传达出专业、可靠、可托付的感觉
  - 是否出现会损害专业感的随意文案、过度游戏化、轻浮语气或不合场景视觉
- 这一项默认由人工主判，Codex 必须做预判并在门禁总表里给出备注。

## 5. 状态和放行规则

| 状态      | 含义                                  | 放行影响                                           |
| --------- | ------------------------------------- | -------------------------------------------------- |
| `PASS`    | 真实运行态完成，证据齐全              | 可放行                                             |
| `ISSUE`   | 可完成，但存在明确体验或次级问题      | 需 release owner 判断是否带病放行                  |
| `BROKEN`  | 用户主链路失败或结果不可达            | 不可放行                                           |
| `BLOCKED` | 因环境/权限/外部依赖无法验证          | 默认不可放行，除非提前批准 waiver                  |
| `SKIPPED` | 预先批准的不在本次 scope 或已失效旅程 | 只能在 release planning 阶段确定，不能现场临时决定 |

### 最终放行结论

| 结论          | 条件                                              |
| ------------- | ------------------------------------------------- |
| `READY`       | 门禁集全部有证据，且无未批准的 `BROKEN / BLOCKED` |
| `CONDITIONAL` | 仅存在已批准的非阻塞 `ISSUE` 或已批准 waiver      |
| `HOLD`        | 存在未关闭 `BROKEN`、未批准 `BLOCKED` 或缺失证据  |

## 6. 标准执行流程

### 阶段 0：Codex 预检

1. 检查候选环境、依赖、健康状态、关键账号和 seed 数据。
2. 生成本次 `Impact Set`，明确门禁旅程列表。
3. 先跑可自动化 smoke，提前拦截：
   - 服务未启动
   - 登录失效
   - 数据缺失
   - 接口契约漂移
   - 权限缺失
4. 读取本轮旅程的 `externalPrerequisites`：
   - 如 `A11 / SJ-3` 的 Android remote push 依赖 `apps/mobile/android/app/google-services.json`
   - 缺失时先登记为已知外部前置 blocker，不要等运行失败后再把它误记为产品启动故障
   - 如该能力 `blocking_policy = conditional`，则本轮允许继续收口核心 release gate，但必须在总表中显式列出

### 阶段 1：Codex 首轮执行

1. 按门禁旅程逐条执行。
2. 自动落证据骨架：
   - 进入态截图
   - 结果态截图
   - 失败态截图/日志摘录
   - `record.json`
   - 初步状态和根因假设
3. 如旅程带有 `externalPrerequisites`：
   - 先记录外部前置是否具备
   - 再分别记录“已通过的核心运行态”与“仍被外部前置阻塞的能力”
   - 例如 `A11 / SJ-3` 必须把 mobile 核心页面可达与 Android remote push 区分开
   - 如 blocker 仅来自 `blocking_policy = conditional` 的能力，则总表结论至少为 `CONDITIONAL`，而不是 `HOLD`
4. 输出首轮结论：
   - `PASS`：进入人工候选集
   - `BROKEN / BLOCKED`：直接拦下，不分发给人工
   - `ISSUE`：视影响决定是否需要人工补判

### 阶段 2：人工体验验证

1. 只把 Codex 已确认“链路可进入”的旅程发给人工。
2. 人工任务卡只包含：
   - 账号
   - 入口
   - 3-7 个明确步骤
   - 用户应看到的结果
   - 本次重点观察的体验维度
   - 失败如何上报
3. 人工不负责：
   - 看日志
   - 抓接口
   - 初始化环境
   - 判断技术根因

### 阶段 3：Codex 收口复验

1. 读取人工问题，去重并归类：
   - 产品 bug
   - 环境问题
   - 数据问题
   - 设计/文案问题
   - 说明不清
2. 逐条做二次复现。
3. 修复后先由 Codex 复跑，再决定是否回给人工二次确认。
4. 更新正式审计记录和门禁总表。

### 阶段 4：门禁结论

1. release owner 只看门禁总表和问题单，不从聊天记录拼结论。
2. 结论写入：
   - `READY`
   - `CONDITIONAL`
   - `HOLD`

## 7. 标准化产物

本流程固定维护以下 5 份产物：

1. [内部 QA SOP](./QA_RELEASE_GATE_SOP.md)
2. [人工测试者任务卡模板](./templates/human-e2e-task-card.md)
3. [问题提报模板](./templates/e2e-issue-report.md)
4. [Codex Runbook](./CODEX_E2E_RUNBOOK.md)
5. [发版门禁总表模板](./templates/release-gate-master.md)

## 8. 配套标准

以下文档不是“可选参考”，而是正式判定依据：

1. [旅程注册表](./JOURNEY_REGISTRY.md)
2. [Impact Set 映射规则](./RELEASE_IMPACT_MAPPING.md)
3. [AI Agent 评估 Rubric](./AI_AGENT_EVALUATION_RUBRIC.md)
4. [Web / Mobile 复用 Rubric](./CROSS_PLATFORM_REUSE_RUBRIC.md)
5. [专业留学中介感 Rubric](./PROFESSIONAL_CONSULTANCY_RUBRIC.md)
6. [发版门禁样例包](./examples/AI_FIRST_RELEASE_GATE_SAMPLE.md)

脚本入口：

- `pnpm release-gate:generate`
- `pnpm release-gate:run --config e2e-report/releases/<release-id>/codex-run-config.json`
- `scripts/release-gate/README.md`

## 9. 字段标准

### 所有门禁记录必须包含

- `release_id`
- `journey_id`
- `execution_owner`: `codex / human / internal`
- `validation_type`: `objective / experiential / admin-only`
- `environment`
- `build_version`
- `status`
- `evidence_link`
- `issue_link`
- `decision`
- `quality_dimensions_checked`
- `external_prerequisites`
- `registry_version`
- `impact_mapping_used`

### 分配规则

| `validation_type` | 默认 `execution_owner` | 说明                               |
| ----------------- | ---------------------- | ---------------------------------- |
| `objective`       | `codex`                | 可脚本化，可直接验证结果           |
| `experiential`    | `human`                | 需要真实主观判断；Codex 必须先清障 |
| `admin-only`      | `internal` 或 `codex`  | 高权限链路，不外包给普通测试者     |

## 10. 人工测试任务设计规则

- 一张任务卡只验证一个旅程，不混多个目标。
- 一次人工执行控制在 `30-45` 分钟内。
- 非技术测试者默认不超过 `3-5` 张任务卡。
- 任务卡必须用用户语言，不写接口名、seed、feature flag、controller 名称。
- 预期结果必须是用户可见结果，不能写“HTTP 200”或“日志正常”。
- 每张任务卡必须至少点名一个本轮重点体验维度：
  - 布局合理性
  - AI 输出合理性
  - 跨端复用合理性
  - 专业留学中介感
- 如果是 AI 旅程，必须引用 [AI Agent 评估 Rubric](./AI_AGENT_EVALUATION_RUBRIC.md) 中对应场景。
- 如果是跨端旅程，必须引用 [Web / Mobile 复用 Rubric](./CROSS_PLATFORM_REUSE_RUBRIC.md)。
- 如果是品牌/顾问定位敏感页面，必须引用 [专业留学中介感 Rubric](./PROFESSIONAL_CONSULTANCY_RUBRIC.md)。

## 11. 流程验收指标

- 非技术测试者任务完成率 `>= 90%`
- 问题单可复现率 `>= 80%`
- 阻塞问题首响 `<= 30 分钟`
- 发版前门禁总表无空白项 `100%`
- 人工测试者不因环境问题中断的比例逐轮上升
- 与上述 4 个体验维度相关的问题，不再因“主链路可完成”自动降级忽略

## 12. 默认约束

- 默认以后发版门禁以 Codex 为主执行者，不走纯人工全量测试。
- 默认共享预发环境是唯一正式门禁环境。
- 默认 `B1-B3` 等 inactive journeys 不进入日常发版门禁，除非注册表重新激活。
- 默认任何没有证据路径的旅程都不算完成。
- 默认 AI 旅程的“输出质量”与“功能可达性”同级，不能只用“返回成功”代替通过。
