/**
 * 论坛示例帖子种子数据 - 扩展版
 * 包含更多真实风格的帖子
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 生成随机的用户名
const userNames = [
  'Alex Chen',
  'Emily Wang',
  'Kevin Liu',
  'Sophia Zhang',
  'Ryan Li',
  'Olivia Wu',
  'Jason Huang',
  'Chloe Lin',
  'Daniel Yang',
  'Grace Xu',
  'Michael Chen',
  'Isabella Zhao',
  'Ethan Wang',
  'Mia Tang',
  'Andrew Li',
  'Lily Zhu',
  'Brandon Sun',
  'Amy Zhou',
  'David He',
  'Crystal Liu',
  'Lucas Ma',
  'Sarah Feng',
  'Justin Xie',
  'Nancy Qian',
  'Chris Gao',
  '小明同学',
  '申请路上',
  '留学小白',
  'UCBerkeley2026',
  'MIT梦想家',
  '文书打工人',
  'CS狂热者',
  '商科爱好者',
  '数学建模er',
  '美高党',
  '普高逆袭',
  '国际生活',
  'Offer收割机',
  '选校纠结症',
  '申请焦虑症患者',
];

async function main() {
  console.log('📝 创建论坛示例帖子（扩展版）...\n');

  // 获取或创建多个测试用户
  const bcrypt = await import('bcrypt');
  const users: { id: string; name: string }[] = [];

  for (const name of userNames.slice(0, 20)) {
    const email = `${name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '')}@demo.studyabroad.com`;
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash('Demo123!', 10),
          emailVerified: true,
          role: Math.random() > 0.7 ? 'VERIFIED' : 'USER',
          profile: {
            create: {
              visibility: 'ANONYMOUS',
            },
          },
        },
      });
    }
    users.push({ id: user.id, name });
  }

  // 获取分类
  const categories = await prisma.forumCategory.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  // 扩展的帖子数据
  const posts = [
    // ==================== 申请经验 ====================
    {
      categoryName: 'Application Experience',
      title: '从普高到 MIT：我的申请之路',
      content: `分享一下我的申请经历，希望能帮到正在准备的同学。

**背景**
- 普通高中，GPA 3.9/4.0
- SAT 1560，托福 115
- 研究经历：暑期参加了一个大学实验室项目

**时间线**
- 10年级开始准备标化
- 11年级暑假完成主文书初稿
- 12年级 EA 提交 MIT

**给学弟学妹的建议**
1. 活动贵精不贵多，找到真正热爱的事情深入做
2. 文书要真诚，展现真实的自己
3. 心态很重要，结果不能定义你的价值

欢迎在评论区交流！`,
      tags: ['MIT', '申请经验', 'EA'],
    },
    {
      categoryName: 'Application Experience',
      title: '收到 6 所 Top 30 录取后的复盘',
      content: `今年申请季结束，分享一些心得。

**录取结果**
✅ Duke, Northwestern, Cornell, Rice, Vanderbilt, Emory
❌ Stanford, Harvard, Yale
⏳ Princeton (Waitlist → Reject)

**我做对了什么**
- 文书反复打磨，每篇改了 10+ 版
- 选校策略合理，冲刺/匹配/保底比例 4:4:2
- 推荐信提前 2 个月约老师

**踩过的坑**
- 过于依赖中介模板，后来全部重写
- 活动列表堆砌太多，没有突出重点

有问题可以留言！`,
      tags: ['Top30', '选校', '复盘'],
    },
    {
      categoryName: 'Application Experience',
      title: '三申三中 UCB/UCLA/USC - CS 方向经验分享',
      content: `作为 CS 申请者分享下加州系统的申请经验。

**我的背景**
- 美高，GPA: 4.0 UW / 4.5 W
- SAT: 1530 (没交)
- AP: Calc BC (5), Physics C (5), CS A (5), Stats (4)

**活动**
- 学校 CS 社团社长
- 两个个人 App 项目上架 App Store
- 暑假在本地公司做了 SWE 实习

**UC 文书**
PIQ 是重中之重！我写了：
1. Creative side - 关于我做的 App
2. Talent/skill - 编程能力的发展
3. Educational opportunity - 参加编程夏校的经历
4. Community contribution - CS 社团的活动

**重要提醒**
UC 只看高中前三年成绩，12年级第一学期成绩不看！

希望对申请加州的同学有帮助~`,
      tags: ['UCB', 'UCLA', 'USC', 'CS', '加州申请'],
    },
    {
      categoryName: 'Application Experience',
      title: '文科生逆袭！从 Top 50 到 Top 10 的转学经历',
      content: `作为一个本科 Transfer 成功的学生，分享我的转学经验。

**背景**
原学校：Top 50 综合大学
目标学校：Top 10 文理学院
专业：Political Science

**为什么转学**
- 原校太大，与教授互动少
- 想要更小班化的教学
- 对 LAC 的学术氛围更向往

**如何准备**
1. GPA 是硬指标，保持在 3.9+
2. 和教授建立深度联系，拿到强推
3. 文书重点写"为什么转"和"为什么这所学校"

**时间线**
- 大一秋季开始研究目标学校
- 大一春季准备材料
- 大一暑假提交申请

转学申请和新生申请不一样，有问题欢迎私信！`,
      tags: ['转学', 'Transfer', '文理学院', '文科'],
    },
    {
      categoryName: 'Application Experience',
      title: '全奖博士申请经验 - STEM 方向',
      content: `分享我申请全奖 PhD 的经验，希望能帮到准备读博的同学。

**背景**
- 本科：985 计算机系
- GPA: 3.8/4.0
- 研究经历：2 篇顶会一作
- GRE: 325+

**申请结果**
录取（全奖）：MIT, Stanford, CMU, Berkeley
Reject：没有

**我的建议**
1. **研究经历是王道** - 论文 > 一切
2. **套磁很重要** - 提前联系导师可以大大提高成功率
3. **推荐信要强** - 最好有国外教授的推荐
4. **SOP 要具体** - 写清楚研究计划和兴趣

**时间线建议**
- 大三开始做研究
- 大三暑假开始套磁
- 大四上学期提交申请

PhD 申请和本科很不一样，重点是 Research Fit！`,
      tags: ['PhD', '博士申请', '全奖', 'STEM'],
    },
    {
      categoryName: 'Application Experience',
      title: '工作三年后申请 MBA - Top 15 商学院经验',
      content: `工作三年后决定读 MBA，分享我的申请经验。

**背景**
- 本科：国内 211 金融
- 工作：Big 4 咨询三年
- GMAT: 740
- GPA: 3.5/4.0

**申请结果**
✅ Booth, Kellogg, Yale SOM
❌ HBS, Wharton
WL: Sloan (最后 Reject)

**经验总结**
1. **Why MBA** 要想清楚 - 招生官很重视职业规划
2. **故事要好** - MBA 申请更看重个人经历和领导力
3. **面试准备** - 每所学校面试风格不同，要提前研究

**推荐资源**
- Poets & Quants 看学校信息
- GMAT Club 找面试经验
- ChaseDream 中文论坛交流

三十岁读书不晚，欢迎交流！`,
      tags: ['MBA', '商学院', 'GMAT', '职业发展'],
    },

    // ==================== 文书讨论 ====================
    {
      categoryName: 'Essay Discussion',
      title: '【求反馈】Common App 主文书 - 关于失败的经历',
      content: `写了一篇关于比赛失利的文书，想请大家帮忙看看。

**题目选择**：Prompt 2 - 讲述一个挫折经历

**大纲**
- 开头：比赛当天的场景描写
- 中间：失败后的反思和调整
- 结尾：这次经历如何改变了我

**纠结的点**
1. 是不是太多人写失败主题了？
2. 结尾的升华是否太刻意？

希望大家给点建议，谢谢！

（正文已私信给想帮忙看的朋友）`,
      tags: ['CommonApp', '主文书', '求反馈'],
    },
    {
      categoryName: 'Essay Discussion',
      title: '文书写作的 5 个常见误区',
      content: `帮很多同学看过文书后，总结了一些常见问题：

**误区 1：堆砌成就**
文书不是简历！招生官已经看过你的活动列表了。

**误区 2：用大词撑场面**
简单直接的语言更有力量，不需要炫技。

**误区 3：写别人期待看到的**
真实 > 完美。招生官见过太多"完美"的文书了。

**误区 4：忽略 Why School**
这篇文书最能体现你是否 match，要好好研究学校。

**误区 5：最后一刻才写**
好文书需要时间沉淀，建议暑假开始。

欢迎补充！`,
      tags: ['文书技巧', '经验分享'],
    },
    {
      categoryName: 'Essay Discussion',
      title: 'Why School 文书写作模板（附 5 所学校示例）',
      content: `Why School 文书是展示你与学校 fit 的最佳机会，分享我的写作思路。

**通用结构**
1. 开头：为什么对这所学校感兴趣（具体原因）
2. 中间：学校的什么资源能帮助你实现目标
3. 结尾：你能给学校带来什么

**具体要提到的点**
- 特定的课程或项目
- 具体的教授和他们的研究
- 学校特有的资源或机会
- 校园文化和社区

**注意事项**
❌ 不要写那些在网上随便搜就能找到的信息
❌ 不要只夸学校排名高、地理位置好
✅ 要展示你真的研究过这所学校
✅ 要把学校资源和你的目标联系起来

每所学校的 Why School 都应该是独特的！`,
      tags: ['WhySchool', '文书模板', '写作技巧'],
    },
    {
      categoryName: 'Essay Discussion',
      title: '如何让活动列表更有说服力？',
      content: `活动列表只有150字符，怎么写才能抓住招生官的眼球？

**格式建议**
- 第一行：职位/角色
- 第二行：具体做了什么
- 第三行：量化的成果

**示例对比**

❌ 差的写法：
"I was the president of Math Club"

✅ 好的写法：
"Pres., Math Club | Organized weekly workshops for 50+ students; Led team to place 2nd in State Math Olympiad; Raised $2000 for competition funds"

**注意事项**
1. 用动词开头（Led, Founded, Created...）
2. 能量化的地方一定要量化
3. 最重要的活动放在最前面
4. 同类活动可以合并

Common App 的活动列表排序很重要！`,
      tags: ['活动列表', 'CommonApp', '写作技巧'],
    },
    {
      categoryName: 'Essay Discussion',
      title: '文书灵感枯竭怎么办？分享几个头脑风暴方法',
      content: `写文书没灵感？试试这些方法！

**方法1：人生地图**
画一条时间线，标出你人生中的重要时刻，看看哪个最有故事可讲。

**方法2：问自己问题**
- 最近一次让你感到骄傲的事是什么？
- 你会为什么事情熬夜？
- 如果可以改变世界的一件事，你会选什么？

**方法3：问朋友**
让朋友描述你，看看他们眼中的你是什么样的。

**方法4：反向思考**
想想招生官想看到什么样的人，然后找自己身上与之匹配的特质。

**方法5：写日记**
每天写一点，不用管质量，坚持一周后回看。

灵感不是等来的，是写出来的！`,
      tags: ['文书灵感', '头脑风暴', '写作方法'],
    },

    // ==================== 选校建议 ====================
    {
      categoryName: 'School Selection',
      title: 'CS 专业选校：CMU vs Georgia Tech vs UIUC',
      content: `这三所都是 CS 强校，但风格差异很大：

**CMU**
- 全美 CS #1
- 学术压力大，课业繁重
- 匹兹堡生活成本低
- 就业资源顶级

**Georgia Tech**
- 性价比之王
- Co-op 项目强
- 亚特兰大科技公司多
- 校园文化活跃

**UIUC**
- 大校资源丰富
- 研究机会多
- 中部生活相对单调
- 中国学生群体大

**我的建议**
- 追求学术深度 → CMU
- 看重性价比 → GT
- 想要社交圈 → UIUC

大家有什么看法？`,
      tags: ['CS', '选校对比', 'CMU', 'Georgia Tech', 'UIUC'],
    },
    {
      categoryName: 'School Selection',
      title: '文科生如何选择美国大学？',
      content: `作为一个社科方向的申请者，分享一些选校心得。

**看重的因素**
1. 核心课程设置（Columbia, UChicago 的 Core）
2. 写作项目（Tufts, Yale 的 Writing Program）
3. 小班授课比例
4. 本科研究机会

**被低估的好学校**
- Middlebury - 语言项目顶尖
- Pomona - 文理学院资源不输综合大学
- Wesleyan - 文科氛围浓厚

**误区**
不要只看排名，文科更要看 fit！

希望能帮到文科的小伙伴们。`,
      tags: ['文科', '选校', '文理学院'],
    },
    {
      categoryName: 'School Selection',
      title: '商科本科选校指南 - Top 商学院对比',
      content: `想学商科的同学看过来！本科商学院选校分析。

**顶级商学院（本科）**
1. Wharton (UPenn) - 华尔街直通车
2. Stern (NYU) - 地理位置无敌
3. Ross (Michigan) - MAP 项目出名
4. McIntire (UVA) - 性价比高
5. Haas (Berkeley) - 科技+商业结合

**选择考虑**
- 目标金融 → Wharton, Stern
- 目标咨询 → Ross, McIntire
- 目标科技 → Haas, MIT Sloan

**本科 vs 研究生读商**
- 本科商科更侧重基础
- 很多 Top 公司对 MBA 更看重
- 但本科商学院的 network 也很强

建议：如果不确定，可以本科先读 Econ，研究生再转 MBA。`,
      tags: ['商科', '商学院', '选校', '金融'],
    },
    {
      categoryName: 'School Selection',
      title: '纠结了！Duke vs Northwestern - 请大家帮我选',
      content: `两所学校都录了，不知道怎么选，求建议！

**我的情况**
- 准备学 Econ + CS
- 以后想做 Quant 或者科技公司
- 比较喜欢社交活跃的校园

**Duke 优点**
- 篮球氛围超棒
- 南方天气好
- 校园很漂亮
- Greek life 活跃

**Northwestern 优点**
- 靠近芝加哥，实习机会多
- Kellogg 商学院资源
- 学术氛围更浓
- Quarter 制可以上更多课

**纠结的点**
1. Duke 更 work hard play hard
2. NU 学术压力更大
3. 两边的 CS 都不错但风格不同

已经去两个学校访校了，还是决定不了...
大家有什么建议吗？`,
      tags: ['Duke', 'Northwestern', '选校', '求助'],
    },
    {
      categoryName: 'School Selection',
      title: '加州大学系统全解析 - UC 各分校对比',
      content: `加州大学系统是很多国际生的首选，来做个全面对比！

**UC Berkeley**
- 公立 Top 1
- CS, EECS 超强
- 学术压力大，竞争激烈
- 湾区位置就业好

**UCLA**
- 地理位置梦幻
- 社交氛围好
- 文理科都很强
- 校园很漂亮

**UCSD**
- 理工科强校
- 研究资源丰富
- 校园偏安静
- 圣地亚哥气候宜人

**UCI**
- CS 游戏设计特色
- 亚裔学生多
- 尔湾安全整洁
- 性价比不错

**UCSB**
- Party school 标签（其实学术也不错）
- 环境美爆
- 工程不错
- 校园文化轻松

**UCD**
- 农业&生物强
- 校园超大
- 小城市生活
- 物价相对低

选 UC 要考虑：专业强度、地理位置、校园文化、生活成本！`,
      tags: ['UC', '加州大学', '选校', '公立大学'],
    },

    // ==================== 组队找伴 ====================
    {
      categoryName: 'Team Up',
      title: '【组队】2026 Fall 申请互助群 - CS/DS 方向',
      content: `召集 2026 Fall 的申请小伙伴组成互助群！

**基本信息**
- 申请季节：2026 Fall
- 方向：CS / Data Science
- 人数：10 人左右

**群内活动**
- 每周文书互看
- 共享学校信息
- 申请进度打卡
- 心理互助

**加入条件**
- 有基本的标化成绩
- 愿意积极参与讨论
- 能够互相提供反馈

感兴趣的同学请私信，备注：申请年份 + 方向`,
      tags: ['组队', '2026Fall', 'CS'],
      isTeamPost: true,
      teamSize: 10,
    },
    {
      categoryName: 'Team Up',
      title: '找 Boston 地区的室友 - 2025 Fall 入学',
      content: `录了 BU，在找室友！

**我的情况**
- 女生，大一新生
- 专业：Economics
- 性格：安静，早睡早起

**希望室友**
- 不抽烟
- 作息规律
- 好沟通

**预算**
$1200-1500/月（可商量）

有兴趣的同学私信聊～`,
      tags: ['室友', 'BU', 'Boston'],
      isTeamPost: true,
      teamSize: 2,
    },
    {
      categoryName: 'Team Up',
      title: '【组队】AMC/AIME 数学竞赛备考群',
      content: `组织一个数学竞赛学习小组！

**目标**
- 2026 年 AMC 12 冲刺 120+
- AIME 冲刺 10+

**活动安排**
- 每周做一套真题
- 群内讨论难题
- 分享学习资源

**要求**
- 认真对待，不是水群
- AMC 10/12 基础分数 90+
- 能坚持到比赛结束

目前已有 5 人，再招 5 人！`,
      tags: ['AMC', 'AIME', '数学竞赛', '组队'],
      isTeamPost: true,
      teamSize: 10,
    },
    {
      categoryName: 'Team Up',
      title: '【组队】USC Marshall 商科学生组建学习小组',
      content: `USC Marshall 新生，找同校同学一起学习！

**课程**
- BUAD 304 - Organizational Behavior
- BUAD 306 - Business Finance
- BUAD 307 - Marketing

**活动**
- 期末考试前一起复习
- 分享笔记和资源
- 组队做 Group Project

**要求**
- USC Marshall 商科学生
- 2025 Fall 入学
- 愿意分享和互助

欢迎私信！`,
      tags: ['USC', 'Marshall', '学习小组', '商科'],
      isTeamPost: true,
      teamSize: 6,
    },
    {
      categoryName: 'Team Up',
      title: '纽约地区实习互助群 - 金融/咨询方向',
      content: `在纽约找实习的小伙伴看过来！

**群组目的**
- 分享实习信息和机会
- 内推互助
- 面试经验交流
- Mock interview 练习

**目标行业**
- 投行 (IBD, S&T)
- 咨询 (MBB, Big4)
- PE/VC

**入群条件**
- 在纽约地区上学或工作
- 目标 2025-2026 实习
- 愿意互帮互助

已有 20+ 人，持续招新！`,
      tags: ['实习', '纽约', '金融', '咨询'],
      isTeamPost: true,
      teamSize: 50,
    },

    // ==================== 留学生活 ====================
    {
      categoryName: 'Student Life',
      title: '美国大学食堂生存指南',
      content: `来美国一学期，总结一下食堂攻略：

**基础技能**
- 学会用 My Fitness Pal 算热量
- 沙拉吧是蔬菜主要来源
- 早餐最不容易踩雷

**省钱技巧**
- Meal Plan 选最小的就够
- 用学校的免费食物活动
- 和朋友一起做饭最划算

**保持健康**
- 远离油炸区
- 多喝水，少喝含糖饮料
- 周末自己做一顿中餐犒劳自己

欢迎补充你的食堂经验！`,
      tags: ['生活', '食堂', '新生'],
    },
    {
      categoryName: 'Student Life',
      title: 'F1 签证续签经历分享（2024 北京）',
      content: `刚刚完成 F1 续签，分享一下流程。

**准备材料**
- 有效护照
- I-20
- 成绩单
- 存款证明

**面签过程**
- 早上 8 点预约，7:30 到达
- 排队约 30 分钟
- 面谈不到 2 分钟，只问了专业和学校

**Tips**
- 穿着得体，不用太正式
- 回答简短清晰
- 不要紧张，正常交流即可

整体很顺利，当天通过！有问题可以问我。`,
      tags: ['签证', 'F1', '北京'],
    },
    {
      categoryName: 'Student Life',
      title: '美国大学选课攻略 - 新生必看',
      content: `选课是门学问，分享一下我的经验。

**选课前**
1. 看 Rate My Professor 评价
2. 研究学校的 Grade Distribution
3. 了解课程 workload
4. 注意 prerequisites

**选课策略**
- 第一学期不要选太多 hard class
- 文理搭配，不要全是 STEM
- 预留时间适应新环境
- 提前了解 drop deadline

**推荐工具**
- Rate My Professor（教授评价）
- Reddit + Discord（学校群组）
- 学长学姐直接问

**注意事项**
⚠️ GPA 很重要，第一学期保 GPA 优先！
⚠️ 选好教授比选好课更重要
⚠️ 不要因为 friend 选同一门课

祝大家选到好课！`,
      tags: ['选课', '新生', '攻略'],
    },
    {
      categoryName: 'Student Life',
      title: '留学生租房避坑指南',
      content: `在美国租房踩了不少坑，给大家总结一下。

**租房渠道**
- 学校 Off-campus Housing 网站
- Facebook 群组
- Zillow / Apartments.com
- 学长学姐推荐

**看房要注意**
1. 检查所有电器是否正常
2. 拍照记录原有损坏
3. 了解周边安全情况
4. 问清楚 utilities 包含什么

**签合同注意**
- 仔细阅读退房条款
- 了解租期和违约金
- 询问押金退还条件
- 确认能否转租

**常见坑**
❌ 二房东不靠谱
❌ 图片与实际不符
❌ 隐藏费用（parking, pet fee 等）
❌ 治安不好的区域

租房是大事，一定要谨慎！`,
      tags: ['租房', '生活', '攻略'],
    },
    {
      categoryName: 'Student Life',
      title: '美国驾照考试攻略 - 加州 DMV',
      content: `刚拿到驾照，分享加州考驾照的经验。

**流程**
1. 预约笔试（网上预约，可中文）
2. 通过笔试后拿 Permit
3. 练习开车（推荐驾校）
4. 预约路考

**笔试准备**
- DMV 官网有题库
- 手机 App 刷题
- 中文考试可选

**路考注意**
- Stop Sign 一定要停稳！
- 看后视镜时转头明显一点
- 不要压线
- 控制好车速

**费用**
- 申请费：$41
- 驾校：$200-400（10小时）

一般练习 2-3 周就能考过，加油！`,
      tags: ['驾照', '加州', 'DMV', '攻略'],
    },

    // ==================== 问答互助 ====================
    {
      categoryName: 'Q&A',
      title: '申请季焦虑怎么办？',
      content: `最近压力很大，想听听大家是怎么调节的。

**我的状态**
- 每天刷论坛看录取结果
- 失眠，总是胡思乱想
- 和朋友比较，更焦虑了

**尝试过的方法**
- 运动（有点用，但没坚持下来）
- 和家人聊（他们不太懂申请）

大家有什么建议吗？`,
      tags: ['焦虑', '心理', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: 'ED 被 defer 后该怎么办？',
      content: `刚收到 defer 通知，有点不知所措。

**情况**
- ED 申请的 dream school
- 收到了 defer，不是直接拒

**我的问题**
1. 要不要写 LOCI？
2. RD 还要继续申请这个学校吗？
3. 需要更新什么材料？

求有经验的学长学姐指点！`,
      tags: ['ED', 'defer', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: '托福口语怎么提高？卡在 23 分上不去',
      content: `托福考了三次了，口语一直在 22-23 分徘徊。

**目前情况**
- 总分 105，口语 23
- 模板背了，但说的时候不自然
- 独立题经常说不满时间

**已经尝试的方法**
- 跟读练习
- 背诵范文
- 找外教 1v1

有没有成功从 23 提到 26+ 的同学分享下经验？`,
      tags: ['托福', '口语', '标化', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: '推荐信找谁写比较好？',
      content: `高三开始准备推荐信了，想问问大家。

**我的情况**
- 普通高中国际部
- 准备申请 CS 专业

**可选的老师**
1. 数学老师 - 成绩很好，但互动不多
2. 物理老师 - 关系好，参加过他的课题
3. 英语老师 - 写作能力强，但对我学术了解有限
4. 班主任 - 了解我，但不教专业课

应该选哪两位？`,
      tags: ['推荐信', '申请', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: 'AP 课程怎么选？准备申请 Top 20',
      content: `现在高一，准备 AP，想请教大家。

**我的目标**
- 申请美国 Top 20 综合大学
- 方向：STEM（偏生物/化学）

**学校开设的 AP**
- 文科：World History, US History, Psychology
- 理科：Calc BC, Physics C, Chemistry, Biology
- 其他：CS A, Statistics

**问题**
1. 高一就开始 AP 会不会太早？
2. 理科方向的话要不要选文科 AP？
3. 几门 AP 算够？

麻烦有经验的学长学姐指点！`,
      tags: ['AP', '选课', '高中', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: '美本申请要不要找中介？',
      content: `家里在讨论要不要找中介，意见不统一。

**中介的报价**
- 全包服务：10-30 万不等
- 只包文书：3-5 万

**我的顾虑**
1. 中介真的有用吗？
2. 文书会不会变得模板化？
3. DIY 的话哪些事情最难自己搞定？

有用过中介或者 DIY 的同学分享一下经验吗？`,
      tags: ['中介', 'DIY', '申请', '求助'],
    },
    {
      categoryName: 'Q&A',
      title: 'CPT 和 OPT 有什么区别？',
      content: `研究生录取了，想提前了解下工作许可的事情。

**问题**
1. CPT 和 OPT 分别是什么？
2. 什么时候可以用 CPT？
3. STEM OPT 延期是怎么回事？
4. 如果以后想留美工作，需要提前规划什么？

对身份问题不太了解，求科普！`,
      tags: ['CPT', 'OPT', '工作签证', '求助'],
    },

    // ==================== 更多帖子 ====================
    {
      categoryName: 'Application Experience',
      title: '普高学生申请藤校的真实心路历程',
      content: `作为一个普高背景的申请者，分享我的经历。

**我的背景**
- 北京市普通高中
- 校内排名 Top 5%
- 无国际课程体系

**申请结果**
✅ Columbia, Penn
❌ HYPS
WL: Brown

**最大的挑战**
1. 没有 AP/IB，课程竞争力不足
2. 活动资源有限
3. 推荐信老师不熟悉美国申请

**我的解决方案**
- 自学 AP 并参加考试
- 主动寻找校外活动机会
- 亲自和老师沟通推荐信要点

普高的同学们，我们可以的！`,
      tags: ['普高', '藤校', '申请经验'],
    },
    {
      categoryName: 'Application Experience',
      title: 'Gap Year 后申请的经验分享',
      content: `高三毕业后 Gap 了一年再申请，分享这段经历。

**为什么选择 Gap**
- 高三申请季没有准备充分
- 想要更多时间提升背景
- 疫情影响，想等形势稳定

**Gap Year 做了什么**
1. 完成了一个研究项目
2. 实习了半年
3. 考出了满意的标化
4. 重新打磨文书

**申请结果**
比应届时好很多，Top 20 录了 3 所。

**建议**
- Gap 一定要有明确规划
- 证明这一年没有浪费
- 在文书中解释 Gap 的原因和收获

Gap Year 不是失败，是另一种选择！`,
      tags: ['GapYear', '申请经验', '规划'],
    },
    {
      categoryName: 'Essay Discussion',
      title: '我是如何把文书改了 20 遍的',
      content: `我的主文书从初稿到定稿改了 20 多遍，分享这个过程。

**时间线**
- 7月：头脑风暴，确定主题
- 8月：写出初稿
- 9-10月：反复修改
- 11月：定稿提交

**修改重点**
1. 结构调整 - 3 次大改
2. 语言润色 - 持续进行
3. 开头结尾 - 重写了 5 次
4. 细节补充 - 让故事更生动

**反馈来源**
- 学校 Counselor
- 文书机构老师
- 申请群的同学
- 父母（非专业视角也很重要）

**心得**
好文书真的是改出来的，不是写出来的！`,
      tags: ['文书修改', '写作经验', '时间规划'],
    },
    {
      categoryName: 'School Selection',
      title: '小众但超棒的学校推荐 - 被忽略的宝藏校',
      content: `除了大家熟知的名校，还有很多很棒的学校值得考虑！

**工程方向**
- Harvey Mudd - 小而精的工程强校
- Cooper Union - 曾经全奖，竞争激烈
- Olin College - 创新型工程教育

**文理学院**
- Carleton - 严谨学术，中西部气候需适应
- Bowdoin - 美食超好，位置偏远
- Grinnell - 国际生友好，奖学金丰厚

**综合大学**
- WUSTL - 校园最美之一，商科医学强
- Tulane - 新奥尔良文化独特
- Northeastern - Co-op 项目无敌

选校不要只看排名，要看适合自己的！`,
      tags: ['选校', '小众学校', '推荐'],
    },
    {
      categoryName: 'Student Life',
      title: '美国超市购物指南 - 省钱又健康',
      content: `来美国后发现买菜是门学问，分享我的超市攻略。

**各超市定位**
- Whole Foods：有机高端，贵
- Trader Joe's：性价比高，零食多
- Costco：量大便宜，需要会员
- Walmart：便宜，种类全
- 亚洲超市：中国食材必备

**省钱技巧**
1. 看每周 flyer 买打折品
2. 用 store card 积分
3. 买当季蔬果
4. Costco 和朋友 share
5. 自己带袋子有折扣

**推荐购买**
- TJ's 的冷冻食品
- Costco 的肉类
- 亚超的调料和面条

吃得健康又省钱！`,
      tags: ['超市', '省钱', '生活攻略'],
    },
    {
      categoryName: 'Q&A',
      title: '双专业 vs 主修+辅修 怎么选？',
      content: `大一纠结 double major 还是 major + minor。

**我的情况**
- 学校允许 double major
- 想学 CS + Economics

**问题**
1. Double major 会不会太累？
2. 对找工作有帮助吗？
3. 如果选一个当 minor，选哪个？

目前倾向 CS major + Econ minor，但不确定。
求有经验的学长学姐指点！`,
      tags: ['双专业', '辅修', '大学规划', '求助'],
    },
    {
      categoryName: 'Team Up',
      title: '【组队】Science Olympiad 科学奥林匹克组队',
      content: `我们学校准备参加 Science Olympiad，招队员！

**比赛介绍**
Science Olympiad 是美国最大的科学竞赛之一，涵盖：
- 生物
- 化学
- 物理
- 地球科学
- 工程设计

**需要的队员**
- 有一门科学特长
- 能坚持每周训练
- 有团队精神

**训练安排**
- 每周六下午 2-5 点
- 有学长指导

目前已有 8 人，还差 7 人！有兴趣的同学私信我。`,
      tags: ['ScienceOlympiad', '科学竞赛', '组队'],
      isTeamPost: true,
      teamSize: 15,
    },
    {
      categoryName: 'Application Experience',
      title: '艺术生申请美国大学的特殊之处',
      content: `作为一个视觉艺术方向的申请者，分享我的经验。

**作品集 Portfolio**
这是艺术申请最重要的部分！
- 一般需要 12-20 件作品
- 要展示多样性和发展轨迹
- 部分学校有命题作品要求

**目标学校**
- RISD - 全美艺术 Top 1
- Parsons - 时尚设计强
- SAIC - 当代艺术氛围
- Pratt - 建筑设计出色

**申请注意事项**
1. 作品集提前准备，至少一年
2. 有些学校需要 Home Test
3. 面试可能要讲解作品
4. GPA 标化相对没那么重要，但不能太差

艺术生的同学们加油！`,
      tags: ['艺术申请', '作品集', 'RISD', '艺术生'],
    },
    {
      categoryName: 'Essay Discussion',
      title: '如何写一篇让招生官记住的 Supplemental Essay',
      content: `Supplement essay 经常被忽视，但其实很重要！

**常见类型**
1. Why School - 为什么选这所学校
2. Why Major - 为什么选这个专业
3. Community - 你如何为社区做贡献
4. Diversity - 你能带来什么多样性
5. Creative - 创意题（如 UChicago）

**写作技巧**

**Why School**
✅ 提到具体的课程、教授、项目
✅ 展示你研究过学校
❌ 不要泛泛地夸学校

**Why Major**
✅ 讲述你对专业的热情从何而来
✅ 提到学校这个专业的独特之处
❌ 不要只说"我对XX感兴趣"

**Creative Essay**
✅ 展示你的思维方式
✅ 不要怕unconventional
❌ 不要为了creative而瞎写

记住：每篇文书都是展示自己的机会！`,
      tags: ['补充文书', 'WhySchool', '写作技巧'],
    },
    {
      categoryName: 'School Selection',
      title: '想学 Pre-Med？选校要考虑这些因素',
      content: `准备走 Pre-Med 路线的同学看过来！

**什么是 Pre-Med**
不是一个专业，而是一条路径。你可以主修任何专业，只要完成医学院的先修课程。

**选校考虑因素**
1. **GPA deflation** - 有些学校分数卡得很紧（如 Berkeley）
2. **研究机会** - 医学院申请需要research
3. **医学院录取率** - 看学校毕业生的医学院录取数据
4. **pre-health advising** - 学校的指导资源

**传统强校**
- Johns Hopkins - 生物医学第一
- WashU - 医学院资源共享
- Duke - 研究机会多
- Rice - 小班教学，支持好

**建议**
- 本科不一定要学 Biology
- 但先修课一定要 A
- 提前准备 MCAT

Pre-Med 是长跑，选好起点很重要！`,
      tags: ['Pre-Med', '医学预科', '选校', '医学院'],
    },
    {
      categoryName: 'Student Life',
      title: '美国校园安全指南 - 自我保护必看',
      content: `安全是第一位的！分享一些在美国保护自己的经验。

**校园安全**
- 晚上不要一个人走偏僻的路
- 手机里存好学校的 Campus Safety 电话
- 了解学校的 Blue Light 系统
- 参加学校的 Safety Walk 活动

**出行安全**
- 晚上出门尽量和朋友一起
- 打 Uber 要确认车牌和司机信息
- 不要去犯罪率高的区域
- 贵重物品不要外露

**紧急情况**
- 911 是紧急电话
- 学校一般有 24/7 Campus Police
- 医疗紧急去 Emergency Room

**推荐 App**
- Citizen - 实时犯罪通报
- Life360 - 和朋友共享位置
- bSafe - 一键求救

安全第一！大家都要保护好自己。`,
      tags: ['安全', '生活', '校园安全'],
    },
    {
      categoryName: 'Q&A',
      title: '大学换专业难吗？想从 Undeclared 转 CS',
      content: `大一以 Undeclared 录取，想转 CS，求问难度。

**情况**
- 学校：某 Top 30
- 当前：Undeclared / Liberal Arts
- 目标：CS

**问题**
1. 转 CS 需要什么条件？
2. 大一应该上哪些课？
3. 转专业的 GPA 要求是多少？
4. 如果转不了怎么办？

听说 CS 很多学校都是 impacted major，很担心转不过去...
有经验的学长学姐帮帮忙！`,
      tags: ['转专业', 'CS', '大学规划', '求助'],
    },
  ];

  let created = 0;
  const userIndex = () => Math.floor(Math.random() * users.length);

  for (const post of posts) {
    const categoryId = categoryMap.get(post.categoryName);
    if (!categoryId) {
      console.log(`⚠️ 分类未找到: ${post.categoryName}`);
      continue;
    }

    // 检查是否已存在
    const existing = await prisma.forumPost.findFirst({
      where: { title: post.title },
    });

    if (existing) {
      console.log(`⏭️ 已存在: ${post.title}`);
      continue;
    }

    // 随机分配作者
    const author = users[userIndex()];

    await prisma.forumPost.create({
      data: {
        categoryId,
        authorId: author.id,
        title: post.title,
        content: post.content,
        tags: post.tags || [],
        isTeamPost: post.isTeamPost || false,
        teamSize: post.teamSize,
        currentSize: post.isTeamPost ? 1 : null,
        viewCount: 0,
        likeCount: 0,
      },
    });

    console.log(`✅ ${post.title}`);
    created++;
  }

  // 创建一些评论
  console.log('\n💬 创建示例评论...\n');

  const allPosts = await prisma.forumPost.findMany({ take: 20 });
  let commentsCreated = 0;

  const sampleComments = [
    '非常有帮助，感谢分享！',
    '同样的情况，也很纠结...',
    '学长/学姐太强了！',
    '请问能私信详细聊聊吗？',
    '这个建议很实用，收藏了！',
    '我也想加入！怎么联系？',
    '经验太宝贵了，感谢！',
    '同 target，一起加油！',
    '太详细了，码住！',
    '有没有微信群可以加？',
    '坐等更新！',
    '这个观点很独特，学到了',
    '补充一点：...',
    '我有不同看法，不过也很有道理',
    '申请季焦虑的我看到这个太及时了',
  ];

  for (const post of allPosts) {
    // 每篇帖子 0-5 条评论
    const numComments = Math.floor(Math.random() * 6);

    for (let i = 0; i < numComments; i++) {
      const commenter = users[userIndex()];
      const commentText =
        sampleComments[Math.floor(Math.random() * sampleComments.length)];

      // 检查是否已有评论
      const existingComment = await prisma.forumComment.findFirst({
        where: {
          postId: post.id,
          authorId: commenter.id,
          content: commentText,
        },
      });

      if (!existingComment) {
        await prisma.forumComment.create({
          data: {
            postId: post.id,
            authorId: commenter.id,
            content: commentText,
            likeCount: 0,
          },
        });
        commentsCreated++;
      }
    }
  }

  // 更新帖子的评论数
  for (const post of allPosts) {
    const commentCount = await prisma.forumComment.count({
      where: { postId: post.id },
    });
    await prisma.forumPost.update({
      where: { id: post.id },
      data: { commentCount },
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 创建 ${created} 篇帖子, ${commentsCreated} 条评论`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
