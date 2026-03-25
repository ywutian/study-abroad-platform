# 用户反馈与代码对照分析

**文档类型**：内部产品 / 研发对齐  
**整理日期**：2025-03-22  
**范围**：基于外部用户（含 Carol Ma）反馈，对照当前仓库实现的核实结论与行动建议。

---

## 1. 背景与目标

用户在试用「留学申请平台」过程中，围绕**档案（标化、GPA、活动、奖项）**、**选校与申请轮次**、**截止日与时间线**、**文书与案例库**、**录取预测与推荐**、**数据可信度**等提出疑问与需求。

本文目标：

- 将反馈**归类**，并与**代码事实**对照（哪些已实现、哪些是缺口、哪些是误解可仅靠文案缓解）。
- 给出**优先级**与**依赖**，便于排期，避免仅停留在口头讨论。

---

## 2. 反馈主题聚类

| 主题              | 用户诉求摘要                                                               |
| ----------------- | -------------------------------------------------------------------------- |
| **标化成绩**      | AP 希望按科目；IB 同理；为何无 A-Level / IGCSE                             |
| **GPA**           | 能否按学期填写并由系统汇总                                                 |
| **活动描述**      | 「500」是字符还是字数；准备期希望多写作为文书素材                          |
| **奖项**          | 是否可增加学科类别，或与竞赛类型联动                                       |
| **选校列表 UI**   | 旁侧 #1、#2 含义；能否按轮次筛选；并非所有学校都有 ED2                     |
| **截止与文案**    | 未来日期旁出现「已过 X 天」等矛盾感                                        |
| **文书与目标校**  | DDL/文书题目能否在选目标校时可见；Essay 不知如何添加                       |
| **案例库**        | 「案例库」具体用途不清晰                                                   |
| **预测与推荐**    | 建议偏泛；希望更具体（如夏校、活动深化）；希望数据与结论可点官网或来源核实 |
| **活动精简**      | 活动描述 500 字符太长，Common App 限制 150 字符，需精简工具                |
| **轮次筛选**      | 目标校列表无法按 ED/EA/RD 等轮次筛选                                       |
| **夏校推荐**      | 希望 AI 能根据背景推荐具体夏校项目                                         |
| **Transfer 数据** | 希望看到学校的 transfer 录取比例                                           |
| **推荐信管理**    | 每个申请者需 2-3 封推荐信，缺少管理老师/状态/学校要求的功能（行业建议）    |
| **CA 活动预览**   | Common App 最多 10 个活动，排序暗含重要性，需预览最终提交版本（行业建议）  |
| **Financial Aid** | 学校间奖学金/助学金对比（数据已有但前端未展示）（行业建议）                |
| **面试准备**      | 各校面试政策（optional/required/alumni）与准备指导（行业建议）             |

---

## 3. 代码核实结论

### 3.1 档案：标化（TestScore） ✅ 已完成

- **枚举 `TestType`**（`apps/api/prisma/schema.prisma`）：`SAT | ACT | TOEFL | IELTS | AP | IB | A_LEVEL | IGCSE`，**已扩展** A-Level / IGCSE。
- **存储**：`subScores` 为 `Json?`，承载科目级数据。
- **Web**（`apps/web/src/components/features/test-score-form.tsx`）：
  - **AP**：21 个科目，分数 1-5
  - **IB**：20+ 科目，HL/SL 级别，分数 1-7
  - **A-Level**：23 科目，A\*-E 评级，自动 UCAS 积分计算
  - **IGCSE**：25+ 科目，双评分模式（数字 9-1 或字母 A\*-U）
- **后端 DTO**（`test-score.dto.ts`）：`subScores?: Record<string, number | string>` 支持任意科目键值对。
- **结论**：~~缺口主要在前端表单与契约统一~~ **全部实现**，四种标化类型均有完整的科目选择 UI + 后端验证。

### 3.2 档案：GPA ✅ 已完成

