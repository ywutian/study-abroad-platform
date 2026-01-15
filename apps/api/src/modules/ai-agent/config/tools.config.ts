/**
 * 工具配置 - 定义所有可用工具
 *
 * 从旧架构 ai/agent/tools.registry.ts 迁移，并添加 delegate_to_agent
 */

import { ToolDefinition } from '../types';

// ==================== 工具名称枚举 ====================

export enum ToolName {
  // 委派工具
  DELEGATE_TO_AGENT = 'delegate_to_agent',

  // 档案工具
  GET_PROFILE = 'get_profile',
  UPDATE_PROFILE = 'update_profile',

  // 学校工具
  SEARCH_SCHOOLS = 'search_schools',
  GET_SCHOOL_DETAILS = 'get_school_details',
  COMPARE_SCHOOLS = 'compare_schools',

  // 文书工具
  GET_ESSAYS = 'get_essays',
  REVIEW_ESSAY = 'review_essay',
  POLISH_ESSAY = 'polish_essay',
  GENERATE_OUTLINE = 'generate_outline',
  BRAINSTORM_IDEAS = 'brainstorm_ideas',

  // 选校工具
  RECOMMEND_SCHOOLS = 'recommend_schools',
  ANALYZE_ADMISSION_CHANCE = 'analyze_admission_chance',

  // 案例工具
  SEARCH_CASES = 'search_cases',

  // 时间线工具
  GET_DEADLINES = 'get_deadlines',
  CREATE_TIMELINE = 'create_timeline',
  GET_PERSONAL_EVENTS = 'get_personal_events',
  CREATE_PERSONAL_EVENT = 'create_personal_event',

  // 测评工具
  GET_ASSESSMENT_RESULTS = 'get_assessment_results',
  INTERPRET_ASSESSMENT = 'interpret_assessment',
  SUGGEST_ACTIVITIES_FROM_ASSESSMENT = 'suggest_activities_from_assessment',

  // 论坛工具
  SEARCH_FORUM_POSTS = 'search_forum_posts',
  GET_POPULAR_DISCUSSIONS = 'get_popular_discussions',
  ANSWER_FORUM_QUESTION = 'answer_forum_question',

  // 案例预测游戏工具
  EXPLAIN_CASE_RESULT = 'explain_case_result',
  ANALYZE_PREDICTION_ACCURACY = 'analyze_prediction_accuracy',
  COMPARE_CASE_WITH_PROFILE = 'compare_case_with_profile',

  // 档案排名工具
  ANALYZE_PROFILE_RANKING = 'analyze_profile_ranking',
  SUGGEST_PROFILE_IMPROVEMENTS = 'suggest_profile_improvements',
  COMPARE_WITH_ADMITTED_PROFILES = 'compare_with_admitted_profiles',

  // 外部搜索工具
  WEB_SEARCH = 'web_search',
  SEARCH_SCHOOL_WEBSITE = 'search_school_website',
}

// ==================== 工具定义 ====================

