import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
