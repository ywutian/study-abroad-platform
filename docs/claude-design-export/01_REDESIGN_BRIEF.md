# Mobile App — Full Redesign Brief (for Claude Design)

> **目的**：把这份文件交给 Claude Design，作为整个移动端（Expo / React Native，约 50 个屏）**全新视觉重做**的唯一信息源（single source of truth），保证没有任何一屏、任何一个内容块被遗漏。
>
> **重要**：这是「内容/信息架构」清单，不是样式清单。视觉风格请全新设计；**内容块、数据字段、状态必须全部保留**。

---

## 0. How to feed this to Claude Design（投喂顺序）

因为这是「全新视觉重做」，不要导入旧设计系统 token，否则会被带回旧风格。按下面 4 步走：

1. **先建立新视觉语言（1 个 session）**
   把第 1、2、3 节贴给 Claude Design，让它先产出 _新_ 的设计系统：色板、字体阶梯、间距、圆角、核心组件（Button / Card / Input / Badge / Tab bar / Bottom sheet / Empty state / Skeleton）。**确认满意后，把这套设计系统存为 Design System，后续每个屏都复用它** —— 这是 50 屏视觉统一的关键。
2. **按 flow 分批做屏（不要一次丢 50 屏）**
   按第 5 节的 10 个 flow，一批一批做。每批附上：① 该 flow 的屏清单（本文件对应段落）② 当前 App 的截图（仅作**内容参考**，告诉它"redesign visuals, keep the content & data"）。
3. **每屏必须覆盖第 4 节的「跨屏状态」**
   loading / empty / error / 游客未登录 / 暗色 —— 这些是最常被漏掉的。每屏单独要它出齐。
4. **用第 6 节的 checklist 逐屏打勾**，做完一屏划掉一屏，做到零遗漏。

> 截图怎么取：`pnpm --filter mobile start` 起 Expo，在模拟器里逐屏截图。5 个 stub 屏（见下）当前是空的，**不要照空屏设计**，按本文件写的「intended content」设计。

---

## 1. App overview

- **产品**：留学申请一站式 App。用户=**高中生**（申请美本为主）+**家长**。
- **核心价值**：选校 + 录取概率预测 + AI 文书/申请助手 + 真实录取案例库 + 申请时间线管理 + 社区。
- **语言**：中英双语（zh / en），设计需兼顾中文（较长）与英文排版。
- **明暗**：必须同时支持 Light / Dark。
- **平台**：iOS + Android（Expo）。

## 2. Design principles to aim for（建议方向，可调整）

- 面向 Z 世代学生：年轻、有活力，但**信息密度高**（大量数据：GPA、SAT、概率、排名、deadline）。
- 数据可视化是重头戏：概率环、趋势图、tier 分布、进度条要做得清晰好看。
- 大量「卡片列表 + 详情」结构，需要一套强壮的 Card / List item 体系。
- 大量表单（profile 录入），需要好用的 Input / Select / Slider / Modal 体系。

## 3. Navigation architecture（导航骨架）

**底部 6 个 Tab：**

1. **Home**（home 图标）— 仪表盘
2. **Schools**（school 图标）— 选校
3. **Cases**（folder 图标）— 录取案例库
4. **AI**（sparkles 图标）— AI 助手
5. **Profile**（person 图标）— 个人中心
6. **More**（grid 图标）— 功能宫格

**More 宫格（3 列网格，15 个入口）**：Notifications, Forum, Essays, Resume, Vault, Teams, Points, Peer Review, Referral, Verification, Ranking, Assessment, Settings, Timeline, Chat。每个=彩色图标圆 + 文字 + 可选红点 badge。

**栈式详情页（从列表/宫格 push 进入，带返回）**：school/[id], case/[id], chat/[id], prediction, recommendation, find-college, essay/[id], essay-gallery, swipe, hall, uncommon-app, subscription, security, settings 子页, admin 等。

**特殊全屏**：生物识别锁屏（指纹/FaceID，App 启动时若开启则先出现）。

---

## 4. Cross-cutting states & components（每屏都要覆盖，最易遗漏）

每个屏在重做时，**这些变体都要出图**：

| 状态                  | 说明                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Loading**           | 列表用 Skeleton（卡片骨架），详情用骨架或全屏 spinner                                                   |
| **Empty**             | EmptyState：图标 + 标题 + 副标题 +（可选）行动按钮                                                      |
| **Error / Not found** | 错误插画 + 文案 + 重试按钮                                                                              |
| **游客未登录**        | 受保护屏要有「需要登录」EmptyState + Login 按钮（Home / Profile / AI / Prediction / Essays 都有游客态） |
| **Refreshing**        | 下拉刷新指示                                                                                            |
| **Toast**             | 成功/失败/警告 toast（顶部或底部）                                                                      |
| **Dark mode**         | 每屏的暗色版本                                                                                          |

