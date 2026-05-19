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

## 七、§7 决策 —— 最终拍板（两轮 10-agent 辩论）

2026-05-19。第一轮 5 个 agent（study-abroad / applicant-simulator / architect /
security-reviewer / data-model-reviewer）初判；第二轮 5 个 agent（红队 / user-journey
/ mobile / ai-prompt-engineer / 创始人-ROI）压力测试,**改写了 A/B/D 三项,并浮现一个
第一轮漏掉的第 6 问**。下为最终裁决。

### 🆕 第 6 问 —— Hall 这个壳还该不该存在?

红队 + 创始人独立得出:A+B 之后 Hall = `verified` + `path`;`verified` 在 D 验证成功前
是空的 → Hall 实际收敛为「只有 `path` 一个真功能的壳」。**终态建议:把 `path` 升为一级
「录取案例 / Cases」入口(与 prediction 并列),解散「校友广场」容器。** 最大战略判断,
据 D 试点结果再定。

### A. Tab → **撤掉 `ranking` 独立 tab;百分位 widget 移到选校/prediction 语境** ⬆改

第一轮裁「并入 verified」。ai-prompt-engineer 反对:把「你的百分位」贴在「真实录取结果」
旁,用户会脑补出「录取率」= **新的第二权威**(folk statistics)。故**不并入 verified**,
`ranking` tab 直接撤;去评分后的百分位 widget 移到选校/prediction 工具语境。创始人:这是
B 的副产品,**不与 D 捆绑**(别拿廉价清理给 XL 当人质)。effort S。

### B. `review` tab → **明确「定时日落」,不是「降级保留」** ⬆改

第一轮裁「降级保留」。第二轮推翻:① 红队——B+C 合起来已等于杀死功能(撤 tab 没人找得到

- C 把池清零),却还在为僵尸付安全/迁移/审计成本;② user-journey 翻代码发现**致命漏洞:
  Hall 的 review 只写不读——根本没有「查看别人给我的反馈」界面**(`getReviewsForUser`
  无前端消费者),功能连闭环都没有。**裁决:撤出 tab + 设淘汰复核日期,不再投入建新家;
  近零使用就在 C6 之后删模型。** effort S。

### C. `acceptPeerReview` → **改 opt-in,迁移把【所有】存量用户置 false** 🔴 确认+强化

两轮 10/10 一致。迁移全量重置(security:可空生日无法可靠识别未成年人;opt-out 下无人给过
PIPL「自愿、明示」同意)。配套:同事务清空 `hallPublicProfile` 快照、记录带时间戳+版本的
同意事件、<14 岁走监护人同意。**新增(mobile agent 发现):移动端没有任何 opt-in 开关——
迁移后移动端用户永久卡在 false,必须补一个移动端开关。** 唯一「现行生产违规」,优先级 #1。

### D. 真实大陆录取数据管线 → **先做验证试点,再决定要不要建 XL** ⬆改

第一轮裁「建,XL,护城河」。第二轮:创始人——D 的 XL 本质是**永久运营成本**(编辑部核验
人力),不是一次性工程,在零需求证据下靠共识承诺是最危险一步。**裁决:先做 2–3 周手工
试点**——手工录入 ~30–50 条真实、已同意的案例进 `path`,埋点测「家庭是否真的为 verified
付费」;**以此为闸门**决定要不要建 XL 管线(复用 `case`+`verification`,不爬虫)。
**若建,必须带 ai-prompt-engineer 的 AI 权威硬契约**:不显示可推算比率(禁「6/8」「75%」)、
不用预测性措辞(只用过去式描述「已验证录取记录」)、每个面挂 prediction 跳转 + 「这是先例
不是录取估计」免责、不出现「同档/cohort 强度」标签。否则 = 造出第四个第二权威。

### E. `verified` 可靠度阈值 → **收紧,样本不足直接隐藏** 确认+强化

两轮一致。`A≥15 / B≥8 / C≥3 / n<3 不渲染该卡`;C 档(3–7)只显示原始计数、不显示百分率。
阈值兼作 k-匿名(小学校单条记录可反推真人)。**新增:随 D 一起发(无数据时零价值)、
移动端必须同步阈值(否则成隐私洞)、`verified` 需设计诚实空状态。** effort S。

### 最终执行顺序

| 序  | 项                                                            | effort | 说明                                                       |
| --- | ------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| 1   | **C** opt-in + 全量迁移 + 移动端开关                          | S      | 现行 PIPL 违规,本周修                                      |
| 2   | **C6** 删已弃用列                                             | S      | `Review` 评分列仍 `NOT NULL` 而 DTO 已改可选,潜在 500 风险 |
| 3   | **B** review 撤 tab + 设淘汰日期 ＋ **A** 撤 ranking tab      | S      | A 是 B 的副产品,一起做                                     |
| 4   | **D-试点** 手工录入 ~30–50 案例进 `path`,埋点                 | S      | 无新代码,2–3 周                                            |
| 5   | **闸门** 试点验证家庭付费意愿 → 过则建 XL 管线 + **E**        | XL     | 不过则不建,verified 不单独成 tab                           |
| 6   | **第 6 问** 据试点结果决定是否解散 Hall 壳、`path`→一级 Cases | —      | 需用户拍板                                                 |
