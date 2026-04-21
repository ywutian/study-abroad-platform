export type AvailabilityBand =
  | 'LESS_THAN_5_HOURS'
  | 'FIVE_TO_TEN_HOURS'
  | 'TEN_PLUS_HOURS'
  | 'WEEKENDS_ONLY';

export type CollaborationMode = 'ONLINE' | 'OFFLINE' | 'HYBRID';

export type IntentMode = 'TEAM_UP' | 'NETWORKING_ONLY';

export type TeamRecruitmentPhase = 'DRAFT' | 'PUBLISHED';

export type TeamRecruitmentStatus = 'LOOKING' | 'ALMOST_FULL' | 'NETWORKING_ONLY' | 'CLOSED';

export type TeamMatchKind = 'TEAM_UP' | 'NETWORKING';

export type ModerationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | (string & {});

export type RecruitmentVisibility = 'PUBLIC' | 'PRIVATE' | (string & {});

export type RecruitmentContextSourceType = 'OFFICIAL' | 'COMMUNITY' | (string & {});

export interface RecruitmentCompetitionDto {
  id: string;
  name: string;
  nameZh?: string | null;
  abbreviation: string;
  category: string;
  tier?: number;
}

export interface RecruitmentEditionDto {
  id: string;
  seasonLabel: string;
  status: string;
  registrationOpenAt?: string | Date | null;
  registrationCloseAt?: string | Date | null;
  eventStartAt?: string | Date | null;
  eventEndAt?: string | Date | null;
}

export interface RecruitmentContextItemDto {
  id: string;
  name: string;
  title?: string;
  titleZh?: string | null;
  subtitle?: string | null;
  description?: string | null;
  sourceType?: RecruitmentContextSourceType;
  moderationStatus?: ModerationStatus | null;
  rolePresets: string[];
  minTeamSize: number;
  maxTeamSize: number;
  languages: string[];
  isActive: boolean;
  isPublished?: boolean;
  sourceUrl?: string | null;
  competitionId?: string | null;
  edition?: RecruitmentEditionDto | null;
  competition?: RecruitmentCompetitionDto | null;
  legacyCompetitionTrackId?: string | null;
  legacyCompetitionTrackName?: string | null;

