# 校友广场 (Hall) 重构总体规划 — Plan C

> 本文档由多 agent 辩论（9 个分析 agent + 4 个方案 agent）综合而成，是 Hall
> 功能重构的单一事实源。分支：`hall-restructure`。

## 一、为什么要做

一轮 9-agent 全面审查（study-abroad / applicant-simulator / architect /
design-reviewer / user-journey-auditor / data-model-reviewer / security-reviewer /
ai-prompt-engineer / i18n-specialist）得出三类结论：

1. **战略**：Hall 现在是 4 个拼在一起的功能，只有 `verified`（中国大陆录取
   数据）是不可替代的护城河；`ranking` / `review` 的数字化打分构成与
   `prediction` 竞争的「第二权威」，违反 `ai-system.md`「prediction 是唯一
   概率/tier 权威」的精神；`path` 的连胜/徽章/排行榜是对高焦虑决策的赌博式
   游戏化，对付费家长是品牌风险。
2. **安全（最严重）**：4 个 BLOCK 级漏洞——锐评无同意闸门（可锐评未成年人）、
   锐评读接口无 opt-out 过滤（IDOR）、Hall 服务读原始 Profile 绕过脱敏快照、
   `verified-ranking` 未授权公开真实姓名 + 录取结果。
3. **质量**：死代码、`loading.tsx` 不匹配、术语三套并存、verified 两个数据面
   口径不一致。

## 二、目标终态

Hall 从「4-tab 游戏厅」收敛为「**可信录取数据 + 案例学习 + 定性同伴反馈**」。
所有「你有多强 / 录取概率 / tier」统一收口到 `prediction`。

| Tab                     | 终态                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `verified` 录取数据中心 | **核心护城河**，修复口径与 ED/EA/REA 桶                                                         |
| `path` 学长之路         | 保留「看真实案例 + 猜结果 + AI 复盘」学习闭环，**移除赌场层**（连胜/徽章/每日挑战/积分/排行榜） |
| `ranking` 同伴定位      | **去评分**：删档位 tier、改百分位区间、加小样本免责 + prediction 跳转                           |
| `review` 同伴反馈       | **砍数字打分**，只留定性文字反馈，术语 锐评→同伴反馈                                            |

> 备选（study-abroad 方案，列为后续可选）：把 `ranking` 并入 `verified` 成
> 「录取数据」单 tab，Hall 收为 3 tab。本规划采用「保留 4 tab、逐个去毒」的
> 较低风险路径；合并可作为 C 完成后的独立优化。

## 三、批次总览

每批独立可提交、可验收、非破坏性。安全修复折叠进「改写同一文件」的批次。

> **执行策略（2026-05 重排）**：按「风险」而非原编号顺序推进——安全 BLOCK 是真实
> 负债，产品质量改动是优化。`C2` 因此拆为 `C2a`（安全闸门，纯后端）+ `C2b`（产品
> 形态改写）；`C5` 的 `B4` 因为是最小、自包含的安全修复，已提前单独完成。
> **目标：先把 4 个安全 BLOCK 全关掉，再做产品形态批次。**

| 批次    | 目标                                              | 安全项                    | 量级 | 状态                                 |
| ------- | ------------------------------------------------- | ------------------------- | ---- | ------------------------------------ |
| **C1**  | `ranking` 去评分                                  | —                         | M    | ✅ 已完成（`625f71ce`）              |
| **C2a** | `review` 安全闸门（纯后端）                       | B1 + B2 + <16 + 限流      | M    | ✅ 已完成（`a387aedc`）              |
| **B4**  | `verified-ranking` 实名 + 可见性                  | B4                        | S    | ✅ 已完成（`c7499a24`）              |
| **B3**  | swipe / getPublicProfiles 不再泄露精确 GPA / 国籍 | B3 + getPublicLists email | M    | ✅ 已完成（`f19ae8db` + `afe3d472`） |
| **C2b** | `review` 砍数字打分 → 定性表单                    | —                         | L    | 待做（产品形态，前端重写）           |
| **C3**  | `path` 去游戏化                                   | —                         | M    | 待做                                 |
| **C4**  | `verified` 修复（口径/ED-EA-RD/去排行榜框架）     | —                         | M    | 待做                                 |
| **C6**  | 迁移：删已弃用的列                                | —                         | S    | 待做（延后，C2b/C3 稳定后）          |

**🔒 安全阶段已 100% 完成**：4 个安全 BLOCK（B1/B2/B3/B4）+ 邮箱 WARN 全部关闭。
**剩余推荐顺序**：C2b → C3 → C4 → C6（均为产品形态重构，前端大块改写）。

---

## 四、逐批次详细方案

### C1 — `ranking` 去评分 ✅ 已完成

