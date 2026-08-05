import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GPA_SCALES } from '@study-abroad/shared';
import { PredictionPreviewScenarioDto } from './prediction-request.dto';

/**
 * The What-if simulator posts the profile's own GPA and scale. While this DTO
 * capped both at `@Max(5)`, every student on a 100-point, IB-45 or 6.0 scale
 * got a 400 on every press and saw only "could not run the preview" — the
 * feature was 100% unusable for them, and the served prediction path was
 * unaffected (it reads GPA from the profile, not the request), so nothing else
 * looked broken.
 *
 * These cases drive the real ValidationPipe path — `plainToInstance` +
 * `validateSync` — because `prediction.controller.spec.ts:210` calls
 * `controller.preview()` directly, which bypasses validation entirely. A
 * controller test could not have caught this and did not.
 */
function validate(scenario: Record<string, unknown>) {
  return validateSync(
    plainToInstance(PredictionPreviewScenarioDto, scenario, {
      enableImplicitConversion: true,
    }),
  );
}

describe('PredictionPreviewScenarioDto — GPA bounds', () => {
  it.each([...GPA_SCALES])(
    'accepts the %s scale a profile may declare',
    (scale) => {
      expect(validate({ gpaScale: scale })).toHaveLength(0);
    },
  );

  it.each([
    ['100-point', 92, 100],
    ['IB 45', 42, 45],
    ['6.0', 5.4, 6],
    ['4.0', 3.9, 4],
    ['5.0', 4.6, 5],
  ])('accepts a realistic %s profile end to end', (_label, gpa, gpaScale) => {
    expect(validate({ gpa, gpaScale })).toHaveLength(0);
  });

  it('rejects a scale the profile itself would reject', () => {
    // 10 is not in GPA_SCALES; if this ever passes, the DTO has drifted looser
    // than the profile and a scenario can carry a scale the engine never sees.
    expect(validate({ gpaScale: 10 })).not.toHaveLength(0);
  });

  it('still rejects a GPA above every scale', () => {
    expect(validate({ gpa: 101 })).not.toHaveLength(0);
  });

  it('rejects a negative GPA', () => {
    expect(validate({ gpa: -1 })).not.toHaveLength(0);
  });

  it('accepts an empty scenario — every field is optional', () => {
    expect(validate({})).toHaveLength(0);
  });
});
