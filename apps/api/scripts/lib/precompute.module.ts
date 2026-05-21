/**
 * Slim Nest module for one-off CLI scripts that need PrismaService +
 * LLMService + EssayAiService **without** booting the full HTTP graph.
 *
 * Why this exists
 * ---------------
 * Importing `AppModule` from standalone CLI scripts (e.g.
 * `scripts/precompute-dogfood-analyses.ts`) drags in EmailModule,
 * ThrottlerModule, AiAgentModule's full controller surface, etc. Some of
 * those modules — notably EmailService — fail to instantiate in the
 * standalone `NestFactory.createApplicationContext` path.
 *
 * Bootstrap-bug root cause (PR4, 2026-05-20)
 * ------------------------------------------
 * Two cascading problems:
 *
 *   1. `AppModule` is too heavy for a CLI: EmailModule, ThrottlerModule,
 *      AiAgentModule's full controller surface, schedulers, global
 *      guards, etc. all instantiate eagerly.
 *
 *   2. `tsx` (the CLI runner used by `pnpm --filter api exec tsx`) is
 *      backed by esbuild, which **does not emit TypeScript decorator
 *      parameter metadata**. Nest relies on that metadata to infer
 *      constructor injection types: `constructor(private cs: ConfigService)`
 *      becomes effectively `constructor(undefined)` at runtime when
 *      `reflect-metadata` finds no `design:paramtypes`. The symptom is:
 *        `TypeError: Cannot read properties of undefined (reading 'get')`
 *      at the first `.get()` call inside the constructor.
 *
 *      The dev server is unaffected because `nest start` uses
 *      ts-loader/swc with metadata emission. The production build is
 *      unaffected because `tsc -p tsconfig.build.json` emits metadata.
 *      Only `tsx`-run CLI scripts hit this trap.
 *
 * The fix: for every provider whose constructor takes a type that Nest
 * normally resolves by reflection, we re-register it locally with an
 * **explicit `useFactory`** so Nest doesn't need decorator metadata.
 * We also dotenv-preload `.env` so `process.env` is populated before
 * any Nest evaluation, defending in depth.
 *
 * Surface
 * -------
 * Exports `PrismaService`, `LLMService`, `EssayAiService`. That's the
 * intersection of what `precompute-gallery-analysis.ts` and
 * `precompute-dogfood-analyses.ts` use.
 *
 * NOT included by design:
 *   - EmailModule (cause of the original failure — not needed by scripts)
 *   - NotificationModule (unused by EssayAiService despite being in EssayModule)
 *   - AiAgentMemoryModule (MemoryManagerService is @Optional on EssayAiService)
 *   - ThrottlerModule (no HTTP requests in a CLI)
 *   - AppModule's global guards, interceptors, schedulers
 */

// Eagerly load .env BEFORE any Nest module evaluation.
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { RedisService } from '../../src/common/redis/redis.service';
import { RedisMetricsCollector } from '../../src/common/redis/redis-metrics.service';
import { CacheInvalidationService } from '../../src/common/redis/cache-invalidation.service';
import { PointsService } from '../../src/modules/points/incentive.service';
import { PointsConfigService } from '../../src/modules/points/points-config.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { EssayAiService } from '../../src/modules/essay/essay-ai.service';
import { validateEnv } from '../../src/common/config/env.validation';

// LLM stack — provided locally with explicit useFactory to dodge the
// esbuild-strips-decorator-metadata problem.
import { OpenAIProvider } from '../../src/modules/ai-agent/providers/openai.provider';
import { LLM_PROVIDER_TOKEN } from '../../src/modules/ai-agent/providers/llm-provider.interface';
import { ResilienceService } from '../../src/modules/ai-agent/core/resilience.service';
import { TokenTrackerService } from '../../src/modules/ai-agent/core/token-tracker.service';
import { LLMService } from '../../src/modules/ai-agent/core/llm.service';

// EssayDebate stack — PR5 adds this so seed-lumni-debate-turns.ts can call
// the real `EssayDebateService.createOrContinueTurn()` end-to-end (real
// context loader, real evidence-strip, real Redis budget counter). Same
// useFactory pattern as the rest of this module to dodge the
// esbuild-strips-decorator-metadata issue.
import { EssayDebateService } from '../../src/modules/essay-debate/essay-debate.service';
import { DebateBudgetService } from '../../src/modules/essay-debate/debate-budget.service';
import { DebateContextLoaderService } from '../../src/modules/essay-debate/debate-context-loader.service';

