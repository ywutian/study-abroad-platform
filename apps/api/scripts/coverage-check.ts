import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const total = await p.school.count({ where: { country: 'US' } });
  const fields = [
    'acceptanceRate',
    'intlStudentPct',
    'percentNeedMet',
    'edAcceptanceRate',
    'eaAcceptanceRate',
    'gpaDistribution',
    'sat25',
    'sat75',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'nicheOverallGrade',
    'nicheSafetyGrade',
    'nicheLifeGrade',
    'nicheFoodGrade',
  ];
  console.log(`\n📊 Data Coverage (${total} US schools)\n`);
  for (const f of fields) {
    const filled = await (p.school as any).count({
      where: { country: 'US', [f]: { not: null } },
    });
    const pct = ((filled / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round((filled / total) * 20)).padEnd(20, '░');
    const missing = total - filled;
    console.log(
      `  ${f.padEnd(24)} ${bar} ${(filled + '/' + total).padEnd(8)} ${pct.padStart(5)}%  missing=${missing}`,
    );
  }
  const bandSchools = await p.schoolCdsAdmitBand.findMany({
    select: { schoolId: true },
    distinct: ['schoolId'],
  });
  const bands = await p.schoolCdsAdmitBand.count();
  const bs = bandSchools.length;
  const bpct = ((bs / total) * 100).toFixed(1);
  console.log(
    `\n  ${'SchoolCdsAdmitBand'.padEnd(24)} ${'█'.repeat(Math.round((bs / total) * 20)).padEnd(20, '░')} ${(bs + '/' + total).padEnd(8)} ${bpct.padStart(5)}%  (${bands} cells)`,
  );
  await p.$disconnect();
}

main().catch(console.error);
