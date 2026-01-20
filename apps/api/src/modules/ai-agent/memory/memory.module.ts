/**
 * AI Agent Memory Sub-Module
 *
 * Encapsulates the enterprise memory system:
 * - Redis caching layer
 * - Embedding generation
 * - Persistent storage (Prisma)
 * - Memory scoring, decay, conflict resolution
 * - Memory compaction (scheduled)
 * - Sensitive data sanitization
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisModule } from '../../../common/redis/redis.module';

import { RedisCacheService } from './redis-cache.service';
import { EmbeddingService } from './embedding.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { SummarizerService } from './summarizer.service';
import { MemoryManagerService } from './memory-manager.service';
import { UserDataService } from './user-data.service';
import { MemoryScorerService } from './memory-scorer.service';
import { MemoryDecayService } from './memory-decay.service';
import { MemoryConflictService } from './memory-conflict.service';
import { MemoryExtractorService } from './memory-extractor.service';
import { MemoryCompactionService } from './memory-compaction.service';
import { SanitizerService } from './sanitizer.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  providers: [
    // Core
    RedisCacheService,
    EmbeddingService,
    PersistentMemoryService,
    SummarizerService,
    MemoryManagerService,
    UserDataService,

    // Enterprise Enhancement (Phase 1)
    MemoryScorerService,
    MemoryDecayService,
    MemoryConflictService,
    MemoryExtractorService,

    // Compaction (Phase 2)
    MemoryCompactionService,

    // Security - Sensitive Data Sanitization
    SanitizerService,
  ],
  exports: [
    MemoryManagerService,
    UserDataService,
    SanitizerService,
    RedisCacheService,
    EmbeddingService,
    MemoryDecayService,
    MemoryConflictService,
  ],
})
export class AiAgentMemoryModule {}
