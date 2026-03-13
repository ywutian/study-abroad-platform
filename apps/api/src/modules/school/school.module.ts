import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { SchoolLogoService } from './school-logo.service';
import { SchoolScraperScheduler } from './school-scraper.scheduler';
import { DataSyncScheduler } from './data-sync.scheduler';
import { HighSchoolService } from './high-school.service';
import { HighSchoolController } from './high-school.controller';
import { IpedsDataService } from './ipeds-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../../common/services/audit-log.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [PrismaModule, AuditLogModule, ScheduleModule, SchoolListModule],
  controllers: [SchoolController, HighSchoolController],
  providers: [
    SchoolService,
    SchoolDataService,
    SchoolScraperService,
    SchoolDataMerger,
    SchoolLogoService,
    SchoolScraperScheduler,
    DataSyncScheduler,
    HighSchoolService,
    IpedsDataService,
    UrbanInstituteDataService,
    BigFutureScrapeService,
    AppilyScrapeService,
  ],
  exports: [
    SchoolService,
    SchoolDataService,
    SchoolScraperService,
    SchoolDataMerger,
    HighSchoolService,
    IpedsDataService,
    UrbanInstituteDataService,
    BigFutureScrapeService,
    AppilyScrapeService,
  ],
})
export class SchoolModule {}
