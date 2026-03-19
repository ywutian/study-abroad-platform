# 做得好的部分（不需要改）

> 这些架构决策和实现质量高，是项目的优势。记录下来防止被"优化"破坏。

---

## 后端架构

### 模块化设计

- **28 个模块领域划分清晰**，每个模块有明确职责
- **依赖方向单向无循环**：AiModule → AiAgentModule（单向），领域模块不直接互相导入
- **`@Optional()` 解耦模式**：MemoryManagerService 等用 `@Optional()`，允许模块独立运行

### 认证安全

- **Token Rotation + $transaction**：正确防止并发 refresh 竞争
- **Brute Force Lua 脚本**：原子性 INCR+EXPIRE，防止 Redis 崩溃导致永久锁定
- **In-memory 降级**：Redis 不可用时用内存 Map 作 fallback
- **Session 限制 max 5**：自动清理最旧 token
- **Constant-time 密码比较**：即使用户不存在也跑 bcrypt，防邮箱枚举

### 请求管线

- **明确的执行顺序**：Middleware → Guards → Interceptors → Filter，在 `app.module.ts` 注册
- **标准化响应包装**：`TransformInterceptor` 统一 `{ success, data, meta }`
- **全局异常处理**：`AllExceptionsFilter` + Prisma 错误映射（P2002→409, P2025→404 等）
- **XSS 防护**：`SanitizeInterceptor` 自动清理请求体

### AI 系统

- **Agent ReWOO 三阶段**：PLAN → EXECUTE → SOLVE 减少 LLM 调用次数
- **12 个工具服务**：实现 `IToolHandlerProvider` 接口，Map 注册表
- **JSON 提取统一**：所有模块用 `extractJsonFromLlm()`，无正则解析
- **双语 Agent Prompt**：`agents.config.ts` 6 个 agent 清晰组织
- **企业级 Memory**：Redis(hot) + PostgreSQL(cold) + pgvector(semantic)

### 数据系统

- **Prediction 4 引擎集成**：统计 + AI + 历史 + ML，动态权重分配
- **School 5 源聚合**：College Scorecard + IPEDS + BigFuture + Appily + 爬虫
- **Timeline 智能解析**：7 种日期格式，3 级数据源优先级
- **Essay-scraper 多策略**：LLM → 正则 → CommonApp 级联 + 年度变更检测

---

## 前端架构

### Web 组件系统

- **61 个 UI 组件** + barrel export，统一 import
- **PageHeader + PageContainer 模式**：所有功能页面统一布局
- **57 个 loading.tsx**：骨架屏覆盖几乎所有路由
- **大页面 \_components/ 拆分**：>500 行的页面都有拆分
- **OKLCH 色彩系统**：50+ CSS 变量，light/dark 自适应

### 状态管理

- **Zustand(app) + React Query(server)**：清晰分离应用状态和服务端缓存
- **httpOnly cookie + 内存 token**：accessToken 不暴露给 JS，防 XSS
- **Token refresh 并发安全**：Zustand subscribe 防止重复 refresh
- **AuthInitializer 统一管理**：刷新间隔只在 providers 中设置

### 国际化

- **369 个文件使用 `useTranslations()`**
- **en/zh 基本对齐**：5,636 vs 5,631 行
- **API 错误 i18n 映射**：`api-error-i18n.ts` + `api-error-map.ts`

### API 客户端

- **401 自动重试**：token 过期自动刷新后重发
- **Timeout 可配**：默认 15s，AI 请求 120s
- **FormData 支持**：upload() 方法处理文件上传
- **响应自动解包**：组件直接收到 data 对象

---

## Admin 面板

- **18 个页面全覆盖**，复杂页面用 \_components/
- **76 个后端端点**（AI 系统 40 个端点特别详细）
- **所有页面有 loading.tsx**
- **Memory 管理 12 个端点**：浏览/删除/统计/衰减/冲突

---

## CI/CD

- **10 个 CI Job** 覆盖 lint/typecheck/test/e2e/build/docker/SBOM/security/deploy
- **E2E 用真实数据库**：PostgreSQL 16 + pgvector + Redis 7
- **Migration drift 检测**：Shadow database 自动检查
- **SBOM 生成**：CycloneDX 格式，90 天保留
- **Auto-rollback**：健康检查失败自动回滚到上一版本
- **VPC 隔离 + Secret Manager**：无公开出口，密钥不在环境变量
- **Non-root 容器**：安全最佳实践
- **多阶段 Docker 构建** + GitHub Actions 缓存

---

## 代码质量工具链

- **前端 7 规则** (`check-code-quality.ts`)：动态 Tailwind（error）、硬编码颜色、console.log、页面大小、loading/error 文件
- **后端 5 规则** (`check-api-quality.ts`)：inline body（error）、throttle、throw、maxlength、test
- **Pre-commit hooks**：lint-staged + commitlint + i18n + 质量检查
- **ESLint jsx-a11y**：可访问性检查
- **simple-import-sort**：自动 import 排序
