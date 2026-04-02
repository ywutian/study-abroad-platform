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

| 日期       | 发现问题数 | 修复数 | 旅程覆盖率   |
| ---------- | ---------- | ------ | ------------ |
| 2026-03-29 | 18         | 18     | 47% (9/19)   |
| 2026-03-29 | 7          | 4      | 100% (19/19) |

---

## 2026-03-29 补充审计（剩余 10 条旅程）

### 审计结果

| #   | 旅程                      | Persona | 评分 | 结果   | 关键发现                                                                          |
| --- | ------------------------- | ------- | ---- | ------ | --------------------------------------------------------------------------------- |
| A1  | 注册→首次登录→引导        | 申请者  | 3/5  | ISSUE  | 引导可跳过，无强制新手流程                                                        |
| A2  | 填写档案                  | 申请者  | 3/5  | ISSUE  | 无内联字段校验，缺少必填标记                                                      |
| A10 | 预测/案例库/排名          | 申请者  | 4/5  | PASS   | 核心功能完整，缺 loading skeleton                                                 |
| A11 | 移动端一致性              | 申请者  | 4/5  | PASS   | **修正**：移动端功能完整（30+ 路由，含 profile/prediction/ranking）。之前审计误报 |
| B1  | 家长注册→查看进度         | 家长    | 1/5  | BROKEN | 系统无 PARENT 角色，旅程不存在                                                    |
| B2  | AI 中文问学费/签证        | 家长    | 4/5  | PASS   | 已有分层处理 + web_search                                                         |
| B3  | 查看选校列表和概率        | 家长    | 3/5  | ISSUE  | 无家长角色无法查看孩子数据                                                        |
| C1  | admin Dashboard           | 管理员  | 4/5  | PASS   | 布局清晰，缺错误边界                                                              |
| C2  | AI Operations → LLM Calls | 管理员  | 4/5  | PASS   | 功能完整，缺导出/排序                                                             |
| C3  | 用户管理                  | 管理员  | 4/5  | PASS   | 批量操作好，角色变更缺确认                                                        |
| C4  | 内容审核                  | 管理员  | 4/5  | PASS   | **已修复**：批量审核已实现（Batch 10）                                            |
| C5  | 学校数据管理              | 管理员  | 4/5  | PASS   | 三 tab 功能完整（列表+数据质量+同步）                                             |

### 问题状态更新

| ID    | 旅程 | 问题                               | 严重性   | 状态                                         |
| ----- | ---- | ---------------------------------- | -------- | -------------------------------------------- |
| GAP-1 | A11  | ~~移动端缺功能~~                   | ~~HIGH~~ | **closed（误报）**：移动端功能完整           |
| GAP-2 | B1   | 系统无 PARENT 角色，家长旅程不存在 | HIGH     | **wontfix**：产品决策不做家长角色            |
| GAP-3 | A1   | 新手引导可跳过                     | MEDIUM   | **fixed**（Batch 8：localStorage 持久化）    |
| GAP-4 | A2   | 档案 GPA 校验 bug                  | MEDIUM   | **fixed**（Batch 9：@Max(100) + scale 修复） |
| GAP-5 | C4   | 内容审核无批量操作                 | MEDIUM   | **fixed**（Batch 10：batch endpoint + UI）   |
| GAP-6 | B3   | 无家长账号关联机制                 | MEDIUM   | **wontfix**：依赖 GAP-2，已决策不做          |
| GAP-7 | C5   | 学校数据管理                       | LOW      | **closed**：审计完成，4/5 PASS               |

### 覆盖率更新

```
已审计旅程: 19 / 19
覆盖率: 100%
```

### 已验证通过（新增）

- A10 预测/案例库/排名 (2026-03-29)
- B2 AI 中文问学费/签证 (2026-03-29)
- C1 admin Dashboard (2026-03-29)
- C2 AI Operations LLM Calls (2026-03-29)
- C3 用户管理 (2026-03-29)

> 下一步：GAP-1（移动端）和 GAP-2（家长角色）需要产品决策——是要补齐还是从注册表中移除。

---

