# 全产品面审计复用手册

## 1. 目标

- 让下一次全量检测不依赖本次聊天上下文。
- 保证 Codex、Claude、Cursor 或其他工程师都能从同一套事实源和模板开始。

## 2. 下次运行顺序

1. 读取：
   - `CLAUDE.md`
   - `docs/FULL_SURFACE_REGISTRY.md`
   - `docs/FULL_SURFACE_GAP_CHECKLIST.md`
   - `docs/JOURNEY_REGISTRY.md`
2. 生成最新 inventory：

```bash
pnpm full-surface:generate --audit-date YYYY-MM-DD
```

3. 查看输出：
   - `e2e-report/full-surface-YYYY-MM-DD/manifest.json`
   - `e2e-report/full-surface-YYYY-MM-DD/route-inventory.json`
   - `e2e-report/full-surface-YYYY-MM-DD/capability-inventory.json`
   - `e2e-report/full-surface-YYYY-MM-DD/journey-overlay.json`
   - `docs/FULL_SURFACE_AUDIT_LOG_YYYY-MM-DD.md`
   - `docs/FULL_SURFACE_AGENT_REVIEW_YYYY-MM-DD.md`
4. 先做 `Batch 0` 分诊，再按 `Batch 1-5` 顺序执行。
5. 每批结束后，同步更新：
   - `docs/FULL_SURFACE_AUDIT_LOG_YYYY-MM-DD.md`
   - `docs/FULL_SURFACE_AGENT_REVIEW_YYYY-MM-DD.md`
   - `docs/USER_JOURNEY_AUDIT_LOG.md`
   - `MEMORY.md`

## 3. 各类页面默认 Agent 组

| surface type                         | 默认 Agent 组                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| web applicant/auth                   | `design-reviewer` / `i18n-specialist` / `applicant-simulator` / `test-engineer`                       |
| web AI / prediction / recommendation | `ai-prompt-engineer` / `study-abroad-expert` / `applicant-simulator` / `test-engineer`                |
| mobile                               | `mobile-specialist` / `design-reviewer` / `i18n-specialist` / `applicant-simulator` / `test-engineer` |
| admin / security / MCP               | `architect` / `data-model-reviewer` / `security-reviewer` / `design-reviewer` / `test-engineer`       |
| closure                              | `integration-checker` / `test-engineer` / `user-journey-auditor`                                      |

## 4. 证据采集模板

- route：
  - 进入态截图
  - 结果态截图
  - loading / empty / error 至少一种真实态
  - 质量维度简述
- capability：
  - 入口证据
  - 动作证据
  - 结果证据
  - 失败态摘录
- journey overlay：
  - 继续沿用 `docs/templates/user-journey-audit.md`

## 5. 常见误判

- 不要把 dev-only HMR / Turbopack 告警记成用户稳定报错。
- 不要把 applicant AI / recommendation 页的 delegated rerun 抖动直接记成产品回归；先确认 `_journeys/<id>/record.json` 是否已稳定落地。
- 不要把 guest/shared 页面匿名初始化时的 `/auth/refresh`、`/users/me -> 401` 记成 public/auth 页面 bug；full-surface runner 应先 stub 匿名 auth bootstrap。
- 不要把缺 seed / 外部配置 / 真机前置记成产品逻辑崩溃。
- 不要把“接口有返回”当成 AI 能力通过。
- 不要把“两个端都有”当成跨端复用合理。
- 不要把“页面能打开”当成专业留学中介感成立。

## 6. 已知 conditional capability gates

- `A11` / `SJ-3`
  - Android remote push / notification-open on a physical device
  - 依赖：`apps/mobile/android/app/google-services.json` + 真机 dev build

## 7. 推荐执行顺序

- 永远先做：
  - `Batch 0`
  - `Batch 1`
  - `Batch 2`
- `Batch 2` 里的 applicant AI / recommendation surfaces 默认走 chunked execution：
  - 先跑 `A3 / RECOMMENDATION_GENERATE`
  - 再跑 `A10 / PREDICTION_RUN`
  - 再扩到 `A4-A9 / SJ-1`
- 对同一 delegated journey 不要高频 `force-rerun`；先确认旧进程已清理、Redis 锁已释放，再做下一次 rerun。
- mobile 与 admin/MCP 可并行，但收口必须最后统一回到 `Batch 5`。
- 任何新发现的“容易漏掉的检查点”都要先写进 `docs/FULL_SURFACE_GAP_CHECKLIST.md` 和 `MEMORY.md`，再结束本轮。

## 8. Dynamic Route 样例策略

- full-surface runner 现在默认先读 sample catalog，再做最小 fallback 创建：
  - `resumeId` 缺失时自动创建最小 resume
  - `teamId` 缺失时优先读取 `teams/my`，仍缺时自动创建最小 public team
  - `forumPostId` 缺失时读取 forum category 并自动创建最小 forum post
- 仍无法拿到稳定样例时，route/capability 才记 `BLOCKED(DATA_ISSUE)`。
- 当前仍建议长期维护的样例键：
  - `resumeId`
  - `teamId`
  - `forumPostId`
  - `chatConversationId`
  - `essayGalleryId`

## 9. Batch 3 mobile 启动前置

- 先确认：
  - `adb devices -l` 至少有一个 `device`
  - `adb shell pm list packages com.studyabroad.mobile` 能看到 dev build
  - `pnpm --filter study-abroad-mobile start:dev-client` 已起，必要时用 `a` 拉起 Android
- 如果 `A11 / SJ-3 / NOTIFICATION_MOBILE_SYNC` 仍未通过：
  - 先判断是不是 route reachability 问题
  - 再判断是不是 Android remote push 条件 gate
  - 不要把“页可达但 push 不通”写成笼统的 mobile `ISSUE`
