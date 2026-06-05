/**
 * Web query layer — public surface.
 *
 *   import { cachePolicy, qk } from '@/lib/query';
 *   import type { CacheTier } from '@/lib/query';
 *
 * (prefetch + cache-metrics are deferred for web — there is no
 *  PersistQueryClientProvider here yet, unlike apps/mobile.)
 */
export { cachePolicy } from './cache-policy';
export type { CacheTier } from './cache-policy';
export { qk } from './keys';
