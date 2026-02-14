import { Module, forwardRef } from '@nestjs/common';
import { HallService } from './hall.service';
import { HallController } from './hall.controller';
import { HallAdminController } from './hall-admin.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';
import { AiModule } from '../ai/ai.module';
import { SwipeModule } from '../swipe/swipe.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AiAgentModule),
    forwardRef(() => AiModule),
    SwipeModule,
    SchoolListModule,
  ],
  controllers: [HallController, HallAdminController],
  providers: [HallService],
  exports: [HallService],
})
export class HallModule {}
