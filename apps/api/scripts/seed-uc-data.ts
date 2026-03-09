/**
 * Seed accurate 2025 admission data for all 9 UC campuses.
 *
 * Usage: npx ts-node apps/api/scripts/seed-uc-data.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

const UC_DATA: Array<{
  name: string;
  acceptanceRate: number;
  usNewsRank: number;
  satAvg: number;
  sat25: number;
  sat75: number;
  graduationRate: number;
}> = [
  {
    name: 'University of California, Los Angeles',
    acceptanceRate: 9,
    usNewsRank: 15,
    satAvg: 1500,
    sat25: 1440,
    sat75: 1560,
    graduationRate: 92,
  },
  {
    name: 'University of California, Berkeley',
    acceptanceRate: 12,
    usNewsRank: 22,
    satAvg: 1480,
    sat25: 1420,
    sat75: 1540,
    graduationRate: 93,
  },
  {
    name: 'University of California, San Diego',
    acceptanceRate: 34,
    usNewsRank: 28,
    satAvg: 1400,
    sat25: 1330,
    sat75: 1470,
    graduationRate: 87,
  },
  {
    name: 'University of California, Irvine',
    acceptanceRate: 30,
    usNewsRank: 33,
    satAvg: 1370,
    sat25: 1300,
    sat75: 1440,
    graduationRate: 85,
  },
  {
    name: 'University of California, Santa Barbara',
    acceptanceRate: 37,
    usNewsRank: 35,
    satAvg: 1360,
    sat25: 1290,
    sat75: 1430,
    graduationRate: 83,
  },
  {
    name: 'University of California, Davis',
    acceptanceRate: 42,
    usNewsRank: 28,
    satAvg: 1330,
    sat25: 1260,
    sat75: 1400,
    graduationRate: 86,
  },
  {
    name: 'University of California, Santa Cruz',
    acceptanceRate: 47,
    usNewsRank: 82,
    satAvg: 1280,
    sat25: 1200,
    sat75: 1360,
    graduationRate: 76,
  },
  {
    name: 'University of California, Riverside',
    acceptanceRate: 70,
    usNewsRank: 97,
    satAvg: 1170,
    sat25: 1090,
    sat75: 1250,
    graduationRate: 74,
  },
  {
    name: 'University of California, Merced',
    acceptanceRate: 95,
    usNewsRank: 97,
    satAvg: 1050,
    sat25: 980,
    sat75: 1120,
    graduationRate: 60,
  },
];

async function main() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}\n`);

  for (const uc of UC_DATA) {
    const school = await prisma.school.findFirst({
      where: { name: uc.name },
      select: {
        id: true,
        name: true,
        acceptanceRate: true,
        usNewsRank: true,
        satAvg: true,
      },
    });

    if (!school) {
      console.log(`  [SKIP] ${uc.name} - not found in DB`);
      continue;
    }

    console.log(
      `  [UPDATE] ${uc.name} (id: ${school.id})` +
        `\n    acceptanceRate: ${school.acceptanceRate} -> ${uc.acceptanceRate}` +
        `\n    usNewsRank: ${school.usNewsRank} -> ${uc.usNewsRank}` +
        `\n    satAvg: ${school.satAvg} -> ${uc.satAvg}`,
    );

    if (!isDryRun) {
      await prisma.school.update({
        where: { id: school.id },
        data: {
          acceptanceRate: uc.acceptanceRate,
          usNewsRank: uc.usNewsRank,
          satAvg: uc.satAvg,
          sat25: uc.sat25,
          sat75: uc.sat75,
          graduationRate: uc.graduationRate,
        },
      });
    }
  }

  console.log(
    `\nDone. ${isDryRun ? 'No changes made (dry run).' : 'UC data updated.'}`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
