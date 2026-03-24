/**
 * 共享种子脚本工具
 *
 * 所有种子脚本统一使用 upsertSchoolFromSeed()，
 * 确保 create 和 update 路径写入一致的字段集，消除字段遗漏 bug。
 */

import { PrismaClient } from '@prisma/client';
import { normalizeSchoolName } from '../../src/common/utils/school-name.util';

export { normalizeSchoolName };

/**
 * 种子脚本可提供的学校数据字段
 */
export interface SeedSchoolData {
  name: string;
  nameZh?: string;
  country?: string;
  state?: string;
  city?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  studentCount?: number;
  graduationRate?: number;
  avgSalary?: number;
  website?: string;
  isPrivate?: boolean;
  description?: string;
  descriptionZh?: string;
  aliases?: string[];
  /** External data source IDs */
  scorecardId?: string;
  ipedsId?: string;
  /** Promoted fields from schema */
  retentionRate?: number;
  studentFacultyRatio?: number;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  totalEnrollment?: number;
  satMath25?: number;
  satMath75?: number;
  satReading25?: number;
  satReading75?: number;
  /** Logo URL */
  logoUrl?: string;
  /** 额外 metadata 字段（deadlines, essayCount 等） */
  metadata?: Record<string, unknown>;
}

/**
 * 统一的种子脚本 upsert 逻辑
 *
 * - 按 nameNorm 查找已有记录
 * - 如已存在：只更新种子提供的非 undefined 字段（不覆盖 DB 中的已有值）
 * - 如不存在：创建新记录，写入所有字段
 * - 幂等安全：重跑不会丢失数据
 */
export async function upsertSchoolFromSeed(
  prisma: PrismaClient,
  data: SeedSchoolData,
): Promise<'created' | 'updated'> {
  const nameNorm = normalizeSchoolName(data.name);

  const existing = await prisma.school.findUnique({
    where: { nameNorm },
  });

  // 构建字段映射（create 和 update 共用）
  const fields: Record<string, unknown> = {};
  if (data.nameZh !== undefined) fields.nameZh = data.nameZh;
  if (data.state !== undefined) fields.state = data.state;
  if (data.city !== undefined) fields.city = data.city;
  if (data.usNewsRank !== undefined) fields.usNewsRank = data.usNewsRank;
  if (data.qsRank !== undefined) fields.qsRank = data.qsRank;
  if (data.acceptanceRate !== undefined)
    fields.acceptanceRate = data.acceptanceRate;
  if (data.tuition !== undefined) fields.tuition = data.tuition;
  if (data.satAvg !== undefined) fields.satAvg = data.satAvg;
  if (data.sat25 !== undefined) fields.sat25 = data.sat25;
  if (data.sat75 !== undefined) fields.sat75 = data.sat75;
  if (data.actAvg !== undefined) fields.actAvg = data.actAvg;
  if (data.act25 !== undefined) fields.act25 = data.act25;
  if (data.act75 !== undefined) fields.act75 = data.act75;
  if (data.studentCount !== undefined) fields.studentCount = data.studentCount;
  if (data.graduationRate !== undefined)
    fields.graduationRate = data.graduationRate;
  if (data.avgSalary !== undefined) fields.avgSalary = data.avgSalary;
  if (data.website !== undefined) fields.website = data.website;
  if (data.isPrivate !== undefined) fields.isPrivate = data.isPrivate;
  if (data.description !== undefined) fields.description = data.description;
  if (data.descriptionZh !== undefined)
    fields.descriptionZh = data.descriptionZh;
  if (data.aliases !== undefined) fields.aliases = data.aliases;
  if (data.scorecardId !== undefined) fields.scorecardId = data.scorecardId;
  if (data.ipedsId !== undefined) fields.ipedsId = data.ipedsId;
  if (data.retentionRate !== undefined)
    fields.retentionRate = data.retentionRate;
  if (data.studentFacultyRatio !== undefined)
    fields.studentFacultyRatio = data.studentFacultyRatio;
  if (data.testOptional !== undefined) fields.testOptional = data.testOptional;
  if (data.hasEarlyDecision !== undefined)
    fields.hasEarlyDecision = data.hasEarlyDecision;
  if (data.totalEnrollment !== undefined)
    fields.totalEnrollment = data.totalEnrollment;
  if (data.satMath25 !== undefined) fields.satMath25 = data.satMath25;
  if (data.satMath75 !== undefined) fields.satMath75 = data.satMath75;
  if (data.satReading25 !== undefined) fields.satReading25 = data.satReading25;
  if (data.satReading75 !== undefined) fields.satReading75 = data.satReading75;
  if (data.logoUrl !== undefined) fields.logoUrl = data.logoUrl;

  if (existing) {
    // 合并 metadata：保留 DB 已有的 metadata，用种子的覆盖/补充
    const updateData: Record<string, unknown> = { ...fields };
    if (data.metadata) {
      const existingMeta = (existing.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...existingMeta, ...data.metadata };
    }

    await prisma.school.update({
      where: { id: existing.id },
      data: updateData,
    });
    return 'updated';
  } else {
    const createData: Record<string, unknown> = {
      name: data.name,
      nameNorm,
      country: data.country || 'US',
      ...fields,
    };
    if (data.metadata) {
      createData.metadata = data.metadata;
    }

    await prisma.school.create({ data: createData as any });
    return 'created';
  }
}

/**
 * 批量 upsert + 统计日志
 */
export async function batchUpsertSchools(
  prisma: PrismaClient,
  schools: SeedSchoolData[],
  label: string,
): Promise<{ created: number; updated: number; errors: number }> {
  console.log(`\n🏫 ${label}`);
  console.log('='.repeat(60));

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const school of schools) {
    try {
      const result = await upsertSchoolFromSeed(prisma, school);
      if (result === 'created') {
        created++;
        console.log(`✅ 新建: ${school.nameZh || school.name}`);
      } else {
        updated++;
        console.log(`📝 更新: ${school.nameZh || school.name}`);
      }
    } catch (err: any) {
      console.log(`❌ ${school.name}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 统计:`);
  console.log(`   新建: ${created}`);
  console.log(`   更新: ${updated}`);
  console.log(`   失败: ${errors}`);
  console.log(`   总计: ${schools.length}`);

  return { created, updated, errors };
}
