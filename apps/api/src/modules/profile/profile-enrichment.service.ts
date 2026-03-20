import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { MemoryType } from '@prisma/client';

export interface EnrichmentSuggestion {
  field: string;
  currentValue: string | null;
  suggestedValue: string;
  source: string; // memory category that produced this
  confidence: number; // 0-1
}

/**
 * Scans user FACT memories and compares with Profile fields
 * to generate auto-fill suggestions for incomplete fields.
 *
 * Suggestions require user confirmation before applying.
 */
@Injectable()
export class ProfileEnrichmentService {
  private readonly logger = new Logger(ProfileEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly memoryManager?: MemoryManagerService,
  ) {}

  /**
   * Generate enrichment suggestions by comparing FACT memories with profile gaps.
   */
  async getSuggestions(userId: string): Promise<EnrichmentSuggestion[]> {
    if (!this.memoryManager) return [];

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { testScores: true },
    });

    if (!profile) return [];

    // Recall FACT memories about this user
    const memories = await this.memoryManager.recall(userId, {
      types: [MemoryType.FACT],
      limit: 50,
      useSemanticSearch: false,
    });

    if (memories.length === 0) return [];

    const suggestions: EnrichmentSuggestion[] = [];

    for (const mem of memories) {
      const content = mem.content;

      // Extract GPA mentions
      if (!profile.gpa && mem.category === 'academic') {
        const gpaMatch = content.match(
          /GPA[：:\s]*(\d+\.?\d*)\s*[/／]\s*(\d+\.?\d*)/i,
        );
        if (gpaMatch) {
          suggestions.push({
            field: 'gpa',
            currentValue: null,
            suggestedValue: gpaMatch[1],
            source: 'academic memory',
            confidence: 0.7,
          });
        }
      }

      // Extract target major mentions
      if (!profile.targetMajor && mem.category === 'profile_update') {
        const majorMatch = content.match(
          /(?:目标专业|intended major|target major)[：:\s]*(.+?)(?:[，,。.]|$)/i,
        );
        if (majorMatch) {
          suggestions.push({
            field: 'targetMajor',
            currentValue: null,
            suggestedValue: majorMatch[1].trim(),
            source: 'profile_update memory',
            confidence: 0.8,
          });
        }
      }

      // Extract school mentions
      if (!profile.currentSchool && mem.category === 'education') {
        const schoolMatch = content.match(
          /(?:就读|在|学校)[：:\s]*(.+?)(?:[，,。.]|$)/,
        );
        if (schoolMatch) {
          suggestions.push({
            field: 'currentSchool',
            currentValue: null,
            suggestedValue: schoolMatch[1].trim(),
            source: 'education memory',
            confidence: 0.6,
          });
        }
      }

      // Extract nationality mentions
      if (!profile.nationality) {
        const natMatch = content.match(
          /(?:国籍|nationality|来自)[：:\s]*(.+?)(?:[，,。.]|$)/i,
        );
        if (natMatch) {
          suggestions.push({
            field: 'nationality',
            currentValue: null,
            suggestedValue: natMatch[1].trim(),
            source: `${mem.category} memory`,
            confidence: 0.6,
          });
        }
      }
    }

    // Deduplicate: keep highest confidence per field
    const bestPerField = new Map<string, EnrichmentSuggestion>();
    for (const s of suggestions) {
      const existing = bestPerField.get(s.field);
      if (!existing || s.confidence > existing.confidence) {
        bestPerField.set(s.field, s);
      }
    }

    return Array.from(bestPerField.values());
  }
}