**通用组件库（需新设计，全局复用）**：
Button（primary/secondary/danger/ghost）、Card、Input、TextArea、Select、RadioGroup、Checkbox、Switch、Slider、Badge（status / result / ranking / count）、Avatar、Tabs / Segmented control、Bottom sheet、Modal、ConfirmDialog、FAB（悬浮加号）、SearchBar、Chip / filter chip、Progress bar、Circular progress（完成度/概率环）、Stat card、List item、EmptyState、Skeleton、Toast、Stepper、Tab bar（底部，带动画）。

**复用模式（多屏共用，统一设计一次）**：

- **CRUD 列表模式**（education / scores / activities / awards）：列表卡片 + 右下 FAB + 新增/编辑 Modal + 删除 ConfirmDialog + EmptyState。
- **搜索+筛选列表模式**（schools / find-college / cases / forum / essay-gallery）：SearchBar + filter chips/按钮（带 active count）+ 排序 + 无限滚动 + footer loading。
- **Tinder 滑卡模式**（swipe / teams / hall-path）：卡片堆叠 + 左右下滑手势 + 结果浮层 + 三按钮。

---

## 5. Complete screen inventory（全部屏，按 flow 分组）

> 每屏格式：**用途 / 内容块（从上到下）/ 关键数据 / 主要操作 / 状态**。
> 标 ⚠️**STUB** 的 5 屏当前是空壳，请按「intended content」设计。

### Flow A — Onboarding & Auth（4 屏）

**A1. Login** `/(auth)/login`

- 用途：邮箱密码登录。
- 内容块：品牌头（logo 图标+标题+副标题）→ 表单（Email、Password、忘记密码链接、登录按钮）→ 底部「没有账号？注册」。
- 数据：email, password。
- 操作：登录（带校验）、跳忘记密码、跳注册。
- 状态：按钮 loading、字段内联错误、成功/失败 toast。

**A2. Register** `/(auth)/register`

- 用途：注册新账号。
- 内容块：头（person-add 图标+标题+副标题）→ 表单（Email、Password+强度提示、确认密码、同意条款 Checkbox+错误）→ 注册按钮 → 底部「已有账号？登录」。
- 数据：email, password, confirmPassword, agreeTerms。
- 状态：按钮 loading、内联错误、条款错误、成功/失败 toast。

**A3. Forgot Password** `/(auth)/forgot-password`

- 用途：发送重置密码邮件。
- 内容块：返回 → 头（key 图标+标题+说明）→ 表单（Email、发送按钮）→ 底部登录链接。**发送成功视图**：mail-open 图标 + 确认标题/说明（含邮箱）+「返回登录」。
- 状态：按钮 loading、email 错误、成功视图+toast、失败 toast。

**A4. Biometric Lock**（启动锁屏）

- 用途：开启生物识别后，启动时验证。
- 内容块：居中指纹图标圆 + 标题 + 副标题 + 解锁按钮。自动弹出系统验证。

### Flow B — Home / Dashboard（1 屏）

**B1. Home** `/(tabs)/index`

- 用途：仪表盘，快速进入各功能 + 申请状态快照。
- 内容块（上→下）：① 渐变 Hero（欢迎+用户名 / 游客提示+登录按钮；3 项统计：案例总数、学校数 "N+"、准确率占位）② 快捷入口网格（6 卡：Profile、Prediction、Ranking、Timeline、Forum、Swipe）③ Profile Grade 卡（A–D 字母圈 + 完成度% + 进度条）④ 选校 Tier 分布（Reach/Target/Safety 计数）⑤ 即将截止（学校名、轮次/状态、剩余天数倒计时，按紧急度变色）⑥ Top Schools 横滑卡（logo、名、排名 badge）⑦ 最近案例列表卡（学校名、专业·年份、结果 badge）。
- 数据：completion%、gpa、targetMajor、tiers、deadline、school logo/rank、case result。
- 操作：点快捷入口/卡片跳转、View all、点学校/案例进详情、游客登录、下拉刷新。
- 状态：列表 Skeleton、Empty、refreshing、游客态。

### Flow C — Profile & Application Data（9 屏，CRUD 重灾区）

**C1. Profile Hub** `/(tabs)/profile`

- 用途：账号主页，完成度/认证/导航到各子页。
- 内容块：头（头像、邮箱、角色 badge、完成度环卡+缺失字段列表+"完善资料"按钮、邮箱/身份认证 badge）→ 积分余额卡 → 申请分析摘要卡（新鲜度/状态/数据质量 badge、结论、traceId、关注校数）→ 资料分区列表（基本信息、成绩、活动、奖项、教育、文书，各带 count badge）→ 快捷链接（简历、保险箱、认证、积分）→ 设置（可见性值、语言、主题、导出数据）→ 管理后台入口（仅 ADMIN）→ 退出按钮+确认。底部版本号。
- 状态：全屏 loading、游客 EmptyState+登录、refreshing、退出确认。

