/**
 * Seed need-blind-for-internationals schools
 *
 * Sets needBlindInternational = true for the 5 known need-blind schools.
 *
 * Run standalone:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-intl-schools.ts
 *
 * Or import and call seedIntlSchools() from the main seed runner.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** nameNorm values (lowercase trimmed) for need-blind-for-internationals schools */
const NEED_BLIND_INTL_NAME_NORMS = [
  'harvard university',
  'massachusetts institute of technology',
  'yale university',
  'princeton university',
  'amherst college',
] as const;

export async function seedIntlSchools(): Promise<{ count: number }> {
  const result = await prisma.school.updateMany({
    where: { nameNorm: { in: [...NEED_BLIND_INTL_NAME_NORMS] } },
    data: { needBlindInternational: true },
  });
  return { count: result.count };
}

async function main() {
  console.log('🏫 Seeding need-blind-for-internationals schools...\n');
  const { count } = await seedIntlSchools();
  console.log(
    `✅ Updated ${count} school(s) with needBlindInternational: true\n`,
  );
}

// Run when executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
