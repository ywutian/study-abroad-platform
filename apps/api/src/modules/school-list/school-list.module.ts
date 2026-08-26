import { forwardRef, Module } from '@nestjs/common';
import { SchoolListController } from './school-list.controller';
import { SchoolListService } from './school-list.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { TimelineModule } from '../timeline/timeline.module';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    TimelineModule,
    // PredictionModule imports SchoolModule, which imports SchoolListModule.
    // Defer this edge so the full Nest module graph can initialize without a
    // JavaScript temporal-dead-zone failure.
    forwardRef(() => PredictionModule),
  ],
  controllers: [SchoolListController],
  providers: [SchoolListService],
  exports: [SchoolListService],
})
export class SchoolListModule {}
