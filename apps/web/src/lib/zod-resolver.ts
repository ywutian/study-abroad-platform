import { zodResolver as baseZodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';

/**
 * Typed re-export of react-hook-form's zodResolver.
 *
 * ponytail: @hookform/resolvers@3.9.1's `zodResolver` return type doesn't unify
 * with RHF's `Resolver<T>` under zod 3.25 on Vercel's `next build` tsc. It passes
 * local `tsc`, local `next build`, AND CI's dedicated Type Check job — so it's an
 * environment-specific type artifact, not a real error. This one forced cast kills
 * the false positive at every call site, which is why we no longer need
 * `typescript.ignoreBuildErrors` in next.config (that disabled type-checking for
 * the entire production build to dodge this single line).
 *
 * Delete this shim and import from '@hookform/resolvers/zod' directly once the
 * dependency is bumped to a version whose types resolve cleanly.
 */
export function zodResolver<T extends FieldValues>(schema: unknown): Resolver<T> {
  return (baseZodResolver as (s: unknown) => Resolver<T>)(schema);
}
