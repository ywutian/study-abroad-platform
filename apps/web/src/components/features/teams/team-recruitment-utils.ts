import {
  getCompetitionTrackLabel,
  getRecruitmentContext,
  getRecruitmentContextName,
  type MatchPoolEntryDto,
  type RecruitmentContextItemDto,
  type TeamMatchInviteResultDto,
  type TeamRecruitmentCardFrontDto,
} from '@study-abroad/shared';

export interface CurrentMemberDisplaySettings {
  introLine: string;
  selectedResumeId: string;
  showSchool: boolean;
  showGrade: boolean;
  showAwards: boolean;
  showAcademics: boolean;
  showExperiences: boolean;
  showPersonality: boolean;
}

export function getCurrentMemberDisplaySettings(
  card: TeamRecruitmentCardFrontDto | null | undefined,
  userId: string | null | undefined
): CurrentMemberDisplaySettings {
  const member = card?.members.find((entry) => entry.userId === userId);

  return {
    introLine: member?.introLine ?? '',
    selectedResumeId: member?.resume?.id ?? 'none',
    showSchool: member?.showSchool ?? false,
    showGrade: member?.showGrade ?? false,
    showAwards: member?.showAwards ?? false,
    showAcademics: member?.showAcademics ?? false,
    showExperiences: member?.showExperiences ?? false,
    showPersonality: member?.showPersonality ?? false,
  };
}

export function getInviteDeliveryState(result: TeamMatchInviteResultDto) {
  if (result.status === 'ALREADY_MEMBER') {
    return 'already_member' as const;
  }
  if (!result.notificationSent) {
    return 'manual_share' as const;
  }
  return result.status === 'EXISTING_PENDING' ? ('existing_pending' as const) : ('sent' as const);
}

type ContextSource =
  | RecruitmentContextItemDto
  | Pick<TeamRecruitmentCardFrontDto, 'recruitmentContext' | 'context'>
  | null
  | undefined;

function resolveContext(value: ContextSource): RecruitmentContextItemDto | null {
  if (!value) return null;
  if ('recruitmentContext' in value || 'context' in value) {
    return getRecruitmentContext(
      value as Pick<TeamRecruitmentCardFrontDto, 'recruitmentContext' | 'context'>
    );
  }
  return value as RecruitmentContextItemDto;
}

/**
 * Primary line for a recruitment context. Without `locale`, keeps legacy web order
 * (trackName → name → title) for backward compatibility. With `locale`, delegates to shared
 * bilingual title logic (titleZh for zh, etc.).
 */
export function getRecruitmentContextLabel(value: ContextSource, locale?: string): string {
  const context = resolveContext(value);
  if (!context) return '';
  if (locale != null && locale !== '') {
    return getRecruitmentContextName(context, locale);
  }
  return context.trackName || context.name || context.title || '';
}

export function getRecruitmentContextMeta(value: ContextSource, locale?: string): string {
  const context = resolveContext(value);
  if (!context) return '';

  const compPart = context.competition
    ? getCompetitionTrackLabel(context.competition, locale ?? null)
    : '';
  const season = context.edition?.seasonLabel;
  if (compPart || season) {
    return [compPart, season].filter(Boolean).join(' / ');
  }

  const extendedContext = context as RecruitmentContextItemDto & {
    subtitle?: string | null;
    locationText?: string | null;
  };

  return extendedContext.subtitle ?? extendedContext.locationText ?? '';
}

const MODERATION_STATUS_KEY_MAP: Record<string, string> = {
  PENDING_REVIEW: 'pendingReview',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/** Maps API moderation enum to `teams` → `recruitment.moderationStatus.*` (see messages). */
export function getRecruitmentModerationLabel(
  status: string | null | undefined,
  t: (key: string) => string
): string {
  if (!status) return '';
  const suffix = MODERATION_STATUS_KEY_MAP[status];
  return suffix ? t(`recruitment.moderationStatus.${suffix}`) : status;
}

const SOURCE_TYPE_KEY_MAP: Record<string, string> = {
  OFFICIAL: 'official',
  COMMUNITY: 'community',
};

export function getRecruitmentContextSourceTypeLabel(
  sourceType: string | null | undefined,
  t: (key: string) => string
): string {
  if (!sourceType) return '';
  const suffix = SOURCE_TYPE_KEY_MAP[sourceType];
  return suffix ? t(`recruitment.contextSourceType.${suffix}`) : sourceType;
}

/** Pool entry row in selects: competition track or promoted context title. */
export function getMatchPoolEntrySelectLabel(entry: MatchPoolEntryDto, locale: string): string {
  if (entry.competition) {
    const part = getCompetitionTrackLabel(entry.competition, locale);
    return part || entry.id;
  }
  if (entry.recruitmentContext) {
    return getRecruitmentContextName(entry.recruitmentContext, locale) || entry.id;
  }
  return entry.id;
}

export function isCommunityRecruitmentContext(value: ContextSource) {
  return resolveContext(value)?.sourceType === 'COMMUNITY';
}
