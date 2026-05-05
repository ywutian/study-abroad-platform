import { Controller, Delete, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { RedisMetricsCollector } from '../../common/redis/redis-metrics.service';
import { RedisService } from '../../common/redis/redis.service';

/**
 * Cache Health admin endpoints (M1 of the long-term cache architecture).
 *
 * Surfaces per-pod Redis metrics so operators can answer:
 *  - Are we approaching the Upstash quota again?
 *  - Which key prefixes drive most traffic? (candidates for L1/CDN)
 *  - What's the cache hit ratio? (validates whether sharding will help)
 *  - What errors are happening, with categories? (timeout vs quota vs auth)
 *
 * Metrics are in-process (per Cloud Run pod). The endpoint stays available
 * even when Redis is broken — that's the failure case we built it to detect.
 */
@ApiTags('Admin - Cache Health')
@Controller('admin/cache-health')
@Roles(Role.ADMIN)
export class AdminCacheHealthController {
  constructor(
    private readonly metrics: RedisMetricsCollector,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Per-pod Redis cache health snapshot',
    description:
      'Returns operation counts, latency percentiles, hit/miss ratio, hot key prefixes, and recent errors for the current pod. Counters reset on pod restart.',
  })
  async snapshot() {
    const [snapshot, health] = await Promise.all([
      Promise.resolve(this.metrics.snapshot()),
      this.redis.healthCheck(),
    ]);
    return {
      connection: {
        connected: this.redis.connected,
        ...health,
      },
      ...snapshot,
    };
  }

  @Delete()
  @ApiOperation({
    summary: 'Reset all Redis metrics counters for the current pod',
    description:
      'Useful after a deploy to start a fresh measurement window. Only affects the pod handling this request — other pods retain their counters until restarted.',
  })
  reset(): { reset: true; timestamp: string } {
    this.metrics.reset();
    return { reset: true, timestamp: new Date().toISOString() };
  }
}