/**
 * A self-contained Redis sub-module that explicitly wires providers via
 * useFactory, since the production `RedisModule` injects ConfigService
 * by parameter reflection (broken under tsx/esbuild).
 */
@Global()
@Module({
  providers: [
    {
      provide: RedisMetricsCollector,
      useFactory: () => new RedisMetricsCollector(),
      inject: [],
    },
    {
      provide: RedisService,
      useFactory: (config: ConfigService, metrics: RedisMetricsCollector) =>
        new RedisService(config, metrics),
      inject: [ConfigService, RedisMetricsCollector],
    },
    {
      provide: CacheInvalidationService,
      useFactory: (redis: RedisService, prisma: PrismaService) =>
        new CacheInvalidationService(redis, prisma),
      inject: [RedisService, PrismaService],
    },
  ],
  exports: [RedisMetricsCollector, RedisService, CacheInvalidationService],
})
class CliRedisModule {}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    CliRedisModule,
  ],
  providers: [
    // -- LLM stack ------------------------------------------------------
    {
      provide: OpenAIProvider,
      useFactory: (config: ConfigService) => new OpenAIProvider(config),
      inject: [ConfigService],
    },
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, openai: OpenAIProvider) => {
        const provider = config.get<string>('LLM_PROVIDER', 'openai');
        switch (provider) {
          case 'openai':
          default:
            return openai;
        }
      },
      inject: [ConfigService, OpenAIProvider],
    },
    {
      provide: ResilienceService,
      useFactory: (redis: RedisService) => new ResilienceService(redis),
      inject: [RedisService],
    },
    {
      provide: TokenTrackerService,
      useFactory: (redis: RedisService, prisma: PrismaService) =>
        new TokenTrackerService(redis, prisma),
      inject: [RedisService, PrismaService],
    },
    {
      provide: LLMService,
      useFactory: (
        config: ConfigService,
        provider: import('../../src/modules/ai-agent/providers/llm-provider.interface').ILLMProvider,
        resilience: ResilienceService,
        tracker: TokenTrackerService,
      ) =>
        new LLMService(
          config,
          provider,
          resilience,
          tracker,
          /* promptGuard @Optional */ undefined,
        ),
      inject: [
        ConfigService,
        LLM_PROVIDER_TOKEN,
        ResilienceService,
        TokenTrackerService,
      ],
    },

    // -- Settings + Points (deps of EssayAiService) ---------------------
    {
      provide: SettingsService,
      useFactory: (prisma: PrismaService, redis: RedisService) =>
        new SettingsService(prisma, redis),
      inject: [PrismaService, RedisService],
    },
    {
      provide: PointsConfigService,
      useFactory: (settings: SettingsService) =>
        new PointsConfigService(settings),
      inject: [SettingsService],
    },
    {
      provide: PointsService,
      useFactory: (prisma: PrismaService, pc: PointsConfigService) =>
        new PointsService(prisma, pc),
      inject: [PrismaService, PointsConfigService],
    },

    // -- Essay AI -------------------------------------------------------
    {
      provide: EssayAiService,
      useFactory: (
        prisma: PrismaService,
        llm: LLMService,
        points: PointsService,
      ) =>
        new EssayAiService(prisma, llm, points /* memoryManager @Optional */),
      inject: [PrismaService, LLMService, PointsService],
    },

    // -- Essay Debate (PR5 — seed-lumni-debate-turns.ts) ----------------
    // Constructor signatures (verified 2026-05-20):
    //   DebateBudgetService(redis)
    //   DebateContextLoaderService(prisma)
    //   EssayDebateService(prisma, points, budget, contextLoader, llm)
    {
      provide: DebateBudgetService,
      useFactory: (redis: RedisService) => new DebateBudgetService(redis),
      inject: [RedisService],
    },
    {
      provide: DebateContextLoaderService,
      useFactory: (prisma: PrismaService) =>
        new DebateContextLoaderService(prisma),
      inject: [PrismaService],
    },
    {
      provide: EssayDebateService,
      useFactory: (
        prisma: PrismaService,
        points: PointsService,
        budget: DebateBudgetService,
        contextLoader: DebateContextLoaderService,
        llm: LLMService,
      ) => new EssayDebateService(prisma, points, budget, contextLoader, llm),
      inject: [
        PrismaService,
        PointsService,
        DebateBudgetService,
        DebateContextLoaderService,
        LLMService,
      ],
    },
  ],
  exports: [EssayAiService, LLMService, EssayDebateService],
})
export class PrecomputeModule {}
