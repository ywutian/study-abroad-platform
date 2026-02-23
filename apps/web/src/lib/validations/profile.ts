import { z } from 'zod';

/**
 * Create test score validation schema
 */
export function createTestScoreSchema(t: (key: string) => string) {
  return z.object({
    type: z.enum(['SAT', 'ACT', 'TOEFL', 'IELTS', 'GRE', 'GMAT', 'AP', 'IB'], {
      required_error: t('validation.typeRequired'),
    }),
    score: z.coerce
      .number({ invalid_type_error: t('validation.scoreInvalid') })
      .positive(t('validation.scorePositive')),
    date: z.string().optional(),
  });
}

export type TestScoreFormData = z.infer<ReturnType<typeof createTestScoreSchema>>;

/**
 * Create activity validation schema
 */
export function createActivitySchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(200),
    category: z.string().min(1, t('validation.categoryRequired')),
    role: z.string().max(200).optional(),
    organization: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    hoursPerWeek: z.coerce.number().int().min(0).max(168).optional(),
    weeksPerYear: z.coerce.number().int().min(0).max(52).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });
}

export type ActivityFormData = z.infer<ReturnType<typeof createActivitySchema>>;

/**
 * Create award validation schema
 */
export function createAwardSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(200),
    level: z.enum(['INTERNATIONAL', 'NATIONAL', 'STATE', 'REGIONAL', 'SCHOOL'], {
      required_error: t('validation.levelRequired'),
    }),
    year: z.coerce
      .number()
      .int()
      .min(2000)
      .max(new Date().getFullYear() + 1)
      .optional(),
    description: z.string().max(2000).optional(),
  });
}

export type AwardFormData = z.infer<ReturnType<typeof createAwardSchema>>;
