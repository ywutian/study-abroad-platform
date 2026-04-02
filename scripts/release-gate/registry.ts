export const JOURNEY_REGISTRY_VERSION = '2026-04-01.v3';

export const REGISTRY_STATUSES = ['active', 'inactive', 'temporary-child'] as const;
export type RegistryStatus = (typeof REGISTRY_STATUSES)[number];

export const EXECUTION_OWNERS = ['codex', 'human', 'internal', 'codex + human'] as const;
export type ExecutionOwner = (typeof EXECUTION_OWNERS)[number];

export const VALIDATION_TYPES = ['objective', 'experiential', 'admin-only'] as const;
export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const QUALITY_DIMENSIONS = [
  'layout',
  'ai-quality',
  'cross-platform',
  'consultancy-quality',
] as const;
export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export const QUALITY_DIMENSION_LABELS: Record<QualityDimension, string> = {
  layout: '布局合理性',
  'ai-quality': 'AI Agent 功能与输出合理性',
  'cross-platform': 'Web / Mobile 复用合理性',
  'consultancy-quality': '专业留学中介感',
};

export interface HumanTaskConfig {
  summary: string;
  entry: string;
  steps: string[];
  expectedResults: string[];
  observationPrompts?: string[];
}

export interface ExternalPrerequisite {
  scope: string;
  blockingPolicy: 'required' | 'conditional';
  reason: string;
  unblockAction: string;
}

export interface JourneyDefinition {
  id: string;
  title: string;
  registryStatus: RegistryStatus;
  persona: 'applicant' | 'admin' | 'parent' | 'external';
  platform: 'web' | 'mobile' | 'api+mcp' | 'cross-platform';
  defaultExecutionOwner: ExecutionOwner;
  validationType: ValidationType;
  baselineSmoke: boolean;
  fullAuditDefault: boolean;
  qualityDimensions: QualityDimension[];
  notes?: string[];
  externalPrerequisites?: ExternalPrerequisite[];
  humanTask?: HumanTaskConfig;
}

const ANDROID_REMOTE_PUSH_PREREQUISITE: ExternalPrerequisite = {
  scope: 'Android remote push / notification-open on a physical device',
  blockingPolicy: 'conditional',
  reason:
    'Expo Android remote push depends on FCM initialization. Without a valid apps/mobile/android/app/google-services.json and a rebuilt physical-device dev build, token issuance and true remote push delivery cannot be verified. This is tracked as a conditional capability gate rather than a default core-runtime stop condition.',
  unblockAction:
    'Install a valid apps/mobile/android/app/google-services.json, rebuild the Android dev build for a connected physical device, then rerun A11 and SJ-3 on that device.',
};

