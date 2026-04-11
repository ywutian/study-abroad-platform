import fs from 'node:fs';
import path from 'node:path';

import {
  ACTIVE_JOURNEY_IDS,
  getJourneyDefinition,
  JOURNEY_REGISTRY_VERSION,
  QUALITY_DIMENSION_LABELS,
  type ExecutionOwner,
  type ExternalPrerequisite,
  type QualityDimension,
  type ValidationType,
} from './registry';

const ROOT = process.cwd();
const WEB_APP_ROOT = path.join(ROOT, 'apps', 'web', 'src', 'app');
const MOBILE_APP_ROOT = path.join(ROOT, 'apps', 'mobile', 'src', 'app');

export const FULL_SURFACE_REGISTRY_VERSION = '2026-04-10.v3';

export const FULL_SURFACE_QUALITY_DIMENSIONS = [
  'layout',
  'ai-quality',
  'cross-platform',
  'consultancy-quality',
] as const satisfies readonly QualityDimension[];

export type SurfaceType = 'route' | 'capability' | 'journey';
export type SurfacePlatform = 'web' | 'mobile' | 'api' | 'mcp' | 'cross-platform';
export type SurfacePersona = 'guest' | 'applicant' | 'admin' | 'external' | 'shared' | 'inactive';
export type AgentBundleId =
  | 'batch-0-inventory-triage'
  | 'batch-1-applicant-web-auth'
  | 'batch-2-applicant-ai-business'
  | 'batch-3-mobile'
  | 'batch-4-admin-data-security-mcp'
  | 'batch-5-forced-closure';

export interface SurfaceEvidenceRequirement {
  key: string;
  description: string;
}

export interface RouteShellArtifact {
  relativePath: string;
  shellType: 'layout' | 'loading' | 'error' | 'not-found' | 'default';
  scope: 'root' | 'ancestor' | 'local';
}

export interface RouteMetadata {
  sourcePath: string;
  routeTemplate: string;
  routeGroups: string[];
  dynamicSegments: string[];
  authBoundary: 'public' | 'auth' | 'protected' | 'admin';
  supportingShells: RouteShellArtifact[];
  standaloneCounted: boolean;
}

export interface BaseSurfaceDefinition {
  surfaceId: string;
  surfaceType: SurfaceType;
  platform: SurfacePlatform;
  persona: SurfacePersona;
  routeOrEntry: string;
  executionOwner: ExecutionOwner;
  validationType: ValidationType;
  agentBundle: AgentBundleId;
  qualityDimensions: QualityDimension[];
  externalPrerequisites: ExternalPrerequisite[];
  evidenceRequirements: SurfaceEvidenceRequirement[];
  reuseTags: string[];
  lastVerifiedTemplate: string;
}

export interface RouteSurfaceDefinition extends BaseSurfaceDefinition {
  surfaceType: 'route';
  routeMetadata: RouteMetadata;
}

export interface CapabilitySurfaceDefinition extends BaseSurfaceDefinition {
  surfaceType: 'capability';
  description: string;
  linkedJourneyIds: string[];
}

export interface JourneyOverlaySurfaceDefinition extends BaseSurfaceDefinition {
  surfaceType: 'journey';
  journeyId: string;
  description: string;
}

export interface FullSurfaceRegistry {
  version: string;
  journeyRegistryVersion: string;
  generatedAt: string;
  routeInventory: {
    web: RouteSurfaceDefinition[];
    mobile: RouteSurfaceDefinition[];
  };
  capabilityInventory: CapabilitySurfaceDefinition[];
  journeyOverlay: JourneyOverlaySurfaceDefinition[];
  counts: {
    webStandaloneRoutes: number;
    mobileStandaloneRoutes: number;
    webShellArtifacts: number;
    mobileShellArtifacts: number;
    capabilityEntries: number;
    journeyOverlayEntries: number;
    totalSurfaceEntries: number;
  };
}

export const AGENT_BUNDLE_DEFINITIONS: Record<
  AgentBundleId,
  {
    label: string;
    agents: string[];
    defaultScope: string;
  }
