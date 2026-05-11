import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { SchoolLogoService } from './school-logo.service';
import { SchoolMediaService } from './school-media.service';
import { SchoolScraperScheduler } from './school-scraper.scheduler';
import { DataSyncScheduler } from './data-sync.scheduler';
import { SchoolProvenanceScheduler } from './school-provenance.scheduler';
import { SchoolWriteService } from './school-write.service';
import { HighSchoolService } from './high-school.service';
import { HighSchoolController } from './high-school.controller';
import { HsCalibrationScheduler } from './hs-calibration.scheduler';
import { HighSchoolEventListener } from './high-school-event.listener';
import { IpedsDataService } from './ipeds-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { SchoolCommunityRatingService } from './school-community-rating.service';
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
    SchoolMediaService,
    SchoolWriteService,
    SchoolScraperScheduler,
    DataSyncScheduler,
    SchoolProvenanceScheduler,
    HighSchoolService,
    HsCalibrationScheduler,
    HighSchoolEventListener,
    IpedsDataService,
    UrbanInstituteDataService,
    BigFutureScrapeService,
    AppilyScrapeService,
    SchoolCommunityRatingService,
  ],
  exports: [
    SchoolService,
    SchoolDataService,
    SchoolScraperService,
    SchoolDataMerger,
    SchoolWriteService,
    SchoolMediaService,
    SchoolProvenanceScheduler,
    HighSchoolService,
    IpedsDataService,
    UrbanInstituteDataService,
    BigFutureScrapeService,
    AppilyScrapeService,
    SchoolCommunityRatingService,
  ],
})
export class SchoolModule {}
