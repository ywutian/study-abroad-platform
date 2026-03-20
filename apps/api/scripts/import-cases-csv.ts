/**
 * CSV 案例批量导入工具
 *
 * 使用方法：
 * npx ts-node scripts/import-cases-csv.ts data/cases.csv
 * npx ts-node scripts/import-cases-csv.ts --sample  # 生成示例CSV
 *
 * CSV 格式（第一行为表头）：
 * school,major,year,round,result,gpa,sat,act,toefl,ielts,tags,highschooltype,hook,notes
 *
 * 字段说明：
 * - school: 学校名称（支持缩写如 MIT, Stanford）
 * - major: 申请专业
 * - year: 申请年份（2020-2030）
 * - round: ED/ED2/EA/REA/RD
 * - result: ADMITTED/REJECTED/WAITLISTED/DEFERRED（支持中文和各种简写）
 * - gpa: GPA 或范围（如 3.9 或 3.8-3.9）
 * - sat/act/toefl/ielts: 成绩或范围
 * - tags: 标签，分号分隔（research;olympiad;CS）
 * - highschooltype: PUBLIC_US/PRIVATE_US/CHINA_INTL/CHINA_PUBLIC/OTHER_INTL
 * - hook: legacy/athlete/first_gen/urm/recruited，分号分隔
 * - notes: 备注（可选）
 *
 * 示例：
 * MIT,CS,2025,RD,ADMITTED,3.9-4.0,1550-1600,,115,,research,CHINA_INTL,,USACO金牌
 */

import { PrismaClient } from '@prisma/client';
import { normalizeSchoolName as normalizeSchoolNameForDb } from '../src/common/utils/school-name.util';
import { resolveSchoolAlias } from '../src/common/constants/school-aliases';
import {
  normalizeResult as sharedNormalizeResult,
  normalizeRound as sharedNormalizeRound,
} from '../src/common/utils/import-normalizers';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CsvRow {
  school: string;
  major: string;
  year: string;
  round: string;
  result: string;
  gpa: string;
  sat: string;
  act: string;
  toefl: string;
  ielts: string;
  tags: string;
  highschooltype: string; // PUBLIC_US, PRIVATE_US, CHINA_INTL, CHINA_PUBLIC, OTHER_INTL
  hook: string; // legacy, athlete, first_gen, urm
  notes: string;
}

// 解析 CSV（支持引号内逗号和换行）
function parseRawCsv(content: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && content[i + 1] === '\n')) {
      current.push(field);
      field = '';
      lines.push(current);
      current = [];
      if (char === '\r') i++;
    } else {
      field += char;
    }
  }
  if (field || current.length > 0) {
    current.push(field);
    lines.push(current);
  }
  return lines;
}

function parseCsv(content: string): CsvRow[] {
  const rows = parseRawCsv(content);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());

  return rows.slice(1).map((values) => {
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] || '').trim();
    });
    return row as CsvRow;
  });
}

// School alias resolution uses shared constant
function normalizeSchoolName(name: string): string {
  return resolveSchoolAlias(name);
}

// Delegates to shared normalizers from import-normalizers.ts
function normalizeResult(
  result: string,
): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | null {
  return sharedNormalizeResult(result);
}

function normalizeRound(round: string): string {
  return sharedNormalizeRound(round);
}

