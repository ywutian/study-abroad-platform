import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_SCHOOLS_PER_BATCH } from '@study-abroad/shared';
import { PredictionRequestDto } from './prediction-request.dto';

const schoolIds = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `school-${i}`);

// Mirror the global ValidationPipe (main.ts: whitelist + forbidNonWhitelisted).
async function validateRequest(payload: Record<string, unknown>) {
  const dto = plainToInstance(PredictionRequestDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('PredictionRequestDto.schoolIds cap', () => {
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

  it('rejects an empty school list', async () => {
    const errors = await validateRequest({ schoolIds: [] });
    const schoolIdsError = errors.find((e) => e.property === 'schoolIds');
    expect(schoolIdsError?.constraints).toHaveProperty('arrayMinSize');
  });

  // Regression: a full school list (56) + UC cross-campus expansion used to 400
  // against the old @ArrayMaxSize(10). It must now validate.
  it('accepts a realistic large school list (56) that previously 400d', async () => {
    const errors = await validateRequest({
      schoolIds: schoolIds(56),
      forceRefresh: true,
    });
    expect(errors).toHaveLength(0);
  });
});