export const TOOLS: ToolDefinition[] = [
  // ============== 委派工具 ==============
  {
    name: ToolName.DELEGATE_TO_AGENT,
    description:
      '将任务委派给专业 Agent 处理。当用户问题涉及文书(essay)、选校(school)、档案(profile)、时间规划(timeline)等专业领域时使用。返回委派确认信息。不要用于可以直接回答的简单问题。',
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
          description: '任务描述，说明需要该 Agent 做什么',
        },
        context: {
          type: 'string',
          description: '上下文信息，帮助目标 Agent 理解背景',
        },
      },
      required: ['agent', 'task'],
    },
    handler: 'delegate',
  },

  // ============== 档案工具 ==============
  {
    name: ToolName.GET_PROFILE,
    description:
      '获取当前用户的完整档案信息。当需要了解用户的 GPA、标化成绩、活动、奖项、目标专业等背景时使用。返回包含学术和课外活动的完整档案对象。不要用于更新档案（请用 update_profile）。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'profile.get',
  },
  {
    name: ToolName.UPDATE_PROFILE,
    description:
      '更新用户档案中的特定字段（目标专业、目标学校、预算等级）。当用户明确要求修改档案信息时使用。返回更新后的字段值。不要用于读取档案信息（请用 get_profile）。',
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
    handler: 'profile.update',
  },

  // ============== 学校工具 ==============
  {
    name: ToolName.SEARCH_SCHOOLS,
    description:
      '搜索和筛选学校列表。当用户询问学校推荐、排名筛选、按条件找学校时使用。支持按名称、排名范围、学费、地理位置筛选。返回匹配的学校列表（含名称、排名、基本信息）。不要用于获取单个学校的详细信息（请用 get_school_details）。',
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
    handler: 'school.search',
  },
  {
    name: ToolName.GET_SCHOOL_DETAILS,
    description:
      '获取指定学校的详细信息。当用户询问某所学校的录取要求、截止日期、文书题目、学费等详情时使用。支持通过 schoolId 或 schoolName 查询。返回学校完整信息对象。不要用于搜索多所学校（请用 search_schools）。',
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
    handler: 'school.details',
  },
  {
    name: ToolName.COMPARE_SCHOOLS,
    description:
      '对比多所学校的关键指标。当用户要求比较两所或多所学校时使用。支持对比排名、学费、录取率、地理位置等维度。返回结构化的对比表格数据。不要用于单个学校查询（请用 get_school_details）。',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'string',
          description: '学校ID列表，用逗号分隔',
        },
        schoolNames: {
          type: 'string',
          description: '学校名称列表，用逗号分隔（如不知道ID可用名称）',
        },
        aspects: {
          type: 'string',
          description: '对比维度：ranking, tuition, admission, location',
        },
      },
      required: [],
    },
    handler: 'school.compare',
  },

  // ============== 文书工具 ==============
  {
    name: ToolName.GET_ESSAYS,
    description:
      '获取用户保存的所有文书列表。当需要查看用户已有文书、选择文书进行评估或润色时使用。返回文书列表（含标题、状态、关联学校）。不要用于评估或修改文书内容（请用 review_essay 或 polish_essay）。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'essay.list',
  },
  {
    name: ToolName.REVIEW_ESSAY,
    description:
      '评估文书质量并给出评分和改进建议。当用户请求文书评估、打分、诊断问题时使用。支持通过 essayId 或直接传入 content。返回评分、优缺点分析和改进建议。不要用于润色修改文书（请用 polish_essay）。',
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
    handler: 'essay.review',
  },
  {
    name: ToolName.POLISH_ESSAY,
    description:
      '润色文书内容，提升语言表达质量。当用户请求修改、润色、优化文书语言时使用。支持 formal/vivid/concise 三种风格。返回润色后的完整文书内容。不要用于评估打分（请用 review_essay）或生成新文书（请用 generate_outline）。',
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
    handler: 'essay.polish',
  },
  {
    name: ToolName.GENERATE_OUTLINE,
    description:
      '根据题目和学生背景生成文书大纲。当用户有文书题目但不知道如何构思结构时使用。返回分段落的大纲结构和写作建议。不要用于生成完整文书或润色已有内容。',
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
    handler: 'essay.outline',
  },
  {
    name: ToolName.BRAINSTORM_IDEAS,
    description:
      '为文书题目生成创意素材和写作角度。当用户面对文书题目没有思路、需要灵感时使用。返回多个创意方向和对应的素材建议。不要用于已有思路需要大纲的情况（请用 generate_outline）。',
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
    handler: 'essay.brainstorm',
  },

  // ============== 选校工具 ==============
  {
    name: ToolName.RECOMMEND_SCHOOLS,
    description:
      '根据学生档案智能推荐学校。当用户请求选校推荐或选校列表时使用。自动分为冲刺校、匹配校、保底校三个层次。返回分层的推荐学校列表（含匹配理由）。不要用于分析单个学校的录取概率（请用 analyze_admission_chance）。',
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
    handler: 'school.recommend',
  },
  {
    name: ToolName.ANALYZE_ADMISSION_CHANCE,
    description:
      '分析用户申请某所学校的录取概率。当用户询问某所学校的录取机会或"我能不能进 XX"时使用。支持通过 schoolId 或 schoolName 查询。返回录取概率评估、优劣势分析和建议。不要用于多校推荐（请用 recommend_schools）。',
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
    handler: 'school.admissionChance',
  },

  // ============== 案例工具 ==============
  {
    name: ToolName.SEARCH_CASES,
    description:
      '搜索历史录取案例。当用户想了解类似背景的真实申请结果、录取数据时使用。支持按学校、专业、年份、GPA 范围筛选。返回匹配的案例列表（含背景和录取结果）。不要用于分析用户自己的录取概率（请用 analyze_admission_chance）。',
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
    handler: 'case.search',
  },

  // ============== 时间线工具 ==============
  {
    name: ToolName.GET_DEADLINES,
    description:
      '获取目标学校的申请截止日期。当用户询问学校截止日期或需要规划时间时使用。支持按申请轮次(ED/EA/RD)筛选。返回学校截止日期列表。不要用于创建完整时间线（请用 create_timeline）。',
    parameters: {
      type: 'object',
      properties: {
        schoolIds: {
          type: 'string',
          description: '学校ID列表，用逗号分隔',
        },
        schoolNames: {
          type: 'string',
          description: '学校名称列表，用逗号分隔（如不知道ID可用名称）',
        },
        round: {
          type: 'string',
          description: '申请轮次：ED, EA, RD',
          enum: ['ED', 'EA', 'REA', 'ED2', 'RD'],
        },
      },
      required: [],
    },
    handler: 'timeline.deadlines',
  },
  {
    name: ToolName.CREATE_TIMELINE,
    description:
      '根据目标学校创建个性化申请时间线。当用户要求制定申请规划或时间安排时使用。返回按时间排序的任务清单（含截止日期和优先级）。不要用于只查看截止日期（请用 get_deadlines）。',
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
    handler: 'timeline.create',
  },
  {
    name: ToolName.GET_PERSONAL_EVENTS,
    description:
      '获取用户的个人事件列表。当需要查看用户的竞赛、考试、夏校、实习等安排时使用。支持按分类筛选。返回事件列表（含标题、日期、状态）。不要用于创建新事件（请用 create_personal_event）。',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '事件分类过滤',
          enum: [
            'COMPETITION',
            'TEST',
            'SUMMER_PROGRAM',
            'INTERNSHIP',
            'ACTIVITY',
            'MATERIAL',
            'OTHER',
          ],
        },
      },
      required: [],
    },
    handler: 'timeline.personalEvents',
  },
  {
    name: ToolName.CREATE_PERSONAL_EVENT,
    description:
      '为用户创建个人事件并自动生成子任务。当用户要求添加竞赛、考试、夏校、实习等事件到日程时使用。返回创建的事件信息和自动生成的子任务列表。不要用于查看已有事件（请用 get_personal_events）。注意: 此操作会写入数据库，不可撤销。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '事件名称，如 AMC 12 竞赛、TOEFL 考试',
        },
        category: {
          type: 'string',
          description: '事件分类',
          enum: [
            'COMPETITION',
            'TEST',
            'SUMMER_PROGRAM',
            'INTERNSHIP',
            'ACTIVITY',
            'MATERIAL',
            'OTHER',
          ],
        },
        deadline: {
          type: 'string',
          description: '截止日期 (ISO 格式)',
        },
        eventDate: {
          type: 'string',
          description: '事件日期 (ISO 格式)',
        },
        description: {
          type: 'string',
          description: '事件描述/备注',
        },
      },
      required: ['title', 'category'],
    },
    handler: 'timeline.createPersonalEvent',
  },

  // ============== 测评工具 ==============
  {
    name: ToolName.GET_ASSESSMENT_RESULTS,
    description:
      '获取用户的性格或职业测评结果。当需要查看用户的 MBTI 或霍兰德测评数据时使用。支持按类型筛选。返回测评结果对象（含类型代码和各维度得分）。不要用于解读测评含义（请用 interpret_assessment）。',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: '测评类型',
          enum: ['mbti', 'holland'],
        },
      },
      required: [],
    },
    handler: 'assessment.results',
  },
  {
    name: ToolName.INTERPRET_ASSESSMENT,
    description:
      '深度解读测评结果，分析性格特点和职业倾向。当用户想了解测评结果的含义和专业推荐时使用。返回性格分析、适合专业列表和职业方向建议。不要用于获取原始测评数据（请用 get_assessment_results）。',
    parameters: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: '测评结果ID',
        },
        type: {
          type: 'string',
          description: '测评类型（如不知道 resultId，传类型会自动查最新结果）',
          enum: ['mbti', 'holland'],
        },
      },
      required: [],
    },
    handler: 'assessment.interpret',
  },
  {
    name: ToolName.SUGGEST_ACTIVITIES_FROM_ASSESSMENT,
    description:
      '基于测评结果推荐适合的课外活动和竞赛。当用户想根据性格特点和兴趣找活动时使用。返回推荐的活动列表（含匹配理由和参与建议）。不要用于解读测评本身（请用 interpret_assessment）。',
    parameters: {
      type: 'object',
      properties: {
        resultId: {
          type: 'string',
          description: '测评结果ID',
        },
        type: {
          type: 'string',
          description: '测评类型（如不知道 resultId，传类型会自动查最新结果）',
          enum: ['mbti', 'holland'],
        },
        targetMajor: {
          type: 'string',
          description: '目标专业（可选，用于更精准的推荐）',
        },
      },
      required: [],
    },
    handler: 'assessment.suggestActivities',
  },

  // ============== 论坛工具 ==============
  {
    name: ToolName.SEARCH_FORUM_POSTS,
    description:
      '搜索论坛帖子和经验分享。当用户想查找社区讨论、他人经验、热门话题时使用。支持按分类和关键词筛选。返回匹配的帖子列表（含标题、摘要、互动数据）。不要用于获取热门帖子排行（请用 get_popular_discussions）。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
        category: {
          type: 'string',
          description: '分类筛选',
          enum: [
            'general',
            'application',
            'essay',
            'interview',
            'visa',
            'life',
            'team',
          ],
        },
        limit: {
          type: 'number',
          description: '返回数量限制',
        },
      },
      required: ['query'],
    },
    handler: 'forum.search',
  },
  {
    name: ToolName.GET_POPULAR_DISCUSSIONS,
    description:
      '获取论坛热门讨论排行。当用户想了解社区最近关注什么话题时使用。支持按分类和时间范围筛选。返回热门帖子列表（按热度排序）。不要用于搜索特定话题（请用 search_forum_posts）。',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: '分类筛选',
          enum: [
            'general',
            'application',
            'essay',
            'interview',
            'visa',
            'life',
            'team',
          ],
        },
        timeRange: {
          type: 'string',
          description: '时间范围',
          enum: ['day', 'week', 'month'],
        },
      },
      required: [],
    },
    handler: 'forum.popular',
  },
  {
    name: ToolName.ANSWER_FORUM_QUESTION,
    description:
      '基于知识库回答留学相关问题。当用户提出具体的留学问题需要专业回答时使用。返回结构化的回答内容。不要用于搜索已有讨论（请用 search_forum_posts）。',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '问题内容',
        },
        context: {
          type: 'string',
          description: '问题的上下文或背景',
        },
      },
      required: ['question'],
    },
    handler: 'forum.answer',
  },

  // ============== 案例预测游戏工具 ==============
  {
    name: ToolName.EXPLAIN_CASE_RESULT,
    description:
      '解释某个录取案例的结果原因。当用户在案例预测游戏中想了解某案例为何被录取或被拒时使用。返回关键因素分析和录取逻辑解读。不要用于分析用户自己的录取概率（请用 analyze_admission_chance）。',
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: '案例ID',
        },
        schoolName: {
          type: 'string',
          description: '学校名称（如不知道 caseId，配合 year 查询最近案例）',
        },
        year: {
          type: 'number',
          description: '申请年份',
        },
      },
      required: [],
    },
    handler: 'swipe.explain',
  },
  {
    name: ToolName.ANALYZE_PREDICTION_ACCURACY,
    description:
      '分析用户在案例预测游戏中的整体表现。当用户想回顾自己的预测准确率和预测偏差时使用。返回准确率统计、常见错误模式和改进建议。不要用于解释单个案例（请用 explain_case_result）。',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: 'swipe.analyzeAccuracy',
  },
  {
    name: ToolName.COMPARE_CASE_WITH_PROFILE,
    description:
      '将某个录取案例与用户档案进行对比。当用户想知道自己和某个已录取/被拒案例的差异时使用。返回逐项对比分析和差距说明。不要用于整体选校推荐（请用 recommend_schools）。',
    parameters: {
      type: 'object',
      properties: {
        caseId: {
          type: 'string',
          description: '案例ID',
        },
        schoolName: {
          type: 'string',
          description: '学校名称（如不知道 caseId，配合 year 查询最近案例）',
        },
        year: {
          type: 'number',
          description: '申请年份',
        },
      },
      required: [],
    },
    handler: 'swipe.compareWithProfile',
  },

  // ============== 档案排名工具 ==============
  {
    name: ToolName.ANALYZE_PROFILE_RANKING,
    description:
      '分析用户档案在目标学校申请者中的排名位置。当用户想了解自己在某校申请者中的竞争力水平时使用。支持通过 schoolId 或 schoolName 查询。返回排名百分位和各维度评估。不要用于获取改进建议（请用 suggest_profile_improvements）。',
    parameters: {
      type: 'object',
      properties: {
        schoolId: {
          type: 'string',
          description: '目标学校ID（可选）',
        },
        schoolName: {
          type: 'string',
          description: '目标学校名称（可选）',
        },
      },
      required: [],
    },
    handler: 'hall.ranking',
  },
  {
    name: ToolName.SUGGEST_PROFILE_IMPROVEMENTS,
    description:
      '基于档案分析提供具体的改进建议。当用户想知道如何提升申请竞争力时使用。支持指定目标学校层次。返回按优先级排序的改进建议列表。不要用于查看当前排名（请用 analyze_profile_ranking）。',
    parameters: {
      type: 'object',
      properties: {
        targetTier: {
          type: 'string',
          description: '目标学校层次',
          enum: ['top10', 'top30', 'top50', 'top100'],
        },
      },
      required: [],
    },
    handler: 'hall.suggestImprovements',
  },
  {
    name: ToolName.COMPARE_WITH_ADMITTED_PROFILES,
    description:
      '与目标学校已录取学生的档案进行对比。当用户想了解自己和已录取学生的差距时使用。支持通过 schoolId 或 schoolName 查询。返回逐项对比和差距分析。不要用于查看录取案例详情（请用 search_cases）。',
    parameters: {
      type: 'object',
      properties: {
        schoolId: {
          type: 'string',
          description: '目标学校ID',
        },
        schoolName: {
          type: 'string',
          description: '目标学校名称',
        },
      },
      required: [],
    },
    handler: 'hall.compareWithAdmitted',
  },
  // ============== 外部搜索工具 ==============
  {
    name: ToolName.WEB_SEARCH,
    description:
      '搜索互联网获取最新信息。当用户询问留学政策、签证动态、申请趋势等需要实时信息的问题时使用。返回搜索结果摘要和来源链接。不要用于查询学校官方信息（请用 search_school_website）。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，尽量使用英文以获取更好的结果',
        },
        topic: {
          type: 'string',
          description: '搜索类型',
          enum: ['general', 'news'],
        },
      },
      required: ['query'],
    },
    handler: 'search.web',
  },
  {
    name: ToolName.SEARCH_SCHOOL_WEBSITE,
    description:
      '搜索学校官方网站获取权威信息。当需要确认学校官方的截止日期、文书题目、录取要求、学费等信息时使用。自动限定到学校官网域名。返回官网搜索结果和来源链接。不要用于通用互联网搜索（请用 web_search）。',
    parameters: {
      type: 'object',
      properties: {
        schoolName: {
          type: 'string',
          description: '学校名称（英文），如 MIT, Stanford, Harvard',
        },
        query: {
          type: 'string',
          description:
            '要搜索的具体信息，如 application deadline, essay prompts, tuition',
        },
      },
      required: ['schoolName', 'query'],
    },
    handler: 'search.school',
  },
];

// ==================== 工具查询函数 ====================

/**
 * 根据名称获取工具定义
 */
export function getTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * 根据名称列表获取工具定义
 */
export function getTools(names: string[]): ToolDefinition[] {
  return TOOLS.filter((t) => names.includes(t.name));
}

/**
 * 转换为 OpenAI Function Calling 格式
 */
export function toOpenAIFormat(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * 获取所有工具名称
 */
export function getAllToolNames(): string[] {
  return TOOLS.map((t) => t.name);
}
