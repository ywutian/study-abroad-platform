/**
 * The GPA scales a profile may declare — one list, because it had four copies
 * and one of them was wrong.
 *
 * Before this constant existed the same set lived in
 * `profile/dto/profile.dto.ts`, `profile/dto/onboarding.dto.ts` and the
 * `<Select>` in `profile/_components/gpa-tab.tsx` (all five values), while
 * `prediction/dto/prediction-request.dto.ts` capped `gpaScale` at `@Max(5)`.
 * The What-if simulator posts the profile's own scale, so every student on a
 * 100-point, IB-45 or 6.0 scale got a 400 on every press with no way to tell
 * why — the panel only shows a generic "could not run the preview". The served
 * prediction path was unaffected because it reads GPA from the profile rather
 * than the request, which is why nothing else looked broken.
 *
 * ponytail: a plain array, not a zod schema or a class-validator decorator
 * factory. Each consumer already has its own validation idiom (`@IsIn`,
 * `<SelectItem>`); what they were missing was agreement on the values.
 */
export const GPA_SCALES = [4.0, 5.0, 6, 45, 100] as const;

export type GpaScale = (typeof GPA_SCALES)[number];

/** Largest declarable GPA — a value is always bounded by its own scale. */
export const GPA_MAX = Math.max(...GPA_SCALES);

/** Mutable copy for validators whose signatures reject `readonly` arrays. */
export const GPA_SCALES_MUTABLE: number[] = [...GPA_SCALES];
