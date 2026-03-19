# AI 系统架构问题

> 范围: 7 个 AI 模块 · 28 个 AiService 调用点 · 49 个 Agent 工具 · 6 个 Agent 类型

---

## A1：双轨 LLM 调用 — 50% token 不可见 🔴

### 现状

系统存在两条并行的 LLM 调用路径：

|            | 管理路径 (LLMService)            | 非管理路径 (AiService)      |
| ---------- | -------------------------------- | --------------------------- |
| Token 追踪 | ✅ tiktoken + AgentTokenUsage 表 | ❌ 无（部分模块用粗略估算） |
| 韧性保护   | ✅ 重试 + 熔断器 + 超时          | ❌ 无保护                   |
| 配额控制   | ✅ 日/月 token 限额              | ❌ 完全绕过                 |
| 使用范围   | Agent 编排系统                   | **11 个服务，28 个调用点**  |

### 28 个调用点分布

| 消费者                      | 方法                                                              | 数量 |
| --------------------------- | ----------------------------------------------------------------- | ---- |
| `ai.controller.ts`          | reviewEssay, polishEssay (deprecated), rewrite, continue, opening | 5    |
| `essay-ai.service.ts`       | polishEssay, chat × 5                                             | 6    |
| `recommendation.service.ts` | chat                                                              | 1    |
| `prediction.service.ts`     | chat                                                              | 1    |
| `profile.controller.ts`     | analyzeProfileDetailed                                            | 1    |
| `resume.service.ts`         | reviewResume                                                      | 1    |
| Agent 工具服务 × 7          | chat × 12, 间接 × 1                                               | 13   |

### 影响

- Admin AI Analytics 面板看不到约 50% 的实际 token 消耗和成本
- `AiService` 无熔断器，LLM 供应商超时时会引发重试风暴
- 用户配额只限制 Agent 调用，直接调用无限制

### 修复方案

在 `AiService.chat()` 内部加入 ResilienceService + TokenTrackerService，不需要改任何消费者：

```typescript
// ai.service.ts - chat() 改造
async chat(messages, options) {
  // 1. 韧性保护
  const result = await this.resilience.execute(() =>
    this.provider.chat(messages, options)
  );
  // 2. Token 追踪
  if (this.tokenTracker) {
    await this.tokenTracker.track({
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      model: options?.model,
      source: 'ai-service',
      userId: options?.userId,
    }).catch(err => this.logger.warn('Token tracking failed', err));
  }
  return result.content;
}
```

### 涉及文件

- `apps/api/src/modules/ai/ai.service.ts` — chat() 加入 resilience + tracking
- `apps/api/src/modules/ai/ai.module.ts` — 注入 TokenTrackerService（@Optional）

### 工作量: 小

---

## A2：AiService God Service（1,745 行）🟠

### 现状

`AiService` 本该是薄 LLM 抽象层（只有 `chat()`），但塞进了三个领域的业务逻辑：

| 领域 | 方法                                                                                                                         | 行数估算 | 应在哪个模块 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| 文书 | `polishEssay()`, `reviewEssay()`, `rewriteParagraph()`, `continueWriting()`, `generateOpening()`, `analyzeEssayParagraphs()` | ~600 行  | `essay-ai/`  |
| 档案 | `analyzeProfileDetailed()` (红黄绿评分，4 维度)                                                                              | ~300 行  | `profile/`   |
| 简历 | `reviewResume()`, `optimizeResumeBullets()`, `suggestSectionContent()`                                                       | ~400 行  | `resume/`    |

加上 `ai.controller.ts` 暴露 5 个端点：

- `POST /ai/review-essay` — deprecated ⚠️
- `POST /ai/polish-essay` — deprecated ⚠️
- `POST /ai/rewrite-paragraph` — active
- `POST /ai/continue-writing` — active
- `POST /ai/generate-opening` — active

**前端 `essays/page.tsx` 仍在调用所有 5 个 `/ai/*` 路由。**

### 修复方案

1. 文书方法 → `EssayAiService`，新增 `/essay-ai/rewrite`、`/essay-ai/continue`、`/essay-ai/opening`
2. 档案分析 → `ProfileService.analyzeProfileDetailed()`
3. 简历方法 → `ResumeService`
4. 删除 `ai.controller.ts` 整个文件
5. AiService 最终只保留 `chat()`
6. 前端 `essays/page.tsx` 全部 5 个 mutation 迁移到 `/essay-ai/`
7. Agent 工具服务中调用 `aiService.polishEssay()` 等 → 改为调用领域服务

