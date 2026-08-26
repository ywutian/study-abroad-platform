# Quality Gates & Runtime Architecture

> 全栈质量门禁（从 git hook 到 CI/CD 再到运行时），安全架构，可观测性，部署策略。

**最后更新**: 2026-04-12 (based on 3 parallel Explore agent verification)

---

## 目录

- [§1 Testing 体系](#1-testing-体系)
- [§2 CI/CD 流水线](#2-cicd-流水线)
- [§3 Quality Rules (27 unique)](#3-quality-rules)
- [§4 Lint Script Chain](#4-lint-script-chain)
- [§5 Git Hooks (Husky)](#5-git-hooks)
- [§6 Security Architecture (15 层)](#6-security-architecture)
- [§7 Observability (OTel + Sentry + Grafana)](#7-observability)
- [§8 Deploy (GCP Cloud Run)](#8-deploy)

---

## 1. Testing 体系

### 文件数 + 测试数

| 层级        | 工具                  | 文件数                    | 测试数    | 配置                              |
| ----------- | --------------------- | ------------------------- | --------- | --------------------------------- |
| API 单元    | Jest + @swc/jest      | **194** suites            | **2,777** | `apps/api/package.json` jest 字段 |
| Web 单元    | Vitest (jsdom)        | 16                        | —         | `apps/web/vitest.config.ts`       |
| Mobile 单元 | Jest (expo preset)    | 27                        | —         | `apps/mobile/jest.config.js`      |
| API E2E     | Jest + Docker         | 5 spec + config + helpers | —         | `apps/api/test/jest-e2e.json`     |
| Web E2E     | Playwright (chromium) | 4                         | —         | `playwright.config.ts` (根)       |

### 覆盖率门槛 (Coverage Thresholds)

| App    | Statements | Branches | Functions | Lines |
| ------ | ---------- | -------- | --------- | ----- |
| API    | 38%        | 25%      | 34%       | 39%   |
| Web    | 10%        | 10%      | 10%       | 10%   |
| Mobile | 5%         | 3%       | 4%        | 5%    |

**策略**: 低起点渐进提升。每次 PR 必须不降低当前覆盖率。

### E2E 基础设施

**Service Containers** (CI):

- `pgvector/pgvector:pg16` — PostgreSQL + 向量扩展
- `redis:7-alpine` — 缓存

**执行流程**:

```
migration drift check → prisma migrate deploy → db seed → run E2E
```

### 关键约束

- **API route 重命名/删除** → 必须同步 `apps/api/test/*.e2e-spec.ts`
- **Prisma Model 新增** → 必须在所有 `PrismaService` mock 中添加对应 model
- **Zustand selector mock** → `jest.fn((selector) => selector ? selector(state) : state)`
- **新 service** → 必须有 `.spec.ts` (check-drift 的 coverage-trend rule 会检测)

---

## 2. CI/CD 流水线

### 5 个 GitHub Workflows

| Workflow              | 触发             | 用途                                                  |
| --------------------- | ---------------- | ----------------------------------------------------- |
| `ci.yml`              | push/PR          | **主流水线**, 15 个 job                               |
| `deploy-staging.yml`  | push develop     | 自动部署 staging (Cloud Run)                          |
| `preview.yml`         | PR (API/shared)  | PR preview (Cloud Run tagged revision, secrets-gated) |
| `preview-cleanup.yml` | PR closed        | 清理 traffic tag                                      |
| `mobile-ci.yml`       | push/PR (mobile) | Mobile 专属 CI                                        |

### ci.yml 15 个 Job

```
detect-changes (paths-filter)
  ↓
┌───────┬─────────┬──────┬──────┬──────────┬─────────────────┐
│ lint  │typecheck│ test │ e2e  │ e2e-web  │ prediction-gate │ (并行)
│       │         │      │      │          │                 │
│secret │  sast   │security│doc-│          │                 │
│-scan  │ (PR)    │        │check(PR)│     │                 │
│(always)│        │(always)│    │          │                 │
└───────┴─────────┴──────┴──────┴──────────┴─────────────────┘
  ↓
build (需 lint+typecheck+test 通过)
  ↓
docker (仅 main push)
  ↓
sbom (仅 main)
  ↓
deploy-gcp (仅 main + workflow_dispatch)
```

**Jobs 完整列表**:

1. `detect-changes` — paths-filter 决定哪些 job 触发
2. `lint` — ESLint + quality + i18n + routes
3. `typecheck` — TypeScript --noEmit (api + web + mobile)
4. `test` — 单元测试 (api + web + mobile)
5. `e2e` — API E2E with Docker PG+Redis
6. `e2e-web` — Playwright web E2E
7. `prediction-gate` — 预测模型准确性门禁
8. `doc-check` (PR only) — API/schema 文档同步
9. `secret-scan` (always) — gitleaks
10. `sast` (PR only) — Semgrep OWASP Top 10
11. `security` (always) — Trivy (fs + image)
12. `build` — 构建所有应用
13. `docker` (main only) — Docker 镜像构建 + Trivy image scan
14. `sbom` (main only) — CycloneDX SBOM 生成
15. `deploy-gcp` (main only) — GCP Cloud Run 部署

### 安全扫描

| 扫描           | 触发                        | 工具                            | 范围                            |
| -------------- | --------------------------- | ------------------------------- | ------------------------------- |
| **gitleaks**   | pre-commit + CI secret-scan | gitleaks/gitleaks-action@v2     | 密钥检测                        |
| **Semgrep**    | CI sast (PR only)           | semgrep/semgrep-action@v1       | SAST (OWASP Top 10, JS/TS/Node) |
| **Trivy**      | CI security + docker image  | trivy-action（不可变 SHA 固定） | 漏洞扫描                        |
| **pnpm audit** | pre-push + CI               | `pnpm audit --audit-level=high` | 依赖 CVE                        |

### 部署策略

| 目标    | 平台                   | 触发                          | 服务名                                    |
| ------- | ---------------------- | ----------------------------- | ----------------------------------------- |
| 生产    | GCP Cloud Run          | push main / workflow_dispatch | `study-abroad-api` (us-central1)          |
| Staging | GCP Cloud Run          | push develop                  | `study-abroad-api-staging`                |
| Preview | GCP Cloud Run (tagged) | PR opened (API/shared)        | `study-abroad-api-staging` + tag `pr-{N}` |

---

## 3. Quality Rules

**统计**: **27 个独立规则** = 21 integration + 6 drift

### 21 Integration Rules (`scripts/check-integration.ts`)

按 5 domain 组织，每个 domain 回答一个关键问题：

#### Domain: `types` (3 rules)

回答: **跨层 TypeScript 类型是否一致?**

- `enum-consistency` — Prisma enum ↔ shared types ↔ 前后端消费者
- `password-regex-sync` — 密码强度正则在 3 处一致
- `form-validation-sync` — 表单验证规则前后端一致

#### Domain: `routes` (4 rules)

回答: **API 路径在前后端/移动端是否对齐?**

- `route-helper-sync` — 后端 `@Controller()` 前缀 ↔ shared route helpers
- `hardcoded-api-routes` — 前端/移动端禁止硬编码路径
- `route-protection-audit` — 受保护路由必须在 `proxy.ts` 中
- `mobile-endpoint-consistency` — 移动端路径与 shared 对齐

#### Domain: `ai` (3 rules)

回答: **AI 工具/streaming 事件是否完整?**

- `ai-tool-registration` — agents.config.ts 引用的工具必须在 tools/ 注册
- `streaming-event-coverage` — 所有 `StreamEvent.type` 都有处理
- `websocket-event-coverage` — WebSocket gateway 事件完整

#### Domain: `backend` (6 rules)

回答: **后端跨模块依赖/guard/缓存是否正确?**

- `admin-guard-coverage` — 所有 admin controller 必须 `@Roles(ADMIN)`
- `email-method-existence` — EmailService 方法引用必须存在
- `module-dependency-check` — Module imports 与 providers 声明一致
- `stub-service-audit` — 禁止生产代码中的 stub service
- `cache-invalidation-audit` — 缓存写入必须有对应失效逻辑
- `llm-json-import-check` — 使用 LLM 的模块必须 import `extractJsonFromLlm`

#### Domain: `governance` (5 rules)

回答: **架构治理规则是否被违反?**

- `governance-optional-security` — `@Optional()` 禁用于 AgentSecurityModule 服务
- `governance-nl-endpoint-coverage` — NL 端点必须在中间件和 nl-endpoints.json 注册
- `governance-config-consistency` — 直接读 `AGENT_CONFIGS[...]` 必须经过 validator
- `governance-user-data-isolation` — Prisma 查询必须有 userId filter (或显式注释)
- `governance-dead-provider` — ai-agent.module.ts 无未使用 provider

### 6 Drift Rules (`scripts/check-drift.ts`)

按 3 domain 组织：

#### Domain: `docs` (3 rules)

- `brief-accuracy` — BRIEF.md 引用的文件必须存在
- `claude-md-consistency` — CLAUDE.md 路径可达 + 行数 ≤ 190
- `manifest-consistency` — `.claude/manifests/agent-workflow.yml` 与 `.claude/agents/*.md` 同步

#### Domain: `rules` (1 rule)

- `rules-glob-coverage` — `.claude/rules/*.md` 的 glob 有效

#### Domain: `arch` (2 rules)

- `module-boundary` — 禁止深入其他模块内部文件 (必须走 barrel)
- `coverage-trend` — Service 必须有对应 .spec.ts

**当前状态** (2026-04-12): **0 errors / 0 warnings** ✓

---

## 4. Lint Script Chain

### `pnpm lint:all` 完整链

```bash
pnpm lint                                        # 3 app ESLint (并行)
  → pnpm --filter web lint:quality                # 8 web rules
  → pnpm --filter api lint:quality                # 7 api rules
  → pnpm --filter study-abroad-mobile lint:quality  # 4 mobile rules
  → pnpm --filter web lint:i18n                   # 4 web i18n checks
  → pnpm --filter study-abroad-mobile lint:i18n   # 2 mobile i18n checks
  → pnpm lint:routes                              # API route 一致性
  → pnpm lint:integration                         # 21 integration rules
  → pnpm lint:drift                               # 6 drift rules
  → pnpm lint:journeys                            # Journey path 校验
```

### Web Quality (8 rules)

`apps/web/scripts/check-code-quality.ts`:

- `no-dynamic-tailwind` (error) — 禁动态类名 `` `bg-${color}-500` ``
- `no-hardcoded-dark-bg` (warning) — 硬编码 dark 背景必须有 `dark:` 变体
- `no-hardcoded-gray` (warning) — 硬编码灰色必须有 `dark:` 变体
- `page-size-limit` (warning) — page.tsx > 500 行
- `no-console-in-prod` (warning) — `console.log/error` 不得入生产代码
- `no-missing-loading` (warning) — page.tsx 必须有同级 loading.tsx
- `no-missing-error-boundary` (warning) — Route group 必须有 error.tsx
- `no-tooltip-without-provider` (error) — Tooltip 必须在 TooltipProvider 内

### API Quality (7 rules)

`apps/api/scripts/check-api-quality.ts`:

- `no-inline-body` (error) — `@Body() body: { ... }` 必须用 DTO class
- `no-unthrottled-ai` (warning) — AI 路由缺 `@Throttle*`
- `no-generic-throw` (warning) — `throw new Error()` 禁用于 service
- `no-missing-maxlength` (warning) — `@IsString()` 缺 `@MaxLength()`
- `no-missing-test` (warning) — Service 缺 `.spec.ts`
- `no-duplicated-select` (warning) — 相同 select 块重复 2 次以上
- `no-select-mapping-drift` (warning) — SELECT 字段未在 mapper 中

### Mobile Quality (4 rules)

`apps/mobile/scripts/check-mobile-quality.ts`:

- `no-dynamic-style` (warning) — 禁动态 style 插值
- `no-hardcoded-color` (warning) — 禁硬编码颜色 (用 `useColors()`)
- `no-console-in-prod` (warning) — `console.log/error` 禁用
- `file-size-limit` (warning) — 文件 > 500 行

### i18n Checks

**Web (4 checks)**:

- `check-missing-keys` — `t()` 调用必须有对应键
- `check-translation-keys` — en/zh key 对齐
- `check-wrong-language` — 键值语言匹配 (en.json 必须英文，zh.json 必须中文)
- `check-hardcoded-english` — 硬编码英文 (audit only)

**Mobile (2 checks)**:

- `check-mobile-i18n` — en/zh 深度比较
- `check-missing-translations` — 空值检测

---

## 5. Git Hooks

**Husky** — 在 `.husky/` 目录

### Pre-commit (~5-10s) — 7 步

```
1. lint-staged                                # Prettier + ESLint on *.{ts,tsx,js,jsx,json,md,yml,yaml}
2. gitleaks protect --staged                  # 密钥扫描 (如已安装)
3. [web src changed] i18n 3 checks:
   - check-missing-keys.ts
   - check-translation-keys.ts
   - check-wrong-language.ts
4. [web src changed] check-code-quality.ts --staged
5. [api src changed] check-api-quality.ts --staged
6. [mobile src changed] check-mobile-quality.ts --staged
7. [mobile src changed] check-mobile-i18n.ts
```

### Pre-push (~20-50s) — 4 步

```
1. pnpm --filter api db:generate              # Prisma client 同步
2. verify-gate.ts                              # 智能 typecheck + test (只跑 affected)
3. [migrations changed] check-migration-safety.ts --new-only
4. pnpm audit --audit-level=high              # CVE 检测
```

### Commit-msg

```
pnpm exec commitlint --edit $1                 # Conventional Commits
```

**允许 types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

---

## 6. Security Architecture

**15 层防御** — 从认证到审计

| #   | 层面               | 实现                                          | 关键约束                                 |
| --- | ------------------ | --------------------------------------------- | ---------------------------------------- |
| 1   | **认证**           | JWT (access: 内存 / refresh: httpOnly cookie) | Access token 绝不入 localStorage         |
| 2   | **角色层级**       | ADMIN > VERIFIED > USER                       | ADMIN 覆盖所有 guard                     |
| 3   | **RBAC**           | PermissionGuard 细粒度权限                    | ownership.guard 额外检查资源所有权       |
| 4   | **限流**           | ThrottlerModule + Redis Lua 原子 INCR+EXPIRE  | Lua 脚本防崩溃永久锁                     |
| 5   | **Token 刷新**     | `$transaction` 防并发 race                    | 仅 AuthInitializer 触发刷新              |
| 6   | **输入清理**       | SanitizeInterceptor                           | 深度限制 + 数组根级处理 (防栈溢出)       |
| 7   | **参数验证**       | class-validator + `@MaxLength()` 强制         | 所有 `@IsString()` 必须 `@MaxLength()`   |
| 8   | **Correlation ID** | CorrelationIdMiddleware + UUID 验证           | 防日志注入                               |
| 9   | **CORS/CSP**       | Helmet 严格策略                               | 生产禁 unsafe-inline/unsafe-eval         |
| 10  | **Vault**          | AES-256 (IV + userId 派生密钥)                | 密钥从环境变量派生                       |
| 11  | **密码**           | bcrypt + 恒常时间登录                         | 登录总是执行 bcrypt.compare (防邮箱枚举) |
| 12  | **AI 安全**        | PromptGuard + ContentModeration + Audit       | 3 层纵深防御 (见 ai-system.md §6)        |
| 13  | **密钥扫描**       | gitleaks (pre-commit + CI)                    | 阻断提交含密钥的代码                     |
| 14  | **SAST**           | Semgrep OWASP Top 10                          | PR 门禁                                  |
| 15  | **CVE**            | Trivy (fs + Docker image) + pnpm audit        | high/critical 阻断                       |

### 运行时安全约束

- **Env 验证**: Zod schema，启动时失败即崩溃 (ADR-0004)
- **WebSocket auth**: `JwtStrategy.validate()` 同步检查 `isBanned`
- **Ban check**: 覆盖 HTTP + WebSocket 两条入口
- **Brute force**: Redis Lua 脚本原子 `INCR + EXPIRE` (防 server crash 后永久锁)

---

## 7. Observability

### 可观测组件

| 组件     | 服务                                     | 输出                             |
| -------- | ---------------------------------------- | -------------------------------- |
| 指标     | OpenTelemetry SDK                        | Prometheus endpoint              |
| 追踪     | `apps/api/src/tracing.ts`                | OTLP exporter (可配置开关)       |
| 自动埋点 | HTTP + Express + ioredis + Prisma        | 零配置                           |
| 日志     | StructuredLoggerService                  | JSON + correlation ID + PII 脱敏 |
| 错误     | Sentry (SentryInterceptor)               | Sentry dashboard                 |
| 告警     | AlertChannelService                      | 邮件 / Slack / PagerDuty         |
| 仪表盘   | `grafana-dashboards/agent-overview.json` | Grafana                          |

### 条件启用

OpenTelemetry 通过 `OTEL_EXPORTER_OTLP_ENDPOINT` 环境变量开关，**零开销** 当禁用时。

### 关键指标 (AI 系统专属)

见 `docs/architecture/ai-system.md` §9

### 通用指标

- HTTP 请求总数 + 延迟 (p50/p95/p99)
- Prisma query 时长
- Redis 操作时长
- 认证事件 (登录成功/失败)
- Guard 触发次数 (throttle/roles/permission)

### 健康检查 (5 端点)

| Endpoint           | 用途                             | 认证       |
| ------------------ | -------------------------------- | ---------- |
| `/health`          | 综合检查 (DB + Redis)            | Public     |
| `/health/live`     | Liveness probe (K8s)             | Public     |
| `/health/ready`    | Readiness probe + migration 检查 | Public     |
| `/health/startup`  | Startup probe                    | Public     |
| `/health/detailed` | 含环境/构建信息                  | Admin only |

---

## 8. Deploy

### 部署架构

| 组件     | 平台                               | 配置                                        |
| -------- | ---------------------------------- | ------------------------------------------- |
| API      | GCP Cloud Run (us-central1)        | Multi-stage Docker, non-root, VPC connector |
| Web      | Next.js (可独立部署)               | —                                           |
| DB       | Cloud SQL PostgreSQL 16 + pgvector | —                                           |
| Cache    | Memorystore Redis                  | VPC 连接                                    |
| 镜像仓库 | GCP Artifact Registry              | —                                           |
| SBOM     | CycloneDX (仅 main 分支)           | —                                           |
| 域名     | Cloud Run + Custom domain          | —                                           |

### Docker 多阶段构建

`apps/api/Dockerfile`:

- Stage 1: 依赖安装 (pnpm install)
- Stage 2: 构建 (`pnpm --filter api build`)
- Stage 3: 生产镜像 (仅 dist + 必要依赖，non-root user)

### VPC + 网络

- Cloud Run → VPC Connector → Cloud SQL + Memorystore
- 出站流量受 VPC 控制
- 无公网 DB 暴露

### 部署流程 (from ci.yml)

```
1. Build Docker image (BuildKit cache)
2. Push to Artifact Registry
3. Trivy 扫描镜像
4. gcloud run deploy (asia-east1 → us-central1 migration 已完成)
5. Smoke test /health endpoint
6. Rollback 策略: 新 revision 流量 0% → 10% → 100% (手动/自动)
```

### Staging vs Production

**Staging** (`deploy-staging.yml`):

- 触发: push develop
- 服务: `study-abroad-api-staging`
- 自动执行 migration
- 减小的资源配置

**Preview** (`preview.yml`):

- 触发: PR opened/synchronize (API/shared changes)
- 服务: `study-abroad-api-staging` + tag `pr-{N}`
- 部署为 **tagged revision** (0% 流量)
- 提供隔离 URL 用于测试
- PR close 时自动清理 (`preview-cleanup.yml`)

---

## 关联文档

- [REPO_SNAPSHOT.md](../REPO_SNAPSHOT.md) — 自动生成的仓库数字快照
- [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) — 完整测试清单 (1,788 行)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) — 运维故障排查 (930 行)
- [DEPLOYMENT_STRATEGY.md](../DEPLOYMENT_STRATEGY.md) — 部署策略
- [RUNBOOK.md](../RUNBOOK.md) — 运维手册
- [ENGINEERING_STANDARDS.md](../ENGINEERING_STANDARDS.md) — 工程标准 (671 行)
- [ARCHITECTURE.md](../ARCHITECTURE.md) — 系统架构总论 (1,712 行)

---

<!-- 生成于 2026-04-12 全面重构 -->
