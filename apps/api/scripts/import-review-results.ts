/**
 * 导入人工核验结果
 *
 * 功能：
 * 1. 读取核验后的 CSV 文件
 * 2. 根据 status 列执行操作：
 *    - "通过" = 标记 isVerified = true
 *    - "修改" = 更新字段并标记 isVerified = true
 *    - "删除" = 从数据库删除
 * 3. 根据 notes 列解析修改内容
 *
 * 使用方法：
 * npx ts-node scripts/import-review-results.ts <csv_file>
 *
 * 选项：
 * --dry-run    仅检查，不修改数据
 *
 * 示例：
 * npx ts-node scripts/import-review-results.ts data/review_completed.csv
 * npx ts-node scripts/import-review-results.ts data/review.csv --dry-run
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// 解析命令行参数
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const csvFileArg = args.find((a) => !a.startsWith('--'));

if (!csvFileArg) {
  console.error('❌ 请指定 CSV 文件路径');
  console.error(
    '用法: npx ts-node scripts/import-review-results.ts <csv_file>',
  );
  process.exit(1);
}

if (!fs.existsSync(csvFileArg)) {
  console.error(`❌ 文件不存在: ${csvFileArg}`);
  process.exit(1);
}

const csvFile: string = csvFileArg;

interface ReviewRow {
  id: string;
  rank: string;
  school: string;
  major: string;
  year: string;
  round: string;
  result: string;
  gpa: string;
  sat: string;
  act: string;
  toefl: string;
  tags: string;
  source: string;
  isVerified: string;
  status: string;
  notes: string;
}

interface ImportStats {
  total: number;
  passed: number;
  modified: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

// 解析 CSV 行（处理引号和逗号）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// 解析 notes 列中的修改指令
function parseModifications(notes: string): Record<string, string> {
  const mods: Record<string, string> = {};

  if (!notes) return mods;

  // 支持的格式：
  // "gpa=3.85" 或 "gpa:3.85"
  // "sat=1550, toefl=115"
  // "修改GPA为3.85"

  // 格式1: key=value 或 key:value
  const kvPattern = /(\w+)\s*[=:]\s*([^,;]+)/g;
  let match;
  while ((match = kvPattern.exec(notes)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();

    // 映射字段名
    const fieldMap: Record<string, string> = {
      gpa: 'gpaRange',
      sat: 'satRange',
      act: 'actRange',
      toefl: 'toeflRange',
      major: 'major',
      round: 'round',
      year: 'year',
      result: 'result',
    };

    if (fieldMap[key]) {
      mods[fieldMap[key]] = value;
    }
  }

  // 格式2: 中文描述 "修改GPA为3.85"
  const chinesePatterns = [
    /修改\s*GPA\s*为?\s*([0-9.]+)/i,
    /修改\s*SAT\s*为?\s*(\d+)/i,
    /修改\s*ACT\s*为?\s*(\d+)/i,
    /修改\s*TOEFL\s*为?\s*(\d+)/i,
    /修改\s*托福\s*为?\s*(\d+)/i,
  ];

  const fieldNames = [
    'gpaRange',
    'satRange',
    'actRange',
    'toeflRange',
    'toeflRange',
  ];
  for (let i = 0; i < chinesePatterns.length; i++) {
    const m = notes.match(chinesePatterns[i]);
    if (m) {
      mods[fieldNames[i]] = m[1];
    }
  }

  return mods;
}

async function main() {
  console.log('═'.repeat(50));
  console.log('📥 导入核验结果');
  console.log('═'.repeat(50));
  console.log(`文件: ${csvFile}`);
  console.log(`模式: ${DRY_RUN ? '仅检查 (dry-run)' : '执行导入'}`);
  console.log('═'.repeat(50));
  console.log('');

  const stats: ImportStats = {
    total: 0,
    passed: 0,
    modified: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
  };

  // 读取 CSV
  let content = fs.readFileSync(csvFile, 'utf-8');
  // 移除 BOM
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    console.error('❌ CSV 文件为空或格式错误');
    process.exit(1);
  }

  // 解析表头
  const headers = parseCSVLine(lines[0]);
  const idIndex = headers.indexOf('id');
  const statusIndex = headers.indexOf('status');
  const notesIndex = headers.indexOf('notes');

  if (idIndex === -1 || statusIndex === -1) {
    console.error('❌ CSV 缺少必要列: id, status');
    process.exit(1);
  }

  console.log(`📊 共 ${lines.length - 1} 条记录\n`);

  // 处理每行
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const id = values[idIndex];
    const status = values[statusIndex]?.trim().toLowerCase();
    const notes = values[notesIndex] || '';

    stats.total++;

    if (!id) {
      stats.errors.push(`行 ${i + 1}: 缺少 ID`);
      stats.skipped++;
      continue;
    }

    // 检查记录是否存在
    const existing = await prisma.admissionCase.findUnique({ where: { id } });
    if (!existing) {
      stats.errors.push(`行 ${i + 1}: ID ${id} 不存在`);
      stats.skipped++;
      continue;
    }

    // 根据状态执行操作
    if (
      status === '通过' ||
      status === 'pass' ||
      status === 'ok' ||
      status === '✓'
    ) {
      // 标记为已核验
      if (!DRY_RUN) {
        await prisma.admissionCase.update({
          where: { id },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
          },
        });
      }
      stats.passed++;
      console.log(`✅ 通过: ${id.slice(0, 8)}...`);
    } else if (
      status === '修改' ||
      status === 'modify' ||
      status === 'edit' ||
      status === '✎'
    ) {
      // 解析修改内容
      const mods = parseModifications(notes);

      if (Object.keys(mods).length === 0) {
        stats.errors.push(`行 ${i + 1}: 标记为修改但 notes 列无修改内容`);
        stats.skipped++;
        continue;
      }

      // 执行修改
      if (!DRY_RUN) {
        await prisma.admissionCase.update({
          where: { id },
          data: {
            ...mods,
            isVerified: true,
            verifiedAt: new Date(),
          },
        });
      }
      stats.modified++;
      console.log(
        `✏️  修改: ${id.slice(0, 8)}... - ${Object.entries(mods)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`,
      );
    } else if (
      status === '删除' ||
      status === 'delete' ||
      status === 'remove' ||
      status === '✗'
    ) {
      // 删除记录
      if (!DRY_RUN) {
        await prisma.admissionCase.delete({ where: { id } });
      }
      stats.deleted++;
      console.log(
        `🗑️  删除: ${id.slice(0, 8)}...${notes ? ` (${notes.slice(0, 30)})` : ''}`,
      );
    } else if (status === '待核验' || status === 'pending' || !status) {
      // 跳过未处理的
      stats.skipped++;
    } else {
      stats.errors.push(`行 ${i + 1}: 未知状态 "${status}"`);
      stats.skipped++;
    }
  }

  // 输出统计
  console.log('\n═'.repeat(50));
  console.log('📊 导入完成');
  console.log('═'.repeat(50));
  console.log(`总计: ${stats.total}`);
  console.log(`通过: ${stats.passed}`);
  console.log(`修改: ${stats.modified}`);
  console.log(`删除: ${stats.deleted}`);
  console.log(`跳过: ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  错误 (${stats.errors.length})`);
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`   ${err}`);
    }
    if (stats.errors.length > 10) {
      console.log(`   ... 还有 ${stats.errors.length - 10} 个错误`);
    }
  }

  if (DRY_RUN) {
    console.log(
      '\n💡 这是预览模式，实际未修改数据。移除 --dry-run 执行实际导入。',
    );
  }

  // 最终统计
  const total = await prisma.admissionCase.count();
  const verified = await prisma.admissionCase.count({
    where: { isVerified: true },
  });
  console.log(
    `\n📈 数据库状态: ${verified}/${total} 已核验 (${Math.round((verified / total) * 100)}%)`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
