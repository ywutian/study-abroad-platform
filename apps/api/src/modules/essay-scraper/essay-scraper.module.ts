import { Module } from '@nestjs/common';
import { EssayScraperService } from './essay-scraper.service';
import { EssayScraperController } from './essay-scraper.controller';
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { AiValidatorService } from './ai-validator.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EssayScraperController],
  providers: [
    EssayScraperService,
    OfficialScrapeStrategy,
    CollegeVineScrapeStrategy,
    AiValidatorService,
  ],
  exports: [EssayScraperService],
})
export class EssayScraperModule {}