> = {
  'batch-0-inventory-triage': {
    label: 'Batch 0：Inventory & Triage',
    agents: ['feedback-processor', 'integration-checker', 'user-journey-auditor'],
    defaultScope: 'inventory / triage',
  },
  'batch-1-applicant-web-auth': {
    label: 'Batch 1：Applicant Web + Auth',
    agents: ['design-reviewer', 'i18n-specialist', 'applicant-simulator', 'test-engineer'],
    defaultScope: 'web / auth',
  },
  'batch-2-applicant-ai-business': {
    label: 'Batch 2：Applicant AI + 留学业务',
    agents: ['ai-prompt-engineer', 'study-abroad-expert', 'applicant-simulator', 'test-engineer'],
    defaultScope: 'prediction / recommendation / ai',
  },
  'batch-3-mobile': {
    label: 'Batch 3：Mobile 全面检查',
    agents: [
      'mobile-specialist',
      'design-reviewer',
      'i18n-specialist',
      'applicant-simulator',
      'test-engineer',
    ],
    defaultScope: 'mobile',
  },
  'batch-4-admin-data-security-mcp': {
    label: 'Batch 4：Admin / Data / Security / MCP',
    agents: [
      'architect',
      'data-model-reviewer',
      'security-reviewer',
      'design-reviewer',
      'test-engineer',
    ],
    defaultScope: 'admin / security / mcp',
  },
  'batch-5-forced-closure': {
    label: 'Batch 5：强制闭环',
    agents: ['integration-checker', 'test-engineer', 'user-journey-auditor'],
    defaultScope: 'closure',
  },
};

const MOBILE_REMOTE_PUSH_PREREQUISITE =
  getJourneyDefinition('SJ-3')?.externalPrerequisites?.[0] ??
  getJourneyDefinition('A11')?.externalPrerequisites?.[0];

function walkFiles(rootDir: string, predicate: (filePath: string) => boolean) {
  const results: string[] = [];
  const visit = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const nextPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
        continue;
      }
      if (predicate(nextPath)) {
        results.push(nextPath);
      }
    }
  };

  visit(rootDir);
  return results.sort();
}

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join('/');
}

function isRouteGroup(segment: string) {
  return segment.startsWith('(') && segment.endsWith(')');
}

function normalizeWebRoute(relativePagePath: string) {
  const normalizedPagePath = toPosix(relativePagePath)
    .replace(/^page\.tsx$/, '')
    .replace(/\/page\.tsx$/, '');
  const segments = normalizedPagePath.split('/').filter(Boolean);
  const publicSegments = segments.filter((segment) => !isRouteGroup(segment));
  const routeTemplate =
    '/' +
    publicSegments
      .map((segment) => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          if (segment.startsWith('[...') && segment.endsWith(']')) {
            return `:${segment.slice(4, -1)}*`;
          }
          return `:${segment.slice(1, -1)}`;
        }
        return segment;
      })
      .join('/');
  return routeTemplate === '/' ? '/' : routeTemplate.replace(/\/+/g, '/');
}

function normalizeMobileRoute(relativePath: string) {
  const segments = toPosix(relativePath)
    .replace(/\.tsx$/, '')
    .split('/')
    .filter(Boolean);
  const publicSegments = segments.filter((segment) => !isRouteGroup(segment));
  const routeTemplate =
    '/' +
    publicSegments
      .map((segment) => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return `:${segment.slice(1, -1)}`;
        }
        if (segment === 'index') return '';
        return segment;
      })
      .filter(Boolean)
      .join('/');
  return routeTemplate === '/' ? '/' : routeTemplate.replace(/\/+/g, '/');
}

