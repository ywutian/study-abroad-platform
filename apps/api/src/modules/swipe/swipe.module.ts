import { Module } from '@nestjs/common';
import { SwipeService } from './swipe.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { CaseModule } from '../case/case.module';

/**
 * SwipeModule
 *
 * 注意: SwipeController 已移除，所有 swipe 端点统一通过 HallController (/hall/swipe/*) 暴露。
 * 避免 /swipe/* 和 /hall/swipe/* 双路径暴露相同功能导致的安全和维护问题。
 */
@Module({
  imports: [PrismaModule, AiAgentMemoryModule, CaseModule],
  providers: [SwipeService],
  exports: [SwipeService],
})
export class SwipeModule {}
