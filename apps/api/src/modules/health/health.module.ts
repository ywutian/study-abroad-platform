import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports: [PrismaModule, RedisModule, AiAgentModule],
  controllers: [HealthController],
})
export class HealthModule {}