删除 `competitivePosition`（strong/moderate/challenging）；LLM prompt 不再产出
tier；百分位成为主视觉，`#N` 降为小字；加小样本免责 + `/prediction` 跳转；
SummaryStats 去掉第 4 格；mobile 同步。13 文件 / api+web+mobile。

### C2 — `review` 砍数字打分 → 纯定性反馈

**产品形态**（study-abroad + design 定）：

- 砍掉 5 维 1-10 打分（academic/test/activity/award/overall）。
- 评审者产出改为 3 个结构化定性 prompt：① 一个亮点 ② 一个可以更清晰的地方
  ③ 一条具体建议；保留 `quickTags` 标签芯片。
- 被评者收到的是定性反馈卡片集合，**不再有「综合 6.2/10」**。
- 术语：`锐评` → `同伴反馈`；memory category `锐评` 改名。
- 两个 wizard（SwipeReviewWizard 滑动评分 + ClassicReviewWizard 滑块）合并为
  单一定性表单；`SwipeReviewWizard` 删除（其存在意义就是把滑动映射成分数）。

**改动清单**：

- backend：`hall-review.service.ts`（`createReview`/`updateReview`/`getReviewStats`
  去 averages、`recordReviewToMemory` 去分数）、`hall-review-aggregator.service.ts`
  （去 4 维均值聚合）、`dto/index.ts`（`CreateReviewDto` 评分字段改 `@IsOptional`）。
- web：`review/ReviewTab.tsx`（删 choose-mode 阶段）、删 `SwipeReviewWizard.tsx` /
  `ClassicReviewWizard.tsx` → 新单一定性表单、`ReviewModuleCard.tsx` 评估删除、
  `review-shared.ts` 删 `ReviewScores`/`swipeToScore`/`computeOverall`。
- mobile：`screens/hall/ReviewSwipeTab.tsx` / `ReviewProfileCard.tsx` / `types.ts`。
- shared：`AggregatedReviewPayload` 在 `@study-abroad/shared` → 需 build + mobile 同步。

**折叠的安全修复**：

- **B1**：`createReview()`/`updateReview()`（PUBLISHED 时）查目标 `acceptPeerReview`，
  false → `ForbiddenException`；**另加年龄硬下限**：从 `profile.birthday` 推算，
  <16 → `ForbiddenException`（`acceptPeerReview` 默认 `true`，开关不保护存量未成年人）。
  抽 `deriveAge` 到 `common/utils/age.util.ts` 共用。
- **B2**：`getReviewsForUser`/`getReviewStats`/`getReviewsForUserLegacy` 查目标
  `acceptPeerReview`，false → 返回空（非 403，避免枚举 oracle）。本人看自己的可豁免
  （controller 加 `@CurrentUser()`）。
- 限流：`POST /halls/reviews`、`PATCH`、`/report` 加 `@ThrottleSensitive()`。
- `HALL_REVIEWER_SELECT`（`hall.constants.ts`）删 `email`。

**契约/测试**：`getReviewStats` 响应去 `averages`；`hall-review.service.spec.ts` /
`hall.controller.spec.ts` 改写评分相关断言。Schema 评分列**本批不删**（C6 再删）。

### C3 — `path` 去游戏化

**保留**：浏览真实录取案例、「先判断结果再看 AI 复盘」的 swipe 学习闭环、
私有的「判断校准」准确率（仅自己可见，不上榜）。
**移除**：连胜（streak）、徽章（bronze→diamond）、每日挑战、积分 toast、
**整个排行榜**、成就 memory 写入、🎉 庆祝文案。

**改动清单**：

- backend：`swipe.service.ts`（删 streak/dailyChallenge/badge 写入、积分调用；
  保留 `getNextCases`/`submitSwipe` 学习闭环）、`hall-overview.service.ts`
  （`HallOverviewPayload` 去 points/streak/dailyChallenge）、`hall.controller.ts`
  （删 `swipe/leaderboard`、视情况删 `swipe/challenge`）。
- **领域 bug 修复**：`checkPrediction` 把 `deferred` 当 `waitlist` 是错的——
  加 `DEFER` 到 `SwipePrediction` 枚举，1:1 映射（前端已有 `DEFERRED` 样式）。
- web：删 `HallHeroBar.tsx`（4 格全是游戏化计分板）、`BadgeDisplay.tsx`、
  `DailyChallenge.tsx`、`StatsPanel.tsx`、`LeaderboardList.tsx`；`TinderTab.tsx`/
  `ChallengeTab.tsx`/`SwipeResultOverlay.tsx` 去游戏化文案与积分行；`page.tsx`
  移除 `<HallHeroBar />`。
- mobile：`screens/hall/PathTab.tsx`、`ChallengeMode.tsx`（可能删）、`HallHeroBar.tsx`。
- shared：`HallOverviewPayload`、`SwipeStatsDto`、`hallRoutes`（删的端点）。