function supportingShells(rootDir: string, sourceRelativePath: string) {
  const shellNames = new Set([
    'layout.tsx',
    '_layout.tsx',
    'loading.tsx',
    'error.tsx',
    'not-found.tsx',
    'default.tsx',
  ]);
  const relativeDir = path.dirname(sourceRelativePath);
  const segments = relativeDir === '.' ? [] : toPosix(relativeDir).split('/');
  const collected: RouteShellArtifact[] = [];

  for (let index = 0; index <= segments.length; index += 1) {
    const currentSegments = segments.slice(0, index);
    const currentRelativeDir = currentSegments.length === 0 ? '' : currentSegments.join('/');
    const absoluteDir = path.join(rootDir, currentRelativeDir);
    if (!fs.existsSync(absoluteDir)) continue;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isFile() || !shellNames.has(entry.name)) continue;
      const relativePath = toPosix(path.join(currentRelativeDir, entry.name));
      const shellType =
        entry.name === 'layout.tsx' || entry.name === '_layout.tsx'
          ? 'layout'
          : entry.name === 'loading.tsx'
            ? 'loading'
            : entry.name === 'error.tsx'
              ? 'error'
              : entry.name === 'not-found.tsx'
                ? 'not-found'
                : 'default';
      collected.push({
        relativePath,
        shellType,
        scope: index === 0 ? 'root' : index === segments.length ? 'local' : 'ancestor',
      });
    }
  }

  return collected.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function dynamicSegments(routeTemplate: string) {
  return routeTemplate
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.replace(/[:*]/g, ''));
}

function defaultEvidenceRequirements(platform: 'web' | 'mobile'): SurfaceEvidenceRequirement[] {
  const base = [
    { key: 'entry-screenshot', description: '进入态截图' },
    { key: 'result-screenshot', description: '结果态截图' },
    { key: 'quality-summary', description: '四个质量维度中的相关判断摘要' },
  ];

  if (platform === 'mobile') {
    return [...base, { key: 'navigation-proof', description: '返回、滚动或深链行为摘录' }];
  }

  return [
    ...base,
    { key: 'network-or-console', description: '必要时记录稳定的 console / network 异常摘录' },
  ];
}

function capabilityEvidenceRequirements(): SurfaceEvidenceRequirement[] {
  return [
    { key: 'preconditions', description: '前置条件和运行账号' },
    { key: 'action-proof', description: '真实操作和关键输入摘要' },
    { key: 'result-proof', description: '结果截图或关键响应摘录' },
    { key: 'quality-summary', description: '相关质量维度结论' },
  ];
}

function classifyWebPersona(routeTemplate: string, sourcePath: string): SurfacePersona {
  if (sourcePath.includes('/admin/')) return 'admin';
  if (sourcePath.includes('/(auth)/')) return 'guest';
  if (
    routeTemplate === '/' ||
    routeTemplate.startsWith('/:locale/about') ||
    routeTemplate.startsWith('/:locale/help') ||
    routeTemplate.startsWith('/:locale/privacy') ||
    routeTemplate.startsWith('/:locale/terms')
  ) {
    return 'shared';
  }
  return 'applicant';
}

function classifyMobilePersona(routeTemplate: string) {
  if (routeTemplate === '/admin') return 'admin' as const;
  if (
    routeTemplate.startsWith('/login') ||
    routeTemplate.startsWith('/register') ||
    routeTemplate.startsWith('/forgot-password')
  ) {
    return 'guest' as const;
  }
  return 'applicant' as const;
}

function routeValidationType(persona: SurfacePersona, platform: 'web' | 'mobile'): ValidationType {
  if (persona === 'admin') return 'admin-only';
  if (platform === 'mobile') return 'experiential';
  return 'objective';
}

function routeExecutionOwner(persona: SurfacePersona, platform: 'web' | 'mobile'): ExecutionOwner {
  if (persona === 'admin') return 'codex';
  if (platform === 'mobile') return 'codex + human';
  return 'codex';
}

function routeAgentBundle(
  platform: 'web' | 'mobile',
  routeTemplate: string,
  persona: SurfacePersona
): AgentBundleId {
  if (platform === 'mobile') return 'batch-3-mobile';
  if (persona === 'admin') return 'batch-4-admin-data-security-mcp';
  if (
    routeTemplate.includes('/prediction') ||
    routeTemplate.includes('/ai') ||
    routeTemplate.includes('/chat') ||
    routeTemplate.includes('/timeline') ||
    routeTemplate.includes('/schools') ||
    routeTemplate.includes('/assessment') ||
    routeTemplate.includes('/essays')
  ) {
    return 'batch-2-applicant-ai-business';
  }
  return 'batch-1-applicant-web-auth';
}

