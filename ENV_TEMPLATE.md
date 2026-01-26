# 环境变量配置指南

> **注意**：标注 `[Zod 验证]` 的变量在应用启动时由 Zod schema 校验，格式不正确会导致启动失败。

## 本地开发 (apps/api/.env)

```bash
# ============================================
# 核心 [Zod 验证]
# ============================================
NODE_ENV=development
PORT=3001

# ============================================
# 数据库 [Zod 验证] — 必须以 postgresql:// 开头
# ============================================
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/study_abroad"

# ============================================
# Redis [Zod 验证] — 可选，不配置则退化为内存缓存
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# JWT 认证 [Zod 验证] — 用 openssl rand -base64 32 生成
# ============================================
JWT_SECRET=your_jwt_secret_here_at_least_16_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_at_least_16_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# CORS [Zod 验证] — 多个域名用逗号分隔
# 注意：变量名是 CORS_ORIGINS（复数）
# ============================================
CORS_ORIGINS=http://localhost:3000

# ============================================
# OpenAI (AI 功能) [Zod 验证: OPENAI_API_KEY 可选]
# ============================================
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# ============================================
# College Scorecard (学校数据)
# ============================================
COLLEGE_SCORECARD_API_KEY=your_scorecard_api_key

# ============================================
# 邮件服务 [Zod 验证: 可选]
# 注意：Zod 验证使用 EMAIL_* 变量名，但 email.service.ts 实际读取 SMTP_* 变量
# 建议同时配置两套变量名，确保兼容
# ============================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email_user
SMTP_PASS=your_email_password
EMAIL_FROM=noreply@your-domain.com

# ============================================
# 文件存储 [Zod 验证: 默认 local]
# STORAGE_TYPE: local | s3 | oss | cos
# ============================================
STORAGE_TYPE=local
# STORAGE_BUCKET=your-bucket-name
# STORAGE_REGION=us-east-1
# STORAGE_ACCESS_KEY=your-access-key
# STORAGE_SECRET_KEY=your-secret-key

# ============================================
# Sentry 监控 [Zod 验证: 可选，生产环境强烈建议]
# ============================================
SENTRY_DSN=https://your_dsn@sentry.io/xxx

# ============================================
# 限流配置 [Zod 验证: 有默认值]
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# ============================================
# 前端地址 (用于邮件链接等)
# ============================================
FRONTEND_URL=http://localhost:3000

# ============================================
# 性能监控
# ============================================
# Prisma 慢查询阈值（毫秒），超过此值会 WARN 级别日志记录
PRISMA_SLOW_QUERY_MS=200
# 全局请求超时（毫秒），普通接口
REQUEST_TIMEOUT_MS=30000
# AI 接口请求超时（毫秒）
AI_REQUEST_TIMEOUT_MS=120000

# ============================================
# 构建元数据 [Zod 验证: 可选] — CI/CD 自动注入
# ============================================
# GIT_COMMIT_SHA=auto-injected
# BUILD_TIME=auto-injected

# ============================================
# AI Agent 外部搜索 (可选，不配置则搜索功能静默禁用)
# ============================================
# Google Custom Search API (https://console.cloud.google.com/apis/credentials)
GOOGLE_SEARCH_API_KEY=your_google_api_key
# Google Programmable Search Engine ID (https://programmablesearchengine.google.com/)
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
# Tavily Search API (https://app.tavily.com/)
TAVILY_API_KEY=tvly-your_tavily_api_key

# ============================================
# AI Agent 安全 (可选)
# ============================================
SECURITY_STRICT_MODE=false
OPENAI_MODERATION_ENABLED=false

# ============================================
# AI Agent 任务队列 (可选)
# ============================================
TASK_QUEUE_ENABLED=true
TASK_QUEUE_CONCURRENCY=5

# ============================================
# AI Agent 可观测性 (可选)
# ============================================
TRACING_ENABLED=false
```

## Web 前端 (apps/web/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001

# WebSocket URL（默认与 API_URL 相同，仅部署时 WS 域名不同时需要设置）
# NEXT_PUBLIC_WS_URL=http://localhost:3001

NEXT_PUBLIC_SENTRY_DSN=https://your_dsn@sentry.io/xxx
```

---

## 生产环境 (香港 VPS + Cloudflare)

### 根目录 .env.production

```bash
# ============================================
# 核心 [Zod 验证]
# ============================================
NODE_ENV=production
PORT=3001

