import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../decorators';
import type { CurrentUserPayload } from '../decorators';
import { ThrottleRelaxed } from '../decorators/throttle.decorator';
import { FeatureFlagService } from './feature-flag.service';

/**
 * 2026-05 Phase 4 #35: User-facing feature-flag evaluation endpoint.
 *
 * Before this, only the admin CRUD controller (`AdminFeatureFlagController`)
 * existed — the frontend had **zero way** to ask "is flag X enabled for
 * me?" beyond the backend decorator that gates entire endpoints.
 *
 * This endpoint evaluates a comma-separated list of flag keys against
 * the current user's identity (role + userId + percentage bucket) and
 * returns a `{ key: boolean }` map. The frontend `useFeatureFlag` hook
 * batches lookups via this endpoint and caches per-flag in React Query.
 *
 * Idempotent GET (read-only) — eligible for the relaxed throttle band.
 */
@ApiTags('feature-flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get('evaluate')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Evaluate one or more feature flags for the current user',
  })
  @ApiQuery({
    name: 'keys',
    type: String,
    required: true,
    description:
      'Comma-separated list of feature flag keys (e.g. ?keys=new-dashboard,prediction-v5)',
  })
  async evaluate(
    @CurrentUser() user: CurrentUserPayload,
    @Query('keys') keysParam: string,
  ): Promise<{ flags: Record<string, boolean> }> {
    const keys = (keysParam ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0)
      // Cap the request width so a misuse (?keys=a,b,c,…,1000) can't
      // hammer Redis with 1000 lookups per call.
      .slice(0, 20);

    if (keys.length === 0) {
      return { flags: {} };
    }

    const flags: Record<string, boolean> = {};
    // Evaluate in parallel — each lookup is cached in Redis (60s TTL).
    const results = await Promise.all(
      keys.map((key) =>
        this.featureFlagService.isEnabled(key, {
          userId: user.id,
          role: user.role,
        }),
      ),
    );
    keys.forEach((key, index) => {
      flags[key] = results[index];
    });
    return { flags };
  }
}
