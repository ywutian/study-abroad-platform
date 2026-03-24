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

### 3.1 档案：标化（TestScore）

- **枚举 `TestType`**（`apps/api/prisma/schema.prisma`）：`SAT | ACT | TOEFL | IELTS | AP | IB`，**无** A-Level / IGCSE 独立类型。
- **存储**：`subScores` 为 `Json?`，种子数据中存在 AP 的 `subject` 等非纯数字字段，**模型可承载**更细粒度信息。
- **Web**（`apps/web/src/components/features/test-score-form.tsx`）：仅为 **SAT / TOEFL** 组装 `subScores`；**AP / IB 仅总分**，无科目 UI。
- **结论**：「AP 科目 / IB 明细」在数据层可行，**缺口主要在前端表单与契约统一**；A-Level/IG 需**新类型或并行设计**。

### 3.2 档案：GPA

- **Profile** 仅 `gpa`、`gpaScale`（`schema.prisma`），**无**学期维度。
- **结论**：「按学期录入并自动算总平均」需**新数据模型 + UI + 规则**，非小改。

### 3.3 档案：活动描述「500」

- **Web**（`apps/web/src/components/features/activity-form.tsx`）：`maxLength={500}` + `length/500` → **字符数**。
- **API**（`apps/api/src/modules/profile/dto/activity.dto.ts`）：`@MaxLength(500)` → **字符**（class-validator 字符串长度）。
- **`lib/validations/profile.ts` 中 `createActivitySchema` 的 `description.max(2000)`**：当前仓库内**无引用**，活动提交流程**未使用该 zod**，**不构成线上双轨冲突**。

### 3.4 档案：奖项（Award）

- **Award** 模型无独立「学科」字段；可选关联 **Competition**，后者含 **`CompetitionCategory`**（数学、生物、CS 等）。
- **结论**：若绑定官方竞赛库，**已有分类维度**；若需「与竞赛无关的学科标签」，需 **schema / 产品字段扩展**。

### 3.5 选校列表：#1 / #2 徽章

- **实现**：展示 `School.usNewsRank`（如 `apps/web/src/components/features/school-selector.tsx` 中 `#{school.usNewsRank}`）。
- **含义**：设计意图为 **US News 类排名数值**，**不是**用户排序优先级。
- **根因**：RISD（QS 艺术设计 #1）、Williams（US News 文理学院 #1）、Princeton（US News 综合 #1）、Juilliard（Niche 表演艺术 #1）、Rose-Hulman（US News 本科工程无博士 #1）分别来自**不同 US News 子榜单或其他排名体系**，但系统用单一 `usNewsRank` 字段混装。
- **解决方案**：需新建 `SchoolRanking` 多对多关联表（source + list + rank + year），Badge 显示"综合 #1"/"文理 #1"等类别前缀。详见实施方案 P0-2。

### 3.6 选校：轮次（含 ED2）与添加失败

- **写入**：`POST /school-lists` 将前端的 `defaultRound` 写入 `SchoolListItem.round`（`school-list.service.ts`），DTO 为**自由短字符串**，**不校验**该校是否真实提供该轮次。
- **Dashboard 合并 DDL**（`apps/api/src/modules/user/dashboard.service.ts`）：当清单项有 `round` 时，仅当 `item.round === dl.round` 时才采用对应 `SchoolDeadline`，**字符串需完全一致**。
- **重复添加**：同一用户同一学校已存在时 **`ConflictException`**（`School already exists in your list`）；前端 i18n 存在 `schoolAlreadyInList`。
- **结论**：「并非所有学校都有 ED2」与实现一致——**系统不限制**；「加不进去」需区分 **409 已在列表** 与其它错误。

### 3.7 时间线：截止日与「已过 X 天」

- **展示**（`apps/web/src/app/[locale]/(main)/timeline/_components/timeline.helpers.tsx`）：`getDaysUntil` 为目标日与今天的天数差；`formatDaysUntil` 在 **`days < 0`** 时使用 `daysAgo` 类文案（中文见 `apps/web/src/messages/zh.json` → `timeline.daysAgo`：**已过 {days} 天**）。
- **逻辑含义**：只要存储的 **`deadline` 早于当前时间**，就会显示「已过」类表述；若界面展示的年份与数据库不一致，会产生「看起来像未来却仍显示已过」的**数据/展示一致性问题**。
- **生成时间线兜底**（`apps/api/src/modules/timeline/timeline-application.service.ts`）：在无合适 `SchoolDeadline` 等情况下，可能对 **RD** 使用 **`new Date(applicationYear, 0, 1)`**，易产生**不合理的过去日期**。

### 3.8 目标校与文书题目数