**C2. Basic Info** `/profile/basic`

- 用途：编辑核心资料。
- 内容块：单表单 — 年级 Select(9/10/11/12/Gap)、学校类型 Select、当前学校 Input、目标专业 Input、GPA Input + GPA 制 Select(4.0/5.0/100) 同行、预算 Select、可见性 Select、保存按钮。
- 数据：grade, schoolType, currentSchool, targetMajor, gpa, gpaScale, budgetTier, visibility。
- 状态：全屏 loading、保存中、成功/失败 toast、refreshing。

**C3. Education**（CRUD）`/profile/education`

- 内容块：教育卡列表（学校图标、schoolName、"学位-专业"、起止、GPA"x/制"）→ EmptyState → 右下 FAB → 新增/编辑 Modal（School Name、Degree、Major、起/止 YYYY-MM 同行、GPA+制 同行）→ 删除 ConfirmDialog。
- 状态：loading、empty+add、saving、成功/失败 toast、删除确认、refreshing。

**C4. Test Scores**（CRUD）`/profile/scores`

- 内容块：成绩卡列表（彩色类型 badge、科目、考试日期、大号分值、编辑/删除）→ EmptyState → FAB → 新增/编辑 Modal（类型 Select[SAT/ACT/TOEFL/IELTS/DUOLINGO/AP/IB/A_LEVEL/IGCSE]、AP/IB/A_LEVEL/IGCSE 时出 Subject Select、分数 Input、条件子项[SAT:EBRW/Math; TOEFL:R/L/S/W]、考试日期）→ 删除确认。
- 数据：type, score, testDate, subScores。

**C5. Activities**（CRUD）`/profile/activities`

- 内容块：活动卡列表（类别图标/色、名称、"角色@组织"、描述、hours/week + weeks/year）→ EmptyState → FAB → Modal（名称、角色、类别 Select[Academic/Sports/Arts/Community/Leadership/Work/Other]、组织、描述多行、每周时长+每年周数 同行）→ 删除确认。

**C6. Awards**（CRUD）`/profile/awards`

- 内容块：奖项卡列表（等级图标/色、名称、等级 badge、日期、描述）→ EmptyState → FAB → Modal（名称、等级 Select[School/Regional/National/International]、年份 YYYY、描述多行）→ 删除确认。

**C7. Essays（只读列表）** `/profile/essays`

- 内容块：文书卡列表（标题、状态 badge[Draft/In Review/Final]、promptType badge、字数）→ EmptyState。点击/空态按钮 → `/essays`。

**C8. Application Analysis（只读）** `/profile/analysis`

- 用途：完整 AI 申请分析报告。
- 内容块：摘要卡（标题/副标题、新鲜度 badge、state+数据质量+版本 badge、结论、降级原因、关注校数+traceId）→ Profile Context（申请人类型+考试策略 信息卡、意向专业 badge、上下文标记 badge、约束列表、高中背景）→ 选校诊断卡（组合平衡+state badge、描述、关键理由、风险边界）→ 关注校（每校卡：名、tier/轮次 badge、轮次上下文、评估摘要、政策 badge、概率/置信/更新行、why-hard/优势/差距/下一步/历史/硬门槛 列表、补救、不确定性区间+原因）→ 行动计划（Now / 未来90天 / 提交前 列表）→ 未知项列表。
- 状态：全屏 loading、游客 EmptyState、无分析 EmptyState、refreshing。只读。

**C9. Data Export** `/profile/export`

- 内容块：单个 JSON 卡（clipboard 图标、"JSON" 标题、说明、导出按钮）→ 调系统分享。
- 数据：导出 grade/schoolType/currentSchool/targetMajor/gpa/scale/budget/scores/activities/awards/education/exportedAt。

### Flow D — School Discovery（5 屏）

**D1. Schools List** `/(tabs)/schools`

- 内容块：SearchBar+筛选按钮 → 排序指示标 → 学校卡 FlashList（校园封面缩略、logo 叠加、名、"city, state"、排名 badge、录取率 badge、chevron）→ 排序 BottomSheet（按 Ranking/录取率/学费/名称）。
- 操作：搜索(防抖)、筛选、排序、点卡进详情、无限滚动、下拉刷新。
- 状态：5 卡 Skeleton、Empty、footer loading、refreshing。

**D2. Find College（搜索+收藏）** `/find-college`

- 内容块：SearchBar+筛选按钮(active count) → 横向筛选 chips(排名/学费/录取率/州/类型) → 可删除的 active filter 标签 → 结果数 → 学校卡无限列表（封面+logo、英文名、中文名、city/state、❤️收藏切换、排名 badge、录取率 badge、学费 badge）→ 筛选 Modal（排名/学费/录取率 min-max、州 Select、类型 Select）。
- 操作：搜索、筛选 Modal(应用/重置)、点 chip/标签、❤️收藏(加入/移出选校单)、进详情、无限滚动、刷新。
- 状态：5 卡 Skeleton、Empty(可清筛选)、footer loading、加/移收藏 toast。

