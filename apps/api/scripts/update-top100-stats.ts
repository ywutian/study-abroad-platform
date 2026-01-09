/**
 * 为 Top 100 学校更新 College Scorecard 统计数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY || 'f9BpBv55kCaOiEPPJgmBMdOeC5UlmDItnEnSEP7B';
const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

async function fetchSchoolStats(schoolName: string) {
  const fields = [
    'id',
    'school.name',
    'latest.admissions.admission_rate.overall',
    'latest.admissions.sat_scores.average.overall',
    'latest.admissions.act_scores.midpoint.cumulative',
    'latest.cost.tuition.out_of_state',
    'latest.student.size',
    'latest.completion.completion_rate_4yr_150nt',
    'latest.earnings.10_yrs_after_entry.median',
  ].join(',');

  // 简化学校名称进行搜索
  const searchName = schoolName
    .replace(/University of California,?\s*/i, 'University of California')
    .replace(/,.*$/, '') // 移除逗号后的内容
    .trim();

  const url = `${BASE_URL}?api_key=${API_KEY}&school.name=${encodeURIComponent(searchName)}&fields=${fields}&per_page=5`;
  
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const results = data.results || [];

  // 找到最匹配的结果
  const exactMatch = results.find((r: any) => 
    r['school.name']?.toLowerCase() === schoolName.toLowerCase()
  );
  
  if (exactMatch) return exactMatch;

  // 尝试部分匹配
  const partialMatch = results.find((r: any) => {
    const apiName = r['school.name']?.toLowerCase() || '';
    const dbName = schoolName.toLowerCase();
    return apiName.includes(dbName.split(',')[0]) || dbName.includes(apiName.split(',')[0]);
  });

  return partialMatch || results[0] || null;
}

async function main() {
  console.log('🔄 更新 Top 100 学校统计数据\n');

  // 获取所有有 US News 排名的学校
  const schools = await prisma.school.findMany({
    where: { usNewsRank: { not: null } },
    orderBy: { usNewsRank: 'asc' },
  });

  console.log(`📊 找到 ${schools.length} 所学校需要更新\n`);

  let updated = 0;
  let failed = 0;

  for (const school of schools) {
    try {
      const stats = await fetchSchoolStats(school.name);
      
      if (stats) {
        const updateData: any = {};
        
        if (stats['latest.student.size']) {
          updateData.studentCount = stats['latest.student.size'];
        }
        if (stats['latest.admissions.sat_scores.average.overall']) {
          updateData.satAvg = stats['latest.admissions.sat_scores.average.overall'];
        }
        if (stats['latest.admissions.act_scores.midpoint.cumulative']) {
          updateData.actAvg = stats['latest.admissions.act_scores.midpoint.cumulative'];
        }
        if (stats['latest.cost.tuition.out_of_state']) {
          updateData.tuition = stats['latest.cost.tuition.out_of_state'];
        }
        if (stats['latest.completion.completion_rate_4yr_150nt']) {
          updateData.graduationRate = Number((stats['latest.completion.completion_rate_4yr_150nt'] * 100).toFixed(2));
        }
        if (stats['latest.earnings.10_yrs_after_entry.median']) {
          updateData.avgSalary = stats['latest.earnings.10_yrs_after_entry.median'];
        }
        if (stats['latest.admissions.admission_rate.overall'] && !school.acceptanceRate) {
          updateData.acceptanceRate = Number((stats['latest.admissions.admission_rate.overall'] * 100).toFixed(2));
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.school.update({
            where: { id: school.id },
            data: updateData,
          });
          updated++;
          console.log(`✅ #${school.usNewsRank} ${school.nameZh || school.name}: 学生${updateData.studentCount || '-'}, SAT${updateData.satAvg || '-'}`);
        } else {
          console.log(`⏭️  #${school.usNewsRank} ${school.nameZh || school.name}: 无新数据`);
        }
      } else {
        console.log(`⚠️  #${school.usNewsRank} ${school.nameZh || school.name}: API 未找到`);
        failed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err: any) {
      console.log(`❌ #${school.usNewsRank} ${school.name}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 完成: 更新 ${updated}, 失败 ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());