### 涉及文件

- `apps/api/src/modules/ai/ai.service.ts` — 删除业务方法（~1,300 行）
- `apps/api/src/modules/ai/ai.controller.ts` — 删除
- `apps/api/src/modules/ai/ai.controller.spec.ts` — 删除或迁移
- `apps/api/src/modules/ai/ai.module.ts` — 简化
- `apps/api/src/modules/essay-ai/essay-ai.service.ts` — 接收文书方法
- `apps/api/src/modules/essay-ai/essay-ai.controller.ts` — 新增 3 个端点
- `apps/api/src/modules/profile/profile.service.ts` — 接收 analyzeProfileDetailed
- `apps/api/src/modules/profile/profile.controller.ts` — 改注入源
- `apps/api/src/modules/resume/resume.service.ts` — 接收简历方法
- `apps/api/src/modules/ai-agent/tools/essay-tools.service.ts` — 改调用目标
- `apps/api/src/modules/ai-agent/tools/recommendation-tools.service.ts` — 检查
- `apps/web/src/app/[locale]/(main)/essays/page.tsx` — API 路径迁移

### 工作量: 中

---

## A3：Prompt 散落 + 重复 🟡

### 现状

40+ 个 prompt 散布在 18+ 个文件中。

**关键重复**:

- `essay-ai.service.ts` 的 `reviewEssay()` (行168-214) 和 `reviewEssayDirect()` (行603-643) **几乎完全相同**
- `brainstormIdeas()` 和 `brainstormDirect()` 同样重复

**业务逻辑不一致**:

- Tier 定义：
  - Prediction: Reach (<30%), Match (30-70%), Safety (>70%)
  - Recommendation: Reach ~30%, Match ~40%, Safety ~30% 分布
  - Orchestrator: 隐式（无具体数值）
- 评分维度：
  - Profile: academic, testScores, activities, awards (4 维)
  - Essay: clarity, uniqueness, storytelling, fit, language (5 维)
  - Ranking: 6+ 维

**组织良好的部分（不需要改）**:

- `agents.config.ts` — 6 agent 双语 prompt
- `prediction/prompt-builder.ts` — 独立文件管理复杂 prompt

### 修复方案

1. `essay-ai.service.ts` 重复 prompt 抽取为 `essay-ai.prompts.ts` 常量
2. Tier 定义抽取到 `packages/shared/src/constants/tiers.ts`
3. `summarizer.service.ts` 的 `fetch()` → `AiService.chat()`
4. 工具服务的内联 prompt 考虑抽取到 `tools/prompts/` 目录

### 工作量: 小

---

## A4：前端 AI 入口碎片化（8 个独立界面）🟡

### 现状

| 入口                  | 传输                | 状态管理               | Timeout   | 错误边界 |
| --------------------- | ------------------- | ---------------------- | --------- | -------- |
| Essays 页（6 dialog） | apiClient → `/ai/*` | 6 × useMutation        | 120s      | ❌       |
| FloatingChat          | fetch + SSE         | useAgentChat           | 60s/chunk | ❌       |
| AiAssistantPanel      | fetch + SSE         | useAgentChat           | 60s/chunk | ❌       |
| Prediction            | apiClient           | useQuery + useMutation | 120s      | ❌       |
| Recommendation        | apiClient           | useQuery               | 120s      | ❌       |
| Profile 分析          | apiClient           | useQuery               | 120s      | ❌       |
| Essay Gallery         | apiClient           | useQuery               | ❌ 无     | ❌       |
| **Mobile AI**         | **完全独立**        | useState               | ❌ 无     | ❌       |

**具体问题**:

- FloatingChat + AiAssistantPanel 通过 CustomEvent `_handled` flag 协调，有竞态条件
- `AIErrorBoundary` 组件定义了但**从未在任何 AI 组件上使用**
- Mobile 完全独立实现（不同端点、流式处理、状态管理）
- 无统一 AI 请求队列

### 短期修复（跟随 A2 一起做）

1. 给缺失 timeout 的 mutation 补上 `AI_TIMEOUTS.AI_REQUEST`
2. 用 `AIErrorBoundary` 包裹所有 AI 功能组件
3. Essays 页面 API 路径从 `/ai/` 迁移到 `/essay-ai/`

### 长期（单独项目）

- 统一前端 AI 请求队列
- 合并 FloatingChat/AiAssistantPanel 的事件协调机制
- Mobile 与 Web 的 AI hook 共享

### 工作量: 短期小 / 长期大