function routeQualityDimensions(
  platform: 'web' | 'mobile',
  routeTemplate: string,
  persona: SurfacePersona
): QualityDimension[] {
  const dimensions = new Set<QualityDimension>(['layout']);
  const isApplicantOrShared =
    persona === 'applicant' || persona === 'shared' || persona === 'guest';
  const aiHeavyRoute =
    routeTemplate.includes('/ai') ||
    routeTemplate.includes('/prediction') ||
    routeTemplate.includes('/profile/analysis') ||
    routeTemplate.includes('/timeline') ||
    routeTemplate.includes('/chat') ||
    routeTemplate.includes('/assessment') ||
    routeTemplate.includes('/schools') ||
    routeTemplate.includes('/essays');

  if (platform === 'mobile') {
    dimensions.add('cross-platform');
  }

  if (aiHeavyRoute) {
    dimensions.add('ai-quality');
  }

  if (isApplicantOrShared) {
    dimensions.add('consultancy-quality');
  }

  return [...dimensions];
}

function routeAuthBoundary(persona: SurfacePersona): RouteMetadata['authBoundary'] {
  if (persona === 'admin') return 'admin';
  if (persona === 'guest') return 'auth';
  if (persona === 'shared') return 'public';
  return 'protected';
}

function routeReuseTags(
  platform: 'web' | 'mobile',
  routeTemplate: string,
  metadata: RouteMetadata,
  persona: SurfacePersona
) {
  const tags = new Set<string>([
    `${platform}-route`,
    persona,
    metadata.dynamicSegments.length > 0 ? 'dynamic-route' : 'static-route',
  ]);

  if (routeTemplate.includes('/prediction') || routeTemplate.includes('/schools')) {
    tags.add('prediction-recommendation');
  }
  if (routeTemplate.includes('/notifications')) tags.add('notification-surface');
  if (routeTemplate.includes('/ai') || routeTemplate.includes('/chat')) tags.add('ai-surface');
  if (metadata.supportingShells.length > 0) tags.add('has-shell-artifacts');
  return [...tags];
}

function buildWebRouteSurface(filePath: string): RouteSurfaceDefinition {
  const relativePath = toPosix(path.relative(WEB_APP_ROOT, filePath));
  const routeTemplate = normalizeWebRoute(relativePath);
  const persona = classifyWebPersona(routeTemplate, relativePath);
  const metadata: RouteMetadata = {
    sourcePath: `apps/web/src/app/${relativePath}`,
    routeTemplate,
    routeGroups: relativePath.split('/').filter(isRouteGroup),
    dynamicSegments: dynamicSegments(routeTemplate),
    authBoundary: routeAuthBoundary(persona),
    supportingShells: supportingShells(WEB_APP_ROOT, relativePath),
    standaloneCounted: true,
  };

  return {
    surfaceId: `WEB_ROUTE:${routeTemplate}`,
    surfaceType: 'route',
    platform: 'web',
    persona,
    routeOrEntry: routeTemplate,
    executionOwner: routeExecutionOwner(persona, 'web'),
    validationType: routeValidationType(persona, 'web'),
    agentBundle: routeAgentBundle('web', routeTemplate, persona),
    qualityDimensions: routeQualityDimensions('web', routeTemplate, persona),
    externalPrerequisites: [],
    evidenceRequirements: defaultEvidenceRequirements('web'),
    reuseTags: routeReuseTags('web', routeTemplate, metadata, persona),
    lastVerifiedTemplate: 'docs/templates/full-surface-route-check.md',
    routeMetadata: metadata,
  };
}

