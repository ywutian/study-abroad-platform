# Claude Code Harness

> 开发协作基础设施 — 三层上下文工程 (rules / routing / workflow) + 13 agents + 6 skills + Agent Workflow Manifest + Workflow Receipts.

**最后更新**: 2026-04-12

---

## 目录

- [§1 三层上下文工程](#1-三层上下文工程)
- [§2 静态规则 (7 rules)](#2-静态规则-7-rules)
- [§3 动态路由 (Context Routing)](#3-动态路由-context-routing)
- [§4 13 Specialized Agents](#4-13-specialized-agents)
- [§5 6 Skills](#5-6-skills)
- [§6 Agent Workflow Manifest](#6-agent-workflow-manifest)
- [§7 Workflow Receipts](#7-workflow-receipts)
- [§8 Hooks](#8-hooks)
- [§9 Documentation Hierarchy](#9-documentation-hierarchy)
- [§10 文档治理门禁](#10-文档治理门禁)

---

## 1. 三层上下文工程

**从静态到动态到工作流**的三层 Context Engineering:

```
┌───────────────────────────────────┐
│  Layer 1: 静态规则                 │
│  .claude/rules/ — 7 个 (glob)      │
│  根据文件 glob 自动加载             │
└───────────────────────────────────┘
              ↓ (+)
┌───────────────────────────────────┐
│  Layer 2: 动态路由                 │
│  CLAUDE.md — 代码路径→文档映射      │
│  166 行 (governance limit 190)    │
└───────────────────────────────────┘
              ↓ (+)
┌───────────────────────────────────┐
│  Layer 3: 工作流                   │
│  13 Agents + 6 Skills + Manifest   │
│  按任务类型触发                     │
└───────────────────────────────────┘
```

**三层协作方式**:

1. 用户开始对话 → Claude 读取 CLAUDE.md 获得全局上下文
2. 用户提及某文件 → glob 规则自动加载对应 `.claude/rules/*.md`
3. 用户执行复杂任务 → Claude 按 manifest 选择 agent + 使用 skill

---

## 2. 静态规则 (7 rules)

**位置**: `.claude/rules/`

每个规则文件通过 frontmatter 声明 glob pattern，Claude 匹配时自动加载：

| Rule           | 自动加载条件                                        | 行数 | 内容主题                                    |
| -------------- | --------------------------------------------------- | ---- | ------------------------------------------- |
| `backend.md`   | `apps/api/**`                                       | ~94  | NestJS 模式，DTO 验证，throttle，异常处理   |
| `frontend.md`  | `apps/web/**`                                       | ~116 | React/Next.js 模式，设计系统，i18n，UI 约定 |
| `mobile.md`    | `apps/mobile/**`                                    | ~37  | Expo/RN，FlashList v2，Reanimated 4         |
| `ai-system.md` | `**/ai-agent/**`, `**/prediction/**`, `**/essay/**` | ~84  | LLM 抽象，JSON 解析，工具注册，记忆系统     |
| `security.md`  | `**/auth/**`, `**/guards/**`, `**/vault/**`         | ~37  | 认证模式，Vault 加密，CORS/CSP              |
| `testing.md`   | `**/*.spec.ts`, `**/*.test.ts`                      | ~32  | Mock 模式，覆盖率策略，验证门               |
| `ci-cd.md`     | `.github/**`, `*.sh`, `.husky/**`                   | ~60  | CI 流水线，git hooks，本地 CI 等价命令      |

**总行数**: 约 460 行 (全部 ≤ 150 governance limit)

### 规则设计原则

- 每个规则必须可独立使用 (不依赖其他规则)
- 规则内容是 "不知道会犯错的约束"，不是通用教程
- 规则引用具体文件路径和代码示例，不泛泛而谈
- 规则更新时自动触发 `check-drift.ts` 的 `rules-glob-coverage` 检查

---

## 3. 动态路由 (Context Routing)

**位置**: 根 `CLAUDE.md` 中的 "Context Routing" 表

修改代码前，Claude 会**自动读取**对应文档：

| 代码路径                                          | 必读文档                                           |
| ------------------------------------------------- | -------------------------------------------------- |
| `apps/api/src/modules/*/`                         | 该模块的 `BRIEF.md` (懒加载)                       |
| `apps/web/src/components/features/*/`             | 该 feature 的 `BRIEF.md`                           |
| `apps/api/` 任意文件                              | `apps/api/CLAUDE.md` + `.claude/rules/backend.md`  |
| `apps/web/` 任意文件                              | `apps/web/CLAUDE.md` + `.claude/rules/frontend.md` |
| `modules/prediction/`                             | `docs/PREDICTION_SYSTEM.md`                        |
| `modules/ai-agent/`                               | `.claude/rules/ai-system.md`                       |
| `modules/auth/`, guards/                          | `.claude/rules/security.md` + `docs/adr/0010-*.md` |
| `prisma/schema.prisma`                            | `apps/api/CLAUDE.md` Schema Change Rules           |
| 留学业务逻辑 (school, prediction, recommendation) | `docs/DATA_SOURCES.md`                             |
| 部署/运维                                         | `docs/DEPLOYMENT_STRATEGY.md` + `docs/RUNBOOK.md`  |

---

## 4. 13 Specialized Agents

**位置**: `.claude/agents/`

每个 agent 有独立的 `.md` 文件定义 role + step 0 relevance check + output format。

| #   | Agent                    | 职责                  | 使用场景                                 |
| --- | ------------------------ | --------------------- | ---------------------------------------- |
| 1   | **Study Abroad Expert**  | 留学业务逻辑验证      | 选校逻辑、录取预测、文书策略、申请时间线 |
| 2   | **Applicant Simulator**  | 学生/家长 UX 审查     | 新功能用户可达性、表单易用性             |
| 3   | **Design Reviewer**      | UI/UX, 暗色模式, a11y | 前端代码变更、组件审查                   |
| 4   | **Architect**            | 系统设计, API, 依赖   | 新模块、API 设计、数据模型变更           |
| 5   | **Integration Checker**  | 前后端闭环            | API 对接完整性、类型一致性               |
| 6   | **Data Model Reviewer**  | Schema-DTO-Type 链路  | Prisma schema、DTO、type 三层一致性      |
| 7   | **Security Reviewer**    | 认证, 注入, OWASP     | 认证、权限、API 端点、加密存储           |
| 8   | **AI Prompt Engineer**   | Prompt 质量, 幻觉     | LLM 调用、prompt 模板、tool 定义         |
| 9   | **i18n Specialist**      | 翻译, 键覆盖          | 用户可见文案、翻译文件、中英切换         |
| 10  | **Test Engineer**        | 测试覆盖, 边界        | 功能开发完成后的测试补齐                 |
| 11  | **Mobile Specialist**    | Expo/RN 兼容          | Expo/RN 代码、移动端 UI                  |
| 12  | **Feedback Processor**   | 反馈分类, 根因        | 外部反馈的 5 阶段处理                    |
| 13  | **User Journey Auditor** | E2E 旅程完整性        | 从终端用户视角审查功能完整性             |

### Step 0 Relevance Filtering

每个 agent 在执行前会先判断"是否相关"：

- 相关 → 进入详细审查
- 不相关 → 早退 (N/A)，成本约 ~10s

**原则**: 当不确定时**宁可启动**，N/A 早退比遗漏代价低。

### Agent 输出格式

统一使用 `N_A | BLOCK | WARN | INFO` (见 [§6 Manifest](#6-agent-workflow-manifest))

---

## 5. 6 Skills

**位置**: `.claude/skills/`

Skill 是 Claude 的预定义工作流，通过 `/skill-name` 触发。

| Skill               | 用途                   | 何时使用                                                     |
| ------------------- | ---------------------- | ------------------------------------------------------------ |
| `/review`           | Post-generation sensor | 代码生成后的综合审查，按 manifest 选 agent                   |
| `/create-module`    | NestJS 模块脚手架      | 新后端模块 (controller + service + dto + BRIEF.md + tests)   |
| `/add-endpoint`     | REST 端点脚手架        | 为现有模块添加端点 (DTO + throttle + swagger + tests)        |
| `/feedback-triage`  | 5 阶段反馈处理         | 外部反馈处理 (triage → batch → implement → verify → release) |
| `/audit-drift`      | 文档对齐检查           | BRIEF.md vs 代码、rules 准确性、CLAUDE.md 一致性             |
| `/workflow-receipt` | 结构化审计回执         | Workflow 结束后生成审计记录                                  |

### 5 阶段反馈处理 (`/feedback-triage`)

```
Stage 1: Triage        # 分类 (CODE_BUG / DATA_ISSUE / UX_CONFUSION / NEW_FEATURE / INDUSTRY_SUGGESTION)
Stage 2: Batch Plan     # 批次规划 (≤3 items/batch)
Stage 3: Implement      # 实施 + 测试
Stage 4: Verify         # 验收 (必须有用户可见证据)
Stage 5: Release        # pre-push gate + 文档更新
```

**铁律**: 绝不跳过 Stage 1 triage，即使是 "obvious bug"。

---

## 6. Agent Workflow Manifest

**位置**: `.claude/manifests/agent-workflow.yml`

**单一真实来源** — CLAUDE.md, `/review`, `/feedback-triage`, `check-drift.ts` 都从此读取。

### 5 大块内容

```yaml
severity:
  BLOCK: 'Must fix before commit' # = feedback critical = MUST
  WARN: 'Should fix' # = feedback high/medium = SHOULD
  INFO: 'Suggestion for improvement' # = feedback low = CONSIDER
  N_A: 'Not relevant, skip'

agents:
  - id: study-abroad-expert
    name: Study Abroad Expert
    file: .claude/agents/study-abroad-expert.md
    role: Business logic validation
  # ... 13 个 agent 的统一 registry

selection:
  by_change_type:
    backend: [architect, data-model-reviewer, security-reviewer, test-engineer]
    frontend: [design-reviewer, i18n-specialist, applicant-simulator, test-engineer]
    mobile: [mobile-specialist, i18n-specialist, applicant-simulator, test-engineer]
    ai_feature: [ai-prompt-engineer, study-abroad-expert, security-reviewer, test-engineer]
    full_stack:
      [
        architect,
        data-model-reviewer,
        design-reviewer,
        i18n-specialist,
        security-reviewer,
        test-engineer,
      ]
    db_change: [data-model-reviewer, architect, security-reviewer]
    large_change: ALL

  cross_cutting: # 叠加规则
    - when: prisma_field_in_frontend_ui
      add: design-reviewer
    - when: llm_output_structure_change
      add: data-model-reviewer
    - when: api_error_code_change
      add: integration-checker
    - when: shared_type_change_with_mobile
      add: mobile-specialist
    - when: nullable_field_with_frontend_display
      add: applicant-simulator
    - when: prompt_output_for_business_decision
      add: study-abroad-expert

acceptance:
  mandatory: # 每次都跑
    - integration-checker
    - test-engineer
  user_visible: # 用户可见才跑
    - user-journey-auditor
  by_feedback_type:
    CODE_BUG: [test-engineer]
    DATA_ISSUE: [data-model-reviewer]
    UX_CONFUSION: [applicant-simulator, design-reviewer]
    NEW_FEATURE: [integration-checker, test-engineer]
    INDUSTRY_SUGGESTION: [study-abroad-expert]

output:
  severity_tiers: [N_A, BLOCK, WARN, INFO]
  format: '... (统一格式规范)'
```

### 设计动机

**Before manifest** (分散的配置):

- CLAUDE.md Phase 1 表 (7 种 change type → agents)
- `/review` skill 有自己的 agent 选择逻辑
- `/feedback-triage` 又一套 severity + acceptance
- 13 agent 文件各自定义 output format

**After manifest**:

- ✓ 单一真实来源
- ✓ `check-drift.ts` 的 `manifest-consistency` 规则自动校验一致性
- ✓ 新增 agent 只需改 manifest + 创建文件，其他地方自动跟进

---

## 7. Workflow Receipts

**位置**: `.claude/receipts/`

每次 workflow 结束后生成结构化审计。

### 文件结构

```
.claude/receipts/
├── INDEX.md                                     # 累计一行摘要
├── 2026-04-12-1430-infra-harness-v2.md           # 单次 workflow 详细
├── 2026-04-12-1500-feature-essay-export.md
└── ...
```

### Receipt Schema

```yaml
# .claude/receipts/{YYYY-MM-DD}-{HHmm}-{branch}.md

# Workflow Receipt

Date: 2026-04-12T14:30:00
Branch: feature/add-essay-export
Workflow: review | feedback-triage | manual

## Change Classification
- Categories: [frontend, shared]
- Change type: full_stack

## Phase 1: Plan Review
| Agent | Status | Findings |
|-------|--------|----------|
| Architect | N/A | "No API changes" |
| Design Reviewer | DONE | 2 WARN (dark mode) |
| i18n Specialist | DONE | 0 issues |
| Security Reviewer | N/A | "No auth changes" |
| Test Engineer | DONE | 1 WARN (missing edge case) |

## Phase 2: Acceptance
| Agent | Status | Result |
|-------|--------|--------|
| Integration Checker | DONE | 0 issues |
| Test Engineer | DONE | All pass |
| User Journey Auditor | SKIP | "Not user-visible" |

## Summary (structured)
agents_run: 5
n_a_agents: 2
blocking_findings: 0
warning_findings: 3
info_findings: 0
acceptance_done: true
journeys_checked: 0
verification_passed: true
```

### 调用方

- `/review` skill 结束时自动生成
- `/feedback-triage` Stage 5 结束时
- 手动调用 `/workflow-receipt`

### 价值

1. **可追溯**: 每次变更有完整审查记录
2. **质量保证**: 强制记录 acceptance 是否完成
3. **团队协作**: PR review 时附上 receipt 作为质量证据

---

## 8. Hooks

**位置**: `.claude/settings.json` 的 `hooks` 键

### 当前 Hooks

| Hook 类型                        | 触发                           | 命令                                      | 目的                |
| -------------------------------- | ------------------------------ | ----------------------------------------- | ------------------- |
| `PostToolUse` (matcher: `Write`) | Claude 用 Write 写 .ts/.tsx 时 | `bash .claude/hooks/post-write-sensor.sh` | BRIEF.md drift 提醒 |

### post-write-sensor.sh 逻辑

```bash
1. 获取被写入的文件路径
2. 检查同级或父级是否有 BRIEF.md
3. 如果有 → 提醒 Claude 验证 BRIEF.md 是否仍准确
4. 如果没有 → 静默通过
```

**超时**: 5 秒
**状态消息**: "Checking BRIEF.md drift..."

### 为什么这个 hook

Claude 可能在修改 service 的内部实现时不会主动更新对应 BRIEF.md，这个 hook 作为 "post-generation sensor" 提醒。

### 扩展点

未来可添加的 hooks:

- `PreToolUse` (Write) — 确认文件大小未超限
- `SessionStart` — 读取 git status 生成当前变更摘要
- `Stop` — 生成 workflow receipt

---

## 9. Documentation Hierarchy

**整体层级**:

```
docs/                              # 101 个 .md (git-tracked)
├── architecture/                  # 架构全景 (新)
│   ├── ai-system.md              # AI 系统深度 (519 行)
│   ├── quality-gates.md          # 质量门禁 + 运行时 (新)
│   └── claude-harness.md         # 本文件
├── adr/                          # 16 个架构决策记录
│   ├── 0001-*.md ... 0016-*.md
│   └── README.md
├── REPO_SNAPSHOT.md              # 自动生成的数字快照
├── AI_AGENT_MEMORY_SYSTEM_SPEC.md  # AI 记忆系统规格 (2,865 行)
├── TESTING_CHECKLIST.md          # 测试清单 (1,788 行)
├── ARCHITECTURE.md               # 系统架构总论 (1,712 行)
├── TROUBLESHOOTING.md            # 故障排查 (930 行)
├── PREDICTION_SYSTEM.md          # 预测系统 (830 行)
└── ... (94 个其他文档)

CLAUDE.md                          # 根 (166 行) — Context Routing 中心
├── apps/api/CLAUDE.md            # 65 行
├── apps/web/CLAUDE.md            # 24 行
├── apps/mobile/CLAUDE.md         # 29 行
└── packages/shared/CLAUDE.md     # 18 行

.claude/                          # 本地配置 (gitignored)
├── rules/                        # 7 个静态规则
├── agents/                       # 13 个 agent 定义
├── skills/                       # 6 个 skill
├── manifests/
│   └── agent-workflow.yml       # 工作流 manifest
├── hooks/
│   └── post-write-sensor.sh
├── receipts/                     # Workflow 审计日志
└── settings.json                 # Claude Code 配置

BRIEF.md                          # 55 个 (28 backend + 27 frontend)
  每个模块/feature 目录一个
  ≤ 40 行 (governance)
```

### 统计

| 类别       | 数量    | 位置                              |
| ---------- | ------- | --------------------------------- |
| docs/ 文档 | **101** | `docs/`                           |
| ADR        | **16**  | `docs/adr/`                       |
| BRIEF.md   | **55**  | 28 backend + 27 frontend features |
| CLAUDE.md  | **5**   | root + 4 子目录                   |
| 规则文件   | **7**   | `.claude/rules/`                  |
| Agent 定义 | **13**  | `.claude/agents/`                 |
| Skill 定义 | **6**   | `.claude/skills/`                 |
| Manifest   | **1**   | `.claude/manifests/`              |

### 核心长文档引用关系

| 文档                        | 行数  | 从哪里引用                |
| --------------------------- | ----- | ------------------------- |
| AI_AGENT_MEMORY_SYSTEM_SPEC | 2,865 | ai-agent/BRIEF.md         |
| TESTING_CHECKLIST           | 1,788 | rules/testing.md          |
| claude-code-architecture    | 1,779 | (onboarding 资料)         |
| ARCHITECTURE                | 1,712 | rules/backend.md          |
| TROUBLESHOOTING             | 930   | rules/ci-cd.md            |
| PREDICTION_SYSTEM           | 830   | CLAUDE.md Context Routing |
| ENGINEERING_STANDARDS       | 671   | rules/backend.md          |

---

## 10. 文档治理门禁

**防文档膨胀** — 所有限制由 `check-drift.ts` 自动校验。

| 规则                                       | 限制                                                 | 当前状态              |
| ------------------------------------------ | ---------------------------------------------------- | --------------------- |
| 根 `CLAUDE.md`                             | ≤ 190 行                                             | **166** ✓ (24 行余量) |
| `.claude/rules/*.md`                       | ≤ 150 行                                             | 全部 ≤ 116 ✓          |
| 子目录 `CLAUDE.md` (api/web/mobile/shared) | ≤ 80 行                                              | 最大 65 ✓             |
| `BRIEF.md` 单文件                          | ≤ 40 行                                              | 全部 ✓                |
| CLAUDE.md vs docs/ 重复                    | 0 行 (>10 行 → 链接引用)                             | ✓                     |
| Agent 清单一致性                           | `.claude/agents/` 文件数 == manifest == CLAUDE.md 表 | 13 == 13 == 13 ✓      |
| Context Routing 路径可达                   | 100%                                                 | ✓ (glob 模式跳过)     |

### 超限应对

| 文件                 | 超限后应该做什么                           |
| -------------------- | ------------------------------------------ |
| 根 CLAUDE.md         | 拆分到 `.claude/rules/` 或子目录 CLAUDE.md |
| `.claude/rules/*.md` | 拆分为多个 rule 文件                       |
| 子目录 CLAUDE.md     | 精简或移到 BRIEF.md                        |
| BRIEF.md             | 只保留"不知道会犯错"的内容                 |

---

## 关联文档

- [ai-system.md](./ai-system.md) — AI 系统深度架构 (519 行)
- [quality-gates.md](./quality-gates.md) — 质量门禁 + 运行时 (~450 行)
- [../adr/0010-governance-automation.md](../adr/0010-governance-automation.md) — 治理自动化决策
- [../TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) — 测试清单
- `.claude/manifests/agent-workflow.yml` — Agent workflow manifest (本地)

---

<!-- 生成于 2026-04-12 全面重构 -->