- **API**：`school-list.service.ts` 在添加/返回列表项时计算 **`essayPromptCount`**（该校已验证文书题目数量）。
- **Uncommon App**（`apps/web/src/app/[locale]/(main)/uncommon-app/_components/step-school-lists.tsx` L91-94）：**已展示** `essayPromptCount`（Badge + FileText 图标）。
- **档案页**（`apps/web/src/app/[locale]/(main)/profile/page.tsx` L110-117）：`targetSchools` 映射**未包含** `essayPromptCount` 和 `round`；**目标校 Tab**（`school-selection-tab.tsx`）**未展示**。
- **结论**：后端已有计数，Uncommon App 流程已展示；**缺口仅在 Profile 档案页的目标校 Tab**——需补充映射与 UI，并增加"写文书"跳转入口。

### 3.9 案例库（/cases）

- **页面**（`apps/web/src/app/[locale]/(main)/cases/page.tsx`）：含两个 Tab — **录取案例**（`cases`）与 **文书范文**（`essays`）。
- **结论**：用户若只见到「案例库」一词，**容易与「我的文书」混淆**；需**信息架构与导航文案**区分。

### 3.10 录取预测与推荐

- **建议生成**（`apps/api/src/modules/prediction/prediction.service.ts` → `generateSuggestions`）：优先截取 AI 建议至多 3 条，再按 reach/match/safety **补充模板化建议**，最终至多 5 条。
- **响应 DTO**（`prediction-response.dto.ts`）：**无**「官方来源 URL / citation」一类字段。
- **选校推荐**（`recommendation.prompts.ts` 等）：LLM 输出 `reasons` 等，**prompt 未要求**每条附带可验证引用。
- **结论**：用户期望的「可点击核实」与当前**产品+技术设计**存在差距，需单独设计（含合规边界）。

### 3.11 学校官网与录取率

- **School** 模型含 **`website`**；`school-hero-header.tsx`（L109-122）已有官网外链实现。
- **但** `SCHOOL_BASIC_SELECT`（`apps/api/src/common/constants/prisma-selects.ts` L19-29）**未包含** `website` 字段，导致学校选择器、目标校卡片等通用场景**无法获取**官网链接。
- **SchoolDeadline** 含 **`source`**（如 `MANUAL` / `SCRAPED`），偏运营与数据治理，**非**终端用户对「录取率旁一键核对」的通用方案。
- **结论**：需在 `SCHOOL_BASIC_SELECT` 中暴露 `website`，并在学校选择器与目标校卡片增加官网图标外链。

### 3.12 Mobile：标化页与 API 一致性（高优先级工程问题）

- **`apps/mobile/src/app/profile/scores.tsx`** 使用 `GET /profile`、`PUT /profile` 且 body 含 `{ testScores: ... }`。
- **后端**（`apps/api/src/modules/profile/profile.controller.ts`）：用户资源为 **`@Controller('profiles')`**，当前用户为 **`GET/PUT .../profiles/me`**。
- **`UpdateProfileDto`**（`apps/api/src/modules/profile/dto/profile.dto.ts`）**不包含** `testScores`；`ProfileCrudService.upsert` **不会**根据该 DTO 写入标化子表。
- **字段名不匹配**（`apps/mobile/src/types/index.ts` L84-91）：Mobile 定义 `testType`（后端为 `type`）、`totalScore`（后端为 `score`），即使路径修正后**字段也无法正确反序列化**。
- **结论**：Mobile 标化编辑存在**路径错误 + 字段名不匹配**双重问题；需修正路径为 `/profiles/me/test-scores` 并统一字段命名。

### 3.13 活动描述精简与 Common App 限制

- **现状**：平台活动描述限 500 字符，但 Common App 实际限制为 **150 字符**。用户在平台详写素材后，需手动精简至 CA 格式。
- **AI 能力**：平台已有 `LLMService.chatSimple()` 和 Profile Agent，可实现 AI 一键精简。
- **Points 系统**：可设置 `AI_ACTIVITY_REFINE` 消费动作（建议 -10pts）。
- **Memory 系统**：精简结果异步保存至 Memory，学习用户偏好的描述风格。
- **结论**：高价值 AI 功能（每个留学顾问都要做的事），需新建 `POST /profiles/me/activities/:id/refine` 端点 + 前端按钮。

### 3.14 轮次筛选与 ED 排他性

- **筛选缺口**：Profile 目标校 Tab 无按轮次筛选功能；`targetSchools` 映射未包含 `round` 字段。
- **ED 排他性缺口**：ED（Early Decision）具有**法律绑定力**，学生只能向 1 所学校提交 ED 申请。系统当前不校验，允许用户为多校选 ED。
- **REA/SCEA**：Harvard/Princeton/Stanford/Georgetown 提供 REA，Yale 提供 SCEA，均有排他约束。
- **结论**：需将 `round` 枚举化（`ApplicationRound` enum），并在 `addSchool()` 中增加排他性业务规则校验。

### 3.15 预测建议具体化（AI 系统未充分利用）

