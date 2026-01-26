# 变更日志

本文档遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [Unreleased]

### 文档

- **全量文档审计（6 轮，270+ 修正）** — 48+ 份文档逐一对照源码验证并修正事实性错误
  - Round 1 (19 fixes): ARCHITECTURE.md、API_REFERENCE.md、根 README、docs/README.md
  - Round 2 (55+ fixes): AI_AGENT_MEMORY_SYSTEM_SPEC.md、AI_AGENT_ARCHITECTURE.md、ENTERPRISE_AI_SOLUTION.md、ENTERPRISE_MEMORY_SYSTEM.md
  - Round 3 (67 fixes): PREDICTION_SYSTEM.md、SCORING_SYSTEM.md、COMPETITION_DATABASE.md、DATA_SOURCES.md、DATA_VERIFICATION.md、PRODUCT_ROADMAP.md、INVESTOR_PITCH_AI_SYSTEM.md、GLOSSARY.md (32 新术语)
  - Round 4 (70+ fixes): CONTRIBUTING.md、ONBOARDING.md、DOCUMENTATION_STANDARDS.md、I18N_GUIDE.md、DESIGN_SYSTEM.md、TYPOGRAPHY_GUIDE.md、DEPLOY.md、RUNBOOK.md、ENV_TEMPLATE.md、TESTING_CHECKLIST.md、QUALITY_CHECK.md、.env.example
  - Round 5 (56+ fixes): ADR-0001/0003/0004-0007、已知问题与解决方案.md、数据库迁移记录.md、SECURITY.md、CHANGELOG.md；完整重写 apps/api/README.md、apps/web/README.md、apps/mobile/README.md
  - Round 6: 全局一致性检查、DORA 重评 (37→38/40, 92.5%→95.0%)
