# 实施优先级路线图

---

## Phase 1：立即（安全 + 数据完整性）

> 预计工作量：1-2 天

| #   | 改动                                                 | 工作量 | 文件              |
| --- | ---------------------------------------------------- | ------ | ----------------- |
| S1  | 修复邮箱验证绕过（`emailVerified: false` + env var） | 极小   | `auth.service.ts` |
| S2  | `findByEmail()` 加 `deletedAt: null`                 | 极小   | `user.service.ts` |
| F2  | 修复 SwipeStack dynamic Tailwind → 静态类名映射      | 极小   | `SwipeStack.tsx`  |
| S5  | npm audit 改为阻断 CI                                | 极小   | `ci.yml`          |
| S6  | CI 加 Docker 镜像扫描                                | 极小   | `ci.yml`          |
| D1  | 31 个模型补 `updatedAt`（Prisma migration）          | 小     | `schema.prisma`   |
| D2  | 4 个模型补 `createdAt`                               | 小     | `schema.prisma`   |
| D3  | 补外键索引（PeerReview, ProfileTargetSchool 等）     | 小     | `schema.prisma`   |

### 验证

```bash
pnpm test
pnpm lint:all
pnpm --filter api db:migrate -- --name add_timestamps_and_indexes
npx prisma validate
# 注册新用户 → 确认 emailVerified: false
# 生产构建 → 确认 SwipeStack 样式正确
```

---

## Phase 2：短期（结构优化）

> 预计工作量：3-5 天

| #   | 改动                                              | 工作量 | 关键文件                                                      |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------------- |
| A1  | AiService.chat() 加韧性 + token 追踪              | 小     | `ai.service.ts`, `ai.module.ts`                               |
| S4  | Summarizer fetch() → AiService.chat()             | 小     | `summarizer.service.ts`                                       |
| S3  | 统一积分 refund 模式（PointsRefundHelper + 重试） | 小     | `essay-ai/`, `recommendation/`, `case-gallery/`               |
| A2  | 瘦身 AiService：文书方法 → essay-ai               | 中     | 见 [03-ai-architecture.md](03-ai-architecture.md) A2 文件列表 |
| A2  | 瘦身 AiService：档案分析 → profile                | 小     | `profile.service.ts`, `profile.controller.ts`                 |
| A2  | 瘦身 AiService：简历方法 → resume                 | 小     | `resume.service.ts`                                           |
| A2  | 删除 `ai.controller.ts` + 前端路由迁移            | 小     | `essays/page.tsx` → `/essay-ai/`                              |
| A3  | essay-ai 重复 prompt 抽取常量                     | 小     | `essay-ai.prompts.ts` (新文件)                                |
| D4  | 补复合索引                                        | 小     | `schema.prisma`                                               |
| D7  | pgvector HNSW 索引                                | 小     | SQL migration                                                 |
| I3  | Docker 加 HEALTHCHECK                             | 极小   | `Dockerfile`                                                  |

### 验证

```bash
pnpm test
pnpm lint:all
# Admin AI Analytics → 确认能看到所有 LLM 调用 token
# 手动测试 essay-ai 全部端点（review/polish/rewrite/continue/opening/brainstorm）
# 手动测试 profile AI analysis
# Agent chat 流式测试
# 积分扣除 → 人为制造 LLM 失败 → 确认 refund 重试成功
grep -r "/ai/review-essay\|/ai/polish-essay\|/ai/rewrite\|/ai/continue\|/ai/generate-opening" apps/web/
# 预期：无匹配结果
```

---

## Phase 3：中期（功能完善）

> 预计工作量：2-3 周

| #   | 改动                                        | 工作量 | 目标                                         |
| --- | ------------------------------------------- | ------ | -------------------------------------------- |
| B1  | 积分系统接入剩余动作                        | 中     | SUBMIT_CASE, COMPLETE_PROFILE, REFER_USER 等 |
| B4  | Admin 补 impersonate + Case 审核 + 健康面板 | 中     | 核心管理能力                                 |
| F1  | Mobile 4 个大页面拆分                       | 中     | hall/recommendation/swipe/gallery            |
| F3  | 迁移到 next/image                           | 小     | 图片优化                                     |
| F4  | Accessibility 审查 + aria-label 补全        | 中     | 可访问性                                     |
| A4  | 前端补 timeout + AIErrorBoundary            | 小     | AI 稳定性                                    |
| I1  | CI 加 CodeQL/SAST                           | 小     | 代码安全扫描                                 |
| I2  | 加 Staging 环境                             | 中     | 部署安全                                     |
| I4  | Cloud Run min-instances=1                   | 极小   | 消除冷启动                                   |

---

## Phase 4：长期（质量提升）

> 预计工作量：持续

| #   | 改动                                            | 工作量 | 目标         |
| --- | ----------------------------------------------- | ------ | ------------ |
| B2  | Notification 加持久化 + email/push              | 大     | 通知可靠性   |
| B3  | Subscription 接入真实支付                       | 大     | 商业化       |
| D9  | 统一 Team 系统                                  | 中     | 消除重复     |
| D10 | 统一 Review/PeerReview                          | 中     | 消除重复     |
| F5  | Web/Mobile 代码共享层                           | 大     | 减少重复开发 |
| C   | 补充测试覆盖（prediction/memory/chat/forum 等） | 大     | 长期可维护性 |
| A4  | 前端 AI 入口统一重构                            | 大     | UX 一致性    |

---

## 依赖关系

```
Phase 1 (安全+数据) → 无前置依赖，可立即开始
  │
  ├── D1+D2+D3+D4 (Schema 改动) → 一次 migration 搞定
  │
Phase 2 (结构) → Phase 1 完成后
  │
  ├── A1 (token 追踪) → 独立，可先做
  ├── S3 (refund 统一) → 独立
  ├── A2 (瘦身 AiService) → 最大改动，需要仔细
  │   ├── 先迁移文书方法
  │   ├── 再迁移档案/简历
  │   └── 最后删 controller + 前端迁移
  └── A3 (prompt 抽取) → 跟 A2 一起做

Phase 3 (功能) → Phase 2 完成后
  │
  ├── B1 (积分接入) → 独立
  ├── B4 (Admin 补全) → 独立
  ├── F1 (Mobile 拆分) → 独立
  └── I1+I2 (CI 增强) → 独立

Phase 4 (质量) → 持续进行
```

---

## 跟踪方式

每个 Phase 完成后：

1. 在此文件对应 Phase 下标注 ✅
2. 运行完整验证命令
3. 创建 git tag: `audit-phase-N-complete`
