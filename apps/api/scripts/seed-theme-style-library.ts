#!/usr/bin/env tsx
/**
 * Seed the admin theme-style library (SystemSetting key 'admin.themeStyleLibrary.v1').
 *
 * Generates 144 curated (palette × heroVisual) combos covering every palette
 * CATEGORY and every hero variant. Items match exactly what the controller's
 * auto-seed produces (shared via theme-style-defaults.ts) — running this script
 * explicitly is only needed for environments where you want the seed before
 * any admin first-visit triggers the controller's auto-seed path.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts            # dry-run
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts --apply    # write to DB
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts --apply --reset
 *     # replaces existing library entirely
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  generateDefaultThemeStyleItems,
  SYSTEM_SEED_ACTOR,
} from '../src/modules/admin/theme-style-defaults';

const SETTING_KEY = 'admin.themeStyleLibrary.v1';
const SCHEMA_VERSION = 2 as const;

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');

function checksumState(state: Record<string, unknown>): string {
  const { checksum: _checksum, ...rest } = state;
  return createHash('sha256')
    .update(JSON.stringify(rest))
    .digest('hex')
    .slice(0, 24);
}

async function main() {
  const prisma = new PrismaClient();
  const now = new Date().toISOString();
  const items = generateDefaultThemeStyleItems({ now });

  // Coverage summary
  const heroCoverage = new Set(items.map((i) => i.heroVisual));
  const paletteCoverage = new Set(items.map((i) => i.palette));

  console.log('Seed plan:');
  console.log(`  items:               ${items.length}`);
  console.log(`  hero variants:       ${heroCoverage.size} distinct`);
  console.log(`  palettes (unique):   ${paletteCoverage.size} distinct`);
  console.log('');

  const current = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY },
  });
  if (current) {
    let parsed: { items?: unknown[]; revision?: number } = {};
    try {
      parsed = JSON.parse(current.value);
    } catch {
      /* ignore */
    }
    const currentItemCount = Array.isArray(parsed.items)
      ? parsed.items.length
      : 0;
    console.log(
      `Current DB state: revision=${parsed.revision ?? '?'}, items=${currentItemCount}`,
    );
  } else {
    console.log('Current DB state: SystemSetting row does not exist yet');
  }

  // Build full state
  const stateNoChecksum = {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    updatedAt: now,
    updatedBy: SYSTEM_SEED_ACTOR,
    items,
    tombstones: [],
  };
  const state = {
    ...stateNoChecksum,
    checksum: checksumState(
      stateNoChecksum as unknown as Record<string, unknown>,
    ),
  };

  if (!apply) {
    console.log('');
    console.log('DRY RUN — no DB write. Pass --apply to commit.');
    console.log(`  would write SystemSetting[${SETTING_KEY}]:`);
    console.log(`    schemaVersion: ${state.schemaVersion}`);
    console.log(`    revision:      ${state.revision}`);
    console.log(`    items:         ${state.items.length}`);
    console.log(`    checksum:      ${state.checksum}`);
    console.log(`    JSON size:     ${JSON.stringify(state).length} bytes`);
    console.log('');
    console.log('Sample items:');
    for (const item of items.slice(0, 5)) {
      console.log(
        `  - ${item.palette.padEnd(28)} × ${item.heroVisual.padEnd(22)} → "${item.paletteLabelEn}" / "${item.heroVisualLabelEn}"`,
      );
    }
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
    await prisma.$disconnect();
    return;
  }

  if (current && !reset) {
    console.log(
      'Existing SystemSetting row exists; pass --reset to replace. Aborting to avoid silent overwrite.',
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('Writing to DB...');
  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(state) },
    update: { value: JSON.stringify(state) },
  });
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
