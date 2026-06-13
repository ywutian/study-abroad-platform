import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MAX_PREFERRED_REGIONS,
  MAX_PREFERRED_MAJORS,
} from '@study-abroad/shared';
import { SchoolRecommendationRequestDto } from './school-recommendation.dto';

const items = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `item-${i}`);

// Mirror the global ValidationPipe (main.ts: whitelist + forbidNonWhitelisted).
async function validateRequest(payload: Record<string, unknown>) {
  const dto = plainToInstance(SchoolRecommendationRequestDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('SchoolRecommendationRequestDto array caps', () => {
  it('accepts preferredRegions/preferredMajors at the cap (full 15-chip selection)', async () => {
    const errors = await validateRequest({
      preferredRegions: items(MAX_PREFERRED_REGIONS),
      preferredMajors: items(MAX_PREFERRED_MAJORS),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects preferredRegions over the cap', async () => {
    const errors = await validateRequest({
      preferredRegions: items(MAX_PREFERRED_REGIONS + 1),
    });
    const err = errors.find((e) => e.property === 'preferredRegions');
    expect(err?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects preferredMajors over the cap', async () => {
    const errors = await validateRequest({
      preferredMajors: items(MAX_PREFERRED_MAJORS + 1),
    });
    const err = errors.find((e) => e.property === 'preferredMajors');
    expect(err?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('allows omitting both (optional fields)', async () => {
    const errors = await validateRequest({ schoolCount: 10 });
    expect(errors).toHaveLength(0);
  });
});
