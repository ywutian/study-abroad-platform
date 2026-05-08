#!/usr/bin/env tsx
/**
 * Seed the admin theme-style library (SystemSetting key 'admin.themeStyleLibrary.v1').
 *
 * The /admin/theme-styles workbench reads from this SystemSetting; on a fresh DB
 * the library is empty, so the workbench shows nothing.
 *
 * This script generates curated (palette × heroVisual) combinations covering
 * every palette CATEGORY and every hero variant defined in tokens.ts, so the
 * workbench has a meaningful starting library out of the box.
 *
 * Output: ~120 items (cap is MAX_THEME_STYLE_ITEMS=120).
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts            # dry-run
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts --apply    # write to DB
 *   pnpm --filter api exec tsx scripts/seed-theme-style-library.ts --apply --reset
 *     # replaces existing library entirely (vs merge)
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  COLOR_PALETTES,
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  HERO_VISUAL_IDS,
  HERO_VISUAL_DEFINITIONS,
  getColorThemeLabel,
  getColorThemeDescription,
  getHeroVisualDefinition,
  getThemeStyleMeta,
  normalizeThemeAppearanceOverrides,
  type ColorPalette,
  type HeroVisualId,
  type ThemeAppearanceOverrides,
} from '@study-abroad/shared';

const SETTING_KEY = 'admin.themeStyleLibrary.v1';
const SCHEMA_VERSION = 2 as const;
const MAX_ITEMS = 200; // matches MAX_THEME_STYLE_ITEMS in admin-theme-style.controller.ts

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');

function makeSignature(palette: ColorPalette, heroVisual: HeroVisualId): string {
  const overrides: ThemeAppearanceOverrides = {};
  return createHash('sha256')
    .update(JSON.stringify({ palette, heroVisual, appearanceOverrides: overrides }))
    .digest('hex')
    .slice(0, 16);
}

function checksumState(state: Record<string, unknown>): string {
  const { checksum: _checksum, ...rest } = state;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 24);
}

/**
 * Pick a representative palette per category — featured first, falling back to first.
 * Returns ordered list of palettes.
 */
function pickRepresentativePalettes(): { palette: ColorPalette; category: string }[] {
  const out: { palette: ColorPalette; category: string }[] = [];
  for (const cat of COLOR_THEME_CATEGORIES) {
    const inCategory = COLOR_THEME_DEFINITIONS.filter(
      (d: { id: string; category: string }) => d.category === cat.id
    );
    const featured =
      inCategory.find((d: { featured?: boolean }) => d.featured) ?? inCategory[0];
    if (featured) {
      out.push({ palette: featured.id as ColorPalette, category: cat.id });
    }
  }
  return out;
}

function buildItem(palette: ColorPalette, heroVisual: HeroVisualId, now: string) {
  const appearanceOverrides = normalizeThemeAppearanceOverrides(undefined);
  const styleMeta = getThemeStyleMeta(palette, appearanceOverrides);
  const heroDef = getHeroVisualDefinition(heroVisual);
  const signature = makeSignature(palette, heroVisual);
  const actor = { userId: 'system', email: 'system@local' };

  return {
    id: `theme-style-${signature}`,
    signature,
    palette,
    paletteLabelZh: getColorThemeLabel(palette, 'zh'),
    paletteLabelEn: getColorThemeLabel(palette, 'en'),
    paletteDescriptionZh: getColorThemeDescription(palette, 'zh'),
    paletteDescriptionEn: getColorThemeDescription(palette, 'en'),
    heroVisual,
    heroVisualLabelZh: heroDef.labelZh,
    heroVisualLabelEn: heroDef.labelEn,
    heroVisualDescriptionZh: heroDef.descriptionZh,
    heroVisualDescriptionEn: heroDef.descriptionEn,
    appearanceOverrides,
    styleMeta,
    status: 'draft' as const,
    validationStatus: 'unknown' as const,
    validationErrors: [],
    certificationStatus: 'warning' as const,
    routeAuditSummary: [],
    notes: undefined,
    debugTags: ['seeded'],
    sourcePath: 'apps/api/scripts/seed-theme-style-library.ts',
    sourceCommit: undefined,
    voteCount: 0,
    savedBy: [],
    createdBy: actor,
    updatedBy: actor,
    lastAction: 'saved' as const,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const now = new Date().toISOString();

  // Build curated combos: every category × every hero variant, capped at MAX_ITEMS
  const palettes = pickRepresentativePalettes();
  const heroVariants = [...HERO_VISUAL_IDS];

  // True round-robin: cycle through (hero × palette) so all 9 hero variants get
  // ~equal coverage (16 palettes × 9 hero = 144 exceeds the 120 cap, so without
  // round-robin the last hero gets dropped).
  // Hero priority order: Pro/Mark first (the user-facing switcher), then the rest.
  const heroPriority: HeroVisualId[] = [
    'dense-cockpit' as HeroVisualId,
    'centered-mark' as HeroVisualId,
    ...heroVariants.filter(
      (h: HeroVisualId) => h !== 'dense-cockpit' && h !== 'centered-mark'
    ),
  ];

  const items: ReturnType<typeof buildItem>[] = [];
  // Round-robin: palette outer × hero inner. Each palette pass adds one entry
  // per hero before moving to the next palette. Cap at MAX_ITEMS.
  outer: for (const { palette } of palettes) {
    for (const hero of heroPriority) {
      if (items.length >= MAX_ITEMS) break outer;
      items.push(buildItem(palette, hero, now));
    }
  }

  // Coverage summary
  const heroCoverage = new Set(items.map((i) => i.heroVisual));
  const paletteCoverage = new Set(items.map((i) => i.palette));
  const categoryCoverage = new Set(
    items
      .map((i) => COLOR_THEME_DEFINITIONS.find((d: { id: string }) => d.id === i.palette))
      .filter(Boolean)
      .map((d: { category?: string } | undefined) => d?.category)
  );

  console.log('Seed plan:');
  console.log(`  items:               ${items.length} / ${MAX_ITEMS}`);
  console.log(
    `  hero variants:       ${heroCoverage.size} / ${HERO_VISUAL_IDS.length} covered`
  );
  console.log(
    `  palettes (unique):   ${paletteCoverage.size} / ${COLOR_PALETTES.length} total`
  );
  console.log(
    `  palette categories:  ${categoryCoverage.size} / ${COLOR_THEME_CATEGORIES.length} covered`
  );
  console.log('');

  // Read current state
  const current = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
  if (current) {
    let parsed: { items?: unknown[]; revision?: number } = {};
    try {
      parsed = JSON.parse(current.value as string);
    } catch {
      /* ignore */
    }
    const currentItemCount = Array.isArray(parsed.items) ? parsed.items.length : 0;
    console.log(
      `Current DB state: revision=${parsed.revision ?? '?'}, items=${currentItemCount}`
    );
  } else {
    console.log('Current DB state: SystemSetting row does not exist yet');
  }

  // Build full state
  const stateNoChecksum = {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    updatedAt: now,
    updatedBy: { userId: 'system', email: 'system@local' },
    items,
    tombstones: [],
  };
  const state = {
    ...stateNoChecksum,
    checksum: checksumState(stateNoChecksum as unknown as Record<string, unknown>),
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
        `  - ${item.palette.padEnd(28)} × ${item.heroVisual.padEnd(22)} → "${item.paletteLabelEn}" / "${item.heroVisualLabelEn}"`
      );
    }
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
    await prisma.$disconnect();
    return;
  }

  // Write
  if (current && !reset) {
    console.log(
      'Existing SystemSetting row exists; pass --reset to replace. Aborting to avoid silent overwrite.'
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
