# 用户旅程审计记录

> 每次审计完成后追加一个 section。持续积累，用于趋势分析和防漏。

---

## 2026-03-29 审计（AI Agent 系统全量）

### 元数据

| 项目     | 内容                                                   |
| -------- | ------------------------------------------------------ |
| 日期     | 2026-03-29                                             |
| 触发原因 | AI Agent 企业级升级后的验收审计                        |
| 审计范围 | AI Agent 系统（Persona A 的 A3-A9 + 功能审计 10 维度） |

### 审计结果

#### 功能审计（10 维度）

| #   | 维度            | 结果                               |
| --- | --------------- | ---------------------------------- |
| 1   | 工具注册完整性  | PASS — 42 个工具全部有 handler     |
| 2   | 委派安全性      | PASS — 无自循环、深度限制 3        |
| 3   | 对话所有权      | PASS — 所有操作验证 userId         |
| 4   | 内容审核覆盖    | PASS — 所有响应路径经过 moderation |
| 5   | Token 配额执行  | PASS — Guard 层拦截                |
| 6   | WebSocket 认证  | PASS — JWT 必须                    |
| 7   | Admin 端点权限  | PASS — 类级 @Roles(ADMIN)          |
| 8   | 工具错误消息    | PASS — 多语言 + 有上下文           |
| 9   | 数据清理 / GDPR | PASS — 衰减调度 + 删除接口         |
| 10  | Feature Flag    | PASS — 运行时可切换                |

#### 用户旅程审计（12 个 Bug + 6 个 UX）

**发现并修复的 18 个问题：**

| ID     | 旅程  | 问题                            | 严重性 | 状态     |
| ------ | ----- | ------------------------------- | ------ | -------- |
| Bug-1  | A6    | 并发请求竞争同一对话            | HIGH   | verified |
| Bug-2  | A3    | 推荐结果不可复现（无缓存）      | HIGH   | verified |
| Bug-3  | A3-A5 | Solve 阶段返回空白回复          | MEDIUM | verified |
| Bug-4  | A3    | 推荐已过期截止日期的学校        | MEDIUM | verified |
| Bug-5  | A3    | 搜索返回 0 结果无提示           | MEDIUM | verified |
| Bug-6  | A4    | 文书润色无长度限制              | MEDIUM | verified |
| Bug-7  | A5    | 时间线可创建过去的事件          | MEDIUM | verified |
| Bug-8  | A6    | 超长消息溢出 context window     | MEDIUM | verified |
| Bug-9  | A6    | WebSocket 流式断开不停止        | MEDIUM | verified |
| Bug-10 | A2    | profile 更新无字段校验          | MEDIUM | verified |
| Bug-11 | A3-A5 | 空消息校验不一致                | MEDIUM | verified |
| Bug-12 | A7    | 中英文切换回复不连贯            | MEDIUM | verified |
| UX-1   | A7    | 用户用英文但系统用中文回复      | HIGH   | verified |
| UX-2   | A8    | 越界问题无分层处理              | HIGH   | verified |
| UX-3   | A3    | Action 按钮靠关键词匹配（脆弱） | HIGH   | verified |
| UX-4   | A6    | 对话历史不压缩旧消息            | MEDIUM | verified |
| UX-5   | A9    | 错误恢复消息不含工具信息        | MEDIUM | verified |
| UX-6   | A3    | 新用户无档案引导                | MEDIUM | verified |

### 已验证通过的旅程（下次可跳过，除非相关代码变更）

- 工具注册完整性 (2026-03-29)
- 委派安全性 (2026-03-29)
- 对话所有权 (2026-03-29)
- 内容审核覆盖 (2026-03-29)
- Token 配额执行 (2026-03-29)
- WebSocket 认证 (2026-03-29)
- Admin 端点权限 (2026-03-29)
- 数据清理 / GDPR (2026-03-29)
- Feature Flag (2026-03-29)

### 尚未审计的旅程

- A1 注册→首次登录→引导
- A2 填写档案（仅审计了 profile 更新校验，未审计完整 UI 流程）
- A10 预测结果 / 案例库 / 排名
- A11 移动端一致性
- B1-B3 家长旅程
- C1-C5 管理员旅程

### 指标趋势

| 日期       | 发现问题数 | 修复数 | 旅程覆盖率 |
| ---------- | ---------- | ------ | ---------- |
| 2026-03-29 | 18         | 18     | 47% (9/19) |

---

> 下次全量审计应覆盖：A1, A2, A10, A11, B1-B3, C1-C5（本次未覆盖的 10 条旅程）