### C4 — `verified` 修复

- **抽共享 verified 口径常量**：`hall-verified.service.ts`（宽口径）与
  `hall-verified-dashboard.service.ts`（L2/L3 + 中国国籍严口径）对「什么算
  verified case」定义不一致 → 抽 `VERIFIED_CASE_WHERE` 共享常量，两个服务组合它，
  消除「认证总数 N / 0 所学校」矛盾。
- **ED/EA/REA 拆 3 桶**：`getEdRdComparison` 把绑定的 ED 与非绑定的 EA/REA 合并，
  且用脆弱的 `.includes()` 子串匹配 → 改 `classifyRound()` 精确 token 匹配，拆
  `binding(ED) / earlyNonBinding(EA/REA/SCEA) / regular(RD)` 三桶。契约字段重命名
  → shared 变更 + mobile 同步。
- **难度信号改用率非计数**：`getDifficultySignal` 用录取人数年同比算「难度」，被
  样本量波动主导 → 改用录取率，或如实改名「样本中录取人数变化」。
- **去排行榜框架**：`verified` 的金/银/铜牌 + 「排行榜」标题把学生按录取学校排名，
  改为中性「已验证录取记录」列表。
- **空数据不设默认 tab**：`page.tsx` 不再硬编码默认 `verified`；verified 数据稀疏
  时回退到 `path`（`path` 永远有内容）。

### C5 — 安全：脱敏快照接入 + verified-ranking 匿名化（不可赶工）

- **B3**：`hall-ranking.service.ts` `getPublicProfiles`、`swipe.service.ts`
  `SWIPE_CASE_INCLUDE` / `getChallengeCase` 直接读原始 `Profile`（精确 GPA、
  `nationality`）→ 改读 `User.hallPublicProfile` 脱敏快照（分桶 GPA、coarse region）。
  快照为 `null`（未同意/未生成）的用户从公开面排除。`HallModule` 需注入
  `HallPublicProfileService`。
- **B4**：`verified-ranking`（`@Public()`）`getVerifiedRanking` 选了 `profile.realName`
  并直接对外 → 删 `realName`，改 `maskUserName`；`where` 加
  `visibility ∈ {ANONYMOUS, VERIFIED_ONLY}` 过滤。
- `getPublicLists` 删创建者 `email`。
- 契约：`PublicProfileResponse.gpa→gpaRange`、swipe 卡 `nationality→region` →
  shared + web + mobile 同步。
- **风险最高**：这批改的是「公开面背后是什么数据」，出错就是 PII 事故。
  独立提交、独立验收、security-reviewer 必过。

### C6 — 迁移（延后，破坏性，单独）

C2/C3 让 `Review` 的 5 个评分列、`SwipeStats` 的 streak/dailyChallenge 列变为
未使用。C6 才做 `DROP COLUMN` 迁移——破坏性、不可逆、走 `check-migration-safety`
门禁。**必须在 C2/C3 生产稳定后**单独做，绝不与 C2/C3 捆绑。

---

## 五、横切项

- **死代码清理**（knip `pnpm lint:dead-code` 确认后删）：`ListsTab.tsx`、
  `ReviewModuleCard.tsx`、C3 删的游戏化组件、`HallHeroBar.tsx`、相关 barrel 导出。
- **<16 岁红线**：`acceptPeerReview` 默认 `true`（opt-out），存量未成年人默认可被
  锐评 → C2 的年龄硬下限是真正的安全网。建议另立项：把默认值改 opt-in + 一次性
  迁移把 <16 用户设 `false`。
- **lints**：每个契约变更批次（C2/C3/C4/C5）必须先 `pnpm --filter
@study-abroad/shared build` 再验证 web/mobile；mobile 是必须 consumer。

## 六、执行与验收策略

- **逐批**：方案已定（本文档）→ 实现（四端）→ 自动门禁（typecheck + test +
  i18n + quality + `verify-gate`）→ 多 agent 验收 → commit 到 `hall-restructure`。
- **C5 安全批**：单独验收，security-reviewer 必过，不与其它批次捆绑赶工。
- **最终**：6 批全绿后开一个 PR，列清每批改动与延后项，待 review。

## 七、超出 Plan C 范围、需你另行拍板

1. `ranking` 是否并入 `verified` 成 3-tab（本规划保留 4-tab）。
2. `review` tab 是否整个下线（study-abroad 提出，本规划选择保留为定性形态）。
3. `acceptPeerReview` 默认值改 opt-in + 存量未成年人迁移。
4. 真实中国大陆录取数据采集管线（平台目前只有 demo seed，verified tab 实质为空）。
5. `verified` 的数据可靠性阈值是否收紧（当前 1 条样本即评 C 级）。
