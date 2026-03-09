/**
 * Seed SchoolProgram entries for ~25 top schools across 10 popular majors
 * with curated competitiveness scores.
 *
 * Usage:
 *   pnpm --filter api ts-node prisma/seed-program-rates.ts
 *
 * Or programmatically:
 *   import { seedProgramRates } from './prisma/seed-program-rates';
 *   await seedProgramRates(prisma);
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProgramSeedItem {
  cipCode: string;
  programName: string;
  programNameZh: string;
  competitiveness: number;
  acceptanceRateEstimate?: number;
}

interface ProgramSeed {
  schoolNameNorm: string;
  programs: ProgramSeedItem[];
}

/** CIP code → (programName, programNameZh) for consistent naming */
const CIP_NAMES: Record<
  string,
  { programName: string; programNameZh: string }
> = {
  '0904': { programName: 'Journalism', programNameZh: '新闻传播' },
  '1107': { programName: 'Computer Science', programNameZh: '计算机科学' },
  '1401': { programName: 'Engineering', programNameZh: '工程' },
  '2305': { programName: 'Political Science', programNameZh: '政治学' },
  '2601': { programName: 'Biology', programNameZh: '生物学' },
  '2701': { programName: 'Mathematics', programNameZh: '数学' },
  '4002': { programName: 'Physics', programNameZh: '物理学' },
  '4201': { programName: 'Psychology', programNameZh: '心理学' },
  '4501': { programName: 'Economics', programNameZh: '经济学' },
  '5110': { programName: 'Nursing', programNameZh: '护理' },
  '5202': { programName: 'Business', programNameZh: '商科' },
};

const SEED_DATA: ProgramSeed[] = [
  {
    schoolNameNorm: 'massachusetts institute of technology',
    programs: [
      {
        cipCode: '1107',
        ...CIP_NAMES['1107'],
        competitiveness: 5,
        acceptanceRateEstimate: 3.5,
      },
      {
        cipCode: '1401',
        ...CIP_NAMES['1401'],
        competitiveness: 5,
        acceptanceRateEstimate: 3,
      },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 5 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 5 },
    ],
  },
  {
    schoolNameNorm: 'stanford university',
    programs: [
      {
        cipCode: '1107',
        ...CIP_NAMES['1107'],
        competitiveness: 5,
        acceptanceRateEstimate: 4,
      },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 4 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'harvard university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 5 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 4 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'princeton university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 5 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 5 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'yale university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 4 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'california institute of technology',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 5 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 5 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 5 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 5 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'university of pennsylvania',
    programs: [
      {
        cipCode: '5202',
        ...CIP_NAMES['5202'],
        competitiveness: 5,
        acceptanceRateEstimate: 6,
      },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      {
        cipCode: '5110',
        ...CIP_NAMES['5110'],
        competitiveness: 5,
        acceptanceRateEstimate: 8,
      },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'columbia university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 4 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'duke university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 4 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 3 },
      { cipCode: '5110', ...CIP_NAMES['5110'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'northwestern university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 4 },
      { cipCode: '0904', ...CIP_NAMES['0904'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'johns hopkins university',
    programs: [
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 5 },
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '5110', ...CIP_NAMES['5110'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'cornell university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 5 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'rice university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'university of chicago',
    programs: [
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 5 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 4 },
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 4 },
    ],
  },
  {
    schoolNameNorm: 'brown university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'carnegie mellon university',
    programs: [
      {
        cipCode: '1107',
        ...CIP_NAMES['1107'],
        competitiveness: 5,
        acceptanceRateEstimate: 5,
      },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 4 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'university of california, berkeley',
    programs: [
      {
        cipCode: '1107',
        ...CIP_NAMES['1107'],
        competitiveness: 5,
        acceptanceRateEstimate: 8,
      },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'university of california, los angeles',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 3 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'georgia institute of technology',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 5 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 5 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 3 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'new york university',
    programs: [
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 3 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'university of michigan-ann arbor',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'university of southern california',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 4 },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 2 },
      { cipCode: '4201', ...CIP_NAMES['4201'], competitiveness: 2 },
    ],
  },
  {
    schoolNameNorm: 'university of illinois urbana-champaign',
    programs: [
      {
        cipCode: '1107',
        ...CIP_NAMES['1107'],
        competitiveness: 5,
        acceptanceRateEstimate: 6,
      },
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 3 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 3 },
    ],
  },
  {
    schoolNameNorm: 'purdue university',
    programs: [
      { cipCode: '1401', ...CIP_NAMES['1401'], competitiveness: 4 },
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 4 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 2 },
      { cipCode: '4002', ...CIP_NAMES['4002'], competitiveness: 3 },
      { cipCode: '2701', ...CIP_NAMES['2701'], competitiveness: 2 },
    ],
  },
  {
    schoolNameNorm: 'boston university',
    programs: [
      { cipCode: '1107', ...CIP_NAMES['1107'], competitiveness: 3 },
      { cipCode: '5202', ...CIP_NAMES['5202'], competitiveness: 3 },
      { cipCode: '2601', ...CIP_NAMES['2601'], competitiveness: 3 },
      { cipCode: '4501', ...CIP_NAMES['4501'], competitiveness: 3 },
      { cipCode: '2305', ...CIP_NAMES['2305'], competitiveness: 2 },
    ],
  },
];

export async function seedProgramRates(
  client?: PrismaClient,
): Promise<{ count: number }> {
  const db = client ?? prisma;
  let count = 0;

  try {
    console.log('🌱 Seeding SchoolProgram entries (program rates)...');

    for (const { schoolNameNorm, programs } of SEED_DATA) {
      const school = await db.school.findUnique({
        where: { nameNorm: schoolNameNorm },
        select: { id: true, name: true },
      });

      if (!school) {
        console.warn(`⚠️  School not found: ${schoolNameNorm}, skipping`);
        continue;
      }

      for (const prog of programs) {
        await db.schoolProgram.upsert({
          where: {
            schoolId_cipCode: { schoolId: school.id, cipCode: prog.cipCode },
          },
          create: {
            schoolId: school.id,
            cipCode: prog.cipCode,
            programName: prog.programName,
            programNameZh: prog.programNameZh,
            competitiveness: prog.competitiveness,
            acceptanceRateEstimate: prog.acceptanceRateEstimate ?? null,
          },
          update: {
            programName: prog.programName,
            programNameZh: prog.programNameZh,
            competitiveness: prog.competitiveness,
            acceptanceRateEstimate: prog.acceptanceRateEstimate ?? null,
          },
        });
        count++;
      }

      console.log(`✅ ${school.name}: ${programs.length} program(s)`);
    }

    console.log(`\n📊 Total: ${count} SchoolProgram entries upserted`);
    return { count };
  } finally {
    if (!client) {
      await db.$disconnect();
    }
  }
}

// Standalone runner
if (require.main === module) {
  seedProgramRates()
    .then(({ count }) => {
      console.log(`🎉 Done. Upserted ${count} programs.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}
