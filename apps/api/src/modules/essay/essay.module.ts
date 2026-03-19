import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiAgentMemoryModule } from '../ai-agent/memory/memory.module';
import { PointsModule } from '../points/points.module';

// Services
import { EssayAiService } from './essay-ai.service';
import { EssayGalleryService } from './essay-gallery.service';
import { EssayPromptService } from './essay-prompt.service';
import { EssayScraperService } from './essay-scraper.service';
import { EssayScraperScheduler } from './essay-scraper.scheduler';
import { AiValidatorService } from './ai-validator.service';

// Strategies
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { LlmScrapeStrategy } from './strategies/llm.strategy';
import { CommonAppScrapeStrategy } from './strategies/commonapp.strategy';

// Controllers
import { EssayAiController } from './essay-ai.controller';
import { EssayPromptController } from './essay-prompt.controller';
import { EssayPromptAdminController } from './essay-prompt-admin.controller';
import { EssayScraperController } from './essay-scraper.controller';

@Module({
  imports: [PrismaModule, AiAgentMemoryModule, PointsModule],
  controllers: [
    EssayAiController,
    EssayPromptController,
    EssayPromptAdminController,
    EssayScraperController,
  ],
  providers: [
    EssayAiService,
    EssayGalleryService,
    EssayPromptService,
    EssayScraperService,
    EssayScraperScheduler,
    AiValidatorService,
    OfficialScrapeStrategy,
    CollegeVineScrapeStrategy,
    LlmScrapeStrategy,
    CommonAppScrapeStrategy,
  ],
  exports: [EssayAiService, EssayGalleryService, EssayPromptService],
})
export class EssayModule {}
