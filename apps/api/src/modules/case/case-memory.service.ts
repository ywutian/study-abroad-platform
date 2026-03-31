import { Injectable, Logger, Optional } from '@nestjs/common';
import { MemoryType, EntityType } from '@prisma/client';
import { getSchoolDisplayName } from '../../common/utils/locale.util';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import {
  parseCaseActivities,
  parseCaseAwards,
  parseCaseTestScores,
} from '../../common/constants/data-formats';

@Injectable()
export class CaseMemoryService {
  private readonly logger = new Logger(CaseMemoryService.name);

  constructor(
    @Optional()
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 记录创建录取案例到记忆系统
   */
  async recordCreateCaseToMemory(
    userId: string,
    admissionCase: any,
    data: any,
    locale = 'zh',
  ): Promise<void> {
    if (!this.memoryManager) return;
    // Skip memory for bulk imports — too noisy
    if (data.source === 'csv_import' || data.source === 'reddit') return;

    try {
      const isZh = locale === 'zh';
      const schoolName = admissionCase.school
        ? getSchoolDisplayName(admissionCase.school, locale)
        : isZh
          ? '未知学校'
          : 'Unknown school';
      const resultText = isZh
        ? data.result === 'ADMITTED'
          ? '录取'
          : data.result === 'REJECTED'
            ? '拒绝'
            : data.result === 'WAITLISTED'
              ? '候补'
              : data.result
        : data.result.toLowerCase();

      // Parse structured fields for rich memory content
      const activities = parseCaseActivities(admissionCase.activities);
      const awards = parseCaseAwards(admissionCase.awards);
      const testScores = parseCaseTestScores(admissionCase.testScores);
      const satScore = testScores.find((t: any) => t.type === 'SAT');
      const actScore = testScores.find((t: any) => t.type === 'ACT');

      // Build rich memory content
      const parts = isZh
        ? [
            `用户分享了${data.year}年${schoolName}的${resultText}案例`,
            data.major && `专业：${data.major}`,
            data.gpaRange && `GPA：${data.gpaRange}`,
            satScore && `SAT：${satScore.score}`,
            actScore && `ACT：${actScore.score}`,
            activities.length > 0 &&
              `活动：${activities.length}项 (${activities
                .slice(0, 3)
                .map((a: any) => a.description)
                .join('、')})`,
            awards.length > 0 &&
              `奖项：${awards.length}项 (${awards
                .slice(0, 3)
                .map((a: any) => a.name)
                .join('、')})`,
            admissionCase.highSchoolType &&
              `高中类型：${admissionCase.highSchoolType}`,
            admissionCase.curriculumType &&
              `课程体系：${admissionCase.curriculumType}`,
          ]
        : [
            `User shared a ${data.year} ${resultText} case for ${schoolName}`,
            data.major && `Major: ${data.major}`,
            data.gpaRange && `GPA: ${data.gpaRange}`,
            satScore && `SAT: ${satScore.score}`,
            actScore && `ACT: ${actScore.score}`,
            activities.length > 0 &&
              `Activities: ${activities.length} (${activities
                .slice(0, 3)
                .map((a: any) => a.description)
                .join(', ')})`,
            awards.length > 0 &&
              `Awards: ${awards.length} (${awards
                .slice(0, 3)
                .map((a: any) => a.name)
                .join(', ')})`,
            admissionCase.highSchoolType &&
              `HS Type: ${admissionCase.highSchoolType}`,
            admissionCase.curriculumType &&
              `Curriculum: ${admissionCase.curriculumType}`,
          ];

      await this.memoryManager.remember(userId, {
        type: MemoryType.DECISION,
        category: 'admission_case',
        content: parts.filter(Boolean).join(isZh ? '。' : '. '),
        importance: 0.8,
        metadata: {
          caseId: admissionCase.id,
          schoolId: data.schoolId,
          year: data.year,
          result: data.result,
          major: data.major,
          round: data.round,
          gpaRange: data.gpaRange,
          satScore: satScore?.score,
          activityCount: activities.length,
          awardCount: awards.length,
          highSchoolType: admissionCase.highSchoolType,
          curriculumType: admissionCase.curriculumType,
          demographicTags: admissionCase.demographicTags,
        },
      });

      // 记录学校实体
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: schoolName,
        description: isZh
          ? `${data.year}年申请，结果：${resultText}`
          : `${data.year} application, result: ${resultText}`,
        attributes: {
          schoolId: data.schoolId,
          result: data.result,
          year: data.year,
          major: data.major,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record create case to memory', error);
    }
  }

  /**
   * 记录浏览案例到记忆系统
   */
  async recordViewCaseToMemory(
    userId: string,
    caseItem: any,
    locale = 'zh',
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const isZh = locale === 'zh';
      const schoolName = caseItem.school
        ? getSchoolDisplayName(caseItem.school, locale)
        : isZh
          ? '未知学校'
          : 'Unknown school';

      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'case_view',
        content: isZh
          ? `用户查看了${caseItem.year}年${schoolName}的${caseItem.result === 'ADMITTED' ? '录取' : '申请'}案例`
          : `User viewed a ${caseItem.year} ${caseItem.result === 'ADMITTED' ? 'admission' : 'application'} case for ${schoolName}`,
        importance: 0.3,
        metadata: {
          caseId: caseItem.id,
          schoolId: caseItem.schoolId,
          year: caseItem.year,
          result: caseItem.result,
          viewedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view case to memory', error);
    }
  }
}
