import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { SchoolDataService } from './school-data.service';
import { SchoolScraperService } from './school-scraper.service';
import { SchoolDataMerger } from './school-data-merger';
import { SchoolLogoService } from './school-logo.service';
import { SchoolMediaService } from './school-media.service';
import { SchoolScraperScheduler } from './school-scraper.scheduler';
import { DataSyncScheduler } from './data-sync.scheduler';
import { DeadlineRefreshScheduler } from './deadline-refresh.scheduler';
import { SchoolProvenanceScheduler } from './school-provenance.scheduler';
import { IpedsMonitorService } from './ipeds-monitor.service';
import { SchoolWriteService } from './school-write.service';
import { HighSchoolService } from './high-school.service';
import { HighSchoolController } from './high-school.controller';
import { HsCalibrationScheduler } from './hs-calibration.scheduler';
import { HighSchoolEventListener } from './high-school-event.listener';
import { IpedsDataService } from './ipeds-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { CampusLifeIngestionService } from './campus-life-ingestion.service';
import { SchoolCommunityRatingService } from './school-community-rating.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../../common/services/audit-log.module';
import { SchoolListModule } from '../school-list/school-list.module';

@Module({
  imports: [PrismaModule, AuditLogModule, SchoolListModule],
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
    DeadlineRefreshScheduler,
    SchoolProvenanceScheduler,
    // Registered 2026-08-05. This service existed since #74 and was hardened
    // twice (#452 lock + durable fingerprint, #458 heartbeat) without ever
    // being in a providers list — so its weekly "IPEDS published new data"
    // admin email had never once been scheduled, in any environment. The spec
    // instantiated it directly, which is why every test stayed green. Found by
    // the deploy-time cron assert on its FIRST run (manifest lists the @Cron,
    // live registry showed no provider); the cron-registry e2e now catches the
    // next orphan at test time instead.
    IpedsMonitorService,
    HighSchoolService,
    HsCalibrationScheduler,
    HighSchoolEventListener,
    IpedsDataService,
    UrbanInstituteDataService,
    BigFutureScrapeService,
    AppilyScrapeService,
    CampusLifeIngestionService,
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
    CampusLifeIngestionService,
    SchoolCommunityRatingService,
  ],
})
export class SchoolModule {}
