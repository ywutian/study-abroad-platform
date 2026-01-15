/**
 * 从备份文件恢复 AdmissionCase 数据
 * 使用和之前一样的筛选方法
 */
import { PrismaClient, AdmissionResult, Visibility } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 学校名称映射（中文 -> 英文）
const SCHOOL_ZH_TO_EN: Record<string, string> = {
  普林斯顿大学: 'Princeton University',
  麻省理工学院: 'Massachusetts Institute of Technology',
  哈佛大学: 'Harvard University',
  斯坦福大学: 'Stanford University',
  耶鲁大学: 'Yale University',
  宾夕法尼亚大学: 'University of Pennsylvania',
  加州理工学院: 'California Institute of Technology',
  杜克大学: 'Duke University',
  布朗大学: 'Brown University',
  约翰霍普金斯大学: 'Johns Hopkins University',
  西北大学: 'Northwestern University',
  哥伦比亚大学: 'Columbia University',
  康奈尔大学: 'Cornell University',
  芝加哥大学: 'University of Chicago',
  加州大学伯克利分校: 'University of California, Berkeley',
  加州大学洛杉矶分校: 'University of California, Los Angeles',
  莱斯大学: 'Rice University',
  达特茅斯学院: 'Dartmouth College',
  范德堡大学: 'Vanderbilt University',
  圣母大学: 'University of Notre Dame',
  密歇根大学安娜堡分校: 'University of Michigan, Ann Arbor',
  乔治城大学: 'Georgetown University',
  北卡罗来纳大学教堂山分校: 'University of North Carolina at Chapel Hill',
  卡内基梅隆大学: 'Carnegie Mellon University',
  埃默里大学: 'Emory University',
  弗吉尼亚大学: 'University of Virginia',
  圣路易斯华盛顿大学: 'Washington University in St. Louis',
  加州大学戴维斯分校: 'University of California, Davis',
  加州大学圣地亚哥分校: 'University of California, San Diego',
  佛罗里达大学: 'University of Florida',
  南加州大学: 'University of Southern California',
  德克萨斯大学奥斯汀分校: 'University of Texas at Austin',
  佐治亚理工学院: 'Georgia Institute of Technology',
  加州大学尔湾分校: 'University of California, Irvine',
  纽约大学: 'New York University',
  加州大学圣塔芭芭拉分校: 'University of California, Santa Barbara',
  '伊利诺伊大学厄巴纳-香槟分校': 'University of Illinois Urbana-Champaign',
  威斯康星大学麦迪逊分校: 'University of Wisconsin-Madison',
  波士顿学院: 'Boston College',
  罗格斯大学新布朗斯维克分校: 'Rutgers University-New Brunswick',
  塔夫茨大学: 'Tufts University',
  华盛顿大学: 'University of Washington',
  波士顿大学: 'Boston University',
  俄亥俄州立大学: 'Ohio State University',
  普渡大学: 'Purdue University',
  马里兰大学帕克分校: 'University of Maryland, College Park',
  里海大学: 'Lehigh University',
  德州农工大学: 'Texas A&M University',
  佐治亚大学: 'University of Georgia',
  维克森林大学: 'Wake Forest University',
};

interface BackupCase {
  id: string;
  school: string;
  schoolEn?: string;
  year: number;
  result: string;
  gpa?: string | null;
  sat?: string | null;
  act?: string | null;
  toefl?: string | null;
  major?: string | null;
  round?: string | null;
  tags: string[];
}

