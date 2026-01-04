# 环境变量配置指南

## 本地开发 (apps/api/.env)

```bash
# 数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/study_abroad"

# Redis
REDIS_URL=redis://localhost:6379

# JWT 认证 (用 openssl rand -base64 32 生成)
JWT_SECRET=your_jwt_secret_here_at_least_32_chars
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here_at_least_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS (本地开发)
CORS_ORIGIN=http://localhost:3000

# OpenAI (AI 功能)
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# College Scorecard (学校数据)
COLLEGE_SCORECARD_API_KEY=your_scorecard_api_key

# 邮件服务
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Sentry 监控
SENTRY_DSN=https://your_dsn@sentry.io/xxx

# 前端地址
FRONTEND_URL=http://localhost:3000
```

## Web 前端 (apps/web/.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SENTRY_DSN=https://your_dsn@sentry.io/xxx
```

---

## 生产环境 (香港 VPS + Cloudflare)

### 根目录 .env.production

```bash
# ============================================
# 数据库
# ============================================
POSTGRES_DB=studyabroad
POSTGRES_USER=studyabroad_user
POSTGRES_PASSWORD=你的安全密码_至少16位_使用openssl_rand生成

# ============================================
# Redis
# ============================================
REDIS_PASSWORD=你的Redis密码_至少16位

# ============================================
# JWT 认证
# 使用: openssl rand -base64 32
# ============================================
JWT_SECRET=生成的32位以上密钥
JWT_REFRESH_SECRET=生成的32位以上密钥
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# CORS - Cloudflare Pages 域名
# 多个域名用逗号分隔
# ============================================
CORS_ORIGIN=https://your-app.pages.dev,https://your-custom-domain.com

# ============================================
# 前端地址 (用于邮件链接等)
# ============================================
FRONTEND_URL=https://your-app.pages.dev

# ============================================
# OpenAI
# ============================================
OPENAI_API_KEY=sk-你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# ============================================
# 邮件服务 (可选)
# ============================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password

# ============================================
# 学校数据 API
# ============================================
COLLEGE_SCORECARD_API_KEY=你的API密钥

# ============================================
# Sentry 监控 (可选)
# ============================================
SENTRY_DSN=https://xxx@sentry.io/xxx

# ============================================
# 服务端口
# ============================================
API_PORT=3001

# ============================================
# 限流配置
# ============================================
THROTTLE_TTL=60
THROTTLE_LIMIT=100
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
