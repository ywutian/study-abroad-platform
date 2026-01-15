import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolScraperScheduler } from './school-scraper.scheduler';
import { DataSyncScheduler } from './data-sync.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    ScheduleModule,
    forwardRef(() => ProfileModule),
  ],
  controllers: [SchoolController],
  providers: [
    SchoolService,
    SchoolDataService,
    SchoolScraperService,
    SchoolScraperScheduler,
    DataSyncScheduler,
  ],
  exports: [SchoolService, SchoolDataService, SchoolScraperService],
})
export class SchoolModule {}
