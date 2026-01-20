import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EssayScraperService } from './essay-scraper.service';
import { EssayScraperController } from './essay-scraper.controller';
import { EssayScraperScheduler } from './essay-scraper.scheduler';
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { LlmScrapeStrategy } from './strategies/llm.strategy';
import { CommonAppScrapeStrategy } from './strategies/commonapp.strategy';
import { AiValidatorService } from './ai-validator.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [EssayScraperController],
  providers: [
    EssayScraperService,
    EssayScraperScheduler,
    OfficialScrapeStrategy,
    CollegeVineScrapeStrategy,
    LlmScrapeStrategy,
    CommonAppScrapeStrategy,
    AiValidatorService,
  ],
  exports: [EssayScraperService],
})
export class EssayScraperModule {}
