import { describe, expect, it } from 'vitest';
import {
  getRecruitmentContext,
  getRecruitmentContextId,
  getRecruitmentContextName,
  type RecruitmentContextItemDto,
  type TeamRecruitmentCardFrontDto,
} from '@study-abroad/shared';

describe('team recruitment shared contract helpers', () => {
  it('prefers canonical recruitmentContext over the legacy context field', () => {
    const canonical = {
      id: 'ctx-1',
      name: 'Official Context',
      rolePresets: [],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
    } satisfies RecruitmentContextItemDto;
    const legacy = {
      id: 'legacy-ctx',
      name: 'Legacy Context',
      rolePresets: [],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
    } satisfies RecruitmentContextItemDto;

    const card = {
      recruitmentContext: canonical,
      context: legacy,
    } as Pick<TeamRecruitmentCardFrontDto, 'recruitmentContext' | 'context'>;

    expect(getRecruitmentContext(card)).toEqual(canonical);
  });

  it('resolves recruitmentContextId from canonical, legacy, and context-like payloads', () => {
    const card = {
      recruitmentContextId: 'ctx-1',
      recruitmentContext: {
        id: 'ctx-1',
        name: 'Official Context',
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        isActive: true,
      },
      context: null,
    } as unknown as TeamRecruitmentCardFrontDto;

    expect(getRecruitmentContextId(card)).toBe('ctx-1');
    expect(getRecruitmentContextId({ id: 'ctx-2' })).toBe('ctx-2');
    expect(
      getRecruitmentContextId({ trackId: 'legacy-track-1' } as RecruitmentContextItemDto)
    ).toBe('legacy-track-1');
  });

  it('falls back from name to trackName to title when rendering the context label', () => {
    expect(
      getRecruitmentContextName({
        id: 'ctx-1',
        name: 'Canonical Name',
        trackName: 'Track Label',
        title: 'Title Fallback',
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        isActive: true,
      })
    ).toBe('Canonical Name');

    expect(
      getRecruitmentContextName({
        id: 'ctx-2',
        name: '',
        trackName: 'Track Label',
        title: 'Title Fallback',
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        isActive: true,
      })
    ).toBe('Track Label');

    expect(
      getRecruitmentContextName({
        id: 'ctx-3',
        name: '',
        trackName: '',
        title: 'Title Fallback',
        rolePresets: [],
        minTeamSize: 2,
        maxTeamSize: 4,
        languages: ['English'],
        isActive: true,
      })
    ).toBe('Title Fallback');
  });

  it('prefers titleZh for zh locale and English fields for non-zh locale', () => {
    const ctx = {
      id: 'ctx-bi',
      name: 'Legacy Name',
      trackName: 'Track EN',
      title: 'Title EN',
      titleZh: '中文标题',
      rolePresets: [],
      minTeamSize: 2,
      maxTeamSize: 4,
      languages: ['English'],
      isActive: true,
    } satisfies RecruitmentContextItemDto;

    expect(getRecruitmentContextName(ctx, 'zh')).toBe('中文标题');
    expect(getRecruitmentContextName(ctx, 'zh-CN')).toBe('中文标题');
    expect(getRecruitmentContextName(ctx, 'en')).toBe('Title EN');
  });
});