  // Backward compatibility for older clients still reading `context.trackId/trackName`.
  trackId?: string;
  trackName?: string;
  seasonLabel?: string;
  locationMode?: CollaborationMode | null;
  locationText?: string | null;
  registrationCloseAt?: string | Date | null;
  eventStartAt?: string | Date | null;
  eventEndAt?: string | Date | null;
  createdById?: string | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RecruitmentContextDto {
  items: RecruitmentContextItemDto[];
}

export interface MatchPoolEntryDto {
  id: string;
  entryType: 'OFFICIAL_COMPETITION' | 'PROMOTED_COMMUNITY_CONTEXT' | (string & {});
  sortOrder?: number;
  competitionId?: string | null;
  recruitmentContextId?: string | null;
  competition?: RecruitmentCompetitionDto | null;
  recruitmentContext?: RecruitmentContextItemDto | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface MatchPoolDto {
  id: string;
  name: string;
  description?: string | null;
  nameZh?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  entries?: MatchPoolEntryDto[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CommunityRecruitmentContextDto {
  id: string;
  name: string;
  title?: string;
  titleZh?: string | null;
  subtitle?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  moderationStatus?: ModerationStatus | null;
  rolePresets: string[];
  minTeamSize: number;
  maxTeamSize: number;
  languages: string[];
  isPublished?: boolean;
  isActive?: boolean;
  locationMode?: CollaborationMode | null;
  locationText?: string | null;
  registrationCloseAt?: string | Date | null;
  eventStartAt?: string | Date | null;
  eventEndAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface TeamRecruitmentMemberDto {
  userId: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  verificationRole?: string;
  verificationLevel?: 'admin' | 'verified' | 'email' | 'unverified';
  introLine?: string | null;
  showSchool?: boolean;
  showGrade?: boolean;
  showAwards?: boolean;
  school?: string | null;
  grade?: string | null;
  targetMajor?: string | null;
  consentConfirmedAt?: string | Date | null;
  resume?: {
    id: string;
    title: string;
    updatedAt: string | Date;
    sections: Array<{
      id: string;
      title: string;
      type: string;
      order: number;
      content?: unknown;
    }>;
  } | null;
}

export interface TeamRecruitmentCardFrontDto {
  id: string;
  recruitmentContextId?: string;
  phase: TeamRecruitmentPhase;
  status: TeamRecruitmentStatus;
  version: number;
  headline: string;
  qualitySignal?: 'rich' | 'standard' | 'thin';
  detailNote?: string | null;
  highlightTitle?: string | null;
  offerRoles: string[];
  needRoles: string[];
  skillTags: string[];
  availabilityBand?: AvailabilityBand | null;
  collaborationMode?: CollaborationMode | null;
  timezone?: string | null;
  city?: string | null;
  languages: string[];
  intentMode: IntentMode;
  publishedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  updatedAt: string | Date;
  visibility?: RecruitmentVisibility;
  moderationStatus?: ModerationStatus | null;
  recruitmentContext?: RecruitmentContextItemDto | null;

  // Backward compatibility for older payloads.
  context?: RecruitmentContextItemDto | null;

  team: {
    id: string;
    name: string;
    description?: string | null;
    school?: {
      id: string;
      name: string;
      nameZh?: string | null;
    } | null;
    currentSize: number;
    targetSize: number;
    visibility?: string;
    joinPolicy?: string;
  };
  match?: {
    id: string;
    matchKind: TeamMatchKind;
    conversationId?: string | null;
  } | null;
  members: TeamRecruitmentMemberDto[];
  score?: number;
}

export interface TeamMatchDto {
  id: string;
  matchKind: TeamMatchKind;
  createdAt: string | Date;
  conversationId?: string | null;
  canInvite: boolean;
  myCard: TeamRecruitmentCardFrontDto;
  otherCard: TeamRecruitmentCardFrontDto;
  conversation?: {
    id: string;
    kind: 'DIRECT' | 'MATCH_GROUP';
    title?: string | null;
    createdBySystem?: boolean;
    participantPreview: Array<{
      id: string;
      email: string;
      profile?: {
        nickname?: string | null;
        avatarUrl?: string | null;
      } | null;
    }>;
    lastMessage?: {
      id: string;
      content: string;
      createdAt: string | Date;
    } | null;
  } | null;
}

export type TeamMatchInviteStatus = 'SENT' | 'EXISTING_PENDING' | 'ALREADY_MEMBER';

export interface TeamMatchInviteResultDto {
  inviteeId: string;
  status: TeamMatchInviteStatus;
  invitationId?: string | null;
  token?: string | null;
  inviteUrl?: string | null;
  notificationSent: boolean;
}

export interface InviteMatchMembersResponseDto {
  invitations: TeamMatchInviteResultDto[];
}

export function getRecruitmentContext(
  card?: Pick<TeamRecruitmentCardFrontDto, 'recruitmentContext' | 'context'> | null
): RecruitmentContextItemDto | null {
  return card?.recruitmentContext ?? card?.context ?? null;
}

export function getRecruitmentContextId(
  value?:
    | Pick<TeamRecruitmentCardFrontDto, 'recruitmentContextId' | 'recruitmentContext' | 'context'>
    | Pick<RecruitmentContextItemDto, 'id' | 'trackId'>
    | null
): string | null {
  if (!value) return null;
  if ('recruitmentContextId' in value && value.recruitmentContextId) {
    return value.recruitmentContextId;
  }
  if ('recruitmentContext' in value || 'context' in value) {
    return getRecruitmentContext(value)?.id ?? null;
  }
  const contextLike = value as { id?: string; trackId?: string };
  return contextLike.id ?? contextLike.trackId ?? null;
}

/**
 * Human-readable recruitment context title.
 * When `locale` is omitted, preserves legacy order: name → trackName → title.
 * When `locale` is set, mirrors bilingual display (e.g. school name): zh prefers titleZh.
 */
export function getRecruitmentContextName(
  context?: RecruitmentContextItemDto | null,
  locale?: string | null
): string {
  if (!context) return '';
  if (locale != null && String(locale).length > 0) {
    if (String(locale).startsWith('zh')) {
      return context.titleZh || context.title || context.name || context.trackName || '';
    }
    return context.title || context.name || context.trackName || context.titleZh || '';
  }
  return context.name || context.trackName || context.title || '';
}

/** Match pool list label by locale (nameZh when zh). */
export function getMatchPoolLabel(
  pool?: Pick<MatchPoolDto, 'name' | 'nameZh'> | null,
  locale?: string | null
): string {
  if (!pool) return '';
  if (locale != null && String(locale).length > 0) {
    if (String(locale).startsWith('zh')) {
      return pool.nameZh || pool.name || '';
    }
    return pool.name || pool.nameZh || '';
  }
  return pool.name || pool.nameZh || '';
}

/** Competition track line (abbreviation vs localized name) for meta / selects. */
export function getCompetitionTrackLabel(
  competition?: Pick<RecruitmentCompetitionDto, 'name' | 'nameZh' | 'abbreviation'> | null,
  locale?: string | null
): string {
  if (!competition) return '';
  if (locale != null && String(locale).length > 0) {
    if (String(locale).startsWith('zh')) {
      return competition.nameZh || competition.abbreviation || competition.name || '';
    }
    return competition.abbreviation || competition.name || competition.nameZh || '';
  }
  return competition.abbreviation || competition.name || '';
}
