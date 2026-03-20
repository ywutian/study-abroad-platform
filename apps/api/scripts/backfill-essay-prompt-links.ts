/**
 * Backfill Script: Link existing user essays to EssayPrompt records
 *
 * Matches Essay.prompt (free text) → EssayPrompt.prompt via:
 *   - Same schoolId
 *   - Prompt prefix match (first 50 chars, case-insensitive)
 *
 * Usage:
 *   npx ts-node scripts/backfill-essay-prompt-links.ts --dry-run
 *   npx ts-node scripts/backfill-essay-prompt-links.ts --apply
 */

import { PrismaClient } from '@prisma/client';

const DEDUP_PREFIX_LENGTH = 50;

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const prisma = new PrismaClient();

  console.log(`\n=== Backfill Essay → EssayPrompt Links ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY'}\n`);

  try {
    // Find all essays that have a prompt and schoolId but no essayPromptId
    const essays = await prisma.essay.findMany({
      where: {
        prompt: { not: null },
        schoolId: { not: null },
        essayPromptId: null,
      },
      select: {
        id: true,
        prompt: true,
        schoolId: true,
      },
    });

    console.log(`Found ${essays.length} essays without essayPromptId\n`);

    let matched = 0;
    let unmatched = 0;

    for (const essay of essays) {
      if (!essay.prompt || !essay.schoolId) continue;

      const prefix = essay.prompt
        .substring(0, DEDUP_PREFIX_LENGTH)
        .toLowerCase();

      const matchingPrompt = await prisma.essayPrompt.findFirst({
        where: {
          schoolId: essay.schoolId,
          isActive: true,
          status: 'VERIFIED',
          prompt: { startsWith: prefix, mode: 'insensitive' },
        },
        select: { id: true, prompt: true },
      });

      if (matchingPrompt) {
        matched++;
        if (dryRun) {
          console.log(
            `[MATCH] Essay ${essay.id} → Prompt ${matchingPrompt.id}`,
          );
          console.log(`  Essay prefix:  "${prefix}"`);
          console.log(
            `  Prompt prefix: "${matchingPrompt.prompt.substring(0, DEDUP_PREFIX_LENGTH)}"\n`,
          );
        } else {
          await prisma.essay.update({
            where: { id: essay.id },
            data: { essayPromptId: matchingPrompt.id },
          });
        }
      } else {
        unmatched++;
      }
    }

    console.log(`\n=== Results ===`);
    console.log(`Total essays scanned: ${essays.length}`);
    console.log(`Matched: ${matched}`);
    console.log(`Unmatched: ${unmatched}`);

    if (dryRun && matched > 0) {
      console.log(`\nRun with --apply to persist changes.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
