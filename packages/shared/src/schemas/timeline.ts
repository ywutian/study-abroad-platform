import { z } from 'zod';

/**
 * Create personal event validation schema
 * @param t - Translation function from useTranslations()
 */
export function createPersonalEventSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.titleRequired')).max(200, t('validation.titleTooLong')),
    category: z.enum(
      ['COMPETITION', 'TEST', 'SUMMER_PROGRAM', 'INTERNSHIP', 'ACTIVITY', 'MATERIAL', 'OTHER'],
      { required_error: t('validation.categoryRequired') }
    ),
    deadline: z.string().optional(),
    eventDate: z.string().optional(),
    description: z.string().max(2000).optional(),
    url: z.string().url(t('validation.invalidUrl')).optional().or(z.literal('')),
    notes: z.string().max(2000).optional(),
    priority: z.coerce.number().int().min(0).max(5).default(3),
  });
}

export type PersonalEventFormData = z.infer<ReturnType<typeof createPersonalEventSchema>>;