# ============================================
# 数据库 (Docker Compose 变量)
# ============================================
POSTGRES_DB=studyabroad
POSTGRES_USER=studyabroad_user
POSTGRES_PASSWORD=你的安全密码_至少16位_使用openssl_rand生成

# ============================================
# 数据库 (API 连接) [Zod 验证]
# ============================================
DATABASE_URL="postgresql://studyabroad_user:密码@postgres:5432/studyabroad?connection_limit=10&pool_timeout=20"

# ============================================
# Redis
# ============================================
REDIS_PASSWORD=你的Redis密码_至少16位
REDIS_URL=redis://:密码@redis:6379

# ============================================
# JWT 认证 [Zod 验证]
# 使用: openssl rand -base64 32
# ============================================
JWT_SECRET=生成的32位以上密钥
JWT_REFRESH_SECRET=生成的32位以上密钥
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# CORS [Zod 验证] — 多个域名用逗号分隔
# 注意：变量名是 CORS_ORIGINS（复数）
# ============================================
CORS_ORIGINS=https://your-app.pages.dev,https://your-custom-domain.com

# ============================================
# 前端地址 (用于邮件链接等)
# ============================================
FRONTEND_URL=https://your-app.pages.dev

# ============================================
# OpenAI [Zod 验证: OPENAI_API_KEY 可选]
# ============================================
OPENAI_API_KEY=sk-你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# ============================================
# 邮件服务 [Zod 验证: 可选]
# 注意：Zod 验证使用 EMAIL_* 变量名，但 email.service.ts 实际读取 SMTP_* 变量
# 建议同时配置两套变量名，确保兼容
# ============================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
EMAIL_FROM=noreply@your-domain.com

# ============================================
# 文件存储 [Zod 验证]
# ============================================
STORAGE_TYPE=s3
STORAGE_BUCKET=your-bucket-name
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key

# ============================================
# 学校数据 API
# ============================================
COLLEGE_SCORECARD_API_KEY=你的API密钥

# ============================================
# Sentry 监控 [Zod 验证: 可选，生产环境强烈建议]
# ============================================
SENTRY_DSN=https://xxx@sentry.io/xxx

# ============================================
# 限流配置 [Zod 验证]
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# ============================================
# 性能监控
# ============================================
PRISMA_SLOW_QUERY_MS=200
REQUEST_TIMEOUT_MS=30000
AI_REQUEST_TIMEOUT_MS=120000

# ============================================
# AI Agent 外部搜索（可选）
# ============================================
# Google Custom Search API
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
# Tavily Search API
TAVILY_API_KEY=tvly-your_tavily_api_key

# ============================================
# AI Agent 安全配置
# ============================================
SECURITY_STRICT_MODE=false
OPENAI_MODERATION_ENABLED=false

# ============================================
# AI Agent 任务队列
# ============================================
TASK_QUEUE_ENABLED=true
TASK_QUEUE_CONCURRENCY=5

# ============================================
# AI Agent 告警配置
# ============================================
# Slack Webhook URL (可选)
ALERT_SLACK_WEBHOOK=

# 邮件告警
ALERT_EMAIL_ENABLED=false
ALERT_EMAIL_RECIPIENTS=admin@example.com

# 企业微信/钉钉 (可选)
ALERT_WECHAT_WEBHOOK=
ALERT_DINGTALK_WEBHOOK=

# 告警聚合窗口 (秒)
ALERT_AGGREGATION_WINDOW=60
# 每分钟最大告警数
ALERT_MAX_PER_MINUTE=30

# ============================================
# AI Agent 可观测性
# ============================================
TRACING_ENABLED=false
TRACING_SAMPLE_RATE=0.1
# 导出器: console, jaeger, zipkin, otlp
TRACING_EXPORTER=console
TRACING_ENDPOINT=http://jaeger:14268/api/traces
```

### Cloudflare Pages 环境变量

在 Cloudflare Dashboard → Pages → Settings → Environment variables 添加：

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 部署命令

```bash
# 1. 复制环境变量文件
cp ENV_TEMPLATE.md 参考，创建 .env.production

# 2. 启动生产服务
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# 3. 查看日志
docker-compose -f docker-compose.prod.yml logs -f api

# 4. 初始化 SSL 证书 (首次)
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d api.your-domain.com \
  --email your@email.com \
  --agree-tos
```