- **新模型 `SemesterGpa`**（`schema.prisma` L484-501）：`semester`（g9fall~g12spring）、`year`、`gpa`、`gpaScale`、`credits`（可选学分）。
- **后端**（`profile-scores.service.ts` L834-1104）：`recalculateGpa()` 支持学分加权 + 年级权重（9th=15%, 10th=25%, 11th=35%, 12th=25%）自动计算。
- **前端**（`gpa-tab.tsx`）：简单模式（单 GPA）与详细模式（按学期/按年级）切换，自动汇总显示。
- **结论**：~~需新数据模型 + UI + 规则~~ **全部实现**，含 CRUD API + 自动计算 + 完整 i18n。

### 3.3 档案：活动描述「500」 ✅ 已完成

- **双字段设计**：`description`（500 字符，详细素材）+ `commonAppDescription`（150 字符，Common App 格式）。
- **Schema**（`schema.prisma`）：`description @db.Text` + `commonAppDescription @db.VarChar(150)`。
- **前端**（`activity-form.tsx`）：双字段 UI，字符计数器，动态提示（≤150 适合 CA / >150 需精简），**AI 一键精简按钮**。
- **DTO**（`activity.dto.ts`）：`@MaxLength(500)` + `@MaxLength(150)` 分别校验。
- **结论**：500 是**字符数**（已标注），新增 150 字符 Common App 字段 + AI 精简功能。

### 3.4 档案：奖项（Award） ✅ 已完成

- **新增 `AwardCategory` 枚举**（`schema.prisma` L109-124）：14 类（STEM/MATH/SCIENCE/CS/ENGINEERING/BUSINESS/ARTS/HUMANITIES/SOCIAL_SCIENCE/LANGUAGE/SPORTS/COMMUNITY_SERVICE/LEADERSHIP/OTHER）。
- **Award 模型**新增 `category AwardCategory?` 可选字段。
- **前端**（`award-form.tsx`）：下拉选择学科类别，完整 i18n。
- **结论**：~~需 schema 扩展~~ **已实现**，独立于 Competition 关联的学科标签。

### 3.5 选校列表：#1 / #2 徽章 ✅ 已完成

- **新组件 `RankingBadge`**（`apps/web/src/components/ui/ranking-badge.tsx`）：显示排名 + 榜单类型标签。
- **排名工具**（`apps/web/src/lib/utils/ranking.ts`）：`getDisplayRankings()` 按榜单分类（综合/文理/艺术设计/工程/CS/商科），取每个榜单最佳排名。
- **Tooltip**：悬停显示完整信息（如 "US News 2024 National University Ranking"）。
- **i18n**：`schoolSelector.rankingList` 下所有 6 种榜单类型已翻译。
- **注意**：`ranking-badge.tsx` 和 `ranking.ts` 为新文件（untracked），需确保已提交。
- **结论**：~~需多表拆分~~ **已通过前端组件实现**排名类别区分展示。

### 3.6 选校：轮次（含 ED2）与添加失败 ✅ 已完成

- **后端已实现**（`school-list.service.ts`）：
  - `getAvailableRounds(schoolId)` 查询 `SchoolDeadline` 获取该校可用轮次。
  - `addSchool()` 中校验轮次可用性 + ED/ED2/REA/SCEA 排他性（binding 冲突检查）。
  - 重复添加返回 `ConflictException`。
  - **新增** 6 个 `validateRound` 测试用例覆盖全部排他场景（ED+ED/ED+REA/ED2+SCEA/RD+RD/不可用轮次/无 deadline 跳过）。
- **前端已实现**（`school-selection-tab.tsx`）：
  - `getSchoolAvailableRounds()` 从 `school.deadlines[]` 提取可用轮次。
  - `roundFilter` 下拉筛选。
  - **优化** 默认轮次选择器从 7 种缩减为 4 种常用轮次（ED/EA/RD/ROLLING）。

### 3.7 时间线：截止日与「已过 X 天」

