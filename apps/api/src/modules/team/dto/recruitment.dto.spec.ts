import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_RECRUITMENT_ROLES,
  MAX_RECRUITMENT_SKILL_TAGS,
  MAX_TEAM_LANGUAGES,
  MAX_ROLE_PRESETS,
  MAX_TEAM_INVITEES,
} from '@study-abroad/shared';
import {
  CreateRecruitmentDto,
  CreateCommunityContextDto,
  InviteMatchMembersDto,
} from './recruitment.dto';

const items = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `item-${i}`);

// Mirror the global ValidationPipe (main.ts: whitelist + forbidNonWhitelisted).
async function errorsFor<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const hasCapError = (
  errors: Awaited<ReturnType<typeof errorsFor>>,
  prop: string,
) => errors.find((e) => e.property === prop)?.constraints?.arrayMaxSize != null;
const noCapError = (
  errors: Awaited<ReturnType<typeof errorsFor>>,
  prop: string,
) => errors.find((e) => e.property === prop)?.constraints?.arrayMaxSize == null;

describe('team recruitment DTO array caps', () => {
  it('CreateRecruitmentDto accepts roles/skills/languages at their caps', async () => {
    const errors = await errorsFor(CreateRecruitmentDto, {
      offerRoles: items(MAX_RECRUITMENT_ROLES),
      needRoles: items(MAX_RECRUITMENT_ROLES),
      skillTags: items(MAX_RECRUITMENT_SKILL_TAGS),
      languages: items(MAX_TEAM_LANGUAGES),
    });
    expect(noCapError(errors, 'offerRoles')).toBe(true);
    expect(noCapError(errors, 'needRoles')).toBe(true);
    expect(noCapError(errors, 'skillTags')).toBe(true);
    expect(noCapError(errors, 'languages')).toBe(true);
  });

  it('CreateRecruitmentDto rejects each array over its cap', async () => {
    const errors = await errorsFor(CreateRecruitmentDto, {
      offerRoles: items(MAX_RECRUITMENT_ROLES + 1),
      skillTags: items(MAX_RECRUITMENT_SKILL_TAGS + 1),
      languages: items(MAX_TEAM_LANGUAGES + 1),
    });
    expect(hasCapError(errors, 'offerRoles')).toBe(true);
    expect(hasCapError(errors, 'skillTags')).toBe(true);
    expect(hasCapError(errors, 'languages')).toBe(true);
  });

  it('CreateCommunityContextDto caps rolePresets + languages', async () => {
    const ok = await errorsFor(CreateCommunityContextDto, {
      rolePresets: items(MAX_ROLE_PRESETS),
      languages: items(MAX_TEAM_LANGUAGES),
    });
    expect(noCapError(ok, 'rolePresets')).toBe(true);
    expect(noCapError(ok, 'languages')).toBe(true);

    const bad = await errorsFor(CreateCommunityContextDto, {
      rolePresets: items(MAX_ROLE_PRESETS + 1),
      languages: items(MAX_TEAM_LANGUAGES + 1),
    });
    expect(hasCapError(bad, 'rolePresets')).toBe(true);
    expect(hasCapError(bad, 'languages')).toBe(true);
  });

  it('InviteMatchMembersDto accepts a full team roster (100) and rejects over', async () => {
    const ok = await errorsFor(InviteMatchMembersDto, {
      inviteeIds: items(MAX_TEAM_INVITEES),
    });
    expect(noCapError(ok, 'inviteeIds')).toBe(true);

    const bad = await errorsFor(InviteMatchMembersDto, {
      inviteeIds: items(MAX_TEAM_INVITEES + 1),
    });
    expect(hasCapError(bad, 'inviteeIds')).toBe(true);
  });
});
