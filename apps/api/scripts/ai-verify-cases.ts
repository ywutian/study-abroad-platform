/**
 * AI 核验脚本
 *
 * 对所有案例数据进行自动化核验，标记问题数据
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface VerificationResult {
  id: string;
  status: '通过' | '警告' | '删除';
  notes: string;
}

// 无效学校名列表
const invalidSchoolNames = new Set([
  'Take',
  'They',
  'Yes,',
  'Unless',
  'Applied',
  'STEM,',
  'Note',
  'TOEFL',
  'IELTS,',
  'Bioethics',
  'Environmental',
  'Sociology',
  'Anthropology',
  'Pathobiology',
  'Africana',
  'DREAM',
  'Local',
  'Committed',
  'stats:',
  'Bryn',
  'Additional',
  'Getting',
  'None',
]);

// 无效学校名模式
function isInvalidSchoolName(name: string): boolean {
  if (invalidSchoolNames.has(name)) return true;
  if (name.length < 3) return true;
  if (/^\d+\./.test(name)) return true; // 以数字开头
  if (/^Acceptances/.test(name)) return true;
  if (/^Here's/.test(name)) return true;
  if (/^&gt;/.test(name)) return true;
  if (/^\(USC/.test(name)) return true;
  if (/^EA:|^ED:|^RD:|^REA:/.test(name)) return true;
  return false;
}

// 无效专业名模式
function isInvalidMajor(major: string | null): boolean {
  if (!major) return false;
  if (/^for all schools/.test(major)) return true;
  if (/^I'm now a freshman/.test(major)) return true;
  if (/^s were all over/.test(major)) return true;
  if (/^\/INTERESTS/.test(major)) return true;
  if (/^\*\* /.test(major)) return true;
  return false;
}

// 检查专业名格式问题
function hasMajorFormatIssue(major: string | null): boolean {
  if (!major) return false;
  if (major.startsWith('(s)')) return true;
  if (major.startsWith('s:')) return true;
  if (major.startsWith('*')) return true;
  return false;
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🤖 AI 核验引擎');
  console.log('═'.repeat(50));
  console.log('');

  const cases = await prisma.admissionCase.findMany({
    include: { school: { select: { name: true, usNewsRank: true } } },
    orderBy: [{ school: { usNewsRank: 'asc' } }, { year: 'desc' }],
  });

  console.log(`📊 共 ${cases.length} 条案例待核验\n`);

  const results: VerificationResult[] = [];
  const stats = { pass: 0, warn: 0, delete: 0 };

  for (const c of cases) {
    const issues: string[] = [];
    let status: '通过' | '警告' | '删除' = '通过';

    const schoolName = c.school.name;
    const rank = c.school.usNewsRank || 999;

    // 解析数值（处理范围格式如 "3.8-3.9" 或 "34-35"）
    function parseValue(val: string | null): number | null {
      if (!val) return null;
      // 如果是范围，取第一个数
      const match = val.match(/([0-9.]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
      return null;
    }

    const gpa = parseValue(c.gpaRange);
    const sat = parseValue(c.satRange);
    const act = parseValue(c.actRange);

    // 1. 检查学校名
    if (isInvalidSchoolName(schoolName)) {
      issues.push('学校名无效: ' + schoolName.slice(0, 20));
      status = '删除';
    }

    // 2. 检查专业名
    if (isInvalidMajor(c.major)) {
      issues.push('专业名无效');
      if (status === '通过') status = '警告';
    } else if (hasMajorFormatIssue(c.major)) {
      issues.push('专业名格式错误');
      if (status === '通过') status = '警告';
    }

    // 3. 检查 GPA
    if (c.gpaRange === '.') {
      issues.push('GPA无效: .');
      status = '删除';
    } else if (gpa !== null) {
      if (gpa > 5.0) {
        issues.push('GPA超范围: ' + c.gpaRange);
        status = '删除';
      } else if (gpa > 4.5) {
        issues.push('GPA偏高: ' + c.gpaRange);
        if (status === '通过') status = '警告';
      } else if (gpa < 2.0 && gpa > 0) {
        issues.push('GPA过低: ' + c.gpaRange);
        if (status === '通过') status = '警告';
      }
    }

    // 4. 检查 SAT
    if (sat !== null) {
      if (sat > 1600 || sat < 400) {
        issues.push('SAT超范围: ' + c.satRange);
        status = '删除';
      } else if (sat < 1200 && rank <= 20 && c.result === 'ADMITTED') {
        issues.push('Top20低SAT录取: ' + c.satRange);
        if (status === '通过') status = '警告';
      } else if (sat < 1300 && rank <= 30 && c.result === 'ADMITTED') {
        issues.push('Top30低SAT录取: ' + c.satRange);
        if (status === '通过') status = '警告';
      }
    }

    // 5. 检查 ACT
    if (act !== null) {
      if (act > 36 || act < 1) {
        issues.push('ACT超范围: ' + c.actRange);
        status = '删除';
      } else if (act < 15) {
        issues.push('ACT异常低: ' + c.actRange);
        if (status === '通过') status = '警告';
      } else if (act < 25 && rank <= 30 && c.result === 'ADMITTED') {
        issues.push('Top30低ACT录取: ' + c.actRange);
        if (status === '通过') status = '警告';
      }
    }

    // 6. 检查录取逻辑
    if (c.result === 'ADMITTED') {
      if (rank <= 10) {
        if (gpa !== null && gpa < 3.0) {
          issues.push('Top10极低GPA录取');
          if (status === '通过') status = '警告';
        }
        if (sat !== null && sat < 1350) {
          issues.push('Top10低SAT录取');
          if (status === '通过') status = '警告';
        }
      } else if (rank <= 30) {
        if (gpa !== null && gpa < 3.3) {
          issues.push('Top30低GPA录取: ' + c.gpaRange);
          if (status === '通过') status = '警告';
        }
      }
    }

    // 7. 检查数据完整性
    const missingCount = [
      !c.gpaRange,
      !c.satRange && !c.actRange,
      !c.major,
    ].filter(Boolean).length;
    if (missingCount >= 2 && c.result === 'ADMITTED' && rank <= 30) {
      issues.push('关键数据缺失');
      if (status === '通过') status = '警告';
    }

    results.push({
      id: c.id,
      status,
      notes: issues.join('; '),
    });

    if (status === '通过') stats.pass++;
    else if (status === '警告') stats.warn++;
    else stats.delete++;
  }

  // 输出报告
  console.log('═'.repeat(50));
  console.log('📋 核验报告');
  console.log('═'.repeat(50));
  console.log(
    `✅ 通过: ${stats.pass} (${Math.round((stats.pass / cases.length) * 100)}%)`,
  );
  console.log(
    `⚠️  警告: ${stats.warn} (${Math.round((stats.warn / cases.length) * 100)}%)`,
  );
  console.log(
    `❌ 删除: ${stats.delete} (${Math.round((stats.delete / cases.length) * 100)}%)`,
  );
  console.log('');

  // 输出需要删除的记录
  const toDelete = results.filter((r) => r.status === '删除');
  if (toDelete.length > 0) {
    console.log('─'.repeat(50));
    console.log(`❌ 需要删除 (${toDelete.length} 条)`);
    console.log('─'.repeat(50));
    for (const r of toDelete.slice(0, 30)) {
      const c = cases.find((c) => c.id === r.id);
      console.log(
        `  ${c?.school.name.slice(0, 30).padEnd(30)} | ${r.notes.slice(0, 40)}`,
      );
    }
    if (toDelete.length > 30)
      console.log(`  ... 还有 ${toDelete.length - 30} 条`);
  }

  // 输出警告记录
  const warnings = results.filter((r) => r.status === '警告');
  if (warnings.length > 0) {
    console.log('');
    console.log('─'.repeat(50));
    console.log(`⚠️  警告 (${warnings.length} 条，保留但需注意)`);
    console.log('─'.repeat(50));
    for (const r of warnings.slice(0, 20)) {
      const c = cases.find((c) => c.id === r.id);
      console.log(
        `  ${c?.school.name.slice(0, 30).padEnd(30)} | ${r.notes.slice(0, 40)}`,
      );
    }
    if (warnings.length > 20)
      console.log(`  ... 还有 ${warnings.length - 20} 条`);
  }

  // 保存结果到 CSV
  const csvLines = ['id,status,notes'];
  for (const r of results) {
    csvLines.push(`${r.id},${r.status},"${r.notes.replace(/"/g, '""')}"`);
  }
  fs.writeFileSync(
    'scripts/data/verification_results.csv',
    csvLines.join('\n'),
  );
  console.log('\n📁 结果已保存到 scripts/data/verification_results.csv');

  // 询问是否执行
  console.log('\n═'.repeat(50));
  console.log('💡 执行建议');
  console.log('═'.repeat(50));
  console.log(`将删除 ${stats.delete} 条无效数据`);
  console.log(
    `将保留 ${stats.pass + stats.warn} 条有效数据（其中 ${stats.warn} 条有警告）`,
  );
  console.log('\n要应用核验结果，请运行:');
  console.log('  npx ts-node scripts/ai-verify-cases.ts --apply');
}

// 应用核验结果
async function applyResults() {
  console.log('═'.repeat(50));
  console.log('🔧 应用核验结果');
  console.log('═'.repeat(50));

  // 读取核验结果
  const content = fs.readFileSync(
    'scripts/data/verification_results.csv',
    'utf-8',
  );
  const lines = content.split('\n').slice(1); // 跳过表头

  let deleted = 0;
  let verified = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    const [id, status] = line.split(',');

    if (status === '删除') {
      try {
        await prisma.admissionCase.delete({ where: { id } });
        deleted++;
      } catch (e) {
        // 忽略不存在的记录
      }
    } else if (status === '通过' || status === '警告') {
      try {
        await prisma.admissionCase.update({
          where: { id },
          data: { isVerified: true, verifiedAt: new Date() },
        });
        verified++;
      } catch (e) {
        // 忽略
      }
    }
  }

  console.log(`✅ 已删除: ${deleted} 条`);
  console.log(`✅ 已核验: ${verified} 条`);

  const total = await prisma.admissionCase.count();
  const verifiedCount = await prisma.admissionCase.count({
    where: { isVerified: true },
  });
  console.log(
    `\n📊 当前数据: ${total} 条，已核验 ${verifiedCount} 条 (${Math.round((verifiedCount / total) * 100)}%)`,
  );
}

const args = process.argv.slice(2);
if (args.includes('--apply')) {
  applyResults()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
