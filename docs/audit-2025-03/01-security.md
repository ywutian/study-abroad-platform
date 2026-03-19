# 安全隐患

> 优先级：立即修复

---

## S1：邮箱验证被绕过 🔴

**位置**: `apps/api/src/modules/auth/auth.service.ts:96-104`

**现状**: 注册时硬编码 `emailVerified: true`，所有新用户自动通过邮箱验证。

```typescript
// auth.service.ts:100
const createData: any = {
  email: data.email,
  passwordHash,
  emailVerified: true, // ← 硬编码为 true！
  emailVerifyToken,
  emailVerifyTokenExp,
};
```

**影响**:

- 用户可用假邮箱注册
- `login()` 中 `if (!user.emailVerified)` 检查永远不会触发
- 验证邮件发了但 token 无用
- 无法识别合法用户

**原因**: TODO 注释说等 Resend 域名配置

**修复方案**:

1. 设 `emailVerified: false`
2. 加环境变量 `SKIP_EMAIL_VERIFICATION`，开发环境跳过，生产环境强制
3. 确认 Resend 域名状态

**工作量**: 极小（改 1 行 + 加 1 个 env var）

---

## S2：findByEmail() 不过滤软删除用户 🔴

**位置**: `apps/api/src/modules/user/user.service.ts:34-38`

**现状**: `findByEmail()` 没有 `deletedAt: null` 条件，但 `findById()` 有。

```typescript
// findByEmail - 不过滤
async findByEmail(email: string): Promise<User | null> {
  return this.prisma.user.findUnique({ where: { email } });
}

// findById - 过滤了
async findById(id: string): Promise<User | null> {
  return this.prisma.user.findUnique({ where: { id, deletedAt: null } });
}
```

**影响**:

- 已删除（匿名化）账号仍可通过 `deleted_{id}@deleted.local` 被查到
- 注册时 `findByEmail` 查重不排除已删除用户（但邮箱已匿名化，影响有限）
- 行为不一致，潜在 GDPR 风险

**修复方案**: 加 `deletedAt: null` 到 WHERE 条件

**工作量**: 极小

---

## S3：积分 Refund 不可靠 🟡

**位置**: `essay-ai.service.ts`、`recommendation.service.ts`、`case-gallery.service.ts`

**现状**: `charge()` → AI 调用 → 失败时 `refund().catch(log)` — fire-and-forget，无重试。

三个模块用三种不同的日志风格：

```typescript
// essay-ai: 静默日志
.catch((e) => this.logger.error('Point refund failed', e))

// recommendation: CRITICAL 标记
.catch((refundErr) => {
  this.logger.error('CRITICAL: refund failed after recommendation error', ...)
})

// case-gallery: 又不同...
```

**影响**: 如果 refund 操作本身失败（Redis 崩溃、网络中断），用户积分永久丢失。

**修复方案**:

1. 统一为 `PointsRefundHelper`，封装带重试的 refund 逻辑
2. 最多重试 3 次，指数退避
3. 全部失败后写入 `failed_refunds` 表，admin 定期处理
4. 统一日志级别为 `CRITICAL`

**工作量**: 小

---

## S4：Summarizer 绕过 AiService 直接 fetch() 调 LLM 🟡

**位置**: `apps/api/src/modules/ai-agent/memory/summarizer.service.ts`

**现状**: 用 `fetch()` 直接调 OpenAI API，完全绕过 AiService/LLMService。

**影响**:

- 无 token 追踪（admin 看不到消耗）
- 无韧性保护（无重试、无熔断）
- 无配额控制
- 换 LLM 供应商时需要单独改

**修复方案**: 改为 `AiService.chat()` 调用

**工作量**: 小

---

## S5：npm audit 不阻断 CI 🟡

**位置**: `.github/workflows/ci.yml`

**现状**: `continue-on-error: true`，高危依赖漏洞不会阻止 PR 合并。

**修复方案**: 改为 `continue-on-error: false`，或设置 `--audit-level=high`

**工作量**: 极小

---

## S6：Docker 镜像未扫描 🟡

**位置**: `.github/workflows/ci.yml`

**现状**: Trivy 只扫描文件系统（`fs` 模式），不扫描构建完成的 Docker 镜像。镜像中的运行时依赖漏洞不会被发现。

**修复方案**: 在 docker build 之后加 `trivy image` 扫描

**工作量**: 极小
