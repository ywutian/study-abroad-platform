# 录取预测 —— 招生官评估视角(设计方案)

> 2026-05-22 · 关联 [PREDICTION_ACCURACY_DECISION_2026-05-22.md](./PREDICTION_ACCURACY_DECISION_2026-05-22.md)
> 状态:设计稿(待落地)

## Context — 为什么是这个方案

预测「精准度」讨论收口到一个根本认识链:

1. 点概率不可验证(backtest)→ 改档位为主。
2. 档位/区间作为「裁决」**天生信息量低**——任何把一切压成一个 token 的形态都低参考价值。
3. 真正的参考价值来自**对比/定位**,不是裁决。
4. 但「你 vs 该校录取者分布」只有学术维度有真实校方数据;活动/奖项**全世界都没有校方分布**。
5. **关键反转**:从招生官的真实视角看 —— 他们也**没有「标准」**。选择性大学不存在公开录取线;招生官用的是 **holistic review:一套分轴评级 rubric + 语境校准**。

所以本方案:**把预测页完全重组成「招生官怎么读你这份档案」**。平台不发明标准 —— 它复刻招生办的真实评估流程。

## 招生官真实怎么评(holistic review)

实证依据:Harvard SFFA 诉讼公开的评级体系 —— 每份档案由 reader 在固定几条轴上打分(1–6 分):**Academic / Extracurricular / Athletic / Personal / School Support(推荐信)/ Overall**。三条不变量:

- **没有绝对线**。每份档案读两个语境:相对申请者**自己的高中**(3.8 在严苛校 ≠ 放水校),相对**今年这所学校的池子**。评级对池子校准。
- **软性轴不靠查数据**。课外/个人是 reader 凭训练出的 rubric 打分 —— 招生官手里也没有「录取者活动分布」。
- **Overall 是各轴综合** —— 就是「冲/稳/保」。

> 这条解开了死结:平台用 rubric 评课外,**和招生官同源** —— 不是「假装有数据」,是复刻一个本来就没有数据、只有 rubric 的流程。

## 五条评估轴 —— 每轴的方法、数据、引擎对接、输出

判断方法分 6 类:**A** 分布百分位 · **B** 区间定位 · **C** 基准率切换 · **D** 绝对 rubric · **E** 真实案例锚定 · **F** 修正项(后台,不单独成行)。

每轴对外输出一个**词级评级**(突出 / 有竞争力 / 达标 / 临界 / 偏弱),**对该校选择性校准**,下挂证据。评级由引擎对应 modifier 的乘数读出(>1.05 顺风、~1.0 中性、<0.9 逆风),证据是原始数据。

### 轴 1 · 学术(Academic)

- **招生官做什么**:在高中语境里读成绩单 + 标化 + 学术奖/科研,形成学术评级。
- **平台方法**:
  - GPA → **方法 A**:rigor 归一化后定位 CDS C9/C11 录取者 GPA 分布(`calculateGpaPercentileFromCds` 已存在),输出「约第 N 百分位」。覆盖 182 校;无分布的校降级为「vs 该校均值」。
  - 标化 → **方法 B**:校方 p25/p50/p75 拟合正态(σ=(p75−p25)/1.349),算位置。覆盖 241 校。标签必须写「在**提交分数的**录取者中」(test-optional 自选偏差)。
  - 课程难度 / 学术奖项 → **方法 D**:AP/IB/A-Level + 学术类奖项 tier rubric。
- **引擎对接**:`modifierResults.gpaBand` + `testBand`(几何平均进概率);课程/学术奖在 `profileContext` 内。
- **输出例**:「学术轴:**有竞争力** — GPA 约该校录取者第 68 百分位,SAT 在提交者中偏上四分之一,8 门 AP。」
- **诚实度**:最强 —— 真实数据 + 真实方法。**唯一一个百分位数字合法出现的轴。**

### 轴 2 · 课外(Extracurricular)

- **招生官做什么**:reader 凭 1–6 rubric 评深度/领导力/distinction,找 **spike**(1–2 件事的持续卓越)优于一长串浅尝。
- **平台方法**:**方法 D + E**。复刻 rubric —— 活动 `tier`(1–4)+ 领导角色 + 年限/小时 → 有无 spike(tier≤2)、有无领导力、有无深度(`activityStrengthComponent` 已计算 0–100 分 + highTier/leadership/depth 信号)。叠 **E**:真实相似录取者实际有什么活动(`/cases/similar`,已上线)。
- **引擎对接**:`activityStrengthComponent` + `awardStrengthComponent` → `profileContextMultiplier` → `modifierResults.profileContext`。
- **输出例**:「课外轴:**中等** — 有 1 个 tier-1 活动(算一个 spike),但领导力记录有限;对这个选择性的学校,中等课外是逆风。」
- **诚实度**:rubric 合法(与招生官同源)。**永不给百分位** —— 校方分布不存在。

