import {
  BASELINE_SMOKE_IDS,
  type JourneyId,
  QUALITY_DIMENSION_LABELS,
  type QualityDimension,
} from './registry';

export const IMPACT_MAPPING_VERSION = '2026-04-01.v1';

export interface ImpactRule {
  id: string;
  label: string;
  matchers: string[];
  journeys: JourneyId[];
  qualityDimensions: QualityDimension[];
  fullAuditHint?: boolean;
}

export const IMPACT_RULES: readonly ImpactRule[] = [
  {
    id: 'auth-onboarding',
    label: '身份 / 注册 / onboarding',
    matchers: [
      'apps/web/src/app/[locale]/(auth)',
      'apps/api/src/modules/auth',
      'apps/api/src/modules/profile',
    ],
    journeys: ['A1', 'A2', 'A11', 'C1'],
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    fullAuditHint: true,
  },
  {
    id: 'profile-data',
    label: 'Profile / 档案 / 分数 / 目标学校',
    matchers: [
      'apps/web/src/app/[locale]/(main)/profile',
      'apps/mobile/src/app/(tabs)/profile',
      'apps/api/src/modules/profile',
    ],
    journeys: ['A2', 'A3', 'A10', 'A11'],
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
  },
  {
    id: 'ai-core',
    label: 'AI agent 核心编排',
    matchers: [
      'apps/api/src/modules/ai-agent/core',
      'apps/web/src/components/features/agent-chat',
      'apps/mobile/src/app/(tabs)/ai',
    ],
    journeys: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A11', 'SJ-4'],
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    fullAuditHint: true,
  },
  {
    id: 'ai-tools-policy',
    label: 'AI prompt / tool / moderation / MCP free-text',
    matchers: [
      'apps/api/src/modules/ai-agent/tools',
      'apps/api/src/modules/ai-agent/config',
      'apps/api/src/mcp-server.ts',
    ],
    journeys: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'SJ-4', 'C2'],
    qualityDimensions: ['ai-quality', 'consultancy-quality'],
    fullAuditHint: true,
  },
  {
    id: 'prediction-cases-ranking',
    label: '预测 / 案例库 / 排名 / 学校详情',
    matchers: [
      'apps/api/src/modules/prediction',
      'apps/web/src/app/[locale]/(main)/prediction',
      'apps/web/src/app/[locale]/(main)/schools',
      'apps/mobile/src/screens/prediction',
      'apps/mobile/src/app/school',
      'apps/mobile/src/app/find-college',
    ],
    journeys: ['A10', 'SJ-1', 'A11'],
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
  },
  {
    id: 'notifications',
    label: '通知 / 未读数 / push / deep link',
    matchers: [
      'apps/api/src/modules/notification',
      'apps/mobile/src/hooks/useNotifications',
      'apps/mobile/src/app/notifications',
      'apps/web/src/components/notifications',
      'apps/web/src/app/[locale]/(main)/notifications',
    ],
    journeys: ['SJ-2', 'SJ-3', 'A11'],
    qualityDimensions: ['cross-platform', 'consultancy-quality'],
    fullAuditHint: true,
  },
  {
    id: 'mobile-shell',
    label: 'Mobile shell / shared API client / navigation',
    matchers: [
      'apps/mobile/src/lib/api',
      'apps/mobile/src/app/(tabs)',
      'apps/mobile/src/app/_layout',
      'apps/mobile/src/components',
    ],
    journeys: ['A11', 'SJ-3', 'A1', 'A2', 'A3', 'A10'],
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    fullAuditHint: true,
  },
  {
    id: 'admin-shell',
    label: 'Admin shell / analytics / moderation',
    matchers: ['apps/web/src/app/[locale]/(admin)', 'apps/api/src/modules/admin'],
    journeys: ['C1', 'C2', 'C3', 'C4', 'C5', 'SJ-4'],
    qualityDimensions: ['layout'],
  },
  {
    id: 'school-brand-assets',
    label: '学校品牌资产 / 图标 / 图片加载',
    matchers: [
      'apps/mobile/src/lib/schools',
      'apps/mobile/src/components/features/SchoolAvatar',
      'apps/web/src/components/schools',
    ],
    journeys: ['A10', 'SJ-1', 'A11'],
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'home-dashboard',
    label: 'Home / dashboard / quick actions',
    matchers: [
      'apps/mobile/src/app/(tabs)/index',
      'apps/web/src/app/[locale]/(main)/dashboard',
      'apps/web/src/app/[locale]/(main)/home',
    ],
    journeys: ['A10', 'A11', 'A2'],
    qualityDimensions: ['layout', 'consultancy-quality'],
  },
  {
    id: 'i18n-design-system',
    label: 'i18n / design system / global layout',
    matchers: [
      'apps/mobile/src/lib/i18n',
      'apps/web/src/lib/i18n',
      'apps/web/src/app/globals.css',
      'apps/mobile/src/components/ui',
      'apps/web/src/components/ui',
    ],
    journeys: ['A1', 'A2', 'A3', 'A10', 'A11', 'SJ-2', 'SJ-3', 'C1'],
    qualityDimensions: ['layout', 'cross-platform', 'consultancy-quality'],
    fullAuditHint: true,
  },
] as const;

export interface InferredImpactSet {
  impactMappingVersion: string;
  changedFiles: string[];
  matchedRules: ImpactRule[];
  impactedJourneyIds: JourneyId[];
  gateJourneyIds: JourneyId[];
  qualityDimensions: QualityDimension[];
  requiresFullAudit: boolean;
}

function includesMatcher(filePath: string, matcher: string) {
  return filePath.includes(matcher);
}

export function inferImpactSet(changedFiles: readonly string[]): InferredImpactSet {
  const matchedRules = IMPACT_RULES.filter((rule) =>
    changedFiles.some((filePath) =>
      rule.matchers.some((matcher) => includesMatcher(filePath, matcher))
    )
  );

  const impactedJourneyIds = Array.from(
    new Set(matchedRules.flatMap((rule) => rule.journeys))
  ) as JourneyId[];
  const gateJourneyIds = Array.from(
    new Set([...BASELINE_SMOKE_IDS, ...impactedJourneyIds])
  ) as JourneyId[];
  const qualityDimensions = Array.from(
    new Set(matchedRules.flatMap((rule) => rule.qualityDimensions))
  ) as QualityDimension[];
  const requiresFullAudit = matchedRules.some((rule) => rule.fullAuditHint);

  return {
    impactMappingVersion: IMPACT_MAPPING_VERSION,
    changedFiles: [...changedFiles],
    matchedRules,
    impactedJourneyIds,
    gateJourneyIds,
    qualityDimensions,
    requiresFullAudit,
  };
}

export function formatQualityDimensions(dimensions: readonly QualityDimension[]) {
  return dimensions.map((dimension) => QUALITY_DIMENSION_LABELS[dimension]);
}