export const JOURNEY_REGISTRY = [
  {
    id: 'A1',
    title: '注册 → 首次登录 → onboarding 恢复',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'A2',
    title: '填写档案',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
    humanTask: {
      summary: '确认档案页信息完整、分层清楚，并且整体像专业顾问在理解用户背景。',
      entry: 'Profile 页面',
      steps: [
        '登录 applicant 账号并打开 Profile。',
        '查看基本信息、分数、活动、奖项和目标学校入口。',
        '编辑一个字段后保存，并重新查看页面反馈。',
      ],
      expectedResults: [
        '页面结构清楚，不拥挤，也不显得空洞。',
        '保存反馈自然，字段意义明确。',
        '整体感觉像专业留学服务，不像普通表单后台。',
      ],
      observationPrompts: ['布局合理性', '专业留学中介感'],
    },
  },
  {
    id: 'A3',
    title: 'AI：首次选校推荐',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    humanTask: {
      summary: '判断推荐结果是否像专业顾问给出的分层建议，而不是泛泛的 AI 输出。',
      entry: 'Recommendation / AI 选校入口',
      steps: [
        '进入推荐入口并使用预置 applicant 档案。',
        '查看推荐结果的学校分层和建议说明。',
        '判断推荐是否结合了用户背景和目标。',
      ],
      expectedResults: [
        '结果不是一串无结构学校名。',
        '推荐理由具体、可信、可执行。',
        '整体语气像专业留学顾问，不像模板化机器人。',
      ],
      observationPrompts: ['AI Agent 功能与输出合理性', '专业留学中介感'],
    },
  },
  {
    id: 'A4',
    title: 'AI：文书评审 / 润色',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
  {
    id: 'A5',
    title: 'AI：时间线规划',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
  {
    id: 'A6',
    title: 'AI：5+ 轮多轮对话',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
  {
    id: 'A7',
    title: 'AI：中英文切换',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
  {
    id: 'A8',
    title: 'AI：越界问题',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
  {
    id: 'A9',
    title: 'AI：错误恢复',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality'],
  },
  {
    id: 'A10',
    title: '预测 / 案例库 / 排名',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
    humanTask: {
      summary: '确认预测、案例库和排名页面既有业务价值，也看起来像正式留学顾问产品。',
      entry: 'Prediction / Cases / Ranking',
      steps: [
        '打开预测结果页查看结果区和解释区。',
        '查看案例库列表和至少一条案例。',
        '打开排名或学校结果页查看指标表达方式。',
      ],
      expectedResults: [
        '指标表达清楚，不会让用户误解概率或排名含义。',
        '页面层级稳定，不像拼接出来的内部工具。',
        '整体感觉专业、可信，有顾问型产品的成熟度。',
      ],
      observationPrompts: ['布局合理性', '专业留学中介感'],
    },
  },
  {
    id: 'A11',
    title: '移动端一致性',
    registryStatus: 'active',
    persona: 'applicant',
    platform: 'cross-platform',
    defaultExecutionOwner: 'codex + human',
    validationType: 'experiential',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    notes: [
      '移动端核心运行态与 Android remote push 是两个独立子检查。',
      '如缺少 FCM / google-services.json，A11 应记为外部前置 BLOCKED，而不是启动崩溃。',
      'Android remote push 默认作为 conditional capability gate 跟踪，不自动拖住核心 mobile runtime 放行。',
    ],
    externalPrerequisites: [ANDROID_REMOTE_PUSH_PREREQUISITE],
    humanTask: {
      summary:
        '确认 mobile 与 web 的核心业务信息一致，同时 mobile 自身看起来不像桌面页面被硬缩到手机上。',
      entry: 'Mobile Home / Profile / AI / Schools / Notifications',
      steps: [
        '登录同一 applicant 账号并打开 mobile 核心页面。',
        '对照 web 端的同一用户状态、核心指标和列表结果。',
        '重点查看布局、返回路径、滚动、密度和专业感。',
      ],
      expectedResults: [
        '核心业务语义一致，状态同步可靠。',
        'mobile 页面自然，不挤、不压字、不像 web 缩小版。',
        '整体体验仍像专业留学顾问产品。',
      ],
      observationPrompts: ['Web / Mobile 复用合理性', '布局合理性', '专业留学中介感'],
    },
  },
  {
    id: 'B1',
    title: '家长注册 → 中文界面 → 进度',
    registryStatus: 'inactive',
    persona: 'parent',
    platform: 'web',
    defaultExecutionOwner: 'internal',
    validationType: 'experiential',
    baselineSmoke: false,
    fullAuditDefault: false,
    qualityDimensions: ['consultancy-quality'],
    notes: ['当前产品无 parent persona 入口。'],
  },
  {
    id: 'B2',
    title: '家长 AI：中文问学费 / 签证',
    registryStatus: 'inactive',
    persona: 'parent',
    platform: 'web',
    defaultExecutionOwner: 'internal',
    validationType: 'experiential',
    baselineSmoke: false,
    fullAuditDefault: false,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    notes: ['当前产品无 parent persona 入口。'],
  },
  {
    id: 'B3',
    title: '家长查看选校列表和录取概率',
    registryStatus: 'inactive',
    persona: 'parent',
    platform: 'web',
    defaultExecutionOwner: 'internal',
    validationType: 'experiential',
    baselineSmoke: false,
    fullAuditDefault: false,
    qualityDimensions: ['cross-platform', 'consultancy-quality'],
    notes: ['当前产品无 parent persona 入口。'],
  },
  {
    id: 'C1',
    title: 'admin Dashboard',
    registryStatus: 'active',
    persona: 'admin',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'admin-only',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'C2',
    title: 'AI Operations → LLM Calls',
    registryStatus: 'active',
    persona: 'admin',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'admin-only',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['layout'],
  },
  {
    id: 'C3',
    title: '用户管理 → AI 使用',
    registryStatus: 'active',
    persona: 'admin',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'admin-only',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['layout'],
  },
  {
    id: 'C4',
    title: '内容审核 → 举报处理',
    registryStatus: 'active',
    persona: 'admin',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'admin-only',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'C5',
    title: '学校数据质量',
    registryStatus: 'active',
    persona: 'admin',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'admin-only',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['layout'],
  },
  {
    id: 'SJ-1',
    title: '学校详情 → 学校对比',
    registryStatus: 'temporary-child',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'SJ-2',
    title: 'Web 通知中心 / 通知页',
    registryStatus: 'temporary-child',
    persona: 'applicant',
    platform: 'web',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['layout', 'consultancy-quality'],
    humanTask: {
      summary: '确认 web 通知的文案、层级和动作反馈自然，不打断产品专业感。',
      entry: 'Web 通知中心 / Notifications page',
      steps: [
        '打开通知中心并查看最近通知。',
        '进入通知页并尝试已读、全部已读或删除。',
        '观察未读数、列表状态和文案反馈。',
      ],
      expectedResults: [
        '通知动作反馈清楚、不吵闹。',
        '未读状态和页面内容变化符合直觉。',
        '整体语气和视觉不削弱专业感。',
      ],
      observationPrompts: ['布局合理性', '专业留学中介感'],
    },
  },
  {
    id: 'SJ-3',
    title: 'Mobile 通知页',
    registryStatus: 'temporary-child',
    persona: 'applicant',
    platform: 'cross-platform',
    defaultExecutionOwner: 'codex + human',
    validationType: 'experiential',
    baselineSmoke: false,
    fullAuditDefault: true,
    qualityDimensions: ['cross-platform', 'consultancy-quality'],
    notes: [
      '通知列表/未读数/删除等页面级行为可独立验证。',
      '真 remote push 到达与 notification-open 依赖 Android FCM 配置，缺失时应记外部前置 BLOCKED。',
      'Android remote push 默认作为 conditional capability gate 跟踪，不自动拖住通知页核心页面级验证。',
    ],
    externalPrerequisites: [ANDROID_REMOTE_PUSH_PREREQUISITE],
    humanTask: {
      summary: '确认 mobile 通知列表、未读数、打开后的感受与 web 一致且符合手机通知体验。',
      entry: 'Mobile Notifications',
      steps: [
        '打开 mobile 通知页并查看未读状态。',
        '执行阅读、删除或全部已读。',
        '如本轮包含真机 push，点击通知进入目标页。',
      ],
      expectedResults: [
        '未读数与 web 基本一致。',
        '列表动作反馈自然，没有误导。',
        '打开通知后的感受像正式 app，而不是调试功能。',
      ],
      observationPrompts: ['Web / Mobile 复用合理性', '专业留学中介感'],
    },
  },
  {
    id: 'SJ-4',
    title: 'Admin 创建 MCP key → 外部 MCP 客户端调用工具',
    registryStatus: 'temporary-child',
    persona: 'external',
    platform: 'api+mcp',
    defaultExecutionOwner: 'codex',
    validationType: 'objective',
    baselineSmoke: true,
    fullAuditDefault: true,
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
  },
] as const satisfies readonly JourneyDefinition[];

export type JourneyId = (typeof JOURNEY_REGISTRY)[number]['id'];

export const JOURNEY_IDS = JOURNEY_REGISTRY.map((journey) => journey.id) as JourneyId[];
export const ACTIVE_JOURNEYS = JOURNEY_REGISTRY.filter(
  (journey) => journey.registryStatus !== 'inactive'
);
export const ACTIVE_JOURNEY_IDS = ACTIVE_JOURNEYS.map((journey) => journey.id) as JourneyId[];
export const BASELINE_SMOKE_JOURNEYS = ACTIVE_JOURNEYS.filter((journey) => journey.baselineSmoke);
export const BASELINE_SMOKE_IDS = BASELINE_SMOKE_JOURNEYS.map(
  (journey) => journey.id
) as JourneyId[];
export const FULL_AUDIT_JOURNEYS = ACTIVE_JOURNEYS.filter((journey) => journey.fullAuditDefault);
export const FULL_AUDIT_IDS = FULL_AUDIT_JOURNEYS.map((journey) => journey.id) as JourneyId[];

export function getJourneyDefinition(id: string) {
  return JOURNEY_REGISTRY.find((journey) => journey.id === id);
}

export function getJourneyIds(options?: { activeOnly?: boolean; includeInactive?: boolean }) {
  if (options?.activeOnly) {
    return [...ACTIVE_JOURNEY_IDS];
  }
  if (options?.includeInactive === false) {
    return [...ACTIVE_JOURNEY_IDS];
  }
  return [...JOURNEY_IDS];
}

export function getHumanReviewJourneys(ids: readonly string[]) {
  return ids
    .map((id) => getJourneyDefinition(id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey?.humanTask));
}

export function qualityDimensionLabels(dimensions: readonly QualityDimension[]) {
  return dimensions.map((dimension) => QUALITY_DIMENSION_LABELS[dimension]);
}

export function externalPrerequisiteSummaries(prerequisites?: readonly ExternalPrerequisite[]) {
  return (prerequisites ?? []).map(
    (prerequisite) =>
      `${prerequisite.scope} [${prerequisite.blockingPolicy}]: ${prerequisite.reason} 解锁条件：${prerequisite.unblockAction}`
  );
}