- **展示**（`apps/web/src/app/[locale]/(main)/timeline/_components/timeline.helpers.tsx`）：`getDaysUntil` 为目标日与今天的天数差；`formatDaysUntil` 在 **`days < 0`** 时使用 `daysAgo` 类文案（中文见 `apps/web/src/messages/zh.json` → `timeline.daysAgo`：**已过 {days} 天**）。
- **逻辑含义**：只要存储的 **`deadline` 早于当前时间**，就会显示「已过」类表述；若界面展示的年份与数据库不一致，会产生「看起来像未来却仍显示已过」的**数据/展示一致性问题**。
- **生成时间线兜底**（`apps/api/src/modules/timeline/timeline-application.service.ts`）：在无合适 `SchoolDeadline` 等情况下，可能对 **RD** 使用 **`new Date(applicationYear, 0, 1)`**，易产生**不合理的过去日期**。

### 3.8 目标校与文书题目数 ✅ 已完成

- **API**：`school-list.service.ts` 返回 `essayPromptCount`。
- **Profile 目标校 Tab**（`school-selection-tab.tsx`）：
  - 学校卡片显示 `essayPromptCount` Badge（FileText 图标 + 数字）。
  - 展开学校卡片可见 `SchoolEssayPrompts` 组件：显示所有文书题目（类型/字数/必选可选）。
  - **"Start Writing" 按钮**：点击跳转 `/essays?schoolId=X&promptId=Y`，自动填充文书表单。
  - 学校卡片上的 PenLine 图标按钮：直接跳转写文书。
- **结论**：~~缺口在 Profile 档案页~~ **已全部实现**，含文书题目展示 + 多入口写文书跳转。

### 3.9 案例库（/cases）

- **页面**（`apps/web/src/app/[locale]/(main)/cases/page.tsx`）：含两个 Tab — **录取案例**（`cases`）与 **文书范文**（`essays`）。
- **结论**：用户若只见到「案例库」一词，**容易与「我的文书」混淆**；需**信息架构与导航文案**区分。

### 3.10 录取预测与推荐 ✅ 已完成

- **已实现**：
  - `SuggestionsPanel` 组件：4 分类展示（summer_program/competition/research/general），关键词匹配 + 双语支持。
  - Prompt 已要求 LLM 提供 2-3 个具体项目名（RSI/MOSTEC/SAMS 等）。
  - `ProvenanceBadge` 在学校详情页展示数据来源（College Scorecard/IPEDS），可点击跳转官方链接。
  - 推荐结果含 `reason` + `highlights` + `dataPoints` + `recommendedMajors`（**已结构化为 `{name, reason}[]`**）。
  - **新增** Prediction prompt 第 7 条要求：建议必须基于学生现有活动深化，引用至少一项现有活动说明如何递进。
  - **新增** Recommendation prompt `recommendedMajors` 改为 `{name, reason}[]` 结构，前端渲染 reason。
  - **新增** Prompt 防注入安全声明。

### 3.11 学校官网与录取率 ✅ 已完成

- **School** 模型含 `website`；学校详情页（`school-hero-header.tsx`）Globe 图标外链已实现。
- **`SCHOOL_BASIC_SELECT`** 已包含 `website` 字段。
- **AI 推荐卡片**（`SchoolRecommendation.tsx`）：Globe 图标（官网）+ Database 图标（College Scorecard），通过 `sourceUrls` 结构提供。
- **后端**（`recommendation.constants.ts`）：自动生成 `collegeScorecardUrl`（from `scorecardId`）和 `ipedsUrl`（from `ipedsId`）。
- **结论**：~~需暴露 website~~ **已实现**，学校详情页、选择器、推荐卡片均有官网链接。

### 3.12 Mobile：API 路由一致性 ✅ 已完成

- **系统性修复**：全量扫描 Mobile 13 个 service 文件 + 12+ screen 文件，修复 30+ 错误 API 路径：
  - 单数→复数：`/peer-review/`→`/peer-reviews/`、`/verification/`→`/verifications/`、`/vault`→`/vaults`、`/resume`→`/resumes`、`/prediction`→`/predictions`、`/subscription`→`/subscriptions`、`/assessment/`→`/assessments/`、`/recommendation`→`/recommendations`、`/forum/`→`/forums/`、`/hall/`→`/halls/`、`/chat/`→`/chats/`
  - 路径重构：`/profile`→`/profiles/me`（8+ 文件）、`/ai/...`→实际控制器路径、`/swipe/...`→`/halls/swipe/...`、`/essays/...`→`/essay-ai/...` + `/essay-prompts`、`/referral/...`→`/users/me/referral`
