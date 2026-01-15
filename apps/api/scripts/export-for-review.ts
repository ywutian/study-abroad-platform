/**
 * 导出案例数据供人工核验
 *
 * 功能：
 * 1. 导出全部或未核验的案例到 CSV
 * 2. 包含核验状态列供人工填写
 * 3. 支持按学校、年份等筛选
 *
 * 使用方法：
 * npx ts-node scripts/export-for-review.ts [options]
 *
 * 选项：
 * --output <file>     输出文件路径（默认 data/review_YYYYMMDD.csv）
 * --unverified        仅导出未核验的案例
 * --school <name>     按学校名筛选
 * --year <year>       按年份筛选
 * --limit <number>    限制导出数量
 *
 * 示例：
 * npx ts-node scripts/export-for-review.ts --output review.csv
 * npx ts-node scripts/export-for-review.ts --unverified --limit 100
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// 生成默认文件名
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const defaultOutput = `data/review_${today}.csv`;

const CONFIG = {
  output: getArg('output', defaultOutput),
  unverifiedOnly: hasFlag('unverified'),
  school: getArg('school', ''),
  year: getArg('year', ''),
  limit: parseInt(getArg('limit', '0')) || undefined,
};

// CSV 转义
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 提取数据来源
function extractSource(tags: string[]): string {
  const sourceTag = tags.find((t) => t.startsWith('source:'));
  if (sourceTag) {
    return sourceTag.replace('source:', '');
  }
  return 'unknown';
}

async function main() {
  console.log('═'.repeat(50));
  console.log('📤 导出案例数据供核验');
  console.log('═'.repeat(50));
  console.log(`输出文件: ${CONFIG.output}`);
  console.log(`仅未核验: ${CONFIG.unverifiedOnly}`);
  if (CONFIG.school) console.log(`学校筛选: ${CONFIG.school}`);
  if (CONFIG.year) console.log(`年份筛选: ${CONFIG.year}`);
  if (CONFIG.limit) console.log(`数量限制: ${CONFIG.limit}`);
  console.log('═'.repeat(50));
  console.log('');

  // 构建查询条件
  const where: any = {};

  if (CONFIG.unverifiedOnly) {
    where.isVerified = false;
  }

  if (CONFIG.school) {
    where.school = {
      name: { contains: CONFIG.school, mode: 'insensitive' },
    };
  }

  if (CONFIG.year) {
    where.year = parseInt(CONFIG.year);
  }

  // 查询数据
  console.log('🔍 查询数据...');
  const cases = await prisma.admissionCase.findMany({
    where,
    include: {
      school: { select: { name: true, usNewsRank: true } },
    },
    orderBy: [
      { school: { usNewsRank: 'asc' } },
      { year: 'desc' },
      { result: 'asc' },
    ],
    take: CONFIG.limit,
  });

  console.log(`📊 共 ${cases.length} 条案例\n`);

  if (cases.length === 0) {
    console.log('没有数据可导出');
    return;
  }

  // 确保输出目录存在
  const outputDir = path.dirname(CONFIG.output);
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // CSV 表头
  const headers = [
    'id',
    'rank',
    'school',
    'major',
    'year',
    'round',
    'result',
    'gpa',
    'sat',
    'act',
    'toefl',
    'tags',
    'source',
    'isVerified',
    'status', // 待填写：通过/修改/删除
    'notes', // 待填写：修改内容或删除原因
  ];

  // 构建 CSV 内容
  const rows: string[] = [headers.join(',')];

  for (const c of cases) {
    const source = extractSource(c.tags);
    const tagsWithoutSource = c.tags.filter((t) => !t.startsWith('source:'));

    const row = [
      escapeCSV(c.id),
      escapeCSV(c.school.usNewsRank ? `#${c.school.usNewsRank}` : 'LAC'),
      escapeCSV(c.school.name),
      escapeCSV(c.major),
      escapeCSV(String(c.year)),
      escapeCSV(c.round),
      escapeCSV(c.result),
      escapeCSV(c.gpaRange),
      escapeCSV(c.satRange),
      escapeCSV(c.actRange),
      escapeCSV(c.toeflRange),
      escapeCSV(tagsWithoutSource.join(';')),
      escapeCSV(source),
      escapeCSV(c.isVerified ? '是' : '否'),
      '待核验', // status 默认值
      '', // notes 空
    ];

    rows.push(row.join(','));
  }

  // 写入文件
  const csvContent = rows.join('\n');
  fs.writeFileSync(CONFIG.output, '\ufeff' + csvContent, 'utf-8'); // 添加 BOM 以支持 Excel

  console.log('═'.repeat(50));
  console.log('✅ 导出完成');
  console.log('═'.repeat(50));
  console.log(`文件: ${CONFIG.output}`);
  console.log(`记录: ${cases.length} 条`);
  console.log(`大小: ${(Buffer.byteLength(csvContent) / 1024).toFixed(2)} KB`);
  console.log('');
  console.log('📝 核验说明：');
  console.log('  1. 用 Excel 或 Google Sheets 打开 CSV');
  console.log('  2. 检查每条数据的准确性');
  console.log('  3. 在 status 列填写：');
  console.log('     - "通过" = 数据正确');
  console.log('     - "修改" = 需要修改（在 notes 列写明修改内容）');
  console.log('     - "删除" = 数据错误需删除');
  console.log('  4. 保存并运行 import-review-results.ts 导入结果');

  // 统计
  const byResult = cases.reduce(
    (acc, c) => {
      acc[c.result] = (acc[c.result] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const bySource = cases.reduce(
    (acc, c) => {
      const source = extractSource(c.tags);
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log('\n📊 数据分布：');
  console.log(
    '结果:',
    Object.entries(byResult)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', '),
  );
  console.log(
    '来源:',
    Object.entries(bySource)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', '),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