- 新增 [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) — 一页速查手册（命令、端口、目录结构等）
- 新增 [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 开发环境常见问题排障指南
- DORA 文档质量评分提升：37/40 (92.5%) → 38/40 (95.0%)，可理解性维度 4→5

### 修复

- 邮箱验证流程修复：验证链接正确指向 `/verify-email/callback`，回调页面实际调用后端 API 完成验证
- 重新发送验证邮件按钮功能接入（含 60 秒冷却倒计时）
- 登录页处理 `?verified=true` / `?error=invalid_token` 查询参数，显示对应提示
- 登录后检测邮箱未验证状态，显示警告提示并提供重新发送入口
- Auth DTO 整合：移除控制器内联 DTO 定义，统一使用 `dto/` 目录下带企业级校验的 DTO 类

### 新增

- **移动端实时聊天**：Socket.IO 聊天、生物识别认证、新屏幕 (feat(mobile))
- **Web 管理后台**：管理仪表盘、流式 Markdown 渲染、订阅 UI (feat(web))
- **支付系统**：API 支付模块、文书爬取管道、管理增强 (feat(api))
- **排名对比增强**：后端返回竞争者分数分布（p25/p50/p75）、汇总统计（均分/中位数/人数）、竞争力定位（strong/moderate/challenging）
- **排名对比 UI 重构**：汇总统计头部（ProbabilityRing 平均百分位、总竞争者、最佳学校、综合竞争力标签）、维度分布条可视化、排序控制（百分位/得分/人数）
- **记忆层增强**：排名查询时保存竞争力洞察（最强/最弱维度、竞争力定位）到记忆系统，提升 AI 智能体上下文
- **排名测试数据**：`seed-ranking-test.ts` 生成 15 个多层次学生档案，覆盖 10 所目标学校，每校 8-12 名竞争者
- 企业级文档标准化：LICENSE (Proprietary)、SECURITY.md、CONTRIBUTING.md、CHANGELOG.md
- ADR（架构决策记录）流程：9 条 ADR (0001-0009)
  - ADR-0004: Zod 环境变量校验策略
  - ADR-0005: 生产环境安全头配置 (Helmet CSP + HSTS)
  - ADR-0006: Prisma 异常处理策略 (错误码映射)
  - ADR-0007: API 响应元数据注入 (correlationId + responseTimeMs)
  - ADR-0008: 预测多引擎集成策略
  - ADR-0009: 功能大厅 Swipe UI 重构
- GitHub Issue/PR 模板
- API 参考文档、术语表、运维手册、新人指南
- 文档规范元标准（DORA 8 项指标自评，当前 37/40 = 92.5%）
- Swagger UI 重新启用（try/catch 容错，开发环境 `/api/docs`）
- Husky + lint-staged + commitlint pre-commit hooks
- `.editorconfig` 跨编辑器格式一致性
- CI 文档同步检查 + PR 并发控制
- Health 端点构建元数据注入（commit SHA、构建时间）
- 全局请求超时中间件（普通 30s / AI 120s，可配置）
- Prisma 慢查询监控中间件（阈值可配置，默认 200ms WARN）
- CORS `exposedHeaders`：客户端可读取 X-Correlation-Id、X-Response-Time、X-RateLimit-\*

### 安全

- Helmet 生产环境 CSP (Content Security Policy) + HSTS + frameguard + referrer-policy
- 请求体大小限制 (10MB JSON/URL-encoded)
- Sentry 敏感数据过滤 (Authorization/Cookie headers)
- 未处理异常/Promise Rejection 全局捕获
- PII 日志脱敏扩展：新增 email、phone、mobile、address、dateOfBirth、passport、nationalId、parentEmail、parentPhone、guardianName、emergencyContact 等 15+ 字段
- CORS allowedHeaders 增加 X-Correlation-Id

### 变更

- CI 触发条件扩展至 `feature/**`、`fix/**`、`release/**` 分支 PR
- 所有 `package.json` 统一 `license: "UNLICENSED"`
- 异常过滤器升级：Prisma 异常分类处理 (P2002/P2025/P2003 等)、生产环境错误屏蔽、correlationId 注入
- 环境变量启动验证升级为 Zod Schema（类型校验 + 生产环境警告）
- API 响应体统一注入 `meta.correlationId` + `meta.responseTimeMs` + `X-Response-Time` 头
- Sentry 增加 release 追踪、serverName、initialScope tags
- Jest 测试覆盖率门槛：statements 60%、branches 50%、functions 50%、lines 60%
- 优雅停机：30s 超时强制退出、SIGTERM/SIGINT 处理
- 部署流程：staging smoke test (health/readiness/security headers 验证) → production 手动审批
- ENV*TEMPLATE.md 与 Zod Schema 对齐：修正 CORS_ORIGIN→CORS_ORIGINS、SMTP*\_→EMAIL\_\_，补全 STORAGE\_\*、BUILD_TIME 等缺失变量
- RUNBOOK.md 新增 6 类运维场景：请求超时、慢查询、PII 排查、环境校验、Prisma 错误码、CORS 排障
- ARCHITECTURE.md Section 18 更新：15 项已解决风险、2 项新增技术债务
- TESTING_CHECKLIST.md 新增覆盖率门槛文档

---

## [1.0.0] - 2026-02-07

### 新增

- **核心平台功能**
  - 用户认证系统（注册、登录、JWT、邮箱验证、密码重置）
  - 个人档案管理（教育经历、考试成绩、课外活动、奖项、文书）
  - 学校库（290+ 所学校，College Scorecard API 数据同步）
  - 录取案例库（社区共享录取经历）
  - 录取预测（AI 驱动的概率分析）
  - 学校排名系统（自定义权重排名）

- **AI 系统**
  - AI Agent 对话助手（流式响应、工具调用）
  - 企业级记忆系统（Redis 缓存 + PostgreSQL 持久化 + 向量搜索）
  - 文书 AI 辅助（评审、润色、头脑风暴）
  - 智能选校推荐

- **社区功能**
  - 论坛（帖子、评论、分类、内容审核）
  - 实时聊天（WebSocket）
  - 功能大厅（招生官评分模拟、每日挑战）
  - 用户认证榜单

- **工具功能**
  - 申请时间线管理
  - 性格测评（MBTI + 霍兰德）
  - 简历导出（PDF）
  - 安全保险库（加密存储）
  - 通知系统

- **基础设施**
  - Monorepo 架构（apps/api + apps/web + apps/mobile + packages/shared）
  - Next.js 16 前端 + NestJS 11 后端
  - Prisma ORM + PostgreSQL (pgvector)
  - Redis 缓存
  - Docker 容器化部署
  - CI/CD (GitHub Actions)
  - 完整国际化（中/英双语，50+ 页面）

- **评分系统**
  - 统一评分公式（GPA/SAT/ACT/活动/奖项加权）
  - Competition 数据库（90+ 竞赛，5 级 Tier 体系）
  - SAT/ACT 百分位评分支持

- **安全特性**
  - RBAC 权限控制（ADMIN/VERIFIED/USER）
  - 速率限制（per-endpoint 可配置）
  - XSS 防护（内容消毒）
  - CORS 白名单
  - Docker 非 root 用户

### 修复

- Turbopack 路由组 404 兼容性问题（middleware matcher 排除式匹配）
- Prisma Schema 漂移（Competition 模型正式迁移）
- 9 个单元测试 DI mock 缺失（24/24 套件 100% 通过）
- React Hydration 警告（not-found.tsx、DailyChallenge、virtual-list）
- 290+ 项 i18n 翻译键缺失

### 安全

- Forum createCategory 添加 ADMIN 权限控制
- CORS 限制生产环境来源（CORS_ORIGINS 环境变量）
- Dockerfile 添加非 root 用户
- 启动时环境变量校验（Joi validationSchema）
- Auth 端点添加 @Throttle 速率限制
