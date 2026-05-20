#!/usr/bin/env ts-node
/**
 * Essay-prompt scraper runner (Phase C, task 19)
 *
 * Boots the Nest application context and drives EssayScraperService to grow the
 * EssayPrompt table for top-US schools.
 *
 * What it does:
 *  1. Seeds SchoolEssaySource (sourceType/scrapeGroup = COMMON_APP) rows for the
 *     top-N US-ranked schools so the CommonApp linker has targets. Common App is
 *     used by essentially every ranked US school, so this is a correct mapping.
 *  2. Runs scrapeAndLinkCommonApp(): fetches the 7 official Common App essay
 *     prompts (live from commonapp.org via LLM extraction; falls back to the
 *     strategy's hardcoded verified prompt set) and links them to every
 *     COMMON_APP-grouped school as EssayPrompt rows.
 *  3. (--supplements) optionally runs per-school supplement scraping. Disabled by
 *     default because the official/CollegeVine strategy URLs are stale (HTTP 404)
 *     in this environment.
 *
 * No data is fabricated: Common App prompts are real, official, publicly
 * documented. Schools that yield nothing are reported as 0.
 *
 * Usage:
 *   ts-node --transpile-only scripts/run-essay-prompt-scrape.ts
 *   ts-node --transpile-only scripts/run-essay-prompt-scrape.ts --rank 100 --year 2026
 *   ts-node --transpile-only scripts/run-essay-prompt-scrape.ts --supplements
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EssayScraperService } from '../src/modules/essay/essay-scraper.service';
import { PrismaService } from '../src/prisma/prisma.service';

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const COMMON_APP_URL = 'https://www.commonapp.org/apply/essay-prompts';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const scraper = app.get(EssayScraperService);
  const prisma = app.get(PrismaService);

  const rankCap = Number(getArg('rank') ?? 100);
  const year = Number(getArg('year') ?? 2026);

  // 1. Seed COMMON_APP SchoolEssaySource rows for top-ranked US schools.
  const schools = await prisma.school.findMany({
    where: { usNewsRank: { lte: rankCap }, country: 'US' },
    select: { id: true, name: true },
  });
  console.log(
    `\n=== Seeding COMMON_APP sources for ${schools.length} US schools (rank <= ${rankCap}) ===`,
  );

  let seeded = 0;
  for (const s of schools) {
    try {
      await prisma.schoolEssaySource.upsert({
        where: {
          schoolId_sourceType: { schoolId: s.id, sourceType: 'COMMON_APP' },
        },
        create: {
          schoolId: s.id,
          sourceType: 'COMMON_APP',
          url: COMMON_APP_URL,
          scrapeGroup: 'COMMON_APP',
          isActive: true,
          priority: 0,
        },
        update: { isActive: true, scrapeGroup: 'COMMON_APP' },
      });
      seeded++;
    } catch (e) {
      console.log(
        `  source seed failed for ${s.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  console.log(`Seeded/updated ${seeded} COMMON_APP source rows.`);

  // 2. CommonApp prompts -> link to every COMMON_APP school.
  let commonAppSaved = 0;
  try {
    const ca = await scraper.scrapeAndLinkCommonApp(year);
    commonAppSaved = ca.essaysFound;
    console.log(
      `CommonApp link: success=${ca.success} promptsLinked=${ca.essaysFound}${ca.error ? ` (${ca.error})` : ''}`,
    );
  } catch (e) {
    console.log(
      `CommonApp link: FAILED — ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // 3. Optional per-school supplement scrape (stale URLs by default — opt-in).
  let supplementSaved = 0;
  if (hasFlag('supplements')) {
    const names = await scraper.getConfiguredSchools();
    console.log(`\n=== Supplement scrape: ${names.length} schools ===`);
    for (const name of names) {
      try {
        const r = await scraper.scrapeSchool(name, year);
        supplementSaved += r.essaysFound;
        console.log(
          `  ${name}: success=${r.success} saved=${r.essaysFound}${r.error ? ` (${r.error})` : ''}`,
        );
      } catch (e) {
        console.log(
          `  ${name}: ERROR — ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  console.log(
    `\n=== Done: ${commonAppSaved} CommonApp-linked prompts + ${supplementSaved} supplement prompts ===`,
  );
  await app.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
