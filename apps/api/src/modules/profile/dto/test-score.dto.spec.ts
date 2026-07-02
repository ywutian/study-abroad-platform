import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateTestScoreDto } from './test-score.dto';

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreateTestScoreDto, payload));
}

describe('CreateTestScoreDto — score accepts half-points', () => {
  // Guards the silent-400 class: if `score` ever goes back to @IsInt(), the
  // 2026 TOEFL (1.0–6.0) and IELTS (x.5) half-point scores 400 on save.
  it('accepts a 2026 TOEFL half-point score (5.5)', async () => {
    expect(await errorsFor({ type: 'TOEFL', score: 5.5 })).toHaveLength(0);
  });

  it('accepts an IELTS x.5 band (7.5)', async () => {
    expect(await errorsFor({ type: 'IELTS', score: 7.5 })).toHaveLength(0);
  });

  it('still accepts an integer score (SAT 1500)', async () => {
    expect(await errorsFor({ type: 'SAT', score: 1500 })).toHaveLength(0);
  });

  it('rejects a score above the cap', async () => {
    expect(
      (await errorsFor({ type: 'SAT', score: 5000 })).length,
    ).toBeGreaterThan(0);
  });
});
