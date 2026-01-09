/**
 * 霍兰德职业兴趣测评题库
 * R - Realistic 实际型
 * I - Investigative 研究型
 * A - Artistic 艺术型
 * S - Social 社会型
 * E - Enterprising 企业型
 * C - Conventional 常规型
 */

export const HOLLAND_QUESTIONS = [
  // R 实际型 (5题)
  {
    id: 'r1',
    text: 'I enjoy working with tools and machines',
    textZh: '我喜欢使用工具和机器工作',
    type: 'R',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'r2',
    text: 'I prefer hands-on activities over reading',
    textZh: '我更喜欢动手活动而不是阅读',
    type: 'R',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'r3',
    text: 'I enjoy fixing or building things',
    textZh: '我喜欢修理或建造东西',
    type: 'R',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'r4',
    text: 'I like outdoor activities and physical work',
    textZh: '我喜欢户外活动和体力劳动',
    type: 'R',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'r5',
    text: 'I prefer concrete tasks with clear outcomes',
    textZh: '我更喜欢有明确结果的具体任务',
    type: 'R',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  // I 研究型 (5题)
  {
    id: 'i1',
    text: 'I enjoy solving complex problems',
    textZh: '我喜欢解决复杂问题',
    type: 'I',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'i2',
    text: 'I like to analyze data and find patterns',
    textZh: '我喜欢分析数据并发现规律',
    type: 'I',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'i3',
    text: 'I am curious about how things work',
    textZh: '我对事物的运作原理很好奇',
    type: 'I',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'i4',
    text: 'I enjoy conducting experiments or research',
    textZh: '我喜欢进行实验或研究',
    type: 'I',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'i5',
    text: 'I prefer working independently on intellectual tasks',
    textZh: '我更喜欢独立完成智力任务',
    type: 'I',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  // A 艺术型 (5题)
  {
    id: 'a1',
    text: 'I enjoy creating art, music, or writing',
    textZh: '我喜欢创作艺术、音乐或写作',
    type: 'A',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'a2',
    text: 'I prefer unstructured environments where I can be creative',
    textZh: '我更喜欢可以自由发挥创意的非结构化环境',
    type: 'A',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'a3',
    text: 'I have a strong imagination',
    textZh: '我有很强的想象力',
    type: 'A',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'a4',
    text: 'I enjoy expressing myself through various mediums',
    textZh: '我喜欢通过各种媒介表达自己',
    type: 'A',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'a5',
    text: 'I value aesthetics and beauty in my surroundings',
    textZh: '我重视周围环境的美学和美感',
    type: 'A',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  // S 社会型 (5题)
  {
    id: 's1',
    text: 'I enjoy helping and teaching others',
    textZh: '我喜欢帮助和教导他人',
    type: 'S',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 's2',
    text: 'I am good at understanding others\' feelings',
    textZh: '我善于理解他人的感受',
    type: 'S',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 's3',
    text: 'I prefer working in teams rather than alone',
    textZh: '我更喜欢团队合作而不是独自工作',
    type: 'S',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 's4',
    text: 'I am interested in social issues and community service',
    textZh: '我对社会问题和社区服务感兴趣',
    type: 'S',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 's5',
    text: 'I find satisfaction in making a positive impact on others\' lives',
    textZh: '我从对他人生活产生积极影响中获得满足',
    type: 'S',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  // E 企业型 (5题)
  {
    id: 'e1',
    text: 'I enjoy leading and managing others',
    textZh: '我喜欢领导和管理他人',
    type: 'E',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'e2',
    text: 'I am good at persuading others',
    textZh: '我善于说服他人',
    type: 'E',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'e3',
    text: 'I am ambitious and goal-oriented',
    textZh: '我有抱负且目标导向',
    type: 'E',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'e4',
    text: 'I enjoy taking risks and making decisions',
    textZh: '我喜欢冒险和做决定',
    type: 'E',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'e5',
    text: 'I am interested in business and entrepreneurship',
    textZh: '我对商业和创业感兴趣',
    type: 'E',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  // C 常规型 (5题)
  {
    id: 'c1',
    text: 'I prefer organized and structured environments',
    textZh: '我更喜欢有组织和结构化的环境',
    type: 'C',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'c2',
    text: 'I am detail-oriented and thorough',
    textZh: '我注重细节和全面',
    type: 'C',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'c3',
    text: 'I enjoy working with numbers and data',
    textZh: '我喜欢处理数字和数据',
    type: 'C',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'c4',
    text: 'I follow rules and procedures carefully',
    textZh: '我认真遵守规则和程序',
    type: 'C',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
  {
    id: 'c5',
    text: 'I am reliable and consistent in my work',
    textZh: '我在工作中可靠且始终如一',
    type: 'C',
    options: [
      { value: '5', text: 'Strongly Agree', textZh: '非常同意' },
      { value: '4', text: 'Agree', textZh: '同意' },
      { value: '3', text: 'Neutral', textZh: '中立' },
      { value: '2', text: 'Disagree', textZh: '不同意' },
      { value: '1', text: 'Strongly Disagree', textZh: '非常不同意' },
    ],
  },
];

export const HOLLAND_TYPE_INFO: Record<string, {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  fields: string[];
  fieldsZh: string[];
  majors: string[];
}> = {
  R: {
    name: 'Realistic',
    nameZh: '实际型',
    description: 'Practical, hands-on problem solvers who enjoy physical activities.',
    descriptionZh: '务实的、动手解决问题的人，喜欢体力活动。',
    fields: ['Engineering', 'Construction', 'Agriculture', 'Athletics'],
    fieldsZh: ['工程', '建筑', '农业', '体育'],
    majors: ['Mechanical Engineering', 'Civil Engineering', 'Agriculture', 'Kinesiology'],
  },
  I: {
    name: 'Investigative',
    nameZh: '研究型',
    description: 'Analytical and intellectual, prefer working with ideas and theories.',
    descriptionZh: '善于分析和思考，喜欢研究想法和理论。',
    fields: ['Science', 'Research', 'Medicine', 'Technology'],
    fieldsZh: ['科学', '研究', '医学', '技术'],
    majors: ['Physics', 'Chemistry', 'Biology', 'Computer Science', 'Mathematics'],
  },
  A: {
    name: 'Artistic',
    nameZh: '艺术型',
    description: 'Creative and original, prefer unstructured activities involving self-expression.',
    descriptionZh: '有创造力和独创性，喜欢非结构化的自我表达活动。',
    fields: ['Art', 'Music', 'Writing', 'Design'],
    fieldsZh: ['艺术', '音乐', '写作', '设计'],
    majors: ['Fine Arts', 'Music', 'Creative Writing', 'Graphic Design', 'Architecture'],
  },
  S: {
    name: 'Social',
    nameZh: '社会型',
    description: 'Helpful and friendly, enjoy working with and helping others.',
    descriptionZh: '乐于助人和友善，喜欢与他人合作和帮助他人。',
    fields: ['Education', 'Healthcare', 'Counseling', 'Social Work'],
    fieldsZh: ['教育', '医疗', '咨询', '社会工作'],
    majors: ['Education', 'Psychology', 'Nursing', 'Social Work', 'Communications'],
  },
  E: {
    name: 'Enterprising',
    nameZh: '企业型',
    description: 'Energetic and ambitious, enjoy leading and persuading others.',
    descriptionZh: '精力充沛有抱负，喜欢领导和说服他人。',
    fields: ['Business', 'Management', 'Sales', 'Law'],
    fieldsZh: ['商业', '管理', '销售', '法律'],
    majors: ['Business Administration', 'Marketing', 'Law', 'Political Science', 'Economics'],
  },
  C: {
    name: 'Conventional',
    nameZh: '常规型',
    description: 'Organized and detail-oriented, prefer structured tasks and rules.',
    descriptionZh: '有组织和注重细节，喜欢结构化的任务和规则。',
    fields: ['Finance', 'Accounting', 'Administration', 'Data Management'],
    fieldsZh: ['金融', '会计', '行政', '数据管理'],
    majors: ['Accounting', 'Finance', 'Business Analytics', 'Information Systems'],
  },
};



