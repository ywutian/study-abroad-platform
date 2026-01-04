import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolScraperScheduler } from './school-scraper.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolController],
  providers: [
    SchoolService,
    SchoolDataService,
    SchoolScraperService,
    SchoolScraperScheduler,
  ],
  exports: [SchoolService, SchoolDataService, SchoolScraperService],
})
export class SchoolModule {}
