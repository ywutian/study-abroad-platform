/**
 * 基于荣格类型理论的性格测评题库 (OEJTS 风格)
 *
 * 免责声明：本测评基于荣格心理类型理论设计，为非官方 MBTI® 测评，
 * 仅供个人探索和教育用途。MBTI® 是 The Myers-Briggs Company 的注册商标。
 *
 * 设计原则：
 * - 每个维度 12 题，共 48 题
 * - 使用 5 点 Likert 量表 (1=强烈不同意, 5=强烈同意)
 * - 包含正向计分(+)和反向计分(-)题目
 * - 题目基于公开的心理学研究和荣格类型理论
 *
 * 参考来源：Open Extended Jungian Type Scales (OEJTS) by Open Psychometrics
 * 许可：CC BY-NC-SA 4.0
 */

export interface MbtiQuestion {
  id: string;
  text: string;
  textZh: string;
  dimension: 'EI' | 'SN' | 'TF' | 'JP';
  /** 计分方向：'+' 表示高分偏向第一个字母，'-' 表示高分偏向第二个字母 */
  direction: '+' | '-';
}

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  // ============ E/I 维度 (12题) ============
  // E+ 题目：高分偏向 E（外向）
  {
    id: 'ei01',
    text: 'I feel energized after spending time with a group of people.',
    textZh: '与一群人相处后，我会感到精力充沛。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei02',
    text: 'I enjoy being the center of attention.',
    textZh: '我喜欢成为关注的焦点。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei03',
    text: 'I find it easy to start conversations with strangers.',
    textZh: '我很容易与陌生人开始交谈。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei04',
    text: 'I prefer to think out loud rather than in my head.',
    textZh: '我更喜欢大声思考，而不是在脑海中思考。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei05',
    text: 'I feel comfortable in large social gatherings.',
    textZh: '我在大型社交聚会中感到自在。',
    dimension: 'EI',
    direction: '+',
  },
  {
    id: 'ei06',
    text: 'I often take the initiative to introduce myself to new people.',
    textZh: '我经常主动向新认识的人介绍自己。',
    dimension: 'EI',
    direction: '+',
  },
  // I- 题目：高分偏向 I（内向）
  {
    id: 'ei07',
    text: 'I need time alone to recharge after social events.',
    textZh: '社交活动后，我需要独处时间来恢复精力。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei08',
    text: 'I prefer deep conversations with one person over group discussions.',
    textZh: '比起群体讨论，我更喜欢与一个人深入交谈。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei09',
    text: 'I often think carefully before speaking.',
    textZh: '我经常在说话前仔细思考。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei10',
    text: 'I feel drained after prolonged social interaction.',
    textZh: '长时间社交互动后，我会感到疲惫。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei11',
    text: 'I prefer working alone rather than in a team.',
    textZh: '我更喜欢独自工作而不是团队合作。',
    dimension: 'EI',
    direction: '-',
  },
  {
    id: 'ei12',
    text: 'I enjoy spending time in quiet environments.',
    textZh: '我喜欢在安静的环境中度过时间。',
    dimension: 'EI',
    direction: '-',
  },

  // ============ S/N 维度 (12题) ============
  // S+ 题目：高分偏向 S（感觉）
  {
    id: 'sn01',
    text: 'I focus on the present moment rather than future possibilities.',
    textZh: '我关注当下，而不是未来的可能性。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn02',
    text: 'I prefer practical, hands-on learning experiences.',
    textZh: '我更喜欢实际的、动手的学习体验。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn03',
    text: 'I trust information that comes from my direct experience.',
    textZh: '我信任来自直接经验的信息。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn04',
    text: 'I prefer step-by-step instructions over general guidelines.',
    textZh: '比起笼统的指导，我更喜欢循序渐进的说明。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn05',
    text: 'I pay close attention to details and facts.',
    textZh: '我非常注意细节和事实。',
    dimension: 'SN',
    direction: '+',
  },
  {
    id: 'sn06',
    text: 'I prefer dealing with concrete problems rather than abstract theories.',
    textZh: '我更喜欢处理具体问题，而不是抽象理论。',
    dimension: 'SN',
    direction: '+',
  },
  // N- 题目：高分偏向 N（直觉）
  {
    id: 'sn07',
    text: 'I often think about what could be rather than what is.',
    textZh: '我经常思考"可能是什么"而不是"是什么"。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn08',
    text: 'I enjoy exploring new ideas and concepts.',
    textZh: '我喜欢探索新的想法和概念。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn09',
    text: 'I often see patterns and connections that others miss.',
    textZh: '我经常看到别人忽略的模式和联系。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn10',
    text: 'I am more interested in the big picture than specific details.',
    textZh: '比起具体细节，我对整体图景更感兴趣。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn11',
    text: 'I often rely on my intuition when making decisions.',
    textZh: '做决定时，我经常依赖直觉。',
    dimension: 'SN',
    direction: '-',
  },
  {
    id: 'sn12',
    text: 'I enjoy thinking about future possibilities and innovations.',
    textZh: '我喜欢思考未来的可能性和创新。',
    dimension: 'SN',
    direction: '-',
  },

  // ============ T/F 维度 (12题) ============
  // T+ 题目：高分偏向 T（思考）
  {
    id: 'tf01',
    text: 'I make decisions based on logic rather than feelings.',
    textZh: '我根据逻辑而不是感情做决定。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf02',
    text: 'I value fairness and consistency over personal circumstances.',
    textZh: '我重视公平和一致性，而不是个人情况。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf03',
    text: 'I prefer honest feedback even if it might hurt.',
    textZh: '我更喜欢诚实的反馈，即使可能会伤害人。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf04',
    text: 'I analyze problems objectively without letting emotions interfere.',
    textZh: '我客观分析问题，不让情绪干扰。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf05',
    text: 'I believe the truth is more important than being tactful.',
    textZh: '我认为真相比圆滑更重要。',
    dimension: 'TF',
    direction: '+',
  },
  {
    id: 'tf06',
    text: 'I focus on finding the most efficient solution to problems.',
    textZh: '我专注于找到解决问题的最有效方案。',
    dimension: 'TF',
    direction: '+',
  },
  // F- 题目：高分偏向 F（情感）
  {
    id: 'tf07',
    text: 'I consider how my decisions will affect others emotionally.',
    textZh: '我会考虑我的决定会如何在情感上影响他人。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf08',
    text: 'I value harmony and try to avoid conflict.',
    textZh: '我重视和谐，尽量避免冲突。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf09',
    text: 'I am sensitive to the needs and feelings of others.',
    textZh: '我对他人的需求和感受很敏感。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf10',
    text: 'I prefer to be diplomatic rather than bluntly honest.',
    textZh: '我更喜欢圆滑处事，而不是直言不讳。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf11',
    text: 'I often make decisions based on my personal values.',
    textZh: '我经常根据个人价值观做决定。',
    dimension: 'TF',
    direction: '-',
  },
  {
    id: 'tf12',
    text: 'I find it important to maintain good relationships with everyone.',
    textZh: '我认为与每个人保持良好关系很重要。',
    dimension: 'TF',
    direction: '-',
  },

  // ============ J/P 维度 (12题) ============
  // J+ 题目：高分偏向 J（判断）
  {
    id: 'jp01',
    text: 'I prefer to have a clear plan before starting a project.',
    textZh: '开始项目前，我更喜欢有一个清晰的计划。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp02',
    text: 'I like to complete tasks well before the deadline.',
    textZh: '我喜欢在截止日期前完成任务。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp03',
    text: 'I feel uncomfortable when things are left undecided.',
    textZh: '当事情悬而未决时，我会感到不舒服。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp04',
    text: 'I prefer a structured and organized environment.',
    textZh: '我更喜欢有结构和有组织的环境。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp05',
    text: 'I make to-do lists and follow them closely.',
    textZh: '我会列待办清单并严格遵循。',
    dimension: 'JP',
    direction: '+',
  },
  {
    id: 'jp06',
    text: 'I feel satisfied when I finish all my planned tasks.',
    textZh: '当我完成所有计划任务时，我会感到满足。',
    dimension: 'JP',
    direction: '+',
  },
  // P- 题目：高分偏向 P（知觉）
  {
    id: 'jp07',
    text: 'I prefer to keep my options open rather than commit early.',
    textZh: '我更喜欢保持选择开放，而不是过早承诺。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp08',
    text: 'I often work best under pressure close to deadlines.',
    textZh: '我经常在临近截止日期的压力下工作得最好。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp09',
    text: 'I enjoy spontaneous activities and surprises.',
    textZh: '我喜欢自发的活动和惊喜。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp10',
    text: 'I am comfortable adapting to changing circumstances.',
    textZh: '我能够适应不断变化的情况。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp11',
    text: 'I prefer flexibility over strict schedules.',
    textZh: '比起严格的时间表，我更喜欢灵活性。',
    dimension: 'JP',
    direction: '-',
  },
  {
    id: 'jp12',
    text: 'I often start multiple projects and work on them as inspiration strikes.',
    textZh: '我经常同时开始多个项目，根据灵感来工作。',
    dimension: 'JP',
    direction: '-',
  },
];