## 2026-03-31 审计（`fbd6095` 全量运行态重跑，23/23 已记录，审计保持 open）

### 审计元数据

| 项目       | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期       | 2026-03-31                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| HEAD       | `fbd6095`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 审计范围   | 注册表 19 条主旅程 + `SJ-1..SJ-4` 4 条新增子旅程                                                                                                                                                                                                                                                                                                                                                                                                               |
| 执行方式   | 本地 dev stack + 真实 Web/Admin 运行态 + Android Expo / Android 真机 dev build + 真实 MCP key / stdio 探测                                                                                                                                                                                                                                                                                                                                                     |
| 正式状态集 | `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 证据目录   | `e2e-report/journeys-2026-03-31/`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 正式结论   | `23/23` journey records 均已补齐且无空白状态；Web/Admin/MCP 与 mobile core flows 已重跑完成。2026-04-02 follow-up 又在 Android emulator 上补跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications，确认 mobile 不再是“整体不可用”；standalone `studyabroad://` deep link 也已在 Android 真机 dev build 下验证成功，但 `A11` 与 `SJ-3` 仍因 Android Firebase / FCM 原生配置缺失而无法完成真实 remote push，故继续保持 `BLOCKED`，本轮审计继续 open |

### 运行环境 gate

- 本轮在本地 `fbd6095` dev stack 上执行，Web/API/Admin 证据全部来自真实运行中的本地应用。
- 申请者、管理员与丰富样本账号均可实际登录；A 系与 C 系旅程使用 `alice.zhang@demo.studyabroad.com`、`demo@example.com`、`admin@example.com` 等真实 seed 账号完成。
- iOS 模拟器在本会话中无法连接 `CoreSimulatorService`，A11/SJ-3 改走 Android；先用 Android runtime 完成 Home / Profile / Prediction / Notifications 运行态验证，再用 USB 连接的真实 Android 手机和独立 dev build 验证 production `studyabroad://` scheme。2026-04-02 follow-up 又在 Android emulator 上补跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications，mobile blocker 已从“启动崩溃 / 模拟器无数据”进一步收敛为“Android Firebase / FCM 原生配置缺失，导致真机也无法完成 Expo push token 注册”。
- SJ-4 已使用真实 admin 账号创建 MCP key，并完成 live tool call、rejection 与 free-text guard 路径的本地重跑。

### 新增子旅程固定登记

- `SJ-1` 学校详情 → 学校对比
- `SJ-2` Web 通知中心 / 通知页
- `SJ-3` Mobile 通知页
- `SJ-4` Admin 创建 MCP key → 外部 MCP 客户端调用工具

### 结果汇总

| 状态    | 数量 |
| ------- | ---- |
| PASS    | 18   |
| ISSUE   | 0    |
| BROKEN  | 0    |
| BLOCKED | 2    |
| SKIPPED | 3    |

### 23 条结果矩阵

