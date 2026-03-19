# Admin 面板完整度审查

> 18 个前端页面 · 76 个后端端点（36 通用 + 40 AI）

---

## 页面清单

| #   | 页面               | 路由                        | 行数 | \_components/ | loading.tsx |
| --- | ------------------ | --------------------------- | ---- | ------------- | ----------- |
| 1   | Dashboard          | `/admin`                    | 103  | ❌            | ✅          |
| 2   | Users              | `/admin/users`              | 477  | ❌            | ✅          |
| 3   | User Detail        | `/admin/users/[id]`         | -    | ❌            | ✅          |
| 4   | Reports            | `/admin/reports`            | -    | ❌            | ✅          |
| 5   | Audit Logs         | `/admin/audit-logs`         | 457  | ❌            | ✅          |
| 6   | AI Agent           | `/admin/ai-agent`           | 34   | ✅ (8 组件)   | ✅          |
| 7   | AI Memory          | `/admin/memory`             | -    | ✅ (6 组件)   | ✅          |
| 8   | Analytics          | `/admin/analytics`          | -    | ✅            | ✅          |
| 9   | Content            | `/admin/content`            | -    | ✅ (4 tabs)   | ✅          |
| 10  | Schools            | `/admin/schools`            | -    | ❌            | ✅          |
| 11  | Deadlines          | `/admin/deadlines`          | -    | ❌            | ✅          |
| 12  | Events             | `/admin/events`             | -    | ❌            | ✅          |
| 13  | Activity Templates | `/admin/activity-templates` | -    | ❌            | ✅          |
| 14  | Calibrations       | `/admin/calibrations`       | -    | ❌            | ✅          |
| 15  | Points             | `/admin/points`             | -    | ❌            | ✅          |
| 16  | Payments           | `/admin/payments`           | 398  | ❌            | ✅          |
| 17  | Data Updates       | `/admin/data-updates`       | -    | ❌            | ✅          |
| 18  | Settings           | `/admin/settings`           | -    | ❌            | ✅          |

## 后端端点覆盖

### AdminController（36 端点）

| 分类         | 端点数 | 前端覆盖                |
| ------------ | ------ | ----------------------- |
| 统计分析     | 3      | ✅ Dashboard            |
| 举报管理     | 3      | ✅ Reports              |
| 用户管理     | 7      | ✅ Users + Detail       |
| 审计日志     | 1      | ✅ Audit Logs           |
| 数据同步     | 2      | ⚠️ Data Updates（有限） |
| 学校截止日期 | 4      | ✅ Deadlines            |
| 全局事件     | 4      | ✅ Events               |
| 通知广播     | 1      | ⚠️ 在哪个页面？         |
| CSV 导出     | 1      | ✅ 从各页面调用         |
| 活动模板     | 5      | ✅ Activity Templates   |
| 竞赛数据     | 1      | ⚠️ 无独立页面           |
| 校准参数     | 4      | ✅ Calibrations         |

### AgentAdminController（40 端点）

| 分类          | 端点数 | 前端覆盖               |
| ------------- | ------ | ---------------------- |
| 配置管理      | 8      | ✅ AI Agent 页         |
| Agent 配置    | 4      | ✅ AI Agent 页         |
| Feature Flags | 2      | ✅ AI Agent 页         |
| 用户配额      | 3      | ✅ User Detail 页      |
| 指标监控      | 4      | ✅ Analytics 页        |
| 链路追踪      | 4      | ⚠️ AI Agent 页（部分） |
| 熔断器        | 2      | ✅ AI Agent 页         |
| 健康检查      | 1      | ✅ AI Agent 页         |
| 安全事件      | 2      | ✅ Content 页          |
| AI 审计日志   | 1      | ✅ Audit Logs 页       |
| Memory 管理   | 12     | ✅ Memory 页           |

## 缺失功能

### 高优先级

| 功能             | 现状                               | 建议                                                  |
| ---------------- | ---------------------------------- | ----------------------------------------------------- |
| **用户模拟**     | 无端点                             | `POST /admin/users/:id/impersonate` + audit log       |
| **Case 审核**    | Verification 后端有 approve/reject | Admin 面板加 Verification 审核页面                    |
| **系统健康面板** | 只有 `/admin/ai-agent/health`      | 加全局 `/admin/health` 展示 DB/Redis/LLM/Storage 状态 |

### 中优先级

| 功能           | 现状                 | 建议                       |
| -------------- | -------------------- | -------------------------- |
| **Essay 管理** | 无 admin 端点        | `GET/DELETE /admin/essays` |
| **退款管理**   | Subscription 是 mock | 接入支付后需要退款 UI      |
| **Chat 审核**  | Content 页有 tab     | 加消息删除/用户禁言操作    |

### 低优先级

| 功能              | 建议                                   |
| ----------------- | -------------------------------------- |
| 竞赛数据管理页面  | 独立页面或合并到 Activity Templates    |
| 通知广播历史      | 查看已发送的广播记录                   |
| School 数据源管理 | 数据爬取配置（SchoolEssaySource）的 UI |