async function importCsv(filePath: string) {
  console.log(`📂 读取文件: ${filePath}\n`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCsv(content);

  console.log(`📊 解析到 ${rows.length} 条记录\n`);

  // 获取或创建默认用户
  let defaultUser = await prisma.user.findFirst({
    where: { email: 'import@system.local' },
  });

  if (!defaultUser) {
    defaultUser = await prisma.user.create({
      data: {
        email: 'import@system.local',
        passwordHash: 'imported',
        role: 'USER',
      },
    });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // 查找学校
      const schoolName = normalizeSchoolName(row.school);
      let school = await prisma.school.findUnique({
        where: { nameNorm: normalizeSchoolNameForDb(schoolName) },
      });

      // Fallback: try Chinese name lookup
      if (!school) {
        school = await prisma.school.findFirst({
          where: { nameZh: { contains: row.school, mode: 'insensitive' } },
        });
      }

      if (!school) {
        // 创建新学校
        school = await prisma.school.create({
          data: {
            name: schoolName,
            nameNorm: normalizeSchoolNameForDb(schoolName),
            nameZh: row.school !== schoolName ? row.school : null,
            country: 'US',
          },
        });
        console.log(`  🏫 创建学校: ${schoolName}`);
      }

      // 处理标签
      const tags = row.tags
        ? row.tags
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      // 如果有 TOEFL/IELTS，添加 international 标签
      if ((row.toefl || row.ielts) && !tags.includes('international')) {
        tags.push('international');
      }

      // 添加高中类型标签
      if (row.highschooltype) {
        tags.push(row.highschooltype.toUpperCase());
      }

      // 添加 hook 标签
      if (row.hook) {
        const hooks = row.hook
          .split(';')
          .map((h) => h.trim())
          .filter(Boolean);
        tags.push(...hooks);
      }

      // Validate result
      const result = normalizeResult(row.result);
      if (!result) {
        skipped++;
        errors.push(`${row.school}: Unrecognized result value "${row.result}"`);
        continue;
      }

      // 创建案例
      await prisma.admissionCase.create({
        data: {
          userId: defaultUser.id,
          schoolId: school.id,
          year: parseInt(row.year) || new Date().getFullYear(),
          round: normalizeRound(row.round),
          result,
          major: row.major || null,
          gpaRange: row.gpa || null,
          satRange: row.sat || null,
          actRange: row.act || null,
          toeflRange: row.toefl || (row.ielts ? `IELTS ${row.ielts}` : null),
          tags: [...new Set(tags)], // 去重
          visibility: 'ANONYMOUS',
          source: 'csv_import',
          reviewStatus: 'PENDING_REVIEW',
          qualityScore: 0,
        },
      });

      imported++;
      console.log(`  ✅ ${schoolName} - ${row.major} - ${row.result}`);
    } catch (e: any) {
      skipped++;
      errors.push(`${row.school}: ${e.message}`);
    }
  }

  console.log(`\n========== 导入完成 ==========`);
  console.log(`✅ 成功: ${imported}`);
  console.log(`⏭️  跳过: ${skipped}`);

  if (errors.length > 0) {
    console.log(`\n❌ 错误详情:`);
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (errors.length > 10) {
      console.log(`  ... 还有 ${errors.length - 10} 个错误`);
    }
  }
}

// 创建示例 CSV
function createSampleCsv() {
  const samplePath = path.join(__dirname, '../data/sample-cases.csv');
  const dir = path.dirname(samplePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sample = `school,major,year,round,result,gpa,sat,act,toefl,ielts,tags,highschooltype,hook,notes
MIT,Computer Science,2025,RD,ADMITTED,3.9-4.0,1550-1600,,115-120,,research;olympiad,CHINA_INTL,,USACO金牌
Stanford,Economics,2025,ED,REJECTED,3.8-3.9,1500-1550,,,7.5,business,PRIVATE_US,legacy,
Harvard,Biology,2025,REA,WAITLISTED,3.9-4.0,1540-1580,,112-118,,research;pre-med,PUBLIC_US,first_gen,最终从waitlist录取
Yale,History,2025,EA,ADMITTED,3.85-3.95,,34-35,110-115,,humanities,OTHER_INTL,,
Princeton,Mathematics,2025,RD,ADMITTED,4.0,1560-1600,,118-120,,olympiad,CHINA_INTL,,IMO银牌
Columbia,Political Science,2025,ED,ADMITTED,3.8-3.9,1480-1520,,105-110,,debate,CHINA_PUBLIC,,
UPenn,Business,2025,ED,REJECTED,3.7-3.8,1480-1520,,105-110,,business,PRIVATE_US,legacy,Wharton竞争激烈
Duke,CS,2025,RD,WAITLISTED,3.85-3.95,1520-1560,,112-118,,research;CS,PUBLIC_US,,
Northwestern,Journalism,2025,ED,ADMITTED,3.75-3.85,1450-1500,,108-112,,writing,OTHER_INTL,,
CalTech,Physics,2025,RD,REJECTED,3.95-4.0,1560-1600,,115-120,,research;olympiad,CHINA_INTL,,USAPhO但文书弱
`;

  fs.writeFileSync(samplePath, sample);
  console.log(`📝 示例 CSV 已创建: ${samplePath}`);
  console.log('\n你可以参考这个格式准备数据，然后运行：');
  console.log(`npx ts-node scripts/import-cases-csv.ts ${samplePath}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--sample') {
    createSampleCsv();
    return;
  }

  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }

  await importCsv(filePath);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
