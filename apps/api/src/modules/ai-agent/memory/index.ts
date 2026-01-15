// Types
export * from './types';

// Services - Core
export { RedisCacheService } from './redis-cache.service';
export { EmbeddingService } from './embedding.service';
export { PersistentMemoryService } from './persistent-memory.service';
export { SummarizerService } from './summarizer.service';
export { MemoryManagerService } from './memory-manager.service';
export { UserDataService } from './user-data.service';

// Services - Sanitization (P0.2 Security)
export { SanitizerService, SanitizeLevel } from './sanitizer.service';
export type {
  SanitizeOptions,
  SanitizeResult,
  SensitiveDetectionResult,
} from './sanitizer.service';

// Services - Enterprise (Phase 1)
export { MemoryScorerService, MemoryTier } from './memory-scorer.service';
export type {
  ScoringConfig,
  ScoringWeights,
  MemoryScoreInput,
  MemoryScoreResult,
} from './memory-scorer.service';

export { MemoryDecayService } from './memory-decay.service';
export type {
  DecayConfig,
  DecayResult,
  MemoryDecayStats,
} from './memory-decay.service';

export {
  MemoryConflictService,
  ConflictStrategy,
} from './memory-conflict.service';
export type {
  ConflictDetectionResult,
  ConflictResolutionResult,
  DedupeRule,
} from './memory-conflict.service';

export { MemoryExtractorService } from './memory-extractor.service';
export type {
  ExtractionResult,
  ExtractionContext,
} from './memory-extractor.service';

// Services - Enterprise (Phase 2: Compaction)
export { MemoryCompactionService } from './memory-compaction.service';
export type {
  CompactionResult,
  CompactionConfig,
} from './memory-compaction.service';

// Rules
export * from './extraction-rules';