async function main() {
  console.log('🔄 开始恢复数据...\n');

  // 加载备份文件
  const backupPath1 = path.join(__dirname, 'admission-case-ok.json');
  const backupPath2 = path.join(__dirname, 'top50-cases.json');

  const data1 = JSON.parse(fs.readFileSync(backupPath1, 'utf-8'));
  const data2 = JSON.parse(fs.readFileSync(backupPath2, 'utf-8'));

  // 合并数据，使用ID去重
  const allCases = new Map<string, BackupCase>();

  // 先加载 top50-cases（有更多字段）
  for (const c of data2.cases) {
    allCases.set(c.id, {
      id: c.id,
      school: c.school,
      schoolEn: c.schoolEn,
      year: c.year,
      result: c.result,
      gpa: c.gpa,
      sat: c.sat,
      act: c.act,
      toefl: c.toefl,
      major: c.major,
      round: c.round,
      tags: c.tags || [],
    });
  }

  // 再加载 admission-case-ok
  for (const c of data1.ok) {
    if (!allCases.has(c.id)) {
      allCases.set(c.id, {
        id: c.id,
        school: c.school,
        year: c.year,
        result: c.result,
        gpa: c.gpa,
        sat: c.sat,
        act: c.act,
        major: c.major,
        round: c.round,
        tags: c.tags || [],
      });
    }
  }

  console.log(`📊 合并后总数据量: ${allCases.size} 条`);

  // 获取或创建系统用户
  let systemUser = await prisma.user.findUnique({
    where: { email: 'system@studyabroad.internal' },
  });

  if (!systemUser) {
    const bcrypt = await import('bcrypt');
    systemUser = await prisma.user.create({
      data: {
        email: 'system@studyabroad.internal',
        passwordHash: await bcrypt.hash('SystemUser2024!', 10),
        emailVerified: true,
        role: 'USER',
      },
    });
    console.log('✅ 创建系统用户');
  }

  // 获取所有学校
  const schools = await prisma.school.findMany();
  const schoolMap = new Map<string, string>();
  for (const s of schools) {
    schoolMap.set(s.name, s.id);
    if (s.nameZh) schoolMap.set(s.nameZh, s.id);
  }
  console.log(`📚 已加载 ${schools.length} 所学校\n`);

  // 筛选条件（和之前一样）
  const validResults = ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'];
  const validYearMin = 2020;
  const validYearMax = 2030;

  let imported = 0;
  let skipped = 0;
  let notFoundSchool = 0;
  let invalidData = 0;

  for (const [, c] of allCases) {
    // 筛选1: 有效的录取结果
    if (!validResults.includes(c.result)) {
      invalidData++;
      continue;
    }

    // 筛选2: 有效的年份
    if (c.year < validYearMin || c.year > validYearMax) {
      invalidData++;
      continue;
    }

    // 查找学校ID
    let schoolId = schoolMap.get(c.school);
    if (!schoolId && c.schoolEn) {
      schoolId = schoolMap.get(c.schoolEn);
    }
    if (!schoolId) {
      const enName = SCHOOL_ZH_TO_EN[c.school];
      if (enName) schoolId = schoolMap.get(enName);
    }

    if (!schoolId) {
      notFoundSchool++;
      continue;
    }

    // 检查重复
    const existing = await prisma.admissionCase.findFirst({
      where: {
        schoolId,
        year: c.year,
        result: c.result as AdmissionResult,
        gpaRange: c.gpa || undefined,
        satRange: c.sat || undefined,
        major: c.major || undefined,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // 创建记录
    try {
      await prisma.admissionCase.create({
        data: {
          userId: systemUser.id,
          schoolId,
          year: c.year,
          result: c.result as AdmissionResult,
          round: c.round || undefined,
          major: c.major || undefined,
          gpaRange: c.gpa || undefined,
          satRange: c.sat || undefined,
          actRange: c.act || undefined,
          toeflRange: c.toefl || undefined,
          tags: c.tags,
          visibility: Visibility.ANONYMOUS,
          isVerified: false,
        },
      });
      imported++;

      if (imported % 100 === 0) {
        console.log(`  已导入 ${imported} 条...`);
      }
    } catch (err: any) {
      console.log(`  ❌ 导入失败: ${c.school} - ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 恢复完成:');
  console.log(`   成功导入: ${imported} 条`);
  console.log(`   跳过重复: ${skipped} 条`);
  console.log(`   学校未找到: ${notFoundSchool} 条`);
  console.log(`   无效数据: ${invalidData} 条`);

  // 最终统计
  const finalCount = await prisma.admissionCase.count();
  console.log(`\n✅ 数据库当前 AdmissionCase 总数: ${finalCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
