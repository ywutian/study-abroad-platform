/**
 * Agent 工具配置
 */

import { ToolDefinition } from '../types';

export const TOOLS: ToolDefinition[] = [
  // ==================== 协调工具 ====================
  {
    name: 'delegate_to_agent',
    description: '将任务委派给专业 Agent 处理',
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description: '目标 Agent',
          enum: ['essay', 'school', 'profile', 'timeline'],
        },
        task: {
          type: 'string',
          description: '任务描述',
        },
        context: {
          type: 'string',
          description: '相关上下文',
        },
      },
      required: ['agent', 'task'],
    },
    handler: 'orchestrator.delegate',
  },

  // ==================== 用户工具 ====================
  {
    name: 'get_profile',
    description: '获取用户完整档案信息',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'user.getProfile',
  },
  {
    name: 'get_user_context',
    description: '获取用户上下文（偏好、目标等）',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'user.getContext',
  },

  // ==================== 学校工具 ====================
  {
    name: 'search_schools',
    description: '搜索学校，支持多条件筛选',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '关键词' },
        rankMin: { type: 'number', description: '最低排名' },
        rankMax: { type: 'number', description: '最高排名' },
        state: { type: 'string', description: '州' },
        maxTuition: { type: 'number', description: '最高学费' },
      },
      required: [],
    },
    handler: 'school.search',
  },
  {
    name: 'get_school_details',
    description: '获取学校详细信息',
    parameters: {
      type: 'object',
      properties: {
        schoolId: { type: 'string', description: '学校ID' },
        schoolName: { type: 'string', description: '学校名称' },
      },
      required: [],
    },
    handler: 'school.getDetails',
  },
  {
    name: 'compare_schools',
    description: '对比多所学校',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'array',
          description: '学校ID数组',
          items: { type: 'string' },
        },
      },
      required: ['schoolIds'],
    },
    handler: 'school.compare',
  },
  {
    name: 'get_school_essays',
    description: '获取学校的文书题目要求',
    parameters: {
      type: 'object',
      properties: {
        schoolId: { type: 'string', description: '学校ID' },
        schoolName: { type: 'string', description: '学校名称' },
      },
      required: [],
    },
    handler: 'school.getEssayPrompts',
  },
  {
    name: 'get_deadlines',
    description: '获取学校申请截止日期',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'array',
          description: '学校ID数组',
          items: { type: 'string' },
        },
        round: {
          type: 'string',
          description: '申请轮次',
          enum: ['ED', 'EA', 'REA', 'ED2', 'RD'],
        },
      },
      required: [],
    },
    handler: 'school.getDeadlines',
  },
  {
    name: 'recommend_schools',
    description: '根据用户档案推荐学校',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: '推荐数量' },
        preference: { type: 'string', description: '偏好' },
      },
      required: [],
    },
    handler: 'school.recommend',
  },
  {
    name: 'analyze_admission',
    description: '分析申请某校的录取概率',
    parameters: {
      type: 'object',
      properties: {
        schoolId: { type: 'string', description: '学校ID' },
        schoolName: { type: 'string', description: '学校名称' },
      },
      required: [],
    },
    handler: 'school.analyzeAdmission',
  },

  // ==================== 文书工具 ====================
  {
    name: 'get_essays',
    description: '获取用户保存的文书列表',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'essay.list',
  },
  {
    name: 'review_essay',
    description: '评估文书质量',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '文书内容' },
        prompt: { type: 'string', description: '文书题目' },
        essayId: { type: 'string', description: '已保存文书ID' },
      },
      required: [],
    },
    handler: 'essay.review',
  },
  {
    name: 'polish_essay',
    description: '润色文书',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '文书内容' },
        style: {
          type: 'string',
          description: '润色风格',
          enum: ['formal', 'vivid', 'concise'],
        },
      },
      required: ['content'],
    },
    handler: 'essay.polish',
  },
  {
    name: 'generate_outline',
    description: '生成文书大纲',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '文书题目' },
        background: { type: 'string', description: '学生背景' },
        wordLimit: { type: 'number', description: '字数限制' },
      },
      required: ['prompt'],
    },
    handler: 'essay.generateOutline',
  },
  {
    name: 'brainstorm_ideas',
    description: '为文书题目生成创意点子',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '文书题目' },
        background: { type: 'string', description: '学生背景' },
      },
      required: ['prompt'],
    },
    handler: 'essay.brainstorm',
  },
  {
    name: 'continue_writing',
    description: '续写文书',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '已有内容' },
        prompt: { type: 'string', description: '文书题目' },
        direction: { type: 'string', description: '续写方向' },
      },
      required: ['content'],
    },
    handler: 'essay.continue',
  },

  // ==================== 档案工具 ====================
  {
    name: 'analyze_profile',
    description: '分析用户档案竞争力',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'profile.analyze',
  },
  {
    name: 'suggest_improvements',
    description: '提供背景提升建议',
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: '关注领域',
          enum: ['academic', 'activities', 'awards', 'all'],
        },
      },
      required: [],
    },
    handler: 'profile.suggestImprovements',
  },

  // ==================== 案例工具 ====================
  {
    name: 'get_admission_cases',
    description: '搜索录取案例',
    parameters: {
      type: 'object',
      properties: {
        schoolName: { type: 'string', description: '学校名称' },
        major: { type: 'string', description: '专业' },
        year: { type: 'number', description: '年份' },
        gpaRange: { type: 'string', description: 'GPA范围' },
      },
      required: [],
    },
    handler: 'case.search',
  },

  // ==================== 时间线工具 ====================
  {
    name: 'create_timeline',
    description: '创建申请时间线',
    parameters: {
      type: 'object',
      properties: {
        targetSchools: { type: 'string', description: '目标学校' },
        startDate: { type: 'string', description: '开始日期' },
      },
      required: [],
    },
    handler: 'timeline.create',
  },

  // ==================== 知识搜索 ====================
  {
    name: 'search_knowledge',
    description: '搜索留学相关知识',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索问题' },
      },
      required: ['query'],
    },
    handler: 'knowledge.search',
  },
];

// 按 handler 前缀分组
export const getToolsByHandler = (prefix: string): ToolDefinition[] => {
  return TOOLS.filter(t => t.handler.startsWith(prefix));
};

// 按名称获取工具
export const getToolByName = (name: string): ToolDefinition | undefined => {
  return TOOLS.find(t => t.name === name);
};

// 转换为 OpenAI 格式
export const toOpenAIFormat = (tools: ToolDefinition[]) => {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
};









