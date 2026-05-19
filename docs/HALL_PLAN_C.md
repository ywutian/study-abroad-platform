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
| **C2b** | `review` 砍数字打分 → 定性表单（后端 + 前端）     | —                         | L    | ✅ 已完成（`60861bb5` + `5b14d40e`） |
| **C3**  | `path` 去游戏化                                   | —                         | M    | ✅ 已完成（`00e418a3` + `4e1620b3`） |
| **C4**  | `verified` 修复（口径/ED-EA-RD/去排行榜框架）     | —                         | M    | ✅ 已完成（`62bda40f` + `4ac5066c`） |
| **C6**  | 迁移：删已弃用的列                                | —                         | S    | ⏸ 刻意延后（见下）                   |

**🔒 安全阶段已 100% 完成**：4 个安全 BLOCK（B1/B2/B3/B4）+ 邮箱 WARN 全部关闭。
**🎯 C1–C4 全部完成**——后跟一轮 3-agent 验收（integration / security / design）+ 修完全部发现项（`6b64f2d9`、`30a38a5d`）。

**C6 为何刻意延后**：C6 是对 `Review` 评分列、`SwipeStats` 连胜/徽章列的 `DROP COLUMN`
破坏性迁移。本规划与项目数据库规则都要求破坏性迁移**在写这些列的代码生产稳定后**
才执行——否则一旦回滚，丢列即丢数据。C1–C4 已让这些列「不再被读写」（安全的中间
态：列仍在、可空、有默认值）。C6 应在 `hall-restructure` 合并并稳定运行后，作为
独立迁移单独执行。这不是「未完成」，是迁移安全的正确次序。

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

## 七、§7 决策 —— 最终拍板（三方制结构化辩论，4 轮 28 agent）

2026-05-19。决策经四轮多 agent 辩论收敛：① 第一轮 5 agent 初判；② 第二轮 5 agent
红队压力测试；③ 第三轮 6 个决策各设独立辩论格、正方 vs 反方、12 个 agent 一对一对辩；
④ **第四轮：每格补一个独立「裁判」agent，6 个裁判分别审一格，三方制（正方/反方/裁判）**。
6 个裁判**全部独立裁定与第三轮一致**，并补了两处更优设计（见 E、F）。下为最终裁决。

### A. `ranking` tab → **保留现状，不撤不并**（结构化辩论改）

正方主张撤 tab（独立 tab = 第二权威暗示）；反方胜：C1 已把 `ranking` 去毒成「百分位

- 免责 + prediction 跳转」并上线，撤 tab 是拆已验收成果（负 ROI）；「移到 prediction
  旁」反而把误读风险搬到最危险的邻居。**裁决：保留 `ranking` tab 的 C1 形态，不撤、不并入
  `verified`**。A 实质降为 no-op。

### B. `review` → **立即整体退役**（结构化辩论改）

正方主张「定时日落」；反方胜：「日落观察期 + 近零使用即删」是循环论证（自己掐断入口
再用使用率判死刑），且日落期继续付安全税。**裁决：立即整体退役 `review`，
`DROP TABLE Review / ReviewReaction` 折叠进 C6 一并执行。不设观察期。**

### C. `acceptPeerReview` → **立即全量置 false 止血**（结构化辩论精简）🔴

正方（security）：opt-out 下零合法 PIPL 同意，须清「全部无效同意」全集。反方点出
B/C 矛盾。**裁决：保留「立即全量 `UPDATE acceptPeerReview=false`」止血**（纯数据
UPDATE、非破坏性、优先级 #1——拔违规插头）；**删掉「补移动端 opt-in 开关」**（B 已裁
`review` 退役，opt-in 开关无对象）；`acceptPeerReview` 列随 `Review` 在 C6 一并删除。

### D. 真实数据管线 → **先做 `path` 案例试点，以此为闸门**（结构化辩论修正指标）

正方：reversibility 不对称，先小后大。反方点出冷启动悖论——试点数据会撞 E 的
「n<3 隐藏」。**裁决：方向成立（先试点再决定 XL），但修正试点指标**——试点把 ~30–50 条
真实、已同意的案例录入 `path` 案例库（`path` 无可靠度阈值、单条即可浏览），埋点测
**案例浏览参与度 / 留存**，不伪装成 verified 仪表盘的付费转化验证。以此信号为闸门
决定是否建 XL 管线（复用 `case`+`verification`，不爬虫）。若建，必须带 AI 权威硬契约：
不显示可推算比率、不用预测性措辞、挂 prediction 跳转 + 「这是先例不是录取估计」免责。

### E. `verified` 可靠度阈值 → **废掉 A/B/C 等级，改置信区间渲染层级**（裁判补的更优设计）

正方（data-model）：n<5 录取率是噪声 + n<3 兼作 k-匿名。反方：A≥15 对「中国学生申某
美本」的天然样本稀缺是「A 级永不可达」。**裁判裁决:n<3「隐藏」成立(k-匿名硬下限);
但 A≥15/B≥8/C≥3 这套等级被否——拍脑袋、且会让 verified 永久空白。** 裁判给出更优设计:

- **废掉「A/B/C 可靠度等级」这套会自我打脸的命名**;
- 改为按**置信区间宽度**渲染:n<3 → 隐藏;n 3–9 → 只显原始计数 + 不确定标注(**不显
  百分率**);n≥10 → 显百分率 + 置信区间;
- `verified` tab **永不空白**:数据不足时显式呈现「样本积累中（已收录 X 条）」——把
  稀缺讲成「进度」而非「废弃」。

### F. 解散 Hall 容器 → **冻结待决；命名错位单独修**（裁判确认 + 拆项）

反方胜且无可辩驳:F 本就是「据 D 试点结果再定 / 需用户拍板」的待决项,不是裁定项;在 D
试点出结论前动已稳定的顶级导航 = 试点前后改两次（两次导航地震）。**裁决:F 冻结,等 D
试点闸门后再判。** 裁判另拆出一个可独立做的小项:「校友广场」社交化命名诱导用户期待
论坛/互动——**这个命名错位可单独改文案修掉,零成本,不依赖 F 的容器去留决策**。

### 最终执行顺序

| 序  | 项                                                                                                      | effort | 说明                                   |
| --- | ------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------- |
| 1   | **C** 立即全量 `acceptPeerReview=false` 止血                                                            | S      | 现行 PIPL 违规，纯 UPDATE，本周修      |
| 2   | **B+C6** `review` 整体退役 + 删全部已弃用列（`Review`/评分列/`acceptPeerReview`/`SwipeStats` 游戏化列） | M      | 一次破坏性迁移做完                     |
| 3   | **A** 无操作                                                                                            | —      | 保留 `ranking` C1 现状，本项不再是任务 |
| 4   | **D-试点** ~30–50 案例录入 `path`，埋点测浏览参与度                                                     | S      | 无新代码，2–3 周                       |
| 5   | **闸门** 试点信号 → 过则建 XL 管线 + **E**（含定档功效分析）                                            | XL     | 不过则 `verified` 不单独成 tab         |
| 6   | **F** 据试点结果决定是否解散 Hall 壳                                                                    | —      | 需用户拍板                             |
