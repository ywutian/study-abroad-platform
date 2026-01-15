/**
 * Agent 工具注册表 - 定义所有可用工具
 */

import { AgentTool, ToolDefinition } from './agent.types';

export const AGENT_TOOLS: ToolDefinition[] = [
  // ============== 档案工具 ==============
  {
    name: AgentTool.GET_PROFILE,
    description: '获取当前用户的完整档案信息，包括 GPA、标化成绩、活动、奖项等',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: AgentTool.UPDATE_PROFILE,
    description: '更新用户档案中的特定字段',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          description: '要更新的字段名',
          enum: ['targetMajor', 'targetSchools', 'budgetTier'],
        },
        value: {
          type: 'string',
          description: '新的值',
        },
      },
      required: ['field', 'value'],
    },
  },

  // ============== 学校工具 ==============
  {
    name: AgentTool.SEARCH_SCHOOLS,
    description: '搜索学校，支持按名称、排名、录取率、学费等条件筛选',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词（学校名称）',
        },
        rankRange: {
          type: 'string',
          description: '排名范围，如 "1-20", "21-50"',
        },
        maxTuition: {
          type: 'number',
          description: '最高学费限制',
        },
        state: {
          type: 'string',
          description: '所在州',
        },
      },
      required: [],
    },
  },
  {
    name: AgentTool.GET_SCHOOL_DETAILS,
    description: '获取指定学校的详细信息，包括录取要求、截止日期、文书题目等',
    parameters: {
      type: 'object',
      properties: {
        schoolId: {
          type: 'string',
          description: '学校ID',
        },
        schoolName: {
          type: 'string',
          description: '学校名称（如果不知道ID）',
        },
      },
      required: [],
    },
  },
  {
    name: AgentTool.COMPARE_SCHOOLS,
    description: '对比多所学校的关键指标',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'string',
          description: '学校ID列表，用逗号分隔',
        },
        aspects: {
          type: 'string',
          description: '对比维度：ranking, tuition, admission, location',
        },
      },
      required: ['schoolIds'],
    },
  },

  // ============== 文书工具 ==============
  {
    name: AgentTool.GET_ESSAYS,
    description: '获取用户保存的所有文书',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: AgentTool.REVIEW_ESSAY,
    description: '评估文书质量，给出评分和改进建议',
    parameters: {
      type: 'object',
      properties: {
        essayId: {
          type: 'string',
          description: '文书ID',
        },
        content: {
          type: 'string',
          description: '文书内容（如果是新文书）',
        },
        prompt: {
          type: 'string',
          description: '文书题目',
        },
      },
      required: [],
    },
  },
  {
    name: AgentTool.POLISH_ESSAY,
    description: '润色文书，提升语言表达质量',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '文书内容',
        },
        style: {
          type: 'string',
          description: '润色风格',
          enum: ['formal', 'vivid', 'concise'],
        },
      },
      required: ['content'],
    },
  },
  {
    name: AgentTool.GENERATE_OUTLINE,
    description: '根据题目和背景生成文书大纲',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '文书题目',
        },
        background: {
          type: 'string',
          description: '学生背景信息',
        },
        wordLimit: {
          type: 'number',
          description: '字数限制',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: AgentTool.BRAINSTORM_IDEAS,
    description: '为文书题目生成创意点子',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '文书题目',
        },
        background: {
          type: 'string',
          description: '学生背景（可选）',
        },
      },
      required: ['prompt'],
    },
  },

  // ============== 选校工具 ==============
  {
    name: AgentTool.RECOMMEND_SCHOOLS,
    description: '根据学生档案智能推荐学校，分为冲刺校、匹配校、保底校',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: '推荐数量',
        },
        preference: {
          type: 'string',
          description: '偏好：research, liberal_arts, urban, rural',
        },
      },
      required: [],
    },
  },
  {
    name: AgentTool.ANALYZE_ADMISSION_CHANCE,
    description: '分析申请某所学校的录取概率',
    parameters: {
      type: 'object',
      properties: {
        schoolId: {
          type: 'string',
          description: '学校ID',
        },
        schoolName: {
          type: 'string',
          description: '学校名称',
        },
      },
      required: [],
    },
  },

  // ============== 案例工具 ==============
  {
    name: AgentTool.SEARCH_CASES,
    description: '搜索录取案例，了解类似背景的申请结果',
    parameters: {
      type: 'object',
      properties: {
        schoolName: {
          type: 'string',
          description: '学校名称',
        },
        major: {
          type: 'string',
          description: '专业',
        },
        year: {
          type: 'number',
          description: '申请年份',
        },
        gpaRange: {
          type: 'string',
          description: 'GPA范围，如 "3.8-4.0"',
        },
      },
      required: [],
    },
  },

  // ============== 时间线工具 ==============
  {
    name: AgentTool.GET_DEADLINES,
    description: '获取目标学校的申请截止日期',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'string',
          description: '学校ID列表，用逗号分隔',
        },
        round: {
          type: 'string',
          description: '申请轮次：ED, EA, RD',
          enum: ['ED', 'EA', 'REA', 'ED2', 'RD'],
        },
      },
      required: [],
    },
  },
  {
    name: AgentTool.CREATE_TIMELINE,
    description: '根据目标学校创建个性化申请时间线',
    parameters: {
      type: 'object',
      properties: {
        targetSchools: {
          type: 'string',
          description: '目标学校列表',
        },
        startDate: {
          type: 'string',
          description: '开始日期',
        },
      },
      required: [],
    },
  },
];

// 获取工具定义（用于 OpenAI function calling）
export function getToolDefinitions(tools: AgentTool[]): ToolDefinition[] {
  return AGENT_TOOLS.filter((t) => tools.includes(t.name));
}

// 转换为 OpenAI tools 格式
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