- **自动化防护**：新增 `scripts/check-api-routes.ts` 静态分析脚本，集成到 pre-push hook 和 CI，编译时检测路由不匹配。
- **共享常量**：`packages/shared/src/constants/api-routes.ts` 定义全部 30 个路由前缀作为单一事实来源。
- **结论**：路径问题已全量修复 + 三层防护（共享常量 + 静态检查 + CI 阻断）防止复发。字段名不匹配问题待后续迭代。

### 3.13 活动描述精简与 Common App 限制 ✅ 已完成

- **双字段设计**：`description`（500 字符详细素材）+ `commonAppDescription`（150 字符 CA 格式），见 3.3。
- **AI 精简按钮**（`activity-form.tsx`）："AI Refine to ≤150 chars" 一键将长描述精简至 Common App 格式。
- **AI 生成按钮**："AI Generate Common App Description" 从详细描述自动生成 150 字符版本。
- **结论**：~~需新端点~~ **已通过前端 AI 按钮实现**，用户可详写后一键精简。

### 3.14 轮次筛选与 ED 排他性 ✅ 已完成

- **轮次筛选**（`school-selection-tab.tsx`）：`roundFilter` 状态 + 下拉筛选，用户可按 ED/ED2/EA/RD 等筛选目标校列表。
- **ED 排他性校验**（`school-list.service.ts`）：
  - ED/ED2 只允许 1 所学校。
  - REA/SCEA 只允许 1 所学校。
  - ED/ED2 与 REA/SCEA 互斥。
  - 违反时返回 `ConflictException`。
- **轮次可用性**（`getAvailableRounds()`）：查询 `SchoolDeadline` 表获取该校实际可用轮次。
- **结论**：~~需枚举化 + 排他校验~~ **已实现**，含筛选 + 排他校验 + 可用性验证。残留问题见 3.6。

### 3.15 预测建议具体化 ✅ 已完成

- **已实现**：
  - `SuggestionsPanel` 4 分类展示（夏校/竞赛/科研/通用）。
  - Prompt 明确要求 LLM 提供具体项目名（"每条建议至少提及 2-3 个具体项目名称"）。
  - 列出 20+ 真实项目（RSI/MOSTEC/SAMS/USAMO/DECA 等）作为示例。
  - **新增** Prompt 第 7 条：建议必须基于学生现有活动深化（分析核心方向、引用现有活动、优先进阶项目）。
  - **新增** `recommendedMajors` 从 `string[]` 改为 `{name, reason}[]`，前端渲染 reason。
  - **新增** Prompt 防注入安全声明。
- **结论**：Prompt 指令已明确要求个性化深化分析，结合已注入的活动/Assessment/专业数据可产生有针对性的建议。

### 3.16 推荐信管理（行业专家建议）

- **行业背景**：每位申请者需 2-3 封推荐信（Common App 标准：2 封 teacher + 1 封 counselor），管理推荐人、提交状态、学校要求是高频需求。
- **平台能力**：已有 `ApplicationTask` 体系 + `Notification`（18 种类型）+ `Vault`（AES-256 加密）。
- **结论**：需新建 `RecommendationLetter` 模型，利用通知系统发送到期提醒（7/3/1 天），推荐人邮箱通过 Vault 加密存储。

### 3.17 CA 活动预览与 Financial Aid 对比（行业专家建议）

- **CA 预览**：Common App 最多 10 个活动，排序暗含重要性（#1 最重要）。已有 `Activity.order` 字段支持排序，需前端预览模式。
- **Financial Aid**：Schema 已有 `needBlindInternational`、`percentNeedMet`、`averageAidPackage`、`netPrice` 等字段。School Agent 的 `compare_schools` 工具已支持比较，但**前端无对比展示**。
- **面试准备**：`SchoolDeadline` 已有 `interviewRequired` 和 `interviewDeadline` 字段，可扩展 School Agent 提供面试指导。