**D3. School Detail** `/school/[id]`

- 内容块：头（校园封面、logo、英文名、中文名、city/state/country）→ 4 项统计网格（录取率、学费、平均薪资、在校人数，每项带数据来源标注）→ 可滚 Tab：Overview（描述卡、按来源分组的排名卡+#名次、官网按钮）、Deadlines（轮次+备注+日期 badge）、Essay Prompts（题目、字数限制 badge、required badge）、Related Cases（专业、年/轮、结果 badge）。
- 操作：开官网、点关联案例进详情、切 Tab。
- 状态：头+统计 Skeleton、错误(未找到+重试)、各 Tab 空态、案例 Tab Skeleton。

**D4. Custom Ranking** `/ranking`

- 用途：调权重生成个性化排名并保存。
- 内容块：头卡（图标+标题+副标题）→ 权重卡（总权重 badge + 4 个滑块：US News 排名/录取率/学费/平均薪资，0–100 步长5+提示 + 计算按钮）→ 保存卡（名称 Input+保存，出结果后显示）→ 结果列表(Top50)（排名图标/数字，前3 奖杯/奖牌、logo、英/中文名、计算分）。
- 操作：调滑块、计算/预览、命名+保存、点校进详情。
- 状态：计算中 loading、空结果、保存成功/失败/请输入名称 toast。

**D5. Swipe（滑卡预测游戏）** `/swipe`

- 用途：对真实案例预测 admit/reject/waitlist，建立校准准确率。
- 内容块：StatsBar（准确率%、对/总、切换统计）→ 可滑卡片堆叠（CaseCard：学校名+认证勾、US-News 排名 badge、meta chips[年/轮/专业/录取率]、统计网格[GPA/SAT/ACT/TOEFL/AP]、活动数+亮点 chip、奖项数+最高等级、tags、方向性 admit/reject/waitlist 浮层）→ 每次滑后结果浮层 → 3 按钮(reject/waitlist/admit)。StatsView：返回头、校准准确率大数%、统计网格(总滑数/正确数)。
- 操作：右滑=admit/左滑=reject/下滑=waitlist 或按钮、切统计、Load More、返回。
- 状态：空牌堆(load more)、统计 loading、统计空、错误 toast、触觉反馈。

### Flow E — Prediction & Recommendation（2 屏）

**E1. Prediction** `/prediction`

- 用途：查看各目标校录取概率/tier，上报真实结果。
- 内容块：渐变头（标题、副标题、资料完成度进度条+提示）→ 3 快速统计卡（已预测数、safety 数、reach 数）→ 说明卡（3 条免责：概率≠录取率、置信度、tier）→ 可点「申请分析」卡（状态 badge、state/数据质量 badge、组合结论）→ 预测列表（每卡：学校名、tier badge、tier 结论、基准录取率+对比 delta、baseline/round-adjusted/need-blind badge、洞察面板[估算理由、来源信号 badge、不确定性提示、更新时间]、因素行↑/↓/—、相似真实案例面板、置信度+上报按钮）→「添加预测」按钮 → 上报结果 Modal。
- 上报 Modal：选结果(ADMITTED/REJECTED/WAITLISTED/DEFERRED/WITHDRAWN)、轮次 chips(RD/EA/ED/ED2/REA/SCEA/ROLLING)、isFinal 开关、备注、提交。
- 状态：游客态、loading、空(无预测)、上报成功/失败 toast。

**E2. Recommendation** `/recommendation`

- 用途：按偏好生成 AI 平衡选校单(reach/match/safety)，查看历史。
- 内容块：渐变 Hero → Generate/History 分段 Tab。**Generate**：资料状态横幅(完成度、积分余额、GPA/考试/活动摘要 chip、缺失字段)→ 偏好表单(地区 chips、专业 chips、预算选项、数量 5/8/10/15)→ 生成按钮+积分消耗说明 → 加载卡(动画%+步骤文案)→ 结果(摘要卡[AI 文案、策略免责、tier 计数]、学校卡[logo、名、tier badge、排名 badge、fit 分、概率%+条、地点/录取率/学费、理由、顾虑]、分析[优势/劣势/改进建议]、重新生成按钮)。**History**：可展开的历史推荐卡。
- 状态：loading(预检+动画生成)、历史空、成功/失败 toast、不可生成提示(资料不全/积分不足)。

### Flow F — Cases & Hall（3 屏）

**F1. Cases List** `/(tabs)/cases`

- 内容块：SearchBar+筛选按钮(active count)→「提交案例」按钮(登录)→ 案例卡 FlashList(学校名、"专业·年·轮"、结果 badge、GPA/SAT/TOEFL 统计行、Verified badge、Anonymous badge)→ 筛选 BottomSheet(结果+年份 Select、取消/确认)→ 提交案例 Modal。
- 操作：搜索、按结果(Admitted/Rejected/Waitlisted)+年份(2022–2025)筛选、提交案例、进详情、无限滚动、刷新。
- 状态：4 卡 Skeleton、Empty(登录可提交)、footer loading、a11y 结果数播报。

