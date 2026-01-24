# 竞赛数据库文档 (Competition Database)

> 最后更新: 2026-02-13

---

## 1. 目的与范围

竞赛数据库是一个标准化的参考数据表，用于:

1. **统一竞赛名称**: 用户选择标准化竞赛名称而非自由输入
2. **层级化评分**: 根据竞赛声望层级（1-5）自动加权奖项分数
3. **中英双语**: 支持中英文竞赛名称展示
4. **分类管理**: 按学科领域分类组织竞赛

---

## 2. 数据模型

**Prisma Schema: `model Competition`**

| 字段            | 类型                    | 说明                                                 |
| --------------- | ----------------------- | ---------------------------------------------------- |
| `id`            | String @id              | CUID 主键                                            |
| `name`          | String                  | 英文全称                                             |
| `abbreviation`  | String @unique          | 缩写，唯一标识                                       |
| `nameZh`        | String?                 | 中文名称                                             |
| `category`      | CompetitionCategory     | 12 大类枚举                                          |
| `level`         | AwardLevel              | SCHOOL / REGIONAL / STATE / NATIONAL / INTERNATIONAL |
| `tier`          | Int                     | 1-5 声望层级（5 = 最高）                             |
| `description`   | String? (Text)          | 英文描述                                             |
| `descriptionZh` | String? (Text)          | 中文描述                                             |
| `website`       | String?                 | 官方网站                                             |
| `isActive`      | Boolean (default: true) | 是否仍然活跃                                         |
| `awards`        | Award[]                 | 关联的奖项记录                                       |

**关联**: `Award.competitionId` → `Competition.id` (可选 FK)

---

## 3. 层级体系 (Tier System)

| 层级  | 描述       | 评分权重 | 特征                                                                |
| ----- | ---------- | -------- | ------------------------------------------------------------------- |
| **5** | 最高声望   | 25 分    | 国际金牌/全美顶级（如 IMO Gold, ISEF Grand Award, Regeneron STS）   |
| **4** | 顶尖国家级 | 15 分    | 国家队选拔赛/顶级全国赛（如 USAMO, USABO, NSDA Nationals）          |
| **3** | 优秀国家级 | 8 分     | 高水平全国赛入围/知名竞赛（如 AIME, PhysicsBowl, Science Olympiad） |
| **2** | 标准竞赛   | 4 分     | 广泛参与的知名竞赛（如 AMC 12, FBLA, VEX Robotics）                 |
| **1** | 入门竞赛   | 2 分     | 基础参与类（如 AMC 8, NHS, National Latin Exam）                    |

---

## 4. 竞赛分类 (CompetitionCategory)

| 枚举值                 | 描述       | 竞赛数量 |
| ---------------------- | ---------- | -------- |
| `MATH`                 | 数学竞赛   | 14       |
| `BIOLOGY`              | 生物竞赛   | 5        |
| `PHYSICS`              | 物理竞赛   | 5        |
| `CHEMISTRY`            | 化学竞赛   | 5        |
| `COMPUTER_SCIENCE`     | 计算机科学 | 9        |
| `ENGINEERING_RESEARCH` | 工程与科研 | 12       |
| `ECONOMICS_BUSINESS`   | 经济与商业 | 7        |
| `DEBATE_SPEECH`        | 辩论与演讲 | 6        |
| `WRITING_ESSAY`        | 写作与论文 | 7        |
| `GENERAL_ACADEMIC`     | 综合学术   | 6        |
| `ARTS_MUSIC`           | 艺术与音乐 | 6        |
| `OTHER`                | 其他       | 9        |

---

## 5. 竞赛目录

### 数学 (MATH)