### 轴 3 · 个人特质(Personal)—— 诚实留白

- **招生官做什么**:从文书 + 推荐信 + 面试评性格/voice。**顶校权重极高。**
- **平台方法**:**无**。预测时平台看不到文书、看不到推荐信。
- **输出**(固定文案):「个人轴:**我们看不到** — 文书、推荐信、面试是招生官权重最高的部分之一,而预测无法读取。**这是本预测最大的不确定来源。**」(若学生已有 essay-AI 评分,可作弱信号注脚,不进档位。)
- **诚实度**:这个洞被精确命名 —— 是产品可信度的来源,不是缺陷遮掩。

### 轴 4 · 契合与机构塑造(Fit & Shaping)

- **招生官做什么**:塑造一届学生 —— 专业平衡、地域、ED yield 保护、demonstrated interest、hook、need-aware / 国际生配额。
- **平台方法**:**方法 C + F**。不是「你在哪」,是「哪个基准率适用 + 哪些调整」。
  - 轮次 ED/EA → `round`(C);专业竞争度 → `major`(C/F);国际生 → `intl` + need-blind(C);州内外 → `geo`(C);一代 → `firstGen`。
  - hook(legacy/体育生/URM)→ **不判断,只标注**:「你声明了 X,核实前不计入」(引擎对未核实 hook 故意中性)。
- **引擎对接**:`modifierResults.{round, major, intl, geo, firstGen, legacyHook, athlete, urm}`。
- **输出例**:「契合轴:ED 申请对你有利(该校 ED 录取率约为 RD 的 4×);CS 在该校竞争度高于平均,是逆风;国际生身份意味着适用国际生录取率。」

### Overall · 档位

- = 各轴综合 = 冲刺 / 匹配 / 保底。由引擎 `probability → calculateTier` 得出(不变)。
- 档位是「一眼裁决」;**屏幕主体是上面四条轴的逐轴读数** —— 这才是参考价值所在,它告诉学生**该补哪条轴**。

## 与现有 counselor 引擎的关系 —— 是「重组」不是「重写」

引擎**已经在算**这一切 —— `modifierResults` 的 11 个 modifier 就是这些轴的原料。本方案不改引擎计算,改的是**呈现的组织方式**:

| 招生官轴 | 现有引擎 modifier                                                           |
| -------- | --------------------------------------------------------------------------- |
| 学术     | `gpaBand`, `testBand`, +`profileContext` 内课程/学术奖                      |
| 课外     | `profileContext`(`activityStrengthComponent`+`awardStrengthComponent`)      |
| 个人     | —(引擎也没有,诚实留白)                                                      |
| 契合     | `round`, `major`, `intl`, `geo`, `firstGen`, `legacyHook`, `athlete`, `urm` |

落地 = API 把 `factors[]`/`modifierResults` **按这 4 轴分组**输出 + 每轴派生一个词级评级 + 前端按轴渲染。引擎逻辑零改动。

## 落地清单

1. **后端** — 新增 `buildAdmissionsLens(counselorResult, school, profile)`:把 modifierResults 分到 4 轴,每轴算词级评级(读 modifier 乘数)+ 装配证据(学术轴接 CDS 百分位计算);prediction 响应加 `admissionsLens` 字段。
2. **学术轴证据** — 复用 `calculateGpaPercentileFromCds`;新增标化正态拟合百分位 util。
3. **前端** — 预测卡展开区从「assessment / why / 案例」重组为**四轴读数**为主体;个人轴固定留白文案;档位仍是头条。
4. **i18n** — 四轴标签 + 5 级评级词 + 个人轴留白文案。
5. **数据覆盖兜底** — 学术轴:无 CDS 分布的校只显示「vs 均值」不显示百分位;其余轴 modifier 缺失时显示「未提供」。

## 不做

- 不给活动/奖项编「百分位」(数据不存在)。
- 不把个别案例混入概率(决策记录已定)。
- 不改引擎 modifier 计算(本方案纯呈现层)。
- 概率数字/区间:延续决策记录 —— 前台不作头条;学术轴内的 CDS 百分位是「位置」不是「概率」,可出现。

## 一句话

> 平台不发明录取标准 —— 它复刻招生办的真实流程:把每份档案按 holistic review 的真实评估轴(学术 / 课外 / 个人 / 契合)逐轴给出**对该校校准的词级读数**,有真实分布的轴(学术)用百分位证据,没有的轴(课外)用与招生官同源的 rubric,看不到的轴(个人)**诚实留白**。档位是各轴的 Overall 综合。参考价值来自「逐轴读数」——它告诉学生该补哪一轴。
