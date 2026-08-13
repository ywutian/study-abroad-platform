import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { MemoryType, EntityType } from '@prisma/client';
import {
  UpdateProfileDto,
  CreateTestScoreDto,
  CreateActivityDto,
  CreateAwardDto,
  CreateEducationDto,
  CreateEssayDto,
} from './dto';

interface TargetSchoolMemoryRecord {
  schoolId: string;
  priority?: number | null;
  school?: { name: string; nameZh?: string | null } | null;
}

/**
 * Handles all memory system recording for profile-related events.
 * Contains all 11 record*ToMemory() methods.
 */
@Injectable()
export class ProfileMemoryService {
  private readonly logger = new Logger(ProfileMemoryService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * Record a profile update event to the memory system as a FACT memory.
   *
   * Only records when meaningful fields changed (targetMajor, GPA, regionPref).
   * No-ops if memoryManager is not available or no significant updates exist.
   *
   * @param userId - The user identifier
   * @param data - The profile update DTO (used to detect which fields changed)
   */
  async recordProfileUpdateToMemory(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    const updates: string[] = [];
    if (data.targetMajor) updates.push(`意向专业: ${data.targetMajor}`);
    if (data.gpa) updates.push(`GPA: ${data.gpa}`);
    if (data.regionPref)
      updates.push(`地区偏好: ${data.regionPref.join(', ')}`);

    if (updates.length === 0) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'profile_update',
      content: `用户更新了档案信息：${updates.join('，')}`,
      importance: 0.6,
      metadata: {
        action: 'profile_update',
        updates: Object.keys(data),
      },
    });
  }

  /**
   * Record a new test score to the memory system as a high-importance FACT memory (0.8).
   *
   * @param userId - The user identifier
   * @param data - The test score creation DTO
   */
  async recordTestScoreToMemory(
    userId: string,
    data: CreateTestScoreDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'test_score',
      content: `用户添加了${data.type}成绩：${data.score}分${data.testDate ? '，考试日期' + data.testDate : ''}`,
      importance: 0.8,
      metadata: {
        scoreType: data.type,
        score: data.score,
        subScores: data.subScores,
        testDate: data.testDate,
      },
    });
  }

  /**
   * Record a new activity to the memory system as a FACT memory.
   *
   * @param userId - The user identifier
   * @param data - The activity creation DTO
   */
  async recordActivityToMemory(
    userId: string,
    data: CreateActivityDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'activity',
      content: `用户添加了活动经历：${data.name}（${data.category || '其他'}类别），担任${data.role || '成员'}${data.organization ? '，在' + data.organization : ''}`,
      importance: 0.6,
      metadata: {
        activityName: data.name,
        category: data.category,
        role: data.role,
        organization: data.organization,
        hoursPerWeek: data.hoursPerWeek,
        isOngoing: data.isOngoing,
      },
    });
  }

  /**
   * Record a new award to the memory system as a FACT memory.
   *
   * @param userId - The user identifier
   * @param data - The award creation DTO
   */
  async recordAwardToMemory(
    userId: string,
    data: CreateAwardDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'award',
      content: `用户添加了奖项：${data.name}（${data.level || '其他'}级别${data.year ? '，' + data.year + '年' : ''}）`,
      importance: 0.7,
      metadata: {
        awardName: data.name,
        level: data.level,
        year: data.year,
      },
    });
  }

  /**
   * Record a new education entry to the memory system as a FACT memory.
   *
   * @param userId - The user identifier
   * @param data - The education creation DTO
   */
  async recordEducationToMemory(
    userId: string,
    data: CreateEducationDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    // If a high school is linked, include tier info in memory
    let hsLabel = '';
    if (data.highSchoolId && data.schoolType === 'HIGH_SCHOOL') {
      try {
        const hs = await this.prisma.highSchool.findUnique({
          where: { id: data.highSchoolId },
          select: { name: true, tier: true, type: true },
        });
        if (hs) {
          hsLabel = `（Tier ${hs.tier}，${hs.type}）`;
        }
      } catch {
        // ignore — memory enrichment is best-effort
      }
    }

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: data.schoolType === 'HIGH_SCHOOL' ? 'academic' : 'education',
      content:
        data.schoolType === 'HIGH_SCHOOL'
          ? `用户高中背景：${data.schoolName}${hsLabel}`
          : `用户添加了教育经历：${data.schoolName}${data.degree ? '，' + data.degree + '学位' : ''}${data.major ? '，' + data.major + '专业' : ''}${data.gpa ? '，GPA' + data.gpa : ''}`,
      importance: data.schoolType === 'HIGH_SCHOOL' ? 0.8 : 0.7,
      metadata: {
        schoolName: data.schoolName,
        schoolType: data.schoolType,
        degree: data.degree,
        major: data.major,
        gpa: data.gpa,
        highSchoolId: data.highSchoolId,
        dedupeKey:
          data.schoolType === 'HIGH_SCHOOL' ? 'high_school' : undefined,
      },
    });
  }

  /**
   * Record a new essay creation to the memory system as a FACT memory.
   *
   * @param userId - The user identifier
   * @param data - The essay creation DTO
   * @param wordCount - The computed word count of the essay content
   */
  async recordEssayToMemory(
    userId: string,
    data: CreateEssayDto,
    wordCount: number,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'essay',
      content: `用户创建了文书：标题"${data.title}"${data.prompt ? '，题目"' + data.prompt.slice(0, 50) + '..."' : ''}，共${wordCount}词`,
      importance: 0.6,
      metadata: {
        title: data.title,
        promptPreview: data.prompt?.slice(0, 100),
        wordCount,
        schoolId: data.schoolId,
      },
    });
  }

  /**
   * Record a target school addition to the memory system as a PREFERENCE memory
   * and upsert a SCHOOL entity in the memory graph.
   *
   * @param userId - The user identifier
   * @param schoolId - The school ID being added
   * @param schoolName - Optional school display name for the entity record
   */
  async recordTargetSchoolAddToMemory(
    userId: string,
    schoolId: string,
    schoolName?: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.PREFERENCE,
      category: 'target_school',
      content: `用户将${schoolName || schoolId}添加为目标学校`,
      importance: 0.8,
      metadata: {
        action: 'add_target_school',
        schoolId,
        schoolName,
      },
    });

    // 记录学校实体
    if (schoolName) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: schoolName,
        description: '用户的目标学校',
        attributes: { isTarget: true },
      });
    }
  }

  /**
   * Record a target school removal to the memory system as a DECISION memory.
   *
   * @param userId - The user identifier
   * @param schoolId - The school ID being removed
   */
  async recordTargetSchoolRemovalToMemory(
    userId: string,
    schoolId: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'target_school',
      content: `用户从目标学校列表中移除了一所学校`,
      importance: 0.5,
      metadata: {
        action: 'remove_target_school',
        schoolId,
      },
    });
  }

  /**
   * Record a bulk target-school-list update to the memory system as a DECISION memory.
   *
   * Also upserts SCHOOL entities for each target school with priority metadata.
   *
   * @param userId - The user identifier
   * @param targetSchools - The full list of new target school records with school relation
   */
  async recordSetTargetSchoolsToMemory(
    userId: string,
    targetSchools: TargetSchoolMemoryRecord[],
  ): Promise<void> {
    if (!this.memoryManager || targetSchools.length === 0) return;

    const schoolNames = targetSchools
      .slice(0, 5)
      .map((ts) => ts.school?.name || ts.school?.nameZh || ts.schoolId)
      .join('、');

    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'target_school_list',
      content: `用户设置了${targetSchools.length}所目标学校：${schoolNames}${targetSchools.length > 5 ? '等' : ''}`,
      importance: 0.8,
      metadata: {
        action: 'set_target_schools',
        count: targetSchools.length,
        schoolIds: targetSchools.map((ts) => ts.schoolId),
      },
    });

    // 记录学校实体
    for (const ts of targetSchools) {
      const schoolName = ts.school?.name || ts.school?.nameZh;
      if (schoolName) {
        await this.memoryManager.recordEntity(userId, {
          type: EntityType.SCHOOL,
          name: schoolName,
          description: `用户的目标学校，优先级${ts.priority}`,
          attributes: { isTarget: true, priority: ts.priority ?? undefined },
        });
      }
    }
  }
}
