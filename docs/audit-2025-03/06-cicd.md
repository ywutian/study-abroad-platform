# CI/CD + 部署问题

> 范围: 2 个 GitHub Actions workflow · 10 个 CI Job · Cloud Run 部署 · Docker 构建

---

## I1：无 SAST（静态应用安全测试）🟠

### 现状

CI 有 Trivy（依赖漏洞扫描）和 SBOM（供应链清单），但缺少代码级安全分析：

- 无 CodeQL / Snyk / SonarQube
- 无 SQL 注入检测
- 无 XSS 模式检测（靠 SanitizeInterceptor 运行时防护）

### 建议

添加 GitHub CodeQL（免费）action 到 CI：

```yaml
- uses: github/codeql-action/analyze@v3
  with:
    languages: javascript-typescript
```

---

## I2：无 Staging 环境 🟠

### 现状

从 `main` 分支直接部署到 production Cloud Run。虽然有 auto-rollback（健康检查失败回滚），但：

- 无灰度发布（100% 一次性切换）
- 无 staging 环境验证
- 无金丝雀发布

### 建议

1. 短期：添加手动 staging 部署 workflow（部署到独立 Cloud Run service）
2. 中期：Cloud Run traffic splitting（10% canary → 100%）

---

## I3：Dockerfile 无 HEALTHCHECK 🟡

### 现状

`Dockerfile` 缺少 `HEALTHCHECK` 指令。`docker-compose.yml` 中有健康检查，但独立 Docker 运行时无保护。

### 修复

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4101/health/live || exit 1
```

---

## I4：Cold Start 风险 🟡

### 现状

Cloud Run 配置 `min-instances=0`，首次请求有冷启动延迟（NestJS + Prisma 初始化可能需要 5-10 秒）。

### 建议

生产环境设 `--min-instances=1` 避免冷启动。成本增加约 $5-10/月。

---

## I5：无数据库自动备份 🟡

### 现状

CI/CD 中未见 Cloud SQL 自动备份配置。

### 建议

在 GCP Console 中启用 Cloud SQL 自动备份（每日，保留 7 天）。这不是 CI 问题但是运维关键项。

---

## 做得好的 CI/CD 部分

| 方面               | 详情                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **CI Job 覆盖**    | 10 个 Job：lint / typecheck / test / e2e / doc-check / build / docker / SBOM / security / deploy |
| **E2E 环境**       | 真实 PostgreSQL 16 + pgvector + Redis 7 service containers                                       |
| **Migration 检测** | Shadow database 检测 Prisma drift                                                                |
| **安全扫描**       | Trivy CRITICAL/HIGH + SBOM 生成（CycloneDX）                                                     |
| **部署安全**       | Auto-rollback + VPC 隔离 + GCP Secret Manager                                                    |
| **构建优化**       | Docker Buildx + GitHub Actions cache + 多阶段构建                                                |
| **Non-root 容器**  | 安全最佳实践                                                                                     |
| **代码质量**       | 前端 7 规则 + 后端 5 规则自动检查                                                                |
| **文档检查**       | Controller/Schema 变更提醒更新文档                                                               |
| **Artifact 保留**  | Build 7 天，SBOM 90 天                                                                           |
