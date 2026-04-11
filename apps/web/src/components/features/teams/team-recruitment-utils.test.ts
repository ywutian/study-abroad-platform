import { describe, expect, it } from 'vitest';
import type { TeamMatchInviteResultDto, TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import { getCurrentMemberDisplaySettings, getInviteDeliveryState } from './team-recruitment-utils';

describe('team-recruitment-utils', () => {
  it('extracts current member display settings from the recruitment card', () => {
    const card = {
      members: [
        {
          userId: 'user-1',
          role: 'OWNER',
          displayName: 'Alice',
          introLine: 'Ready to build',
          showSchool: true,
          showGrade: false,
          showAwards: true,
          resume: {
            id: 'resume-1',
            title: 'Main Resume',
            updatedAt: new Date().toISOString(),
            sections: [],
          },
        },
      ],
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getCurrentMemberDisplaySettings(card, 'user-1')).toEqual({
      introLine: 'Ready to build',
      selectedResumeId: 'resume-1',
      showSchool: true,
      showGrade: false,
      showAwards: true,
    });
  });

  it('falls back to clean defaults when the member has not saved display settings', () => {
    expect(getCurrentMemberDisplaySettings(null, 'user-1')).toEqual({
      introLine: '',
      selectedResumeId: 'none',
      showSchool: false,
      showGrade: false,
      showAwards: false,
    });
  });

  it('maps invite delivery outcomes for UI fallback handling', () => {
    const sent = {
      inviteeId: 'user-1',
      status: 'SENT',
      notificationSent: true,
    } as TeamMatchInviteResultDto;
    const existingPending = {
      inviteeId: 'user-2',
      status: 'EXISTING_PENDING',
      notificationSent: true,
    } as TeamMatchInviteResultDto;
    const manualShare = {
      inviteeId: 'user-3',
      status: 'SENT',
      notificationSent: false,
    } as TeamMatchInviteResultDto;

    expect(getInviteDeliveryState(sent)).toBe('sent');
    expect(getInviteDeliveryState(existingPending)).toBe('existing_pending');
    expect(getInviteDeliveryState(manualShare)).toBe('manual_share');
  });
});
