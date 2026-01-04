/**
 * 从 College Scorecard API 同步学校数据
 * 
 * 用法: npx ts-node scripts/sync-schools.ts [limit]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY || 'f9BpBv55kCaOiEPPJgmBMdOeC5UlmDItnEnSEP7B';
const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

interface ScorecardSchool {
  id: number;
  'school.name': string;
  'school.city': string | null;
  'school.state': string | null;
  'school.school_url': string | null;
  'latest.admissions.admission_rate.overall': number | null;
  'latest.admissions.sat_scores.average.overall': number | null;
  'latest.admissions.act_scores.midpoint.cumulative': number | null;
  'latest.cost.tuition.out_of_state': number | null;
  'latest.student.size': number | null;
  'latest.completion.completion_rate_4yr_150nt': number | null;
  'latest.earnings.10_yrs_after_entry.median': number | null;
}

async function syncSchools(limit = 500): Promise<void> {
  const fields = [
    'id',
    'school.name',
    'school.city',
    'school.state',
    'school.school_url',
    'latest.admissions.admission_rate.overall',
    'latest.admissions.sat_scores.average.overall',
    'latest.admissions.act_scores.midpoint.cumulative',
    'latest.cost.tuition.out_of_state',
    'latest.student.size',
    'latest.completion.completion_rate_4yr_150nt',
    'latest.earnings.10_yrs_after_entry.median',
  ].join(',');

  let synced = 0;
  let errors = 0;
  let page = 0;
  const perPage = 100;

  console.log(`🚀 开始同步学校数据 (目标: ${limit} 所)`);

  while (synced < limit) {
    const url = `${BASE_URL}?api_key=${API_KEY}&school.operating=1&school.degrees_awarded.predominant=3&fields=${fields}&per_page=${perPage}&page=${page}`;
    
    console.log(`📥 获取第 ${page + 1} 页...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const schools: ScorecardSchool[] = data.results || [];

    if (schools.length === 0) {
      console.log('📭 没有更多数据');
      break;
    }

    for (const school of schools) {
      if (synced >= limit) break;

      const name = school['school.name'];
      if (!name) continue;

      try {
        const schoolData = {
          name,
          country: 'US',
          state: school['school.state'] || null,
          city: school['school.city'] || null,
          website: school['school.school_url'] || null,
          acceptanceRate: school['latest.admissions.admission_rate.overall'] 
            ? Number((school['latest.admissions.admission_rate.overall'] * 100).toFixed(2))
            : null,
          satAvg: school['latest.admissions.sat_scores.average.overall'] || null,
          actAvg: school['latest.admissions.act_scores.midpoint.cumulative'] || null,
          tuition: school['latest.cost.tuition.out_of_state'] || null,
          studentCount: school['latest.student.size'] || null,
          graduationRate: school['latest.completion.completion_rate_4yr_150nt']
            ? Number((school['latest.completion.completion_rate_4yr_150nt'] * 100).toFixed(2))
            : null,
          avgSalary: school['latest.earnings.10_yrs_after_entry.median'] || null,
          metadata: { scorecardId: String(school.id), lastSync: new Date().toISOString() },
        };

        // Upsert by name
        await prisma.school.upsert({
          where: { 
            id: (await prisma.school.findFirst({ where: { name } }))?.id || 'new-' + school.id,
          },
          update: schoolData,
          create: schoolData,
        });

        synced++;
        if (synced % 50 === 0) {
          console.log(`✅ 已同步 ${synced} 所学校`);
        }
      } catch (err) {
        errors++;
        console.error(`❌ 同步失败: ${name}`, err);
      }
    }

    page++;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n🎉 同步完成!`);
  console.log(`   ✅ 成功: ${synced}`);
  console.log(`   ❌ 失败: ${errors}`);
}

// Main
const limit = parseInt(process.argv[2] || '200', 10);
syncSchools(limit)
  .catch(console.error)
  .finally(() => prisma.$disconnect());




