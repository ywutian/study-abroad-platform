import { z } from 'zod';

/**
 * Create essay validation schema
 * @param t - Translation function from useTranslations()
 */
export function createEssaySchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(200, t('validation.titleTooLong')),
    prompt: z.string().max(5000).optional(),
    content: z.string().min(1, t('validation.contentRequired')).max(50000),
    schoolId: z.string().optional(),
  });
}

export type EssayFormData = z.infer<ReturnType<typeof createEssaySchema>>;

/**
 * Polish essay request schema
 */
export function createPolishSchema(t: (key: string) => string) {
  return z.object({
    content: z.string().min(1, t('validation.contentRequired')),
    style: z.enum(['formal', 'casual', 'academic', 'creative']).default('formal'),
  });
}

export type PolishFormData = z.infer<ReturnType<typeof createPolishSchema>>;