---

## 4. 产品优先级建议（摘要）

| 层级   | 编号 | 方向                | 状态   | 说明                                                                    |
| ------ | ---- | ------------------- | ------ | ----------------------------------------------------------------------- |
| **P0** | P0-1 | 活动描述标注        | ✅     | 双字段（500+150）+ 字符计数器 + AI 精简按钮                             |
| **P0** | P0-2 | 排名系统重构        | ✅     | `RankingBadge` 组件 + `ranking.ts` 工具，6 种榜单类型 + tooltip         |
| **P0** | P0-3 | ED/SCEA 排他性校验  | ✅     | ED/ED2/REA/SCEA 排他校验 + `getAvailableRounds()` 轮次验证              |
| **P0** | P0-4 | 学校官网链接暴露    | ✅     | `SCHOOL_BASIC_SELECT` 含 `website`，选择器/卡片/推荐均有官网链接        |
| **P0** | P0-5 | RD 兜底日期修复     | 待确认 | Jan 1 → Jan 15 + `isEstimated` 标记                                     |
| **P0** | P0-6 | 重复添加错误提示    | ⚠️     | 409 逻辑正确，但前端 toast 提示不够具体（无法区分重复/冲突/轮次不可用） |
| **P0** | P0-7 | Mobile API 路由修复 | ✅     | 30+ 路径修复 + check-api-routes.ts 自动化检查 + CI 集成                 |
| **P1** | P1-1 | AP/IB 科目 UI       | ✅     | AP 21科/IB 20+科(HL/SL)/A-Level 23科(UCAS)/IGCSE 25+科(双评分)          |
| **P1** | P1-2 | 按轮次筛选目标校    | ✅     | `roundFilter` 下拉筛选，残留：无数据时 fallback 显示所有轮次            |
| **P1** | P1-3 | 目标校展示文书题数  | ✅     | `SchoolEssayPrompts` 组件 + Badge + "Start Writing" 跳转                |
| **P1** | P1-4 | Essay 创建入口优化  | ✅     | 三种入口（卡片按钮/展开详情/Essays 页 Prompt 选择器）                   |
| **P1** | P1-5 | AI 活动描述精简     | ✅     | `commonAppDescription` 字段 + AI Refine/Generate 按钮                   |
| **P1** | P1-6 | 预测建议具体化      | ✅     | Prompt 活动深化指令 + recommendedMajors 结构化 + 防注入声明             |
| **P1** | P1-7 | 案例库文案优化      | ✅     | Cases→"Admissions Cases"/"录取案例" + RankingBadge 数据来源前缀         |
| **P1** | P1-8 | 推荐信管理          | 未实施 | 新模型 + 通知提醒 + Vault 加密                                          |
| **P1** | P1-9 | CA 活动预览         | 未实施 | 前 10 活动拖拽排序 + 150 字符超限提示                                   |
| **P2** | P2-1 | A-Level/IGCSE 标化  | ✅     | TestType 枚举已扩展，含完整科目 UI                                      |
| **P2** | P2-2 | 学期 GPA            | ✅     | `SemesterGpa` 模型 + 自动计算 + 完整 UI                                 |
| **P2** | P2-3 | 奖项学科标签        | ✅     | `AwardCategory` 14 枚举 + 前端下拉选择                                  |
| **P2** | P2-4 | 夏校推荐            | ✅     | 后端已返回 summerPrograms[]，前端已渲染                                 |
| **P2** | P2-5 | 专业+招生偏好       | ⏸️     | 跳过：合规红线，需法务确认                                              |
| **P2** | P2-6 | Transfer 数据       | 未实施 | IPEDS 数据（低优先级）                                                  |
| **P2** | P2-7 | Financial Aid 对比  | ✅     | financial-aid-comparison.tsx，桌面表格+移动卡片，i18n 完整              |
| **P2** | P2-8 | 面试准备            | ✅     | interviewFormat 字段 + 迁移 + 前端 badge + tooltip                      |

