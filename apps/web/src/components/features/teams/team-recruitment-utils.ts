import type { TeamMatchInviteResultDto, TeamRecruitmentCardFrontDto } from '@study-abroad/shared';

export interface CurrentMemberDisplaySettings {
  introLine: string;
  selectedResumeId: string;
  showSchool: boolean;
  showGrade: boolean;
  showAwards: boolean;
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
