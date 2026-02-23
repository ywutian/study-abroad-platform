import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheInvalidationService } from './cache-invalidation.service';

@Global()
@Module({
  providers: [RedisService, CacheInvalidationService],
  exports: [RedisService, CacheInvalidationService],
})
export class RedisModule {}