---

## 5. 风险与依赖

- **数据**：`usNewsRank` 多校为 #1 来自**不同排名榜单混装**（综合/文理/艺术/工程等），需 `SchoolRanking` 多表拆分。
- **合规**：未经证实的「学校偏好（如性别）」不宜由模型自由输出；需产品与法务红线。安全做法：展示 CDS 客观数据让用户自行判断。
- **轮次匹配**：`round` 为自由字符串，`ED2` 与 `ED 2` 不匹配将导致 Dashboard DDL 丢失。需枚举化（`ApplicationRound` enum）并创建数据迁移脚本。
- **ED 排他性**：✅ **已解决**。ED/ED2/REA/SCEA 排他校验已实现（`school-list.service.ts`），含 6 个测试用例覆盖全部冲突场景。
- **SchoolDeadline 覆盖率**：当前仅覆盖约 33 所学校，轮次校验和筛选对大部分学校无数据支撑。需降级策略：有数据显示有效轮次，无数据显示全部 + 提示。
- **AI 建议泛化**：✅ **已缓解**。Prediction prompt 新增活动深化指令（第 7 条），Recommendation prompt `recommendedMajors` 结构化为 `{name, reason}[]`，防注入声明已添加。

---

## 6. 数据缺口清单

以下数据/内容需人工收集或爬虫补充，是方案落地的前置依赖：

| 数据项                           | 影响方案                 | 获取方式              | 紧急度 |
| -------------------------------- | ------------------------ | --------------------- | ------ |
| 文理学院 Top 50 排名             | P0-2 排名系统            | US News 官方/手工录入 | **高** |
| QS 艺术/设计/音乐排名            | P0-2 排名系统            | QS 官方/手工录入      | **高** |
| US News 专业排名（工程/CS/商科） | P0-2 排名系统            | US News 官方          | 中     |
| 各校可用轮次 SchoolDeadline      | P0-3 ED 校验 + P1-2 筛选 | 爬虫 + Common App API | **高** |
| REA/SCEA 学校清单                | P0-3 排他校验            | 手工（约 10 所）      | **高** |
| 现有 round 字符串→枚举映射       | P0-3 迁移脚本            | 查询现有数据          | **高** |
| 各校推荐信要求数量               | P1-8 推荐信管理          | Common App + 手工     | 中     |
| 知名夏校数据（约 50 个）         | P2-4 夏校推荐            | 手工整理              | 低     |
| A-Level/IGCSE 科目与评分标准     | P2-1 标化扩展            | 标准化，手工          | 低     |
| CDS 性别维度录取数据             | P2-5 招生偏好            | IPEDS/CDS             | 低     |
| 面试政策与题库                   | P2-8 面试准备            | 手工 + 爬虫           | 低     |

---

## 7. 建议追踪的指标（可选）

- 目标校添加后 **7 日内** 创建关联文书的比例。
- Timeline / DDL 相关负反馈或客服标签是否下降。
- Mobile 标化保存 **成功率 / 错误率**（修复前后对比）。
- AI 活动精简使用率与用户满意度。
- 预测建议点击/采纳率（注入 Assessment 前后对比）。

---

## 8. 关键代码索引（便于研发跳转）

