import { Global, Module } from '@nestjs/common';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  // 2026-05 Phase 4 #35: user-facing evaluation endpoint joins the
  // admin CRUD that already lived in AdminFeatureFlagController.
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
