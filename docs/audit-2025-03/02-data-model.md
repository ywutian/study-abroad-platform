# 数据模型问题

> Schema 文件: `apps/api/prisma/schema.prisma` (2,471 行, 83 模型, 37 枚举)

---

## D1：31 个模型缺少 updatedAt 🔴

以下模型只有 `createdAt` 没有 `updatedAt @updatedAt`：

RefreshToken, SchoolMetric, TeamInvitation, ProfileTargetSchool, PredictionSnapshot, Follow, Block, ConversationParticipant, Message, ReviewReaction, UserListVote, Report, AuditLog, AgentMessage, AgentTokenUsage, AgentAuditLog, AgentSecurityEvent, AgentConfigVersion, MemoryCompaction, ForumLike, TeamApplication, CaseSwipe, PointHistory, EssayPromptSource, EssayPipelineRun, EssayPromptAudit, SchoolRecommendation, EssayAIResult, CaseView, ResumeSnapshot, ResumeAIReview

**影响**: 无法追踪记录变更时间，影响审计、缓存失效、数据同步。

**修复**: Migration 添加 `updatedAt DateTime @updatedAt` 到所有 31 个模型。对于只读表（AuditLog、PointHistory）可以不加。

---

## D2：4 个模型缺少 createdAt 🔴

TeamMembership, TeamMember, SwipeStats, AssessmentResult

**修复**: 添加 `createdAt DateTime @default(now())`

---

## D3：外键缺少索引（10+ 处）🟠

| 模型                    | 缺少索引                         | 影响                   |
| ----------------------- | -------------------------------- | ---------------------- |
| PeerReview              | `[reviewerId]`, `[revieweeId]`   | 查询用户的互评列表     |
| ProfileTargetSchool     | `[profileId]`, `[schoolId]`      | 查找目标学校的用户     |
| ApplicationTimeline     | `[schoolId]`                     | 按学校查询截止日期     |
| SchoolListItem          | `[schoolId]`                     | 查找添加了某学校的用户 |
| PointHistory            | `[action]`, `[createdAt]`        | 排行榜和趋势查询       |
| AgentTokenUsage         | `[userId, agentType, createdAt]` | 按 Agent 追踪 token    |
| ConversationParticipant | `[userId]`                       | 列出用户的对话         |

**影响**: 这些字段经常出现在 WHERE/ORDER BY 中，缺索引会导致全表扫描。

---

## D4：缺少复合索引（8 处）🟠

| 模型        | 推荐索引                       | 场景                          |
| ----------- | ------------------------------ | ----------------------------- |
| EssayPrompt | `[schoolId, year, type]`       | "MIT 2024 年的补充文书有哪些" |
| User        | `[deletedAt, isBanned]`        | 软删除 + 封禁查询             |
| School      | `[country, tier]`              | 按国家和层级筛选              |
| School      | `[usNewsRank, acceptanceRate]` | 排名+录取率联合查询           |
| Memory      | 合并 5 个重叠索引              | 减少索引维护开销              |

Memory 模型当前有 5 个重叠索引：

```
@@index([userId])
@@index([userId, type])
@@index([userId, importance(sort: Desc)])
@@index([userId, type, importance(sort: Desc)])  ← 包含了前两个
@@index([userId, category])
```

可合并为 2-3 个。

---

## D5：超大模型 🟡

| 模型          | 字段数        | 建议                                             |
| ------------- | ------------- | ------------------------------------------------ |
| School        | 72            | 考虑拆分为 School + SchoolMetrics + SchoolConfig |
| User          | 63 (含 22 FK) | 监控，暂不拆                                     |
| Profile       | 38            | 合理                                             |
| AdmissionCase | 34            | 合理                                             |

School 模型最大问题是同时包含基础信息、统计指标、录取数据、配置项。如果查询量增长，读写分离会有帮助。

---

## D6：TEXT 字段无长度限制（13 处）🟡

使用 `@db.Text` 但无上限的字段：

- School: `description`, `descriptionZh`, `metadata` (JSON)
- AdmissionCase: `activityList`, `awardList`
- Essay/EssayExample: content 字段
- AI Agent: payload 字段

**风险**: 恶意用户或爬虫可提交超大文本，导致存储膨胀和查询变慢。

**修复**: 在 DTO 层用 `@MaxLength()` 限制（前端+后端），Schema 层保持 TEXT 但靠应用层控制。

---

## D7：pgvector 索引未配置 🟡

Memory 模型的 `embedding` 字段：

```prisma
embedding Unsupported("vector(1536)")?  // optional，应为 required
```

**问题**:

- 无 HNSW 或 IVFFlat 向量索引 → 语义搜索是全表扫描
- 字段是 optional → 部分记录无 embedding，搜索不完整
- 无 migration 显式创建 `CREATE EXTENSION IF NOT EXISTS vector`

**修复**:

1. 添加 HNSW 索引（需手动 SQL migration）
2. 评估是否改为 required（需要回填已有记录的 embedding）

---

## D8：ForumPost onDelete: Restrict 🟡

```prisma
ForumPost → ForumCategory @relation(onDelete: Restrict)
```

删除分类时会报错，而非级联删除或设为 null。管理员无法清理无用分类。

**修复**: 改为 `SetNull`（帖子保留但分类为空）或 `Cascade`（连帖子一起删）。

---

## D9：Team 系统重复 🟡

存在两套团队机制：

1. **独立 Team 模型**: `Team` + `TeamMembership` + `TeamMember`
2. **Forum 内 Team**: `TeamInvitation` + `TeamApplication`（在 ForumPost 上下文中）

定位不清，可能是不同阶段开发遗留。

**建议**: 确认哪套是需要的，删除另一套。或统一为一个 Team 系统。

---

## D10：Review vs PeerReview 两套评审 🟡

- `Review`：档案互评（在 Hall 模块中）
- `PeerReview`：文书互评（独立 peer-review 模块）

结构相似但独立。可能是有意为之（评审对象不同），但增加了维护负担。

**建议**: 评估是否合并为一个 Review 模型 + type 字段区分。