function buildMobileRouteSurface(filePath: string): RouteSurfaceDefinition {
  const relativePath = toPosix(path.relative(MOBILE_APP_ROOT, filePath));
  const routeTemplate = normalizeMobileRoute(relativePath);
  const persona = classifyMobilePersona(routeTemplate);
  const metadata: RouteMetadata = {
    sourcePath: `apps/mobile/src/app/${relativePath}`,
    routeTemplate,
    routeGroups: relativePath.split('/').filter(isRouteGroup),
    dynamicSegments: dynamicSegments(routeTemplate),
    authBoundary: routeAuthBoundary(persona),
    supportingShells: supportingShells(MOBILE_APP_ROOT, relativePath),
    standaloneCounted: !relativePath.endsWith('_layout.tsx'),
  };

  return {
    surfaceId: `MOBILE_ROUTE:${routeTemplate}`,
    surfaceType: 'route',
    platform: 'mobile',
    persona,
    routeOrEntry: routeTemplate,
    executionOwner: routeExecutionOwner(persona, 'mobile'),
    validationType: routeValidationType(persona, 'mobile'),
    agentBundle: routeAgentBundle('mobile', routeTemplate, persona),
    qualityDimensions: routeQualityDimensions('mobile', routeTemplate, persona),
    externalPrerequisites:
      MOBILE_REMOTE_PUSH_PREREQUISITE && routeTemplate.includes('/notifications')
        ? [MOBILE_REMOTE_PUSH_PREREQUISITE]
        : [],
    evidenceRequirements: defaultEvidenceRequirements('mobile'),
    reuseTags: routeReuseTags('mobile', routeTemplate, metadata, persona),
    lastVerifiedTemplate: 'docs/templates/full-surface-route-check.md',
    routeMetadata: metadata,
  };
}

function discoverWebRoutes() {
  return walkFiles(WEB_APP_ROOT, (filePath) => filePath.endsWith(`${path.sep}page.tsx`)).map(
    buildWebRouteSurface
  );
}

function discoverMobileRoutes() {
  return walkFiles(MOBILE_APP_ROOT, (filePath) => filePath.endsWith('.tsx')).map(
    buildMobileRouteSurface
  );
}

