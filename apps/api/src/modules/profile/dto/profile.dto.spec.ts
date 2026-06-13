import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_LEGACY_AFFILIATIONS,
  MAX_REGION_PREFERENCES,
} from '@study-abroad/shared';
import { UpdateProfileDto } from './profile.dto';

const strings = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `v-${i}`);

// Mirror the global ValidationPipe (main.ts: whitelist + forbidNonWhitelisted).
async function validateField(field: string, value: string[]) {
  const dto = plainToInstance(UpdateProfileDto, { [field]: value });
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.find((e) => e.property === field);
}

/**
 * Boundary guard for the 2026-06 uncapped-array sweep (the no-uncapped-array rule
 * close): each user-facing array cap is a shared SSOT constant on the DTO, so an
 * over-limit POST is rejected with arrayMaxSize instead of accepting an unbounded
 * array. Representative of the sweep — the rule enforces the cap EXISTS on every
 * such field; this proves the cap VALUE is wired and rejects cap+1.
 */
describe('UpdateProfileDto array caps (SSOT, uncapped-array sweep)', () => {
  it('accepts exactly MAX_LEGACY_AFFILIATIONS and rejects one more', async () => {
    expect(
      await validateField('legacy', strings(MAX_LEGACY_AFFILIATIONS)),
    ).toBeUndefined();
    const over = await validateField(
      'legacy',
      strings(MAX_LEGACY_AFFILIATIONS + 1),
    );
    expect(over?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('accepts exactly MAX_REGION_PREFERENCES and rejects one more', async () => {
    expect(
      await validateField('regionPref', strings(MAX_REGION_PREFERENCES)),
    ).toBeUndefined();
    const over = await validateField(
      'regionPref',
      strings(MAX_REGION_PREFERENCES + 1),
    );
    expect(over?.constraints).toHaveProperty('arrayMaxSize');
  });
});
