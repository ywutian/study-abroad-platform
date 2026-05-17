'use client';

/**
 * ReviewTab — re-export shim.
 *
 * The review experience lives under `./review/` (orchestrator + classic wizard
 * + swipe wizard). This file keeps the historical import path stable for
 * `hall/page.tsx` and the `features/hall` barrel.
 */

export { ReviewTab } from './review/ReviewTab';