| 缩写       | 名称                                          | 中文名               | 层级 |
| ---------- | --------------------------------------------- | -------------------- | ---- |
| IMO        | International Mathematical Olympiad           | 国际数学奥林匹克     | 5    |
| USAMO      | USA Mathematical Olympiad                     | 美国数学奥林匹克     | 4    |
| USAJMO     | USA Junior Mathematical Olympiad              | 美国初级数学奥林匹克 | 4    |
| Putnam     | Putnam Mathematical Competition               | 普特南数学竞赛       | 4    |
| AIME       | American Invitational Mathematics Examination | 美国数学邀请赛       | 3    |
| HMMT       | Harvard-MIT Mathematics Tournament            | 哈佛-MIT数学锦标赛   | 3    |
| PUMaC      | Princeton University Mathematics Competition  | 普林斯顿大学数学竞赛 | 3    |
| AMC 12     | AMC 12                                        | AMC 12 数学竞赛      | 2    |
| AMC 10     | AMC 10                                        | AMC 10 数学竞赛      | 2    |
| ARML       | American Regions Mathematics League           | 美国地区数学联赛     | 2    |
| Mandelbrot | Mandelbrot Competition                        | 曼德布洛特数学竞赛   | 2    |
| MATHCOUNTS | MATHCOUNTS                                    | MATHCOUNTS 数学竞赛  | 2    |
| AMC 8      | AMC 8                                         | AMC 8 数学竞赛       | 1    |
| MOEMS      | Math Olympiad for Elementary Schools          | 小学数学奥林匹克     | 1    |

### 生物 (BIOLOGY)

| 缩写       | 名称                              | 中文名                 | 层级 |
| ---------- | --------------------------------- | ---------------------- | ---- |
| IBO        | International Biology Olympiad    | 国际生物奥林匹克       | 5    |
| USABO      | USA Biology Olympiad              | 美国生物奥林匹克       | 4    |
| USABO Open | USABO Open Exam                   | USABO公开赛            | 3    |
| BioGENEius | BioGENEius Challenge              | BioGENEius生物技术挑战 | 3    |
| SciOly-Bio | Science Olympiad - Biology Events | 科学奥林匹克-生物      | 2    |

### 物理 (PHYSICS)

| 缩写           | 名称                              | 中文名              | 层级 |
| -------------- | --------------------------------- | ------------------- | ---- |
| IPhO           | International Physics Olympiad    | 国际物理奥林匹克    | 5    |
| USAPhO         | USA Physics Olympiad              | 美国物理奥林匹克    | 4    |
| PhysicsBowl    | Physics Bowl                      | Physics Bowl 物理碗 | 3    |
| F=ma           | F=ma Exam                         | F=ma物理竞赛        | 3    |
| SciOly-Physics | Science Olympiad - Physics Events | 科学奥林匹克-物理   | 2    |

### 化学 (CHEMISTRY)

| 缩写           | 名称                             | 中文名               | 层级 |
| -------------- | -------------------------------- | -------------------- | ---- |
| IChO           | International Chemistry Olympiad | 国际化学奥林匹克     | 5    |
| USNCO          | USA National Chemistry Olympiad  | 美国国家化学奥林匹克 | 4    |
| USNCO National | Chemistry Olympiad National Exam | USNCO全国赛          | 3    |
| USNCO Local    | USNCO Local Section Exam         | USNCO地区赛          | 2    |
| YBTC           | You Be The Chemist Challenge     | 你来做化学家挑战赛   | 2    |

### 计算机科学 (COMPUTER_SCIENCE)

| 缩写            | 名称                                  | 中文名             | 层级 |
| --------------- | ------------------------------------- | ------------------ | ---- |
| IOI             | International Olympiad in Informatics | 国际信息学奥林匹克 | 5    |
| USACO           | USA Computing Olympiad                | 美国计算机奥林匹克 | 4    |
| USACO Gold      | USACO Gold Division                   | USACO金级          | 3    |
| Google Code Jam | Google Code Jam                       | 谷歌编程大赛       | 3    |
| Kaggle          | Kaggle Competitions                   | Kaggle数据科学竞赛 | 3    |
| USACO Silver    | USACO Silver Division                 | USACO银级          | 2    |
| ACSL            | American Computer Science League      | 美国计算机科学联盟 | 2    |
| CAC             | Congressional App Challenge           | 国会App挑战赛      | 2    |
| Codeforces      | Codeforces Competitive Programming    | Codeforces编程竞赛 | 2    |

### 工程与科研 (ENGINEERING_RESEARCH)

