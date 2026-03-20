import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisMetricsService } from './redis-metrics.service';

@Global()
@Module({
  providers: [RedisService, CacheInvalidationService, RedisMetricsService],
  exports: [RedisService, CacheInvalidationService, RedisMetricsService],
})
export class RedisModule {}