| ID   | 状态    | 评分 | 账号 / 介质                                 | 证据                                              | 备注                                                                                                                                                                               |
| ---- | ------- | ---- | ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | PASS    | 4/5  | fresh applicant / web                       | `e2e-report/journeys-2026-03-31/A1/record.json`   | 注册 + auto-login + onboarding 恢复链已重跑通过                                                                                                                                    |
| A2   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A2/record.json`   | profile 全 CRUD 与保存回显已跑通                                                                                                                                                   |
| A3   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A3/record.json`   | 首次选校推荐生成成功                                                                                                                                                               |
| A4   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A4/record.json`   | 文书评审 / 润色单轮完成                                                                                                                                                            |
| A5   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A5/record.json`   | 时间线单轮完成，文本摘录有流式抓取噪声                                                                                                                                             |
| A6   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A6/record.json`   | 5+ 轮多轮对话已在同一会话真实跑通                                                                                                                                                  |
| A7   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A7/record.json`   | 中英文切换单轮完成                                                                                                                                                                 |
| A8   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A8/record.json`   | 越界问题单轮完成                                                                                                                                                                   |
| A9   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A9/record.json`   | 工具失败 / 错误恢复单轮完成                                                                                                                                                        |
| A10  | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A10/record.json`  | prediction/history/cases/ranking 重跑通过                                                                                                                                          |
| A11  | BLOCKED | 3/5  | Android emulator + Android 真机 + dev build | `e2e-report/journeys-2026-03-31/A11/record.json`  | Emulator 已重跑通过 Home / Schools / Cases / AI / Profile / Forum / Notifications；真机 deep link 也已验证，剩余 blocker 仅是 Firebase / FCM 未初始化导致 Expo push token 申请失败 |
| B1   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B1/record.json`   | 当前产品无 parent persona 入口                                                                                                                                                     |
| B2   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B2/record.json`   | parent AI 旅程无法真实进入                                                                                                                                                         |
| B3   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B3/record.json`   | parent 选校监督旅程无法真实进入                                                                                                                                                    |
| C1   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C1/record.json`   | admin dashboard 已实际加载                                                                                                                                                         |
| C2   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C2/record.json`   | AI Operations / LLM Calls 已实际加载                                                                                                                                               |
| C3   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C3/record.json`   | 用户管理 → AI 使用已实际加载                                                                                                                                                       |
| C4   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C4/record.json`   | 内容审核 → 举报处理已实际加载                                                                                                                                                      |
| C5   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C5/record.json`   | 学校数据质量页已实际加载                                                                                                                                                           |
| SJ-1 | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/SJ-1/record.json` | 学校详情 → 对比页重跑通过                                                                                                                                                          |
| SJ-2 | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/SJ-2/record.json` | 通知中心 + 通知页 + mark-all 已实际跑通                                                                                                                                            |
| SJ-3 | BLOCKED | 3/5  | Android emulator + Android 真机 + runtime   | `e2e-report/journeys-2026-03-31/SJ-3/record.json` | 通知页 delete/read/unread sync 已在 emulator + 真机复核；剩余 blocker 仅是 Firebase / FCM 未初始化导致真实 remote push 无法送达 / 打开                                             |
| SJ-4 | PASS    | 4/5  | `admin@example.com` + MCP stdio             | `e2e-report/journeys-2026-03-31/SJ-4/record.json` | live key / invalid-expired-revoked key / free-text guard 已重跑通过                                                                                                                |

### 本轮 regression / blocker 汇总

- `A11` / `SJ-3` `BLOCKED`：mobile startup blocker 已解除，2026-04-02 follow-up 又在 Android emulator 上重跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications；AI `Analyze my profile` 已能返回完整答案。当前唯一剩余 blocker 已不是 app 启动、seed 数据或 emulator 介质，而是 Android Firebase / FCM 原生配置缺失：`apps/mobile/android/app/google-services.json` 缺失，导致 `Notifications.getExpoPushTokenAsync` 在真机上报 `Default FirebaseApp is not initialized in this process com.studyabroad.mobile`。根因与限制见 `apps/mobile/src/hooks/useNotifications.ts:90-142`、`apps/mobile/src/lib/api/client.ts`、`apps/mobile/src/app/(tabs)/ai.tsx`、`apps/mobile/android/app/build.gradle`、`apps/mobile/android/build.gradle` 与 `e2e-report/journeys-2026-03-31/A11/push-limitations.txt`。
- `B1-B3` `SKIPPED`：本轮不是沿用旧结论，而是实际再次确认 live product 不存在 parent 角色 / 入口，因此正式记为 `SKIPPED`。
- 其余 `A1-A10`、`C1-C5`、`SJ-1`、`SJ-2`、`SJ-4` 已在本轮修复后重新实际跑通，不进入当前 blocker set。

### Stop condition 检查

| 检查项                                         | 结果                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `19` 条主旅程 + `4` 条子旅程是否全部有非空状态 | 是                                                                                                                                          |
| 是否全部有运行态 evidence path                 | 是                                                                                                                                          |
| 是否存在空白条目                               | 否                                                                                                                                          |
| 是否仍存在 `BLOCKED`                           | 是，`A11` 与 `SJ-3`                                                                                                                         |
| 本轮审计是否可关闭                             | 否；当前 `A11 / SJ-3` 的 Android remote push 已改为 `conditional capability gate`，不再等同于核心 runtime blocker，但该条件能力仍需单独跟踪 |

### 2026-04-02 Follow-up（Android emulator 复测）

- 触发原因：用户在 follow-up 中指出“模拟器也没有数据，AI 不能用”，因此对 Android emulator 做了额外真实运行态复测。
- 复测结果：
  - local API health、db、redis 全部恢复后，emulator 里的 Home / Schools / Cases / AI / Profile / Forum / Notifications 都能加载真实 seed 数据。
  - `Analyze my profile` 现在会在 mobile AI tab 返回完整文案，不再出现 `HTTP 401`、`No response body` 或只有空白消息气泡的旧坏态。
  - 这次复测确认此前“模拟器无数据 / AI 不可用”并不是单一后端停机，而是 `db` 未启动、feature seed 里 case 未自动变成 public review status、mobile API client 对顶层 `data` 字段的过度解包、以及 RN SSE body reader 不稳定几项问题叠加。
- 新增证据：
  - `e2e-report/journeys-2026-03-31/A11/07-emulator-home.png`
  - `e2e-report/journeys-2026-03-31/A11/08-emulator-schools.png`
  - `e2e-report/journeys-2026-03-31/A11/09-emulator-cases.png`
  - `e2e-report/journeys-2026-03-31/A11/10-emulator-ai-answer.png`
  - `e2e-report/journeys-2026-03-31/A11/11-emulator-profile.png`
  - `e2e-report/journeys-2026-03-31/A11/12-emulator-forum.png`
  - `e2e-report/journeys-2026-03-31/A11/13-emulator-notifications.png`
  - `e2e-report/journeys-2026-03-31/A11/emulator-runtime-smoke.txt`
  - `e2e-report/journeys-2026-03-31/SJ-3/04-emulator-notifications-list.png`
  - `e2e-report/journeys-2026-03-31/SJ-3/emulator-runtime-smoke.txt`

### 2026-04-02 Follow-up（漏检检查点回填）

- 在上面的 emulator follow-up 之后，用户继续指出了几类此前检查遗漏、但确属 mobile 真实体验的一阶检查点：
  - Profile 页虽然“能加载”，但 completion ring 与文案布局一度明显失衡；
  - 学校页虽然“有数据”，但 school logo 没有走统一来源与 website-domain fallback；
  - Home quick action 里的 `Swipe Game` 没被纳入初次 emulator follow-up，后续实际打开后直接崩溃；
  - `Swipe Game` 崩溃修掉后，结果 overlay 仍暴露出 i18n 模板残留和明显失衡的反馈设计。
- 这些点说明本轮 `A11` 的“follow-up 已通过”只能解释为 mobile core data/runtime 已恢复，不能外推为“视觉、品牌资产、二级入口与瞬时反馈层已全部复核”。
- 本轮已将这些漏检点追加到工作底稿 `docs/CODE_REVIEW_2026-03-31_fbd6095.md` 的 mobile checklist 中；后续 A11 / SJ-3 复跑必须显式覆盖：
  - profile 布局与进度组件；
  - 学校 logo 来源/fallback；
  - 至少一个 Home quick action 二级入口；
  - 至少一个瞬时反馈态（如 Swipe result overlay）。

### 备注

- A4/A5/A7/A8/A9 的 `response.txt` 受流式 UI 抓取方式影响，文本摘录存在噪声；状态判定以截图、live page 完成态和实际 POST 成功为准。
- 本轮对子旅程 `SJ-1..SJ-4` 先按稳定临时 ID 固定登记；是否升格进入主注册表，待后续 registry 调整时再决策。

---

## 2026-04-01 流程治理更新（AI-first 发版门禁）

### 背景

- 后续发版门禁不再采用“人工先全量探索、Codex 事后补充”的模式。
- 自本次治理更新起，正式流程切换为：`Codex 预检 -> Codex 首轮执行 -> 人工补位体验验证 -> Codex 收口复验 -> 发版结论`。

### 固定规则

- 正式门禁环境默认是共享预发环境。
- `Baseline Smoke` 必须先由 Codex 全跑。
- 非技术用户只负责体验型验证，不负责日志、接口、seed 和环境准备。
- 正式状态继续使用 `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED`。
- 审计记录新增两个必填字段：
  - `execution_owner`
  - `validation_type`

### 正式产物

- `docs/QA_RELEASE_GATE_SOP.md`
- `docs/CODEX_E2E_RUNBOOK.md`
- `docs/JOURNEY_REGISTRY.md`
- `docs/RELEASE_IMPACT_MAPPING.md`
- `docs/AI_AGENT_EVALUATION_RUBRIC.md`
- `docs/CROSS_PLATFORM_REUSE_RUBRIC.md`
- `docs/PROFESSIONAL_CONSULTANCY_RUBRIC.md`
- `docs/templates/human-e2e-task-card.md`
- `docs/templates/e2e-issue-report.md`
- `docs/templates/release-gate-master.md`
- `docs/examples/AI_FIRST_RELEASE_GATE_SAMPLE.md`

### 后续执行口径

- `objective` 旅程先由 Codex 执行。
- `experiential` 旅程先由 Codex 清障，再交人工补位。
- `admin-only` 旅程由内部 owner 或 Codex 在授权范围内执行。
- 正式放行只看门禁总表、证据目录和问题单，不再从聊天记录拼结论。
- 以下 4 项从 2026-04-01 起升级为正式门禁维度，而不是“额外体验建议”：
  - 布局合理性
  - AI Agent 功能与输出合理性
  - Web / Mobile 复用合理性
  - 是否符合专业留学中介定位

## 2026-04-02 流程治理更新（conditional capability gates）

- `A11` / `SJ-3` 已正式拆成两层结论：
  - mobile 核心运行态 / 页面级行为
  - Android remote push / notification-open 条件能力
- Android remote push 现在登记为 `conditional capability gate`：
  - 缺少 `apps/mobile/android/app/google-services.json` 时，旅程记录仍可写 `BLOCKED`
  - 但这类 blocker 不再自动把整轮 release gate 判成 `HOLD`
  - release gate 默认降为 `CONDITIONAL`，同时把该能力继续列入总表、handoff 和审计 section
- 当前 live gate 包 `live-2026-04-01-gate` 已按这一新规则刷新：
  - `PASS 13 / BLOCKED 2`
  - `A11`、`SJ-3` 的 blocker 均只剩 Android remote push
  - 最终放行建议已从 `HOLD` 降为 `CONDITIONAL`

## 2026-04-02 Follow-up（Web / Admin live gate 补充复跑）

### 触发原因

- 在 live gate 已经收敛到 `A11 / SJ-3` 两条 mobile 条件能力 blocker 之后，仍需要回答一个更具体的问题：网页端是否也都已经 fresh 复核，而不是部分沿用旧证据。

### 补充复跑范围

- `SJ-1` 学校详情 → 学校对比
- `C2` AI Operations → LLM Calls
- `C3` 用户管理 → AI 使用
- `C4` 内容审核 → 举报处理
- `C5` 学校数据质量

### 复跑结果

- 上述 5 条旅程已在与 `live-2026-04-01-gate` 相同的本地 live 环境 fresh 重跑，并全部 `PASS`。
- `C2-C5` 的 fresh records 现已明确包含 `pageResponseStatus = 200` 与目标 admin 路由的 `finalUrl`，因此此前 runtime issue 中“admin 子路由可能只是截图命中页面壳子、实际仍有 404”的疑点已被清除。
- `SJ-1` 也已在同一 live 环境下补跑通过，因此当前 web applicant / admin / MCP 路径不存在新的 runtime blocker；live gate 里剩余的 `BLOCKED` 已只属于 mobile `A11 / SJ-3` 的 Android remote push 条件能力。

### 补充证据

- `e2e-report/releases/live-2026-04-01-gate/journeys/SJ-1/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C2/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C3/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C4/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C5/record.json`
- `/tmp/live-2026-04-01-gate/release-gate-master.md`
