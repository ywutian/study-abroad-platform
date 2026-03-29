# 全面完善计划

> 基于 2026-03-29 的系统审计、用户旅程审计、AI 质量审计的综合成果。

## 已完成（本轮 21 commits）

### 基础设施

- [x] 并行工具执行（读写分离，35 个 readonly 工具并行）
- [x] 语义路由（EmbeddingRouter + pgvector，shadow 模式）
- [x] 自建 LLM 调用追踪（替代 Langfuse，admin LLM Calls tab）
- [x] 路由层 + critique 指标追踪
- [x] 8 条 governance 规则（含 3 条新增安全规则）
- [x] CVE 修复（handlebars, path-to-regexp）
- [x] Gemini Code Assist PR 审查
- [x] LLM 成本计算（estimateCost 修复）
- [x] providerOptions denylist 安全修复

### AI Agent 质量

- [x] Chain-of-Verification（替代简单 critique）
- [x] Graph Memory（PostgreSQL 递归 CTE）
- [x] MCP Server（42 工具 stdio 暴露）
- [x] Profile 预加载到 system prompt
- [x] 主动截止日期提醒（scheduler）
- [x] RESUME prompt 改为大学申请格式
- [x] ESSAY prompt 加 Common App 规范检查
- [x] SCHOOL 推荐注入历史案例
- [x] PROFILE 分析注入学校对比数据
- [x] TIMELINE 个性化进度评估
- [x] 对话历史智能压缩

### Bug 修复（18 个）

- [x] 并发请求对话级锁
- [x] 推荐结果 Redis 缓存
- [x] Solve 空回复兜底
- [x] 截止日期过期标注
- [x] 搜索零结果提示
- [x] 文书长度限制
- [x] 时间线过去日期校验
- [x] Context window 溢出预检
- [x] WebSocket 断开检测
- [x] Profile 更新字段校验
- [x] 空消息 DTO 校验
- [x] 语言切换连贯性
- [x] 语言自动检测
- [x] 越界问题分层处理
- [x] Action 按钮显式返回
- [x] 新用户引导持久化
- [x] GPA 百分制/IB/A-Level 后端 bug 修复
- [x] SAT 最低分动态校验

### UX 改进（6 个）

- [x] 对话历史压缩（旧消息截断）
- [x] 错误恢复带工具信息
- [x] 新用户 profile 引导
- [x] 批量内容审核
- [x] 引导 localStorage 持久化
- [x] 论坛批量操作端点

### 框架

- [x] 用户旅程审计框架（Agent #13 + 模板 + 记录）
- [x] 19 条旅程 100% 覆盖

---

## 未完成 / 后续优化

### P0: 产品核心（直接影响用户决策）

| #   | 任务                                                                    | 类型    | 依赖                 |
| --- | ----------------------------------------------------------------------- | ------- | -------------------- |
| 1   | **react-hook-form + Zod 迁移 profile 表单**                             | 前端    | 无                   |
|     | 8 个 tab 组件迁移到 react-hook-form，加内联校验、必填标记、tab 错误指示 |         |                      |
| 2   | **SCHOOL 推荐：显示录取+拒绝案例对比**                                  | AI+后端 | 历史案例已注入       |
|     | 留学专家建议：分析录取者 vs 拒绝者差异，按国籍/高中类型分段             |         |                      |
| 3   | **ESSAY：supplement essay 按学校查 word limit**                         | AI+后端 | essay_prompts 表已有 |
|     | 每个学校的 supplement 字数限制不同，review 时应自动查询并检查           |         |                      |
| 4   | **PREDICTION 结果追踪**                                                 | 后端    | 无                   |
|     | 记录预测结果 vs 实际录取结果，用于校准和反馈循环                        |         |                      |

### P1: 用户体验

| #   | 任务                                                                  | 类型      | 依赖         |
| --- | --------------------------------------------------------------------- | --------- | ------------ |
| 5   | **首次使用强制引导优化**                                              | 前端      | 无           |
|     | 当前引导可跳过（已做 localStorage）。可考虑侧边栏进度徽章作为温和提醒 |           |              |
| 6   | **家长角色（产品决策）**                                              | 全栈      | 产品决策     |
|     | 是否做 PARENT 角色 + 账号关联？需要先决策再设计                       |           |              |
| 7   | **Admin 内容审核工作流**                                              | 前端+后端 | 批量操作已做 |
|     | 加优先级队列、自动分配、审核统计仪表盘                                |           |              |
| 8   | **Admin 学校数据：scrape 确认对话框**                                 | 前端      | 无           |
|     | 数据抓取前加确认（可能覆盖手动编辑）                                  |           |              |
| 9   | **Admin 学校数据：长任务进度指示**                                    | 前端+后端 | 无           |
|     | scrape/sync 任务加 WebSocket 进度推送                                 |           |              |

