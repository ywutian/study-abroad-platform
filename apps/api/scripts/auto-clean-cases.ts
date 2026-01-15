/**
 * 自动清洗案例数据
 *
 * 功能：
 * 1. 验证数据范围（GPA、SAT、ACT、TOEFL）
 * 2. 标准化学校名称
 * 3. 去除重复数据
 * 4. 标记异常数据供人工审核
 *
 * 使用方法：
 * npx ts-node scripts/auto-clean-cases.ts [options]
 *
 * 选项：
 * --dry-run    仅检查，不修改数据
 * --fix        自动修复可修复的问题
 * --delete     删除无法修复的数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 解析命令行参数
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const AUTO_FIX = args.includes('--fix');
const AUTO_DELETE = args.includes('--delete');

interface CleaningIssue {
  id: string;
  school: string;
  type: 'warning' | 'error' | 'fixable';
  field: string;
  message: string;
  currentValue: string | null;
  suggestedValue?: string | null;
}

interface CleaningStats {
  total: number;
  checked: number;
  issues: CleaningIssue[];
  fixed: number;
  deleted: number;
  flagged: number;
}

// 验证规则
const VALIDATION_RULES = {
  gpa: { min: 2.0, max: 4.5, warningMin: 3.0 },
  sat: { min: 800, max: 1600, warningMin: 1200 },
  act: { min: 1, max: 36, warningMin: 20 },
  toefl: { min: 60, max: 120, warningMin: 80 },
  year: { min: 2020, max: 2026 },
};

// Top 学校阈值（录取成绩下限）
const TOP_SCHOOL_THRESHOLDS: Record<number, { gpa: number; sat: number }> = {
  10: { gpa: 3.7, sat: 1450 },
  20: { gpa: 3.6, sat: 1400 },
  30: { gpa: 3.5, sat: 1350 },
  50: { gpa: 3.3, sat: 1300 },
};

function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  // 处理范围格式 "3.8-3.9" -> 取平均
  if (value.includes('-')) {
    const parts = value
      .split('-')
      .map((p) => parseFloat(p.replace(/[^\d.]/g, '')));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return (parts[0] + parts[1]) / 2;
    }
  }
  // 处理 "3.9+" 格式
  const num = parseFloat(value.replace(/[^\d.]/g, ''));
  return isNaN(num) ? null : num;
}

function validateGPA(value: string | null): {
  valid: boolean;
  issue?: string;
  suggestion?: string;
} {
  const num = parseNumericValue(value);
  if (num === null) return { valid: true }; // null 是允许的

  if (num > VALIDATION_RULES.gpa.max) {
    // 可能是百分制
    if (num >= 90 && num <= 100) {
      const converted = ((num / 100) * 4).toFixed(2);
      return {
        valid: false,
        issue: `GPA ${value} 可能是百分制`,
        suggestion: converted,
      };
    }
    return {
      valid: false,
      issue: `GPA ${value} 超出范围 (max: ${VALIDATION_RULES.gpa.max})`,
    };
  }

  if (num < VALIDATION_RULES.gpa.min) {
    return {
      valid: false,
      issue: `GPA ${value} 过低 (min: ${VALIDATION_RULES.gpa.min})`,
    };
  }

  return { valid: true };
}

function validateSAT(value: string | null): { valid: boolean; issue?: string } {
  const num = parseNumericValue(value);
  if (num === null) return { valid: true };

  if (num > VALIDATION_RULES.sat.max || num < VALIDATION_RULES.sat.min) {
    return {
      valid: false,
      issue: `SAT ${value} 超出范围 (${VALIDATION_RULES.sat.min}-${VALIDATION_RULES.sat.max})`,
    };
  }

  return { valid: true };
}

function validateACT(value: string | null): { valid: boolean; issue?: string } {
  const num = parseNumericValue(value);
  if (num === null) return { valid: true };

  if (num > VALIDATION_RULES.act.max || num < VALIDATION_RULES.act.min) {
    return {
      valid: false,
      issue: `ACT ${value} 超出范围 (${VALIDATION_RULES.act.min}-${VALIDATION_RULES.act.max})`,
    };
  }

  return { valid: true };
}

function validateTOEFL(value: string | null): {
  valid: boolean;
  issue?: string;
} {
  const num = parseNumericValue(value);
  if (num === null) return { valid: true };

  if (num > VALIDATION_RULES.toefl.max || num < VALIDATION_RULES.toefl.min) {
    return {
      valid: false,
      issue: `TOEFL ${value} 超出范围 (${VALIDATION_RULES.toefl.min}-${VALIDATION_RULES.toefl.max})`,
    };
  }

  return { valid: true };
}

function validateYear(value: number): { valid: boolean; issue?: string } {
  if (value < VALIDATION_RULES.year.min || value > VALIDATION_RULES.year.max) {
    return {
      valid: false,
      issue: `年份 ${value} 超出范围 (${VALIDATION_RULES.year.min}-${VALIDATION_RULES.year.max})`,
    };
  }
  return { valid: true };
}

function checkTopSchoolAdmission(
  rank: number | null,
  result: string,
  gpa: string | null,
  sat: string | null,
): { warning: boolean; message?: string } {
  if (!rank || result !== 'ADMITTED') return { warning: false };

  const gpaNum = parseNumericValue(gpa);
  const satNum = parseNumericValue(sat);

  // 找到对应的阈值
  let threshold = null;
  for (const [maxRank, thresholds] of Object.entries(TOP_SCHOOL_THRESHOLDS)) {
    if (rank <= parseInt(maxRank)) {
      threshold = thresholds;
      break;
    }
  }

  if (!threshold) return { warning: false };

  const issues: string[] = [];
  if (gpaNum && gpaNum < threshold.gpa) {
    issues.push(`GPA ${gpa} 低于 Top ${rank} 学校典型值 ${threshold.gpa}`);
  }
  if (satNum && satNum < threshold.sat) {
    issues.push(`SAT ${sat} 低于 Top ${rank} 学校典型值 ${threshold.sat}`);
  }

  if (issues.length > 0) {
    return { warning: true, message: issues.join('; ') };
  }

  return { warning: false };
}

function countMissingFields(c: any): number {
  let missing = 0;
  if (!c.gpaRange) missing++;
  if (!c.satRange && !c.actRange) missing++;
  if (!c.major) missing++;
  if (!c.round) missing++;
  if (c.tags.length === 0) missing++;
  return missing;
}

async function findDuplicates(): Promise<Map<string, string[]>> {
  const cases = await prisma.admissionCase.findMany({
    select: {
      id: true,
      schoolId: true,
      year: true,
      round: true,
      result: true,
      gpaRange: true,
      satRange: true,
    },
  });

  const duplicates = new Map<string, string[]>();
  const seen = new Map<string, string>();

  for (const c of cases) {
    // 生成唯一键
    const key = `${c.schoolId}|${c.year}|${c.round || ''}|${c.result}|${c.gpaRange || ''}|${c.satRange || ''}`;

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (!duplicates.has(existing)) {
        duplicates.set(existing, [c.id]);
      } else {
        duplicates.get(existing)!.push(c.id);
      }
    } else {
      seen.set(key, c.id);
    }
  }

  return duplicates;
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🧹 自动清洗工具');
  console.log('═'.repeat(50));
  console.log(
    `模式: ${DRY_RUN ? '仅检查 (dry-run)' : AUTO_FIX ? '自动修复' : AUTO_DELETE ? '自动删除' : '检查并报告'}`,
  );
  console.log('═'.repeat(50));
  console.log('');

  const stats: CleaningStats = {
    total: 0,
    checked: 0,
    issues: [],
    fixed: 0,
    deleted: 0,
    flagged: 0,
  };

  // 获取所有案例
  const cases = await prisma.admissionCase.findMany({
    include: {
      school: { select: { name: true, usNewsRank: true } },
    },
  });

  stats.total = cases.length;
  console.log(`📊 共 ${stats.total} 条案例待检查\n`);

  // 逐条检查
  for (const c of cases) {
    stats.checked++;
    const schoolName = c.school.name;
    const rank = c.school.usNewsRank;

    // 1. 验证 GPA
    const gpaCheck = validateGPA(c.gpaRange);
    if (!gpaCheck.valid) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: gpaCheck.suggestion ? 'fixable' : 'error',
        field: 'gpaRange',
        message: gpaCheck.issue!,
        currentValue: c.gpaRange,
        suggestedValue: gpaCheck.suggestion,
      });
    }

    // 2. 验证 SAT
    const satCheck = validateSAT(c.satRange);
    if (!satCheck.valid) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'error',
        field: 'satRange',
        message: satCheck.issue!,
        currentValue: c.satRange,
      });
    }

    // 3. 验证 ACT
    const actCheck = validateACT(c.actRange);
    if (!actCheck.valid) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'error',
        field: 'actRange',
        message: actCheck.issue!,
        currentValue: c.actRange,
      });
    }

    // 4. 验证 TOEFL
    const toeflCheck = validateTOEFL(c.toeflRange);
    if (!toeflCheck.valid) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'error',
        field: 'toeflRange',
        message: toeflCheck.issue!,
        currentValue: c.toeflRange,
      });
    }

    // 5. 验证年份
    const yearCheck = validateYear(c.year);
    if (!yearCheck.valid) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'error',
        field: 'year',
        message: yearCheck.issue!,
        currentValue: String(c.year),
      });
    }

    // 6. Top 学校录取成绩检查
    const topCheck = checkTopSchoolAdmission(
      rank,
      c.result,
      c.gpaRange,
      c.satRange,
    );
    if (topCheck.warning) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'warning',
        field: 'admission',
        message: topCheck.message!,
        currentValue: `GPA: ${c.gpaRange}, SAT: ${c.satRange}`,
      });
    }

    // 7. 字段缺失检查
    const missingCount = countMissingFields(c);
    if (missingCount >= 3) {
      stats.issues.push({
        id: c.id,
        school: schoolName,
        type: 'warning',
        field: 'completeness',
        message: `缺失 ${missingCount} 个关键字段`,
        currentValue: null,
      });
    }
  }

  // 8. 查找重复
  console.log('🔍 检查重复数据...');
  const duplicates = await findDuplicates();
  console.log(`   发现 ${duplicates.size} 组重复\n`);

  for (const [original, dupes] of duplicates) {
    for (const dupeId of dupes) {
      const c = cases.find((c) => c.id === dupeId);
      stats.issues.push({
        id: dupeId,
        school: c?.school.name || 'Unknown',
        type: 'error',
        field: 'duplicate',
        message: `与 ${original} 重复`,
        currentValue: null,
      });
    }
  }

  // 输出报告
  console.log('═'.repeat(50));
  console.log('📋 检查报告');
  console.log('═'.repeat(50));
  console.log(`检查: ${stats.checked} 条`);
  console.log(`问题: ${stats.issues.length} 个`);
  console.log('');

  // 按类型分组
  const byType = {
    error: stats.issues.filter((i) => i.type === 'error'),
    warning: stats.issues.filter((i) => i.type === 'warning'),
    fixable: stats.issues.filter((i) => i.type === 'fixable'),
  };

  console.log(`❌ 错误: ${byType.error.length}`);
  console.log(`⚠️  警告: ${byType.warning.length}`);
  console.log(`🔧 可修复: ${byType.fixable.length}`);
  console.log('');

  // 显示详细问题
  if (stats.issues.length > 0) {
    console.log('─'.repeat(50));
    console.log('详细问题列表 (前 50 条):');
    console.log('─'.repeat(50));

    for (const issue of stats.issues.slice(0, 50)) {
      const icon =
        issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : '🔧';
      console.log(`${icon} [${issue.field}] ${issue.school.slice(0, 30)}`);
      console.log(`   ${issue.message}`);
      if (issue.suggestedValue) {
        console.log(
          `   建议: ${issue.currentValue} -> ${issue.suggestedValue}`,
        );
      }
    }

    if (stats.issues.length > 50) {
      console.log(`\n... 还有 ${stats.issues.length - 50} 个问题未显示`);
    }
  }

  // 执行修复
  if (!DRY_RUN && (AUTO_FIX || AUTO_DELETE)) {
    console.log('\n═'.repeat(50));
    console.log('🔧 执行修复');
    console.log('═'.repeat(50));

    // 修复可修复的问题
    if (AUTO_FIX) {
      for (const issue of byType.fixable) {
        if (issue.suggestedValue !== undefined) {
          await prisma.admissionCase.update({
            where: { id: issue.id },
            data: { [issue.field]: issue.suggestedValue },
          });
          stats.fixed++;
          console.log(`✅ 修复: ${issue.school.slice(0, 30)} - ${issue.field}`);
        }
      }
    }

    // 删除重复和严重错误
    if (AUTO_DELETE) {
      const toDelete = byType.error
        .filter((i) => i.field === 'duplicate' || i.field === 'year')
        .map((i) => i.id);

      if (toDelete.length > 0) {
        await prisma.admissionCase.deleteMany({
          where: { id: { in: toDelete } },
        });
        stats.deleted = toDelete.length;
        console.log(`🗑️  删除: ${stats.deleted} 条问题数据`);
      }
    }

    // 标记需要人工审核的数据
    const toFlag = byType.warning.map((i) => i.id);
    // 这里可以添加一个 needsReview 字段，暂时跳过
    stats.flagged = toFlag.length;
  }

  // 最终统计
  console.log('\n═'.repeat(50));
  console.log('📊 清洗完成');
  console.log('═'.repeat(50));
  console.log(`检查: ${stats.checked}`);
  console.log(`问题: ${stats.issues.length}`);
  console.log(`修复: ${stats.fixed}`);
  console.log(`删除: ${stats.deleted}`);
  console.log(`标记待审: ${stats.flagged}`);

  // 输出问题 ID 列表供后续处理
  if (stats.issues.length > 0 && !AUTO_FIX && !AUTO_DELETE) {
    console.log(
      '\n💡 提示: 使用 --fix 自动修复可修复问题，使用 --delete 删除重复/错误数据',
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
