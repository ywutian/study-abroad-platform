# 功能缺失与半成品

---

## B1：积分系统只接入 5% 🟠

### 现状

`PointsConfigService` 配置了 20 个积分动作（7 赚取 + 8 消费 + 5 其他），但实际接入的只有：

| 动作                       | 分值            | 状态      | 触发模块       |
| -------------------------- | --------------- | --------- | -------------- |
| `VERIFICATION_APPROVED`    | +100            | ✅ 已接入 | verification   |
| `SWIPE_CORRECT`            | +5 (含连击翻倍) | ✅ 已接入 | swipe          |
| `AI_ESSAY_POLISH`          | -20             | ✅ 已接入 | essay-ai       |
| `AI_ESSAY_REVIEW`          | -30             | ✅ 已接入 | essay-ai       |
| `AI_ESSAY_BRAINSTORM`      | -15             | ✅ 已接入 | essay-ai       |
| `AI_ESSAY_GALLERY`         | -20             | ✅ 已接入 | case-gallery   |
| `AI_SCHOOL_RECOMMENDATION` | -25             | ✅ 已接入 | recommendation |

**未接入的（全部已配置分值但无触发代码）**:

| 动作               | 配置分值 | 状态      | 应在哪触发                    |
| ------------------ | -------- | --------- | ----------------------------- |
| `SUBMIT_CASE`      | +50      | ❌ 未接入 | case.service → create()       |
| `CASE_VERIFIED`    | +100     | ❌ 未接入 | verification → approve()      |
| `CASE_HELPFUL`     | +10      | ❌ 未接入 | case → markHelpful()          |
| `COMPLETE_PROFILE` | +30      | ❌ 未接入 | profile → 完成度达标时        |
| `REFER_USER`       | +50      | ❌ 未接入 | user → referral 成功          |
| `VIEW_CASE_DETAIL` | -20      | ❌ 未接入 | case → findById()             |
| `AI_ANALYSIS`      | -30      | ❌ 未接入 | prediction → analyze()        |
| `MESSAGE_VERIFIED` | -10      | ❌ 未接入 | chat → 给 VERIFIED 用户发消息 |

**还缺少的功能**:

- ❌ Forum 发帖/回帖不奖励
- ❌ Chat 关注不奖励
- ❌ Timeline 完成任务不奖励
- ❌ 无积分排行榜端点
- ❌ 无用户积分消费记录 UI
- ❌ 无积分商城/兑换

### 建议

分批接入：先接入高价值动作（SUBMIT_CASE、COMPLETE_PROFILE、REFER_USER），再接入低价值动作。

---

## B2：Notification 架构不完整 🟠

### 现状

- **纯 Redis 存储**（`LPUSH` + `LTRIM` 100 条 + 30 天 TTL）
- Redis 重启 → 所有通知丢失
- 13 个通知类型定义了，但多数无触发器
- `DEADLINE_REMINDER` 类型存在但**无定时触发器**
- 无 email 通知后端（`EmailService` 存在但 Notification 模块未使用）
- 无 push 通知（Mobile 的 `expo-notifications` 已配置但未对接后端）
- 无消息摘要/批处理

### 建议

1. 短期：加 PostgreSQL 持久化层作为 fallback
2. 中期：对接 EmailService 发送重要通知
3. 长期：对接 expo-notifications + 定时触发 deadline reminder

---

## B3：Subscription 是 Mock 🟡

### 现状

`processPayment()` 硬编码返回 success（500ms 延迟模拟）：

- 3 个定价层级（FREE/PRO/PREMIUM）已配置
- Admin 动态定价已实现
- 但无 Stripe/支付宝/微信支付集成
- 无自动续费
- 无取消调度

### 建议

根据目标用户群选择支付网关（国内用户 → 支付宝/微信，海外用户 → Stripe）。

---

## B4：Admin 缺失功能 🟡

### 已有（76 端点）

用户管理（ban/unban/role/delete）、审计日志、AI Agent 配置（40 端点）、Memory 管理、通知广播、学校/截止日期/事件 CRUD、活动模板、校准参数、积分配置、CSV 导出

### 缺失

| 功能               | 描述                                   | 优先级 |
| ------------------ | -------------------------------------- | ------ |
| 用户模拟           | Admin "以用户身份登录" 排查问题        | 高     |
| Case 审核 UI       | Verification 后端有，admin 面板无入口  | 高     |
| Essay 管理         | 无 Essay CRUD 端点                     | 中     |
| 退款管理           | 无退款/取消订阅端点                    | 中     |
| 系统健康仪表盘     | 只有 AI Agent 健康端点，无全局健康面板 | 中     |
| Forum 内容审核详情 | Content 页有 tab 但无深度操作          | 低     |

---

## B5：GlobalEvent 管理不够直观 🟡

### 现状

Admin 后端有 GlobalEvent CRUD（`/admin/global-events`），但 admin 前端中这个入口的发现性不够强。Timeline 模块依赖 GlobalEvent 来自动生成用户日程。

### 建议

确保 admin 面板的 Events 页面明确展示 GlobalEvent 管理入口。

---

## B6：Peer-Review 准入门槛过高 🟡

### 现状

要求：

1. 双方都是 VERIFIED+ 角色
2. 互相关注
3. 主动发起请求（对方需接受）
4. 7 天有效期

**结果**: 能用这个功能的用户非常少。与 AI Essay Review 定位不同（同行互评 vs AI 评估），但用户可能困惑。

### 建议

- 降低门槛：允许 USER 角色参与
- 去掉互相关注要求，改为"同一学校列表"匹配
- 或者评估是否值得保留此功能

---

## B7：Forum 团队功能定位不明 🟡

### 现状

Forum 实现了完整的团队系统：

- 创建团队帖子
- 申请加入 / 邀请
- 接受/拒绝
- 成员管理

在留学申请场景中，"组队"的用途不清晰（暑校结伴？文书互助小组？）。

### 建议

明确产品定位后决定保留或简化。如果保留，需要在前端给予更好的引导和曝光。