/**
 * Likert 量表选项
 */
export const LIKERT_OPTIONS = [
  { value: 1, text: 'Strongly Disagree', textZh: '强烈不同意' },
  { value: 2, text: 'Disagree', textZh: '不同意' },
  { value: 3, text: 'Neutral', textZh: '中立' },
  { value: 4, text: 'Agree', textZh: '同意' },
  { value: 5, text: 'Strongly Agree', textZh: '强烈同意' },
];

/**
 * 16 种性格类型解读
 */
export const MBTI_INTERPRETATIONS: Record<
  string,
  {
    title: string;
    titleZh: string;
    description: string;
    descriptionZh: string;
    strengths: string[];
    strengthsZh: string[];
    careers: string[];
    majors: string[];
  }
> = {
  INTJ: {
    title: 'The Architect',
    titleZh: '建筑师',
    description:
      'Imaginative and strategic thinkers with a plan for everything.',
    descriptionZh: '富有想象力和战略思维，对一切都有计划。',
    strengths: [
      'Strategic thinking',
      'Independent',
      'Decisive',
      'Hard-working',
    ],
    strengthsZh: ['战略思维', '独立', '果断', '勤奋'],
    careers: ['Scientist', 'Engineer', 'Investment Banker', 'Systems Analyst'],
    majors: [
      'Computer Science',
      'Engineering',
      'Economics',
      'Mathematics',
      'Physics',
    ],
  },
  INTP: {
    title: 'The Logician',
    titleZh: '逻辑学家',
    description:
      'Innovative inventors with an unquenchable thirst for knowledge.',
    descriptionZh: '富有创新精神的发明家，对知识有无尽的渴望。',
    strengths: ['Analytical', 'Objective', 'Logical', 'Creative'],
    strengthsZh: ['分析能力强', '客观', '逻辑性强', '有创造力'],
    careers: ['Software Developer', 'Researcher', 'Professor', 'Architect'],
    majors: [
      'Philosophy',
      'Computer Science',
      'Mathematics',
      'Physics',
      'Economics',
    ],
  },
  ENTJ: {
    title: 'The Commander',
    titleZh: '指挥官',
    description:
      'Bold, imaginative and strong-willed leaders, always finding a way.',
    descriptionZh: '大胆、富有想象力、意志坚强的领导者，总能找到方法。',
    strengths: ['Leadership', 'Strategic', 'Efficient', 'Energetic'],
    strengthsZh: ['领导力', '战略性', '高效', '精力充沛'],
    careers: ['CEO', 'Entrepreneur', 'Lawyer', 'Management Consultant'],
    majors: [
      'Business Administration',
      'Law',
      'Political Science',
      'Economics',
    ],
  },
  ENTP: {
    title: 'The Debater',
    titleZh: '辩论家',
    description:
      'Smart and curious thinkers who cannot resist an intellectual challenge.',
    descriptionZh: '聪明好奇的思考者，无法抗拒智力挑战。',
    strengths: ['Quick thinking', 'Charismatic', 'Innovative', 'Knowledgeable'],
    strengthsZh: ['思维敏捷', '有魅力', '创新', '知识渊博'],
    careers: ['Entrepreneur', 'Lawyer', 'Consultant', 'Creative Director'],
    majors: ['Business', 'Law', 'Communications', 'Marketing', 'Engineering'],
  },
  INFJ: {
    title: 'The Advocate',
    titleZh: '提倡者',
    description:
      'Quiet and mystical, yet very inspiring and tireless idealists.',
    descriptionZh: '安静而神秘，但非常鼓舞人心且不知疲倦的理想主义者。',
    strengths: ['Insightful', 'Principled', 'Passionate', 'Altruistic'],
    strengthsZh: ['有洞察力', '有原则', '热情', '利他'],
    careers: ['Counselor', 'Writer', 'Social Worker', 'Psychologist'],
    majors: [
      'Psychology',
      'Social Work',
      'Literature',
      'Philosophy',
      'Education',
    ],
  },
  INFP: {
    title: 'The Mediator',
    titleZh: '调解者',
    description:
      'Poetic, kind and altruistic people, always eager to help a good cause.',
    descriptionZh: '富有诗意、善良、利他，总是渴望帮助正义事业。',
    strengths: ['Empathetic', 'Creative', 'Open-minded', 'Idealistic'],
    strengthsZh: ['有同理心', '有创造力', '开放心态', '理想主义'],
    careers: ['Writer', 'Artist', 'Therapist', 'Designer'],
    majors: [
      'Creative Writing',
      'Art',
      'Psychology',
      'Sociology',
      'Film Studies',
    ],
  },
  ENFJ: {
    title: 'The Protagonist',
    titleZh: '主人公',
    description:
      'Charismatic and inspiring leaders, able to mesmerize their listeners.',
    descriptionZh: '有魅力和鼓舞人心的领导者，能够吸引听众。',
    strengths: ['Charismatic', 'Empathetic', 'Organized', 'Natural leaders'],
    strengthsZh: ['有魅力', '有同理心', '有组织力', '天生领导者'],
    careers: ['Teacher', 'HR Manager', 'Marketing Manager', 'Diplomat'],
    majors: [
      'Education',
      'Communications',
      'Psychology',
      'International Relations',
    ],
  },
  ENFP: {
    title: 'The Campaigner',
    titleZh: '竞选者',
    description: 'Enthusiastic, creative and sociable free spirits.',
    descriptionZh: '热情、有创造力、善于社交的自由精神。',
    strengths: ['Curious', 'Enthusiastic', 'Creative', 'Sociable'],
    strengthsZh: ['好奇', '热情', '有创造力', '善于社交'],
    careers: ['Actor', 'Journalist', 'Consultant', 'Entrepreneur'],
    majors: [
      'Communications',
      'Marketing',
      'Theater',
      'Journalism',
      'Entrepreneurship',
    ],
  },
  ISTJ: {
    title: 'The Logistician',
    titleZh: '物流师',
    description:
      'Practical and fact-minded individuals, whose reliability cannot be doubted.',
    descriptionZh: '务实和注重事实，可靠性毋庸置疑。',
    strengths: ['Honest', 'Dedicated', 'Responsible', 'Calm'],
    strengthsZh: ['诚实', '专注', '负责', '冷静'],
    careers: ['Accountant', 'Financial Analyst', 'Military Officer', 'Judge'],
    majors: ['Accounting', 'Finance', 'Criminal Justice', 'Engineering'],
  },
  ISFJ: {
    title: 'The Defender',
    titleZh: '守护者',
    description:
      'Very dedicated and warm protectors, always ready to defend their loved ones.',
    descriptionZh: '非常专注和温暖的保护者，随时准备保护亲人。',
    strengths: ['Supportive', 'Reliable', 'Patient', 'Observant'],
    strengthsZh: ['支持性强', '可靠', '耐心', '善于观察'],
    careers: ['Nurse', 'Teacher', 'Social Worker', 'Administrator'],
    majors: [
      'Nursing',
      'Education',
      'Social Work',
      'Healthcare Administration',
    ],
  },
  ESTJ: {
    title: 'The Executive',
    titleZh: '总经理',
    description:
      'Excellent administrators, unsurpassed at managing things or people.',
    descriptionZh: '出色的管理者，在管理事物或人员方面无人能及。',
    strengths: ['Organized', 'Honest', 'Dedicated', 'Strong-willed'],
    strengthsZh: ['有组织力', '诚实', '专注', '意志坚强'],
    careers: ['Manager', 'Judge', 'Military Officer', 'Financial Officer'],
    majors: [
      'Business Administration',
      'Law',
      'Finance',
      'Public Administration',
    ],
  },
  ESFJ: {
    title: 'The Consul',
    titleZh: '执政官',
    description:
      'Extraordinarily caring, social and popular people, always eager to help.',
    descriptionZh: '非常关心人、善于社交、受欢迎，总是渴望帮助他人。',
    strengths: ['Caring', 'Sociable', 'Loyal', 'Sensitive'],
    strengthsZh: ['关心他人', '善于社交', '忠诚', '敏感'],
    careers: [
      'Healthcare Worker',
      'Event Coordinator',
      'HR Specialist',
      'Teacher',
    ],
    majors: ['Nursing', 'Education', 'Hospitality', 'Human Resources'],
  },
  ISTP: {
    title: 'The Virtuoso',
    titleZh: '鉴赏家',
    description:
      'Bold and practical experimenters, masters of all kinds of tools.',
    descriptionZh: '大胆实际的实验者，各种工具的大师。',
    strengths: ['Optimistic', 'Creative', 'Practical', 'Relaxed'],
    strengthsZh: ['乐观', '有创造力', '实际', '放松'],
    careers: ['Engineer', 'Mechanic', 'Forensic Scientist', 'Pilot'],
    majors: [
      'Mechanical Engineering',
      'Forensic Science',
      'Aviation',
      'Computer Science',
    ],
  },
  ISFP: {
    title: 'The Adventurer',
    titleZh: '探险家',
    description:
      'Flexible and charming artists, always ready to explore and experience something new.',
    descriptionZh: '灵活迷人的艺术家，随时准备探索和体验新事物。',
    strengths: ['Charming', 'Sensitive', 'Imaginative', 'Curious'],
    strengthsZh: ['迷人', '敏感', '有想象力', '好奇'],
    careers: ['Artist', 'Designer', 'Veterinarian', 'Nurse'],
    majors: [
      'Fine Arts',
      'Design',
      'Veterinary Medicine',
      'Music',
      'Photography',
    ],
  },
  ESTP: {
    title: 'The Entrepreneur',
    titleZh: '企业家',
    description:
      'Smart, energetic and very perceptive people who truly enjoy living on the edge.',
    descriptionZh: '聪明、精力充沛、非常敏锐，真正享受冒险生活。',
    strengths: ['Bold', 'Direct', 'Sociable', 'Perceptive'],
    strengthsZh: ['大胆', '直接', '善于社交', '敏锐'],
    careers: [
      'Entrepreneur',
      'Sales Manager',
      'Paramedic',
      'Marketing Executive',
    ],
    majors: [
      'Business',
      'Marketing',
      'Emergency Management',
      'Sports Management',
    ],
  },
  ESFP: {
    title: 'The Entertainer',
    titleZh: '表演者',
    description:
      'Spontaneous, energetic and enthusiastic entertainers - life is never boring around them.',
    descriptionZh: '自发、精力充沛、热情的表演者——在他们身边生活永不无聊。',
    strengths: ['Bold', 'Original', 'Observant', 'Excellent people skills'],
    strengthsZh: ['大胆', '独特', '善于观察', '出色的人际交往能力'],
    careers: ['Event Planner', 'Sales Rep', 'Performer', 'Flight Attendant'],
    majors: ['Theater', 'Hospitality', 'Communications', 'Public Relations'],
  },
};

/**
 * 测评免责声明
 */
export const MBTI_DISCLAIMER = {
  en: `This assessment is based on Jungian psychological type theory and is NOT an official MBTI® assessment. 
It is designed for personal exploration and educational purposes only. 
MBTI® is a registered trademark of The Myers-Briggs Company.
Results should not be used for clinical diagnosis or employment decisions.`,
  zh: `本测评基于荣格心理类型理论设计，非官方 MBTI® 测评。
仅供个人探索和教育用途。
MBTI® 是 The Myers-Briggs Company 的注册商标。
测评结果不应用于临床诊断或就业决策。`,
};
