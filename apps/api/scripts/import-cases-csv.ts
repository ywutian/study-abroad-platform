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

// 解析 CSV
function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row as CsvRow;
  });
}

// 标准化学校名称
const schoolNameMap: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  stanford: 'Stanford University',
  harvard: 'Harvard University',
  yale: 'Yale University',
  princeton: 'Princeton University',
  columbia: 'Columbia University',
  upenn: 'University of Pennsylvania',
  penn: 'University of Pennsylvania',
  duke: 'Duke University',
  northwestern: 'Northwestern University',
  caltech: 'California Institute of Technology',
  uchicago: 'University of Chicago',
  jhu: 'Johns Hopkins University',
  cornell: 'Cornell University',
  brown: 'Brown University',
  dartmouth: 'Dartmouth College',
  rice: 'Rice University',
  vanderbilt: 'Vanderbilt University',
  'notre dame': 'University of Notre Dame',
  washu: 'Washington University in St. Louis',
  emory: 'Emory University',
  georgetown: 'Georgetown University',
  ucb: 'University of California, Berkeley',
  berkeley: 'University of California, Berkeley',
  ucla: 'University of California, Los Angeles',
  usc: 'University of Southern California',
  nyu: 'New York University',
  cmu: 'Carnegie Mellon University',
  umich: 'University of Michigan',
  gatech: 'Georgia Institute of Technology',
  uiuc: 'University of Illinois Urbana-Champaign',
  purdue: 'Purdue University',
  utaustin: 'University of Texas at Austin',
  uw: 'University of Washington',
  bu: 'Boston University',
  bc: 'Boston College',
  neu: 'Northeastern University',
  tufts: 'Tufts University',
  williams: 'Williams College',
  amherst: 'Amherst College',
  pomona: 'Pomona College',
  swarthmore: 'Swarthmore College',
  wellesley: 'Wellesley College',
  bowdoin: 'Bowdoin College',
  middlebury: 'Middlebury College',
  carleton: 'Carleton College',
};

function normalizeSchoolName(name: string): string {
  const lower = name.toLowerCase().trim();
  return schoolNameMap[lower] || name;
}

// 标准化结果
function normalizeResult(
  result: string,
): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' {
  const r = result.toLowerCase().trim();
  if (
    ['admitted', 'ad', 'offer', 'accept', 'accepted', '录取', '录了'].includes(
      r,
    )
  ) {
    return 'ADMITTED';
  }
  if (
    [
      'rejected',
      'rej',
      'reject',
      'deny',
      'denied',
      '拒绝',
      '拒了',
      '被拒',
    ].includes(r)
  ) {
    return 'REJECTED';
  }
  if (['waitlisted', 'wl', 'waitlist', '候补', '等待'].includes(r)) {
    return 'WAITLISTED';
  }
  if (['deferred', 'defer', '延期'].includes(r)) {
    return 'DEFERRED';
  }
  return 'ADMITTED';
}

// 标准化轮次
function normalizeRound(round: string): string {
  const r = round.toLowerCase().trim();
  if (['ed', 'ed1', '早申'].includes(r)) return 'ED';
  if (['ed2'].includes(r)) return 'ED2';
  if (['ea', '早行动'].includes(r)) return 'EA';
  if (['rea', 'scea', '限制性早申'].includes(r)) return 'REA';
  if (['rd', '常规', '常规申请'].includes(r)) return 'RD';
  return round.toUpperCase();
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
      let school = await prisma.school.findFirst({
        where: {
          OR: [
            { name: { contains: schoolName, mode: 'insensitive' } },
            { nameZh: { contains: row.school, mode: 'insensitive' } },
          ],
        },
      });

      if (!school) {
        // 创建新学校
        school = await prisma.school.create({
          data: {
            name: schoolName,
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

      // 创建案例
      await prisma.admissionCase.create({
        data: {
          userId: defaultUser.id,
          schoolId: school.id,
          year: parseInt(row.year) || new Date().getFullYear(),
          round: normalizeRound(row.round),
          result: normalizeResult(row.result),
          major: row.major || null,
          gpaRange: row.gpa || null,
          satRange: row.sat || null,
          actRange: row.act || null,
          toeflRange: row.toefl || (row.ielts ? `IELTS ${row.ielts}` : null),
          tags: [...new Set(tags)], // 去重
          visibility: 'ANONYMOUS',
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