### P2: AI 系统深化

| #   | 任务                                                                         | 类型 | 依赖                         |
| --- | ---------------------------------------------------------------------------- | ---- | ---------------------------- |
| 10  | **语义路由激活**                                                             | 后端 | 需要先收集路由指标数据       |
|     | 当 FastRouter fallback > 30% 时，跑 seed-route-embeddings.ts，切 active 模式 |      |                              |
| 11  | **SCHOOL 反思数据验证**                                                      | 后端 | 需要先收集 critique 指标数据 |
|     | 当 critique 不通过率 > 5% 时保留反思；否则关闭（enableReflection: false）    |      |                              |
| 12  | **Graph Memory 集成到 Agent 工具**                                           | 后端 | Graph Memory 表已建          |
|     | 新增 `find_similar_applicants` 工具，调用递归 CTE 查询                       |      |                              |
| 13  | **MCP Server 认证完善**                                                      | 后端 | MCP Server 已建              |
|     | 当前用环境变量传 userId，需要加 API Key 认证映射                             |      |                              |
| 14  | **ESSAY 声音真实性检测**                                                     | AI   | 无                           |
|     | 设计审查建议：加 "authenticity" 维度，检测是否像成人代笔                     |      |                              |

### P3: 基础设施 & 运维

| #   | 任务                                                                              | 类型   | 依赖        |
| --- | --------------------------------------------------------------------------------- | ------ | ----------- |
| 15  | **Staging 环境配置**                                                              | DevOps | GCP Console |
|     | 配置 study-abroad-api-staging 的环境变量，启用 preview deploy                     |        |             |
| 16  | **Governance 规则扩展**                                                           | 脚本   | 无          |
|     | 现有 8 条规则只覆盖 ai-agent + 安全。可扩展到：frontend 组件模式、i18n 完整性     |        |             |
| 17  | **scripts/eval/ 接入 CI**                                                         | CI     | 无          |
|     | 已有 dataset.json + run-eval.ts，但未接入 CI。替代已删除的 Promptfoo workflow     |        |             |
| 18  | **前端动态 Tailwind class 修复**                                                  | 前端   | 无          |
|     | 设计审查发现 onboarding-guide.tsx 和 ProfileTabNav.tsx 有 `${step.gradient}` 插值 |        |             |

### P4: 待产品决策

| #   | 任务              | 决策点                                  |
| --- | ----------------- | --------------------------------------- |
| 19  | 家长角色 (PARENT) | 是否做？做到什么程度？                  |
| 20  | 移动端功能差异    | 功能已齐全，但体验需审计（A11 已 PASS） |
| 21  | 付费/订阅体系     | 与 AI 用量限制的关系                    |

---

## 建议执行顺序

### 下一个 Sprint（1-2 周）

1. **P0-1**: Profile 表单 react-hook-form 迁移（最大前端改善）
2. **P0-4**: Prediction 结果追踪（数据反馈闭环）
3. **P2-10/11**: 收集路由/critique 指标后决策（需要跑一段时间）

### 后续 Sprint（2-4 周）

4. **P0-2**: SCHOOL 录取+拒绝案例对比
5. **P0-3**: ESSAY supplement word limit
6. **P2-12**: Graph Memory 工具集成
7. **P3-15**: Staging 环境

### 长期

8. **P1-6**: 家长角色（等产品决策）
9. **P2-13**: MCP Server 认证
10. **P3-17**: scripts/eval 接入 CI

---

## 质量指标追踪

| 指标              | 当前                 | 目标           |
| ----------------- | -------------------- | -------------- |
| 用户旅程覆盖率    | 100% (19/19)         | 维持 100%      |
| AI 输出质量平均分 | 4.1/5                | >4.3/5         |
| CI 全绿           | E2E 偶发 flaky       | 稳定全绿       |
| 治理规则数        | 8                    | 12+            |
| 测试覆盖率        | 1887 tests           | 2000+          |
| 开放 Gap 数       | 2 (B1 家长, B3 关联) | 0 (需产品决策) |
