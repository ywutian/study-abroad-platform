import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisMetricsCollector } from './redis-metrics.service';

@Global()
@Module({
  providers: [RedisMetricsCollector, RedisService, CacheInvalidationService],
  exports: [RedisMetricsCollector, RedisService, CacheInvalidationService],
})
export class RedisModule {}
