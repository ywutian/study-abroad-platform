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

export interface RecruitmentContextDto {
  items: Array<{
    id: string;
    name: string;
    rolePresets: string[];
    minTeamSize: number;
    maxTeamSize: number;
    languages: string[];
    isActive: boolean;
    edition: {
      id: string;
      seasonLabel: string;
      status: string;
      registrationOpenAt?: string | Date | null;
      registrationCloseAt?: string | Date | null;
      eventStartAt?: string | Date | null;
      eventEndAt?: string | Date | null;
    };
    competition: {
      id: string;
      name: string;
      abbreviation: string;
      category: string;
    };
  }>;
}

export interface TeamRecruitmentMemberDto {
  userId: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  verificationRole?: string;
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
  phase: TeamRecruitmentPhase;
  status: TeamRecruitmentStatus;
  version: number;
  headline: string;
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
  context: {
    trackId: string;
    trackName: string;
    rolePresets: string[];
    minTeamSize: number;
    maxTeamSize: number;
    seasonLabel: string;
    competition: {
      id: string;
      name: string;
      abbreviation: string;
      category: string;
    };
  };
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
