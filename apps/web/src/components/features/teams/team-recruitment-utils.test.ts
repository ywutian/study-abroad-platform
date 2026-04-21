import { describe, expect, it } from 'vitest';
import type { TeamMatchInviteResultDto, TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import {
  getCurrentMemberDisplaySettings,
  getInviteDeliveryState,
  getRecruitmentContextLabel,
  getRecruitmentContextMeta,
  getRecruitmentModerationLabel,
  isCommunityRecruitmentContext,
} from './team-recruitment-utils';

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

  it('formats official recruitment contexts using competition metadata', () => {
    const card = {
      recruitmentContext: {
        id: 'ctx-1',
        name: 'Entrepreneurship Challenge',
        trackName: 'Entrepreneurship Challenge',
        sourceType: 'OFFICIAL',
        competition: {
          id: 'comp-1',
          name: 'National Economics Challenge',
          abbreviation: 'NEC',
          category: 'ECON',
        },
        edition: {
          id: 'edition-1',
          seasonLabel: '2026',
          status: 'ACTIVE',
        },
      },
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getRecruitmentContextLabel(card)).toBe('Entrepreneurship Challenge');
    expect(getRecruitmentContextMeta(card)).toBe('NEC / 2026');
    expect(isCommunityRecruitmentContext(card)).toBe(false);
  });

  it('formats community recruitment contexts using subtitle fallbacks', () => {
    const card = {
      recruitmentContext: {
        id: 'ctx-2',
        name: 'Startup Weekend SF',
        sourceType: 'COMMUNITY',
        subtitle: 'Hybrid / San Francisco',
      },
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getRecruitmentContextLabel(card)).toBe('Startup Weekend SF');
    expect(getRecruitmentContextMeta(card)).toBe('Hybrid / San Francisco');
    expect(isCommunityRecruitmentContext(card)).toBe(true);
  });

  it('uses competition nameZh in meta when locale is zh', () => {
    const card = {
      recruitmentContext: {
        id: 'ctx-3',
        name: 'ISEF Track',
        trackName: 'ISEF Track',
        sourceType: 'OFFICIAL',
        competition: {
          id: 'comp-2',
          name: 'International Science and Engineering Fair',
          nameZh: '国际科学与工程大奖赛',
          abbreviation: 'ISEF',
          category: 'SCI',
        },
        edition: {
          id: 'edition-2',
          seasonLabel: '2026-2027',
          status: 'ACTIVE',
        },
      },
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getRecruitmentContextMeta(card, 'zh')).toBe('国际科学与工程大奖赛 / 2026-2027');
    expect(getRecruitmentContextMeta(card, 'en')).toBe('ISEF / 2026-2027');
  });

  it('maps moderation status enums via translation keys', () => {
    const t = (key: string) => (key === 'recruitment.moderationStatus.approved' ? '已通过' : key);
    expect(getRecruitmentModerationLabel('APPROVED', t)).toBe('已通过');
    expect(getRecruitmentModerationLabel('UNKNOWN', t)).toBe('UNKNOWN');
  });

  it('uses locale-aware title when locale is passed to getRecruitmentContextLabel', () => {
    const card = {
      recruitmentContext: {
        id: 'ctx-4',
        name: 'Name',
        trackName: 'Track',
        title: 'English title',
        titleZh: '中文',
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        isActive: true,
      },
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getRecruitmentContextLabel(card)).toBe('Track');
    expect(getRecruitmentContextLabel(card, 'zh')).toBe('中文');
    expect(getRecruitmentContextLabel(card, 'en')).toBe('English title');
  });
});
