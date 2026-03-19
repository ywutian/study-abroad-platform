# 全平台架构深度审查报告

> 📅 审查日期: 2026-03-15
> 📊 范围: 28 后端模块 · 83 数据模型 · 37 枚举 · 30+ 前端路由 · 76 Admin 端点 · 10 CI Job

## 审查结论

**28 个模块的领域划分基本合理，依赖方向单向无循环。** 但跨模块存在 37 个待整理的问题，按严重程度分为 6 类。

## 问题统计

| 类别                             | 文件                    | 问题数 | 严重                         | 需关注             |
| -------------------------------- | ----------------------- | ------ | ---------------------------- | ------------------ |
| [安全隐患](01-security.md)       | `01-security.md`        | 6      | S1 邮箱验证绕过、S3 积分丢失 | S5 CI 不阻断       |
| [数据模型](02-data-model.md)     | `02-data-model.md`      | 10     | D1 31模型缺 updatedAt        | D7 pgvector 无索引 |
| [AI 架构](03-ai-architecture.md) | `03-ai-architecture.md` | 4      | A1 50% token 不可见          | A2 God Service     |
| [功能缺失](04-feature-gaps.md)   | `04-feature-gaps.md`    | 7      | B1 积分 5% 接入              | B2 通知无持久化    |
| [前端架构](05-frontend.md)       | `05-frontend.md`        | 5      | F2 动态 Tailwind             | F1 Mobile 未拆分   |
| [CI/CD](06-cicd.md)              | `06-cicd.md`            | 5      | I1 无 SAST                   | I2 无 Staging      |

## 其他文档

| 文件                                 | 内容                                 |
| ------------------------------------ | ------------------------------------ |
| [Admin 面板审查](07-admin-panel.md)  | 18 页面 + 76 端点完整度分析          |
| [做得好的部分](08-whats-good.md)     | 不需要改的架构决策和实现             |
| [实施路线图](09-priority-roadmap.md) | 立即/短期/中期/长期优先级 + 验证方式 |

## 模块全景

```
apps/api/src/modules/ (28 模块)
├── 认证授权: auth, user, profile, verification
├── 学校生态: school, school-list, ranking, prediction, case, hall, swipe
├── 内容社交: chat, forum, peer-review, essay-prompt, essay-scraper
├── AI 系统:  ai, ai-agent, essay-ai, recommendation, assessment
├── 平台基础: timeline, notification, subscription, vault, settings, admin, health
└── 新模块:   points (从 case 独立，进行中)

apps/api/src/common/ (基础设施)
├── prisma/, redis/, logger/, email/, storage/, sentry/
├── guards/ (JWT, Roles, Throttler)
├── interceptors/ (Sanitize, Sentry, Transform, Logging)
├── filters/ (AllExceptions)
└── services/ (authorization, audit-log)
```

## 数据规模

| 指标          | 数量                 |
| ------------- | -------------------- |
| Prisma 模型   | 83                   |
| Prisma 枚举   | 37                   |
| Schema 行数   | 2,471                |
| Migration 数  | 2                    |
| Backend 端点  | ~200+                |
| Admin 端点    | 76 (36 通用 + 40 AI) |
| Agent 工具    | 49                   |
| Agent 类型    | 6 (1 编排 + 5 专家)  |
| 前端 TSX 文件 | 497                  |
| UI 组件       | 61                   |
| i18n 键       | ~5,600 (en/zh)       |
| 自定义 Hooks  | 17                   |
| Zustand Store | 2 (web) + 3 (mobile) |