- **Assessment 未注入**：用户 MBTI/Holland 评估结果（`assessment.service.ts`）已存储，但**未注入**预测/推荐 prompt。
- **活动仅传计数**：`prediction.prompts.ts` 中活动信息仅为数量统计，未传入描述详情。
- **SchoolProgram 未用于推荐**：`SchoolProgram` 含专业竞争度(1-5) + 录取率估算，在预测中已使用但**推荐系统未接入**。
- **结论**：通过注入 Assessment 上下文 + 活动详情 + SchoolProgram 数据，可显著提升建议针对性。

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

| 层级   | 编号 | 方向                 | 说明                                                                          |
| ------ | ---- | -------------------- | ----------------------------------------------------------------------------- |
| **P0** | P0-1 | 活动描述标注         | 计数器标注"字符"+ Common App 150 限制提示                                     |
| **P0** | P0-2 | 排名系统重构         | 新建 `SchoolRanking` 多排名表，Badge 显示榜单类别前缀                         |
| **P0** | P0-3 | ED/SCEA 排他性校验   | `ApplicationRound` 枚举化 + ED 排他业务规则                                   |
| **P0** | P0-4 | 学校官网链接暴露     | `SCHOOL_BASIC_SELECT` 增加 `website`，选择器/卡片加外链                       |
| **P0** | P0-5 | RD 兜底日期修复      | Jan 1 → Jan 15 + `isEstimated` 标记                                           |
| **P0** | P0-6 | 重复添加错误提示     | 验证 409 toast 正确展示                                                       |
| **P0** | P0-7 | Mobile 标化 API 修复 | 路径 + 字段名统一                                                             |
| **P1** | P1-1 | AP/IB 科目 UI        | 前端表单支持按科目录入                                                        |
| **P1** | P1-2 | 按轮次筛选目标校     | Profile 目标校 Tab 增加 Round 筛选                                            |
| **P1** | P1-3 | 目标校展示文书题数   | 映射 `essayPromptCount` + "写文书"跳转                                        |
| **P1** | P1-4 | Essay 创建入口优化   | 空状态 CTA + AI 推荐该校文书题目                                              |
| **P1** | P1-5 | AI 活动描述精简      | 复用 `LLMService.chatSimple()` 一键精简至 CA 格式                             |
| **P1** | P1-6 | 预测建议具体化       | 注入 Assessment + 活动详情 + SchoolProgram                                    |
| **P1** | P1-7 | 案例库文案优化       | 区分"录取案例"与"文书范文"，信息架构调整                                      |
| **P1** | P1-8 | 推荐信管理           | 新模型 + 通知提醒 + Vault 加密                                                |
| **P1** | P1-9 | CA 活动预览          | 前 10 活动拖拽排序 + 150 字符超限提示                                         |
| **P2** | P2-1 | A-Level/IGCSE 标化   | TestType 枚举扩展                                                             |
| **P2** | P2-2 | 学期 GPA             | 新 `SemesterGpa` 子模型                                                       |
| **P2** | P2-3 | 奖项学科标签         | 复用 `CompetitionCategory` 枚举                                               |
| **P2** | P2-4 | 夏校推荐             | ✅ 后端已返回 summerPrograms[]，前端 SchoolRecommendation.tsx L362-379 已渲染 |
| **P2** | P2-5 | 专业+招生偏好        | ⏸️ 跳过：合规红线，需法务确认                                                 |
| **P2** | P2-6 | Transfer 数据        | IPEDS 数据（低优先级）                                                        |
| **P2** | P2-7 | Financial Aid 对比   | ✅ 新增 financial-aid-comparison.tsx 组件，桌面表格+移动卡片双布局，i18n 完整 |
| **P2** | P2-8 | 面试准备             | ✅ schema 新增 interviewFormat 字段 + 迁移；前端面试格式 badge + tooltip 提示 |

---

## 5. 风险与依赖

- **数据**：`usNewsRank` 多校为 #1 来自**不同排名榜单混装**（综合/文理/艺术/工程等），需 `SchoolRanking` 多表拆分。
- **合规**：未经证实的「学校偏好（如性别）」不宜由模型自由输出；需产品与法务红线。安全做法：展示 CDS 客观数据让用户自行判断。
- **轮次匹配**：`round` 为自由字符串，`ED2` 与 `ED 2` 不匹配将导致 Dashboard DDL 丢失。需枚举化（`ApplicationRound` enum）并创建数据迁移脚本。
- **ED 排他性**：ED 具有**法律绑定力**（只能选 1 所），系统当前**未校验**，用户可同时为多校选 ED。REA/SCEA 同理存在排他约束。需在 `school-list.service.ts` 增加业务规则校验。
- **SchoolDeadline 覆盖率**：当前仅覆盖约 33 所学校，轮次校验和筛选对大部分学校无数据支撑。需降级策略：有数据显示有效轮次，无数据显示全部 + 提示。
- **AI 建议泛化**：预测/推荐 prompt 未注入用户 Assessment（MBTI/Holland）结果、活动详情、SchoolProgram 专业竞争度，导致建议缺乏针对性。

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

---

_本文档随实现演进可增量更新；完整实施方案见 plan 文件；具体排期请以团队看板为准。_
