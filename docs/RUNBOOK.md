# 运维排障手册 (Runbook)

> 本手册面向运维工程师和后端开发人员，涵盖常见故障的排查和恢复流程。

## 目录

1. [服务架构概览](#1-服务架构概览)
2. [健康检查](#2-健康检查)
3. [常见故障排查](#3-常见故障排查)
4. [数据库运维](#4-数据库运维)
5. [Redis 运维](#5-redis-运维)
6. [AI 服务运维](#6-ai-服务运维)
7. [日志分析](#7-日志分析)
8. [性能调优](#8-性能调优)
9. [回滚流程](#9-回滚流程)
10. [应急联系人](#10-应急联系人)

---

## 1. 服务架构概览

```
用户请求 → Nginx/CloudFlare → Next.js (Web) → NestJS API → PostgreSQL
                                                        → Redis
                                                        → OpenAI API
```

| 服务        | 端口 | 健康检查             |
| ----------- | ---- | -------------------- |
| NestJS API  | 3006 | `GET /api/v1/health` |
| Next.js Web | 3000 | `GET /`              |
| PostgreSQL  | 5432 | `pg_isready`         |
| Redis       | 6379 | `redis-cli ping`     |

---

## 2. 健康检查

### 2.1 快速健康检查

```bash
# API 基础健康
curl http://localhost:3006/api/v1/health

# 详细健康（含 DB/Redis 延迟）
curl http://localhost:3006/api/v1/health/detailed

# Kubernetes 探针
curl http://localhost:3006/api/v1/health/live    # 存活
curl http://localhost:3006/api/v1/health/ready   # 就绪
curl http://localhost:3006/api/v1/health/startup  # 启动
```

### 2.2 预期响应

```json
{
  "status": "ok",
  "timestamp": "2026-02-07T00:00:00.000Z",
  "uptime": 86400,
  "database": { "status": "connected", "latency": "2ms" },
  "redis": { "status": "connected", "latency": "1ms" }
}
```

### 2.3 告警阈值

| 指标               | 警告    | 严重     |
| ------------------ | ------- | -------- |
| API 响应时间 (p95) | > 500ms | > 2000ms |
| 数据库延迟         | > 50ms  | > 200ms  |
| Redis 延迟         | > 10ms  | > 50ms   |
| 错误率             | > 1%    | > 5%     |
| CPU 使用率         | > 70%   | > 90%    |
| 内存使用率         | > 75%   | > 90%    |

---

## 3. 常见故障排查

### 3.1 API 返回 503 Service Unavailable

**症状**: 所有请求返回 503

**排查步骤**:

1. 检查 API 进程是否存活

   ```bash
   docker ps | grep api
   pm2 status  # 如果使用 PM2
   ```

2. 检查端口是否被占用

   ```bash
   lsof -i :3006
   ```

3. 查看最近日志

   ```bash
   docker logs --tail 100 study-abroad-api
   ```

4. 检查数据库连接
   ```bash
   docker exec -it study-abroad-postgres pg_isready
   ```

**恢复**: 重启 API 服务

```bash
docker compose restart api
```

### 3.2 数据库连接耗尽

**症状**: API 日志出现 `Connection pool exhausted` 或 `too many connections`

**排查步骤**:

1. 查看当前连接数

   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

2. 检查 Prisma 连接池配置

   ```
   # .env
   DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=10"
   ```

3. 检查是否有长时间运行的查询
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC
   LIMIT 10;
   ```

**恢复**:

```sql
-- 终止空闲连接
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';
```

### 3.3 Redis 连接失败

**症状**: API 日志出现 `Redis connection refused` 或降级运行（缓存失效）

**排查步骤**:

1. 检查 Redis 进程

   ```bash
   redis-cli ping  # 应返回 PONG
   docker exec -it study-abroad-redis redis-cli info server
   ```

2. 检查内存使用

   ```bash
   redis-cli info memory
   ```

3. 检查是否达到 maxmemory 限制
   ```bash
   redis-cli config get maxmemory
   redis-cli config get maxmemory-policy
   ```

**恢复**:

```bash
# 如果内存不足，清除过期键
redis-cli --scan --pattern '*' | head -100
redis-cli flushdb  # 仅在确认可以清除时

# 重启 Redis
docker compose restart redis
```

### 3.4 OpenAI API 限流 (429)

**症状**: AI 功能返回 429 Too Many Requests

**排查步骤**:

1. 检查 AI Agent 健康

   ```bash
   curl -H "Authorization: Bearer <admin_token>" \
     http://localhost:3006/api/v1/ai-agent/health
   ```

2. 检查熔断器状态
   ```bash
   curl -H "Authorization: Bearer <admin_token>" \
     http://localhost:3006/api/v1/admin/ai-agent/circuit-breakers
   ```

**恢复**:

```bash
# 重置熔断器
curl -X DELETE -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/circuit-breakers/openai

# 调整速率限制
curl -X PUT -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"maxRequestsPerMinute": 20}' \
  http://localhost:3006/api/v1/admin/ai-agent/config/rate-limit/global
```

### 3.5 前端页面 404

**症状**: Next.js 页面返回 404

**排查步骤**:

1. 确认使用 Webpack 模式启动（Turbopack 存在路由组兼容问题，见 ADR-0001）

   ```bash
   # 正确
   pnpm --filter web dev        # 使用 --webpack
   # 错误
   pnpm --filter web dev:turbo  # Turbopack 可能导致 404
   ```

2. 检查中间件匹配

   ```bash
   # apps/web/src/middleware.ts 中 matcher 应为排除式
   ```

3. 检查 locale 路径
   ```
   /zh/dashboard  ✓
   /en/dashboard  ✓
   /dashboard     → 应重定向到 /zh/dashboard 或 /en/dashboard
   ```

---

## 4. 数据库运维

### 4.1 迁移

```bash
# 检查迁移状态
cd apps/api && npx prisma migrate status

# 应用待处理迁移（生产环境）
npx prisma migrate deploy

# 对比 Schema 差异
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
```

### 4.2 备份

```bash
# 创建备份
pg_dump -h localhost -U postgres -d study_abroad -F c -f backup_$(date +%Y%m%d).dump

# 恢复备份
pg_restore -h localhost -U postgres -d study_abroad -c backup_20260207.dump
```

### 4.3 索引维护

```sql
-- 查看缺失索引建议
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename IN ('User', 'School', 'Case', 'ForumPost')
ORDER BY n_distinct DESC;

-- 重建索引（低峰期执行）
REINDEX TABLE "User";
```

---

## 5. Redis 运维

### 5.1 键空间分析

```bash
# 查看各类型键数量
redis-cli info keyspace

# 按前缀统计
redis-cli --scan --pattern 'rate-limit:*' | wc -l
redis-cli --scan --pattern 'ai-agent:*' | wc -l
redis-cli --scan --pattern 'session:*' | wc -l
```

### 5.2 内存优化

```bash
# 查看大键
redis-cli --bigkeys

# 查看内存使用前 10 的键
redis-cli --memkeys --samples 100
```

---

## 6. AI 服务运维

### 6.1 监控指标

```bash
# Prometheus 格式指标
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/metrics/prometheus

# 慢请求追踪
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/traces/slow

# 错误追踪
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/traces/errors
```

### 6.2 Token 配额管理

```bash
# 查看用户使用量
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/users/<userId>/usage

# 重置用户限流
curl -X DELETE -H "Authorization: Bearer <admin_token>" \
  http://localhost:3006/api/v1/admin/ai-agent/users/<userId>/rate-limit
```

---

## 7. 日志分析

### 7.1 日志位置

| 环境    | 位置                                   |
| ------- | -------------------------------------- |
| Docker  | `docker logs study-abroad-api`         |
| Railway | Railway Dashboard → Deployments → Logs |
| 本地    | stdout (console)                       |

### 7.2 关键日志模式

```bash
# 搜索错误日志
docker logs study-abroad-api 2>&1 | grep -i "error\|exception\|fatal"

# 搜索慢查询
docker logs study-abroad-api 2>&1 | grep "slow query"

# 搜索认证失败
docker logs study-abroad-api 2>&1 | grep "Unauthorized\|401"
```

### 7.3 Correlation ID

每个请求都有唯一的 `x-correlation-id`（由 `CorrelationIdMiddleware` 生成）。用于在日志中追踪完整请求链路。

```bash
docker logs study-abroad-api 2>&1 | grep "correlation-id: abc123"
```

---

## 8. 性能调优

### 8.1 API 性能

| 参数            | 建议值                   | 位置                            |
| --------------- | ------------------------ | ------------------------------- |
| Prisma 连接池   | 10-20                    | DATABASE_URL `connection_limit` |
| Redis 缓存 TTL  | 300s (排名) / 60s (列表) | 各 Service 内                   |
| API 请求体大小  | 10MB                     | main.ts `json limit`            |
| 速率限制 (全局) | 100/min                  | ThrottlerModule                 |
| 速率限制 (登录) | 3/min                    | @Throttle decorator             |

### 8.2 前端性能

| 优化项     | 实现                                    |
| ---------- | --------------------------------------- |
| 虚拟滚动   | VirtualList 组件 (schools/cases 页面)   |
| 图片懒加载 | next/image + priority 属性              |
| 代码分割   | next/dynamic + Suspense                 |
| 缓存策略   | @tanstack/react-query (staleTime: 5min) |

---

## 9. 回滚流程

### 9.1 代码回滚

```bash
# 1. 查看最近部署
git log --oneline -10

# 2. 回滚到上一个版本
git revert HEAD

# 3. 推送并触发 CI/CD
git push origin feature/major-updates
```

### 9.2 数据库回滚

Prisma 不支持自动回滚迁移。需要手动编写逆向 SQL：

```bash
# 1. 查看当前迁移
npx prisma migrate status

# 2. 手动编写逆向 SQL
# 3. 执行逆向 SQL
psql -h localhost -U postgres -d study_abroad -f rollback.sql
```

---

## 10. 应急联系人

| 角色      | 负责范围                  |
| --------- | ------------------------- |
| 后端 Lead | API 服务、数据库、AI 集成 |
| 前端 Lead | Web 应用、SSR、性能       |
| DevOps    | 部署、基础设施、监控      |
| 产品经理  | 业务决策、紧急需求变更    |

**升级路径**: 开发人员 → Tech Lead → CTO

---

## 11. 新增运维场景 (2026-02-07)

### 11.1 请求超时 (408)

**症状**: 客户端收到 `408 Request Timeout`，日志中出现 `[TIMEOUT] Request timeout after Xms`

**排查步骤**:

1. 确认超时是普通接口 (30s) 还是 AI 接口 (120s)
2. 检查对应服务的响应时间：
   ```bash
   # 查看慢请求日志
   grep "Request timeout" /var/log/api/combined.log | tail -20
   ```
3. 如果是数据库查询慢，参见 11.2
4. 如果是 AI 服务慢，参见 Section 6

**调整超时**:

```bash
# 环境变量
REQUEST_TIMEOUT_MS=60000      # 普通接口超时（默认 30s）
AI_REQUEST_TIMEOUT_MS=180000  # AI 接口超时（默认 120s）
```

### 11.2 慢查询告警

**症状**: 日志中出现 `[SLOW QUERY] Xms | SELECT ...`

**排查步骤**:

1. 定位慢查询 SQL：
   ```bash
   grep "SLOW QUERY" /var/log/api/combined.log | sort -t'|' -k1 -rn | head -10
   ```
2. 分析查询计划：
   ```sql
   EXPLAIN ANALYZE <slow query>;
   ```
3. 检查是否缺少索引
4. 考虑添加 Prisma `@index()` 或复合索引

**调整阈值**:

```bash
PRISMA_SLOW_QUERY_MS=500  # 慢查询阈值（默认 200ms）
```

### 11.3 PII 泄漏排查

**症状**: 安全审计发现日志中包含敏感信息

**当前脱敏字段**: password, email, phone, mobile, address, ssn, creditCard, apiKey, token, dateOfBirth, passport, nationalId, realName, parentEmail, parentPhone, guardianName, emergencyContact

**排查步骤**:

1. 搜索日志中的敏感模式：
   ```bash
   # 检查是否有未脱敏的邮箱
   grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' /var/log/api/combined.log
   ```
2. 如发现新的泄漏字段，添加到 `logging.interceptor.ts` 的 `SENSITIVE_FIELDS` 数组

### 11.4 环境变量校验失败

**症状**: API 启动时出现 `ENVIRONMENT VARIABLE VALIDATION FAILED` 框架错误

**排查步骤**:

1. 错误消息会列出所有不合格的变量名和原因
2. 常见问题：
   - `DATABASE_URL` 未以 `postgresql://` 开头
   - `JWT_SECRET` 少于 16 个字符
   - `PORT` 非数字或超出 1-65535 范围
3. 参考 `ENV_TEMPLATE.md` 获取正确格式

### 11.5 Prisma 异常码对照

| 错误码      | HTTP 状态 | 含义           | 常见原因             |
| ----------- | --------- | -------------- | -------------------- |
| P2002       | 409       | 唯一约束冲突   | 邮箱/用户名重复      |
| P2025       | 404       | 记录不存在     | ID 无效或已删除      |
| P2003       | 400       | 外键约束失败   | 引用的关联记录不存在 |
| P2011       | 400       | 非空约束失败   | 必填字段未提供       |
| P1001/P1002 | 503       | 数据库连接失败 | DB 宕机或连接池耗尽  |
| P2024       | 504       | 查询超时       | 复杂查询或锁等待     |

### 11.6 CORS 问题排查

**症状**: 浏览器报 `Access-Control-Allow-Origin` 错误

**排查步骤**:

1. 确认 `CORS_ORIGINS` 环境变量包含前端域名（注意是复数 `ORIGINS`）
2. 确认请求头中的 `X-Correlation-Id` 在 `allowedHeaders` 中
3. 确认响应头 `exposedHeaders` 包含 `X-Correlation-Id`, `X-Response-Time`, `X-RateLimit-*`

---

_最后更新: 2026-02-07_