**F2. Case Detail** `/case/[id]`

- 内容块：tinted 头(结果 badge、可点学校行[头像+名+专业/年/轮]、verified badge、anonymous badge)→ 成绩卡(GPA/SAT/ACT/TOEFL 区间，仅非空)→ tags 卡 → 文书卡(题目斜体 + 内容，超500字 show more/less)。
- 操作：点学校行进详情、展开/收起文书。
- 状态：头+成绩 Skeleton、错误(未找到+重试)、无数据时卡片隐藏。

**F3. Hall of Fame** `/hall`

- 用途：浏览大陆已认证录取趋势、你 vs 目标校的竞争排名、案例挑战。
- 内容块：3 分段 Tab(verified/ranking/path)。**Verified**：China Admit Dashboard(数据透明横幅 含数量+日期、每校卡[名、排名、A/B/C/D 可靠度 badge、YoY 录取柱状图或无数据占位、录取率趋势信号 stable/declining/surging+变化%])、已认证用户统计行(总数、录取数、平均 GPA)、筛选 chips(全部/录取/top20/ivy)、已认证用户列表(头像、昵称+认证勾、学校+专业、结果 badge、GPA badge、SAT badge)。**Ranking**：目标校列表(校名、总申请人、百分位 badge、你的排名#、你的分、分项进度条)。**Path**：single/challenge 子模式切换 — single 复用 swipe；challenge 显示一个申请人画像(年级/GPA/SAT/TOEFL/专业 chip)+ 逐校猜测 pills(ADMITTED/REJECTED/WAITLISTED/DEFERRED)+ 提交后逐校揭晓(你的猜 vs 实际+对错图标)+ 对/总汇总。
- 状态：各 Tab loading、verified 空、ranking 空、china-admit 空、challenge 空(新挑战)、提交中。

### Flow G — AI & Essays（6 屏）

**G1. AI Assistant Tab** `/(tabs)/ai`

- 用途：与 AI agent(auto + 4 专项模式)对话。
- 内容块：Agent 模式分段选择(Auto/Essay/School/Profile/Timeline)+新对话按钮 → 空态(sparkles 图标、标题、副标题、4 个快捷建议卡[分析画像/推荐学校/审文书/查时间线])→ 消息列表(用户气泡、助手气泡含 markdown+工具调用 chip+thinking 指示)→ 输入栏(多行 max2000、发送按钮)+未登录提示。
- 状态：thinking loading、空(欢迎)、错误 toast、未登录(提示+禁用输入)。

**G2. Uncommon App（AI Agent + 仪表盘）** `/uncommon-app`

- 用途：多 agent AI 对话 + 申请就绪仪表盘。
- 内容块（欢迎视图）：申请仪表盘卡(eyebrow/标题、新鲜度 badge、结论/摘要、4 指标块[资料%、学校数、文书数、推荐数]、两按钮[生成分析/生成推荐]、4 项任务清单+chevron)→ 配额卡(用量进度条、已用/上限)→ agent 选择 chips(auto/essay/school/profile/timeline)→ 快捷操作横滑卡 → 欢迎消息。**对话视图**：紧凑头(配额+agent 选择)+消息列表(气泡、agent badge、工具调用指示、markdown、typing 指示)。常驻输入栏(多行+发送、未登录提示)。
- 状态：配额 loading、streaming/typing、分析/推荐 pending、未登录提示、成功/失败/警告 toast。

**G3. Essays（管理列表）** `/essays`

- 内容块：统计卡行(All/Draft/In-Progress/Completed，可点筛选)→ 区标题 → 文书列表(EssayCard：类型图标、标题、类型+学校名、状态 badge、字数进度条 wordCount/wordLimit、AI 审查+删除按钮)→「新建文书」FAB → 删除确认。
- 操作：按状态筛选、点卡进编辑器、AI 审查→ AI Tab、删除、FAB→新建、刷新。
- 状态：loading、Empty、未登录 EmptyState、删除成功/失败 toast。
- 跳转：/essay/[id]、/essay/new、/(tabs)/ai。

**G4. Essay Editor** `/essay/[id]`

- 用途：写/编文书，6 个 AI 工具 + 自动保存。
- 内容块：头(标题 Input、字数/上限、保存链接或已存勾)→ 全高内容编辑器 → 底部 AI 工具栏(横滑 6 工具：Review/Polish/Brainstorm/Continue/Opening/Rewrite + 处理条)→ AI 结果 Modal：Review(总分、各项分+反馈、摘要、建议)、Polish(原→改 diff + 应用/复制)、Brainstorm(点子卡点击复制)、Continue(续写+追加/复制)、Opening(风格选项 用/复制)、Rewrite(指令 Input→版本选项 用/复制)。
- 状态：loading、AI 处理中(逐工具)、保存成功/失败 toast、新文书"先保存"提示、应用/追加/复制 toast。

**G5. Essay Gallery** `/essay-gallery`

- 用途：浏览真实录取文书，筛选 + AI 分析。
- 内容块：统计头(总数、录取数、top20 数)→ SearchBar(按学校)→ 年份 pills → 文书类型 pills(All/Common App/UC/Supplemental/Why School/Other)→ 结果 pills(Admitted/Rejected/Waitlisted/Deferred 彩色)→ 清筛选链接 → 结果数+spinner → 文书卡列表 → 分页 footer(上/下页 + page X/Y)→ 详情 BottomSheet。
- 状态：Skeleton loading、Empty(可清筛选)、fetching spinner。

**G6. Chat Conversation** `/chat/[id]`

- 用途：WebSocket 实时 1:1 或群聊。
- 内容块：头(对话/对方名、在线点、菜单)→ 离线/连接中横幅 → 消息列表(日期分隔 Today/Yesterday/date；左右气泡含文本、HH:mm、自己消息已读勾)→ 空"暂无消息" → 滚到底按钮 → typing 指示 → 输入栏(多行 max1000、发送)。
- 操作：发消息(WS+REST 回退)、长按消息→复制/撤回(<2min,自己)/删除、typing 指示、滚到底。
- 状态：loading、错误/未找到、空消息、连接中横幅、复制/撤回 toast。

### Flow H — Community & Social（4 屏 + 1 STUB）

**H1. Forum** `/forum`

- 内容块：统计卡(4 计数：帖子/用户/组队评论/今日活跃)→ SearchBar → 横向类别 chips("All"+各类别带图标)→ 排序分段(Latest/Popular/Comments)→ 结果数+spinner → 帖子列表(置顶标、标题、类别 badge+组队 badge+tag chip、组队信息片段[当前/最大成员、open/closed]、footer[作者头像+名、time-ago、赞/评/看 计数])→ 悬浮 FAB → 发帖 Modal。
- 发帖 Modal：选类别、标题、内容、加/删 tag(≤5)、发布。组队帖只读(跳 /teams)。
- 状态：loading、Empty(可发帖)、发帖成功 toast、失败 toast。

**H2. Forum Post Detail** `/forum/[id]`

- 内容块：作者行(头像、名、日期、删除[自己]/举报)→ meta(类别 badge、置顶/锁定 badge、tag chip)→ 标题+正文 → 统计条(赞切换+数、评论数、查看数)→ 组队区[组队帖](状态 badge、成员进度条、截止、要求、只读提示)→ 评论区(数量头、嵌套评论树[头像/名/时间/内容/回复])→ 底部评论输入栏(回复指示、文本、发送)或锁定提示。
- 操作：赞、评论、回复、举报(确认)、删除(自己)、刷新。
- 状态：全屏 loading、错误/未找到(返回)、空评论、成功/失败 toast。

**H3. Followers / Following / Blocked** `/followers`

- 内容块：SearchBar → 分段 Tab(粉丝/关注/拉黑 含计数)→ 推荐区[非拉黑 Tab](横向可折叠卡：头像、名、副标题 年级·专业、关注/取关)→ 用户列表(UserCard：头像、名+互关 badge、副标题、关注/取关、拉黑图标 或 BlockedUserCard：头像+禁封叠加、解除拉黑)→ 拉黑/解除 ConfirmDialog。
- 操作：搜索、切 Tab、关注/取关、拉黑/解除(确认)、点用户→发起会话、刷新。
- 状态：全屏 loading、各 Tab 空、各操作成功/失败 toast。
- 跳转：/chat/[id]。

**H4. Teams（组队匹配）** `/teams`

- 用途：Tinder 式竞赛组队 — 滑卡、看匹配、编辑招募卡。
- 内容块：PageHeader → 分段 Tab(Match/Matches/My Team)。**Match**：招募卡(竞赛/背景、标题、成员 meta、headline、成员数+状态 badge、亮点 chip[学术/经历/性格]、offer/need/skill 角色 chip、协作详情可折叠)+ Pass/Like 按钮。**Matches**：匹配卡(对方队名、竞赛/背景、匹配类型+状态 badge)。**My Team**：编辑面板(所属队 Select、竞赛赛道 Select、队名、headline、详情、offer/need/skill 角色、目标人数、创建/保存并发布)、展示面板(自我介绍、简历 Select、展示学术/经历/性格 开关、同意确认)、实时预览卡。
- 状态：各 Tab loading、空(无卡/牌堆空/无匹配)、成功 toast(创建/更新/发布/匹配/滑动/展示更新)。

**H5. Peer Review** `/peer-review` — ⚠️**STUB**

- 当前：仅 PageHeader(star 图标)+EmptyState，列表未实现。
- **Intended content（请按此设计）**：可领取的同伴互评请求列表（每项：请求者、文书类型/学校、字数、截止、状态、领取按钮）；我发起的请求；我已完成的评审。需要 列表 + 详情/评审界面 + EmptyState。

### Flow I — Planning & Tools（2 屏 + 2 STUB）

**I1. Timeline** `/timeline`

- 用途：跟踪每校申请进度、任务、个人/全局事件。
- 内容块：总览头卡(总/已交/进行中/即将 统计 + 已交进度条)→ 3 分段 Tab(schools/events/overview)。**Schools**：每校卡(名、轮次 badge、状态 badge、截止+剩余/逾期、任务完成进度、可展开内联任务列表+checkbox+加任务+删除)。**Events**：个人事件区(加按钮；可展开事件卡[类别 badge、标题、日期、任务进度、备注、任务 checkbox、删除])+全局事件区(日期块、标题、类别+剩余天、订阅按钮)。**Overview**：4 统计卡 + 即将截止列表(≤5)+逾期任务列表。Modal：加任务、加事件、删除确认。
- 状态：各 Tab loading、空(无校/无事件/无全局/无总览)、成功/失败 toast、加/删确认。

**I2. Assessment（性格测评）** `/assessment`

- 用途：做 MBTI / Holland / 专业匹配问卷并看结果。
- 内容块（状态机 select/quiz/result/history）：**Select**：标题、3 类型卡(图标、标题、描述、开始)、历史按钮。**Quiz**：关闭、进度(Q n/total)+进度条、题干、选项列表(radio)、上一题/下一题/提交。**Result**：返回头；MBTI(4字母大类型、标题/描述、4 维度条 E/I S/N T/F J/P +%、优势列表、职业 chip、专业 chip) 或 Holland(RIASEC 码、类型 badge、6 维度条+分、领域 chip、推荐专业 chip)；重测/换一个。**History**：返回头、历史结果卡(类型 badge、概要码、完成日期)。
- 状态：quiz loading、提交中、历史 loading、历史空(开始)、提交成功 toast+触觉、失败 toast。

**I3. Resume** `/resume` — ⚠️**STUB**

- 当前：仅 PageHeader(document 图标)+EmptyState。
- **Intended content**：简历列表(每份：标题、更新时间、模板、预览/编辑/导出)；新建 FAB；空态。详情/编辑器另设。

**I4. Vault（加密保险箱）** `/vault` — ⚠️**STUB**

- 当前：仅 PageHeader(lock 图标)+EmptyState。
- **Intended content**：加密凭证列表(每项：类型图标、标题、用户名/账号遮罩、复制、解锁查看)；分类(学校门户/考试账号/推荐人等)；新增 FAB；空态。强调安全感的视觉。

### Flow J — Account, Rewards & Settings（10 屏，含 2 STUB）

**J1. Notifications** `/notifications`

- 内容块：头+「全部已读」[有未读时]→ 通知列表(类型彩色图标圈、标题[未读加粗]、2 行正文、time-ago、未读点、删除)→ 分隔 → EmptyState。
- 数据：14 种 type(NEW_FOLLOWER/NEW_MESSAGE/POINTS_EARNED/DEADLINE_REMINDER…)、title、content、read、createdAt。
- 操作：点击标已读、删除、全部已读、刷新。
- 状态：loading、Empty。

**J2. Subscription** `/subscription`

- 内容块：渐变 Hero → 当前套餐横幅(图标、套餐名、active/expired badge、到期日、免费则升级提示)→ 月/年切换+年付折扣 badge → 套餐卡(Free/Pro/Premium：强调条、popular/best-value badge、图标、名、月价+划线原价+年总价、功能清单、按钮 current/upgrade/switch/free)→ 账单历史可展开(日期、描述、金额、状态 badge)→ 取消订阅按钮[付费]→ 取消确认。
- 状态：全屏 loading、账单 loading/空、订阅&取消 成功/失败 toast。

**J3. Security** `/security`

- 内容块：改密码卡(当前/新/确认 Input、4 段强度条+标签、要求文案、更新按钮)→ 生物识别卡(说明、开关 或"不可用"横幅)→ 活跃会话卡(说明、"登出所有设备"按钮)→ 删除账号卡(红色—警告、删除按钮)→ 删除账号确认浮层(密码 Input、取消/删除)。
- 操作：改密码、切生物识别(系统验证)、登出所有设备(确认)、删除账号(浮层+密码)。
- 状态：各操作 loading、生物识别 loading/不可用、4 个操作成功/失败 toast。
- 跳转：/(auth)/login(登出/删号后)。

**J4. Settings Hub** `/settings`

- 内容块：用户卡[登录](头像、名、邮箱、VIP badge→/profile/basic)→ 分组设置卡：**账号**(个人信息、账号安全、订阅 含 VIP/Free 值)；**偏好**(暗色 开关、语言 跳转切换、生物识别 开关[可用时])；**通知**(推送 开关、邮件摘要 开关)；**安全**(改密码、登录设备)；**帮助**(FAQ、反馈)；**支持**(帮助中心、联系支持、评分)；**关于**(版本、条款、隐私)；**账号操作**[登录](登出、删除账号-危险)→ 删号密码浮层。
- 操作：跳子页、切暗色/通知/生物识别、切语言、开外链、评分、登出、删号。

**J5. Language** `/settings/language`

- 内容块：RadioGroup(标签"语言"、选项 中文/English)。选择→ changeLanguage+同步后端(乐观更新+失败回滚)。成功 toast。

**J6. Theme** `/settings/theme`

- 内容块：RadioGroup 模式(Light/Dark/System)→ 调色板头(标题+说明)→ 主题搜索 Input → 横向类别 chips(All+类别)→ 调色板网格(2 列卡：色板预览 canvas/surface/primary/accent、主题名、字体/卡片预设 meta)→ 无结果空态。
- 操作：选模式、搜主题、按类别筛选、选调色板。
- 状态：Empty(无搜索结果)。

**J7. Points** `/points` — ⚠️**STUB**

- 当前：仅 PageHeader(trophy 图标)+EmptyState(余额/徽章/历史 TODO)。
- **Intended content**：积分余额大数卡 + 等级进度；获取途径(签到/完成资料/提交案例…)；徽章网格(已得/未得)；积分流水历史(时间、事项、+/- 分)；兑换入口。

**J8. Referral** `/referral`

- 内容块：PageHeader(gift 图标)→ 推荐码卡(标签"你的推荐码"、大号等宽码、复制按钮)。
- **可扩展**：邀请奖励说明、已邀请人数、分享按钮(当前仅复制码)。
- 状态：loading、已复制 toast。

**J9. Verification** `/verification` — ⚠️**STUB**

- 当前：仅 PageHeader(shield 图标)+EmptyState(状态+提交表单 TODO)。
- **Intended content**：当前认证状态卡(未认证/审核中/已认证)；身份认证提交表单(上传学生证/录取信、学校、毕业年份)；说明认证带来的权益(已认证 badge、Hall 露出等)；进度时间线。

**J10. Admin Dashboard** `/admin`（仅 ADMIN，模态全屏）

- 内容块：自定义头(返回、标题)→ 分段 Tab(Overview/Reports/Users)。**Overview**：2 列统计网格(总用户、总案例、待处理举报、总评审)。**Reports**：举报卡(状态 badge、目标类型 badge、原因、详情、举报者邮箱)。**Users**：搜索框 + 用户卡(头像、邮箱、角色 badge、邮箱验证图标)。举报处理 Modal(状态/类型/原因/详情 + 标记已审/已解决)。用户处理 Modal(头像、邮箱、角色+验证 badge、案例/评审计数、设为 verified/user、删除)。
- 状态：各 Tab Skeleton、空(无举报/未找到用户)、非管理员→重定向、操作失败 Alert、成功触觉。

---

## 6. Master checklist（逐屏打勾，做到零遗漏）

**Auth & Onboarding**：☐ Login ☐ Register ☐ Forgot Password ☐ Biometric Lock
**Home**：☐ Home Dashboard
**Profile & Data**：☐ Profile Hub ☐ Basic Info ☐ Education ☐ Test Scores ☐ Activities ☐ Awards ☐ Essays(list) ☐ Application Analysis ☐ Data Export
**School Discovery**：☐ Schools List ☐ Find College ☐ School Detail ☐ Custom Ranking ☐ Swipe Game
**Prediction**：☐ Prediction ☐ Recommendation
**Cases & Hall**：☐ Cases List ☐ Case Detail ☐ Hall of Fame
**AI & Essays**：☐ AI Tab ☐ Uncommon App ☐ Essays Mgmt ☐ Essay Editor ☐ Essay Gallery ☐ Chat Conversation
**Community**：☐ Forum ☐ Forum Post Detail ☐ Followers ☐ Teams ☐ Peer Review(stub)
**Planning & Tools**：☐ Timeline ☐ Assessment ☐ Resume(stub) ☐ Vault(stub)
**Account & Settings**：☐ Notifications ☐ Subscription ☐ Security ☐ Settings Hub ☐ Language ☐ Theme ☐ Points(stub) ☐ Referral ☐ Verification(stub) ☐ Admin

**别忘了（最常被漏）**：每屏的 Loading / Empty / Error / 游客态 / Dark mode；3 个共用模式(CRUD / 搜索筛选 / 滑卡)；底部 Tab bar + More 宫格 + 全局组件库。

---

_生成依据：通读 `apps/mobile/src/app/**` 与 `apps/mobile/src/screens/**` 全部屏文件。Stub 屏(peer-review/resume/vault/points/verification)当前为空壳，已补充 intended content。_