| 缩写             | 名称                                                 | 中文名                   | 层级 |
| ---------------- | ---------------------------------------------------- | ------------------------ | ---- |
| ISEF             | Regeneron International Science and Engineering Fair | 再生元国际科学与工程大赛 | 5    |
| Regeneron STS    | Regeneron Science Talent Search                      | 再生元科学天才奖         | 5    |
| Siemens          | Siemens Competition                                  | 西门子数学科学技术竞赛   | 4    |
| Davidson Fellows | Davidson Fellows Scholarship                         | Davidson Fellow奖学金    | 4    |
| SciOly           | Science Olympiad                                     | 科学奥林匹克             | 3    |
| FRC              | FIRST Robotics Competition                           | FIRST机器人竞赛          | 3    |
| GSF              | Google Science Fair                                  | 谷歌科学博览会           | 3    |
| MIT THINK        | MIT THINK Scholars Program                           | MIT THINK学者计划        | 3    |
| JSHS             | Junior Science and Humanities Symposium              | 青少年科学与人文研讨会   | 3    |
| Conrad           | Conrad Challenge                                     | 康拉德创新挑战赛         | 3    |
| VEX              | VEX Robotics Competition                             | VEX机器人竞赛            | 2    |
| Envirothon       | Envirothon                                           | 环境科学竞赛             | 2    |

### 经济与商业 (ECONOMICS_BUSINESS)

| 缩写              | 名称                                             | 中文名             | 层级 |
| ----------------- | ------------------------------------------------ | ------------------ | ---- |
| IEO               | International Economics Olympiad                 | 国际经济学奥林匹克 | 4    |
| NEC               | National Economics Challenge                     | 全美经济学挑战赛   | 3    |
| DECA ICDC         | DECA International Career Development Conference | DECA国际商业竞赛   | 3    |
| KWHS              | KWHS Investment Competition                      | 沃顿商学院投资竞赛 | 3    |
| Diamond Challenge | Diamond Challenge                                | 钻石创业挑战赛     | 3    |
| FBLA              | Future Business Leaders of America               | 未来商业领袖       | 2    |
| SMG               | Stock Market Game                                | 股票市场模拟竞赛   | 1    |

### 辩论与演讲 (DEBATE_SPEECH)

| 缩写           | 名称                                 | 中文名                   | 层级 |
| -------------- | ------------------------------------ | ------------------------ | ---- |
| TOC            | Tournament of Champions (Debate)     | 全美辩论冠军赛           | 4    |
| NSDA Nationals | NSDA Nationals                       | NSDA全美演讲与辩论全国赛 | 4    |
| WSDC           | World Schools Debating Championships | 世界学校辩论锦标赛       | 4    |
| HMC            | Harvard Model Congress               | 哈佛模拟国会             | 3    |
| MUN            | Model United Nations                 | 模拟联合国               | 2    |
| NSDA District  | NSDA District Qualifier              | NSDA地区赛               | 2    |

### 写作与论文 (WRITING_ESSAY)

| 缩写              | 名称                                     | 中文名                 | 层级 |
| ----------------- | ---------------------------------------- | ---------------------- | ---- |
| Scholastic Awards | Scholastic Art & Writing Awards          | Scholastic艺术与写作奖 | 4    |
| Concord Review    | Concord Review                           | 协和评论               | 4    |
| John Locke        | John Locke Essay Competition             | 约翰·洛克论文竞赛      | 3    |
| Princeton Play    | Princeton Ten-Minute Play Contest        | 普林斯顿十分钟戏剧赛   | 3    |
| Spelling Bee      | National Spelling Bee                    | 全美拼字大赛           | 3    |
| NHD               | National History Day                     | 全美历史日             | 2    |
| NYT Editorial     | New York Times Student Editorial Contest | 纽约时报学生社论竞赛   | 2    |

### 综合学术 (GENERAL_ACADEMIC)

| 缩写           | 名称                               | 中文名             | 层级 |
| -------------- | ---------------------------------- | ------------------ | ---- |
| NSB            | National Science Bowl              | 全美科学碗         | 3    |
| PACE NSC       | Quiz Bowl (PACE NSC)               | PACE全国学术锦标赛 | 3    |
| AcaDeca        | Academic Decathlon                 | 学术十项全能       | 3    |
| NAQT           | National Academic Quiz Tournaments | 全美学术知识竞赛   | 2    |
| GeoBee         | National Geographic GeoBee         | 国家地理知识竞赛   | 2    |
| Knowledge Bowl | Knowledge Bowl                     | 知识碗             | 1    |