const CAPABILITY_DEFINITIONS: CapabilitySurfaceDefinition[] = [
  {
    surfaceId: 'CAPABILITY:AUTH_SESSION',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'shared',
    routeOrEntry: '登录 / 刷新 / 过期恢复 / 登出',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-1-applicant-web-auth',
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['auth', 'session', 'baseline-smoke'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证登录、刷新、过期恢复、登出和鉴权回跳。',
    linkedJourneyIds: ['A1'],
  },
  {
    surfaceId: 'CAPABILITY:ONBOARDING_RECOVERY',
    surfaceType: 'capability',
    platform: 'web',
    persona: 'applicant',
    routeOrEntry: '注册 / dashboard onboarding 补偿',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-1-applicant-web-auth',
    qualityDimensions: ['layout', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['onboarding', 'compensation'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证首次 onboarding 成功、失败补偿和恢复行为。',
    linkedJourneyIds: ['A1'],
  },
  {
    surfaceId: 'CAPABILITY:PROFILE_CRUD',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'Profile / 档案编辑',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-1-applicant-web-auth',
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['profile', 'crud', 'cross-platform'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description:
      '验证 profile 各模块 CRUD、回显和跨端语义一致；mobile 对齐由 route surfaces 单独落证据。',
    linkedJourneyIds: ['A2'],
  },
  {
    surfaceId: 'CAPABILITY:PREDICTION_RUN',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'Prediction / 学校详情 / 历史',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['layout', 'ai-quality', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['prediction', 'consultancy', 'cross-platform'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description:
      '验证预测生成、历史、区间解释和学校整体数据与个人预估的区分；mobile prediction 对齐由 route surfaces 单独落证据。',
    linkedJourneyIds: ['A10', 'SJ-1'],
  },
  {
    surfaceId: 'CAPABILITY:APPLICATION_ANALYSIS',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'Application analysis / profile strategy',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['layout', 'ai-quality', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['application-analysis', 'strategy', 'profile', 'cross-platform'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description:
      '验证 canonical `/profiles/me/ai-analysis` 在 web Profile / uncommon-app 与 mobile `/profile`、`/profile/analysis`、`/prediction` CTA 上保持同一结构化策略语义、弱态和 school-aware policy context。',
    linkedJourneyIds: ['A2', 'A10', 'A11'],
  },
  {
    surfaceId: 'CAPABILITY:RECOMMENDATION_GENERATE',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'Recommendation / school recommendation cards',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['layout', 'ai-quality', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['recommendation', 'school-fit', 'consultancy'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证推荐结果、分层表达和顾问式解释。',
    linkedJourneyIds: ['A3'],
  },
  {
    surfaceId: 'CAPABILITY:AI_CHAT_MULTI_TURN',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'AI chat / applicant agent',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['ai-quality', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['ai-chat', 'memory', 'streaming'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证多轮对话、记忆保持和真实顾问输出。',
    linkedJourneyIds: ['A6'],
  },
  {
    surfaceId: 'CAPABILITY:AI_LANGUAGE_SWITCH',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'AI bilingual behavior',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['ai', 'bilingual', 'i18n'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证 AI 中英文切换与术语一致性。',
    linkedJourneyIds: ['A7'],
  },
  {
    surfaceId: 'CAPABILITY:AI_GUARDRAIL',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'AI guardrails / 越界问题',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['ai', 'safety', 'guardrail'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证越界问题的拒答与安全边界。',
    linkedJourneyIds: ['A8'],
  },
  {
    surfaceId: 'CAPABILITY:AI_TOOL_FAILURE_RECOVERY',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'AI error recovery',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['ai-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['ai', 'recovery', 'tool-failure'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证工具失败和错误恢复链。',
    linkedJourneyIds: ['A9'],
  },
  {
    surfaceId: 'CAPABILITY:NOTIFICATION_WEB_SYNC',
    surfaceType: 'capability',
    platform: 'web',
    persona: 'applicant',
    routeOrEntry: 'Web notifications',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-1-applicant-web-auth',
    qualityDimensions: ['layout', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['notifications', 'web', 'sync'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证 web 通知列表、未读数、删除与已读。',
    linkedJourneyIds: ['SJ-2'],
  },
  {
    surfaceId: 'CAPABILITY:NOTIFICATION_MOBILE_SYNC',
    surfaceType: 'capability',
    platform: 'mobile',
    persona: 'applicant',
    routeOrEntry: 'Mobile notifications + remote push',
    executionOwner: 'codex + human',
    validationType: 'experiential',
    agentBundle: 'batch-3-mobile',
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: MOBILE_REMOTE_PUSH_PREREQUISITE ? [MOBILE_REMOTE_PUSH_PREREQUISITE] : [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['notifications', 'mobile', 'push', 'conditional-gate'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证 mobile 通知列表、未读同步、删除与 remote push/open 行为。',
    linkedJourneyIds: ['A11', 'SJ-3'],
  },
  {
    surfaceId: 'CAPABILITY:SCHOOL_COMPARE',
    surfaceType: 'capability',
    platform: 'web',
    persona: 'applicant',
    routeOrEntry: 'School compare',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-2-applicant-ai-business',
    qualityDimensions: ['layout', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['schools', 'compare'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证学校对比入口、指标语义和页面结果。',
    linkedJourneyIds: ['SJ-1'],
  },
  {
    surfaceId: 'CAPABILITY:MCP_KEY_AND_TOOL_CALL',
    surfaceType: 'capability',
    platform: 'mcp',
    persona: 'external',
    routeOrEntry: 'Admin MCP key + external tool call',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-4-admin-data-security-mcp',
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['mcp', 'external-integration', 'security'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证 MCP key 创建、tools/list、无参、有参、异常 key 和安全路径。',
    linkedJourneyIds: ['SJ-4'],
  },
  {
    surfaceId: 'CAPABILITY:PAYMENT_SUBSCRIPTION_ENTRY',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'shared',
    routeOrEntry: 'Subscription / billing entry',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-4-admin-data-security-mcp',
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['payments', 'subscription'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证订阅入口、plan 文案和支付前置页面。',
    linkedJourneyIds: [],
  },
  {
    surfaceId: 'CAPABILITY:RESUME_IMPORT_EXPORT',
    surfaceType: 'capability',
    platform: 'cross-platform',
    persona: 'applicant',
    routeOrEntry: 'Resume import/export',
    executionOwner: 'codex',
    validationType: 'objective',
    agentBundle: 'batch-1-applicant-web-auth',
    qualityDimensions: ['layout', 'consultancy-quality'],
    externalPrerequisites: [],
    evidenceRequirements: capabilityEvidenceRequirements(),
    reuseTags: ['resume', 'import-export'],
    lastVerifiedTemplate: 'docs/templates/full-surface-capability-check.md',
    description: '验证 resume 页面、导入导出和结果反馈。',
    linkedJourneyIds: [],
  },
];

function buildJourneyOverlay() {
  return ACTIVE_JOURNEY_IDS.map((id) => {
    const journey = getJourneyDefinition(id);
    if (!journey) {
      throw new Error(`Missing journey definition for ${id}`);
    }
    return {
      surfaceId: `JOURNEY:${journey.id}`,
      surfaceType: 'journey',
      platform:
        journey.platform === 'api+mcp'
          ? 'mcp'
          : journey.platform === 'cross-platform'
            ? 'cross-platform'
            : journey.platform,
      persona:
        journey.registryStatus === 'inactive'
          ? 'inactive'
          : journey.persona === 'external'
            ? 'external'
            : journey.persona,
      routeOrEntry: journey.title,
      executionOwner: journey.defaultExecutionOwner,
      validationType: journey.validationType,
      agentBundle:
        journey.platform === 'mobile' || journey.platform === 'cross-platform'
          ? 'batch-3-mobile'
          : journey.persona === 'admin' || journey.platform === 'api+mcp'
            ? 'batch-4-admin-data-security-mcp'
            : journey.id.startsWith('A3') ||
                ['A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'SJ-1'].includes(journey.id)
              ? 'batch-2-applicant-ai-business'
              : 'batch-1-applicant-web-auth',
      qualityDimensions: journey.qualityDimensions,
      externalPrerequisites: journey.externalPrerequisites ?? [],
      evidenceRequirements: capabilityEvidenceRequirements(),
      reuseTags: [
        'journey-overlay',
        journey.registryStatus,
        journey.baselineSmoke ? 'baseline-smoke' : 'non-baseline',
      ],
      lastVerifiedTemplate: 'docs/templates/user-journey-audit.md',
      journeyId: journey.id,
      description: journey.title,
    } satisfies JourneyOverlaySurfaceDefinition;
  });
}

export function buildFullSurfaceRegistry(): FullSurfaceRegistry {
  const webRoutes = discoverWebRoutes();
  const mobileRoutes = discoverMobileRoutes().filter(
    (route) => route.routeMetadata.standaloneCounted
  );
  const mobileShellArtifacts = discoverMobileRoutes()
    .filter((route) => !route.routeMetadata.standaloneCounted)
    .flatMap((route) => route.routeMetadata.supportingShells);

  const allWebShells = webRoutes.flatMap((route) => route.routeMetadata.supportingShells);
  const journeyOverlay = buildJourneyOverlay();

  return {
    version: FULL_SURFACE_REGISTRY_VERSION,
    journeyRegistryVersion: JOURNEY_REGISTRY_VERSION,
    generatedAt: new Date().toISOString(),
    routeInventory: {
      web: webRoutes,
      mobile: mobileRoutes,
    },
    capabilityInventory: CAPABILITY_DEFINITIONS,
    journeyOverlay,
    counts: {
      webStandaloneRoutes: webRoutes.length,
      mobileStandaloneRoutes: mobileRoutes.length,
      webShellArtifacts: new Set(allWebShells.map((artifact) => artifact.relativePath)).size,
      mobileShellArtifacts: new Set(mobileShellArtifacts.map((artifact) => artifact.relativePath))
        .size,
      capabilityEntries: CAPABILITY_DEFINITIONS.length,
      journeyOverlayEntries: journeyOverlay.length,
      totalSurfaceEntries:
        webRoutes.length +
        mobileRoutes.length +
        CAPABILITY_DEFINITIONS.length +
        journeyOverlay.length,
    },
  };
}

export function qualityDimensionChineseLabels(dimensions: readonly QualityDimension[]) {
  return dimensions.map((dimension) => QUALITY_DIMENSION_LABELS[dimension]);
}