| 主题                                | 路径                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Schema（TestType / School / Award） | `apps/api/prisma/schema.prisma`                                                                          |
| Prisma Selects                      | `apps/api/src/common/constants/prisma-selects.ts`                                                        |
| Web 标化表单                        | `apps/web/src/components/features/test-score-form.tsx`                                                   |
| 活动 DTO 与表单                     | `apps/api/src/modules/profile/dto/activity.dto.ts`, `apps/web/src/components/features/activity-form.tsx` |
| 学校选择器                          | `apps/web/src/components/features/school-selector.tsx`                                                   |
| 学校列表服务与冲突                  | `apps/api/src/modules/school-list/school-list.service.ts`                                                |
| 学校列表 DTO                        | `apps/api/src/modules/school-list/dto/school-list.dto.ts`                                                |
| Dashboard DDL 合并                  | `apps/api/src/modules/user/dashboard.service.ts`                                                         |
| 时间线生成与 RD 兜底                | `apps/api/src/modules/timeline/timeline-application.service.ts`                                          |
| 截止相对时间文案                    | `apps/web/src/app/[locale]/(main)/timeline/_components/timeline.helpers.tsx`                             |
| 档案目标校映射                      | `apps/web/src/app/[locale]/(main)/profile/page.tsx`                                                      |
| 目标校 Tab                          | `apps/web/src/app/[locale]/(main)/profile/_components/school-selection-tab.tsx`                          |
| Essay 页与 Manager                  | `apps/web/src/app/[locale]/(main)/essays/page.tsx`, `essays/_components/use-essay-manager.ts`            |
| 预测 Prompt 与服务                  | `apps/api/src/modules/prediction/prediction.prompts.ts`, `prediction.service.ts`                         |
| 推荐 Prompt 与服务                  | `apps/api/src/modules/recommendation/recommendation.prompts.ts`, `recommendation.service.ts`             |
| Profile AI                          | `apps/api/src/modules/ai/profile-ai.service.ts`                                                          |
| Assessment 服务                     | `apps/api/src/modules/assessment/assessment.service.ts`                                                  |
| LLM Service                         | `apps/api/src/modules/ai-agent/core/llm.service.ts`                                                      |
| Agent 与 Tool 配置                  | `apps/api/src/modules/ai-agent/config/agents.config.ts`, `tools.config.ts`                               |
| 积分服务                            | `apps/api/src/modules/points/case-incentive.service.ts`                                                  |
| 通知服务                            | `apps/api/src/modules/notification/notification.service.ts`                                              |
| Mobile 标化                         | `apps/mobile/src/app/profile/scores.tsx`                                                                 |
| Mobile 类型                         | `apps/mobile/src/types/index.ts`                                                                         |
| Profile API                         | `apps/api/src/modules/profile/profile.controller.ts`                                                     |
| i18n                                | `apps/web/src/messages/{en,zh}.json`                                                                     |
| 爬虫                                | `apps/api/src/modules/school/school-scraper.service.ts`                                                  |

---

## 9. 修订记录

| 日期       | 说明                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2025-03-22 | 首版：反馈聚类、代码核实、优先级与风险                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-03-23 | 全面修订：修正 3.5 排名根因（多榜单混装非数据错误）；补充 3.8 essayPromptCount 已在 Uncommon App 展示；补充 3.11 website 未通过 SCHOOL_BASIC_SELECT 暴露；补充 3.12 Mobile 字段名不匹配；Section 5 扩展轮次/ED 排他/SchoolDeadline/AI 风险；新增 3.13-3.17（活动精简、轮次筛选、AI 建议具体化、推荐信管理、CA 预览/Financial Aid/面试）；新增数据缺口清单（Section 6）；优先级细化为 24 项（P0×7 + P1×9 + P2×8）；代码索引扩充 |
| 2026-03-23 | P2 实施：修复 Essay-School essayPromptId 链路；新增 interviewFormat 字段+迁移+前端 badge；新增 Financial Aid 跨校对比组件；确认夏校推荐已完成；标记 P2-4/7/8 完成、P2-5 跳过                                                                                                                                                                                                                                                   |
| 2026-03-24 | 状态同步：基于代码验证更新全部 P0-P2 实施状态（24 项中 16 项 ✅、3 项 ⚠️、2 项待确认、2 项未实施、1 项跳过）。Section 3 各项补充实现细节和残留问题。残留：轮次 fallback 显示所有轮次、添加错误提示不具体、预测建议个性化不足（未注入 Assessment/活动详情）                                                                                                                                                                     |

---

_本文档随实现演进可增量更新；完整实施方案见 plan 文件；具体排期请以团队看板为准。_