### 艺术与音乐 (ARTS_MUSIC)

| 缩写                      | 名称                                            | 中文名                       | 层级 |
| ------------------------- | ----------------------------------------------- | ---------------------------- | ---- |
| Presidential Scholar Arts | US Presidential Scholars in the Arts            | 美国总统艺术学者             | 5    |
| YoungArts                 | YoungArts Foundation                            | YoungArts艺术基金会          | 4    |
| Scholastic Art            | Scholastic Art Awards                           | Scholastic艺术奖             | 4    |
| Chopin Junior             | International Chopin Piano Competition (Junior) | 国际肖邦钢琴比赛（青少年组） | 4    |
| NAfME All-National        | All-National Honor Ensembles                    | 全美荣誉乐团                 | 3    |
| All-State Music           | All-State Orchestra/Band                        | 州级全明星乐团               | 2    |

### 其他 (OTHER)

| 缩写                 | 名称                               | 中文名             | 层级 |
| -------------------- | ---------------------------------- | ------------------ | ---- |
| Presidential Scholar | US Presidential Scholars Program   | 美国总统学者奖     | 5    |
| IOL                  | International Linguistics Olympiad | 国际语言学奥林匹克 | 4    |
| IPO                  | International Philosophy Olympiad  | 国际哲学奥林匹克   | 4    |
| NMSQT                | National Merit Scholarship Program | 国家优秀学生奖学金 | 3    |
| Eagle Scout          | Eagle Scout                        | 鹰级童军           | 3    |
| Gold Award           | Gold Award (Girl Scouts)           | 金奖（女童军）     | 3    |
| AP Scholar           | AP Scholar Awards                  | AP学者奖           | 2    |
| NHS                  | National Honor Society             | 全美荣誉学生会     | 1    |
| NLE                  | National Latin Exam                | 全美拉丁语考试     | 1    |

---

## 6. 评分映射

Award 与 Competition 通过 `competitionId` 关联后:

```
Award → Competition.tier → tier_points_map → 评分权重
```

未关联 Competition 的奖项使用 Award.level 的默认分值:

- INTERNATIONAL → 20 分
- NATIONAL → 15 分
- STATE → 8 分
- REGIONAL → 5 分
- SCHOOL → 2 分

---

## 7. 如何添加新竞赛

### 通过 Seed 脚本

编辑 `apps/api/prisma/seed-competitions.ts`，在 `competitions` 数组中添加新条目:

```typescript
{
  name: 'New Competition Name',
  abbreviation: 'UNIQUE_ABBREV',  // 必须唯一
  nameZh: '中文名称',
  category: 'MATH',               // CompetitionCategory 枚举值
  level: 'NATIONAL',              // AwardLevel 枚举值
  tier: 3,                        // 1-5
  description: 'English description',
  website: 'https://...',         // 可选
}
```

然后运行:

```bash
pnpm --filter api ts-node prisma/seed-competitions.ts
```

### 通过 API (如果暴露)

```bash
POST /api/v1/competitions
{
  "name": "...",
  "abbreviation": "...",
  "category": "MATH",
  "level": "NATIONAL",
  "tier": 3
}
```

---

## 8. 数据维护

### 年度审查

每年 8-9 月（新学年开始前）:

1. **检查停办竞赛**: 设置 `isActive = false`
2. **层级调整**: 根据录取数据反馈调整竞赛层级
3. **新增竞赛**: 添加新出现的知名竞赛
4. **社区反馈**: 收集用户建议的竞赛添加请求

### 层级分配标准

| 标准       | 说明                             |
| ---------- | -------------------------------- |
| 选拔率     | 参赛者中获奖比例越低，层级越高   |
| 大学认可度 | 顶尖大学招生官对该竞赛的熟悉程度 |
| 准备难度   | 所需的知识深度和准备时间         |
| 历史声誉   | 竞赛的历史长度和品牌认知         |
| 国际影响   | 国际化程度越高，层级可能越高     |
