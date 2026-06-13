import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_SCHOOLS_PER_BATCH } from '@study-abroad/shared';
import { GenerateTimelineDto } from './timeline.dto';

const schoolIds = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `school-${i}`);

// Mirror the global ValidationPipe (main.ts: whitelist + forbidNonWhitelisted).
async function validateRequest(payload: Record<string, unknown>) {
  const dto = plainToInstance(GenerateTimelineDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('GenerateTimelineDto.schoolIds cap', () => {
  it('accepts exactly MAX_SCHOOLS_PER_BATCH school ids', async () => {
    const errors = await validateRequest({
      schoolIds: schoolIds(MAX_SCHOOLS_PER_BATCH),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects more than MAX_SCHOOLS_PER_BATCH school ids', async () => {
    const errors = await validateRequest({
      schoolIds: schoolIds(MAX_SCHOOLS_PER_BATCH + 1),
    });
    const schoolIdsError = errors.find((e) => e.property === 'schoolIds');
    expect(schoolIdsError?.constraints).toHaveProperty('arrayMaxSize');
  });

  // Regression: prediction (was 10) and timeline (was 50) now share one SSOT cap,
  // so a 56-school list validates against both endpoints identically.
  it('accepts a 56-school list (previously over the old 50 cap)', async () => {
    const errors = await validateRequest({ schoolIds: schoolIds(56) });
    expect(errors).toHaveLength(0);
  });
});
