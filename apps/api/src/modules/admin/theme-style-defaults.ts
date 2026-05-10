/**
 * Default seed for the admin theme-style library.
 *
 * Used by:
 *   - admin-theme-style.controller.ts: auto-seeds DB on first read when the
 *     SystemSetting row does not exist yet (so /admin/theme-styles is never
 *     blank on a fresh deploy).
 *   - apps/api/scripts/seed-theme-style-library.ts: one-shot CLI for explicit
 *     deploy-time seeding.
 *
 * Generates 144 curated (palette × heroVisual) combinations:
 *   - 16 palette categories (one featured palette per category)
 *   - 9 hero variants
 *   - Round-robin so every category × every hero is represented within the
 *     MAX_THEME_STYLE_ITEMS=200 cap.
 */
import { createHash } from 'node:crypto';
import {
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  HERO_VISUAL_IDS,
  getColorThemeLabel,
  getColorThemeDescription,
  getHeroVisualDefinition,
  getThemeStyleMeta,
  normalizeThemeAppearanceOverrides,
  type ColorPalette,
  type HeroVisualId,
  type ThemeAppearanceOverrides,
  type ThemeStyleLibraryItem,
} from '@study-abroad/shared';

export const SYSTEM_SEED_ACTOR = {
  userId: 'system',
  email: 'system@local',
} as const;

function makeSignature(
  palette: ColorPalette,
  heroVisual: HeroVisualId,
): string {
  const overrides: ThemeAppearanceOverrides = {};
  return createHash('sha256')
    .update(
      JSON.stringify({ palette, heroVisual, appearanceOverrides: overrides }),
    )
    .digest('hex')
    .slice(0, 16);
}

/** Pick one representative palette per category — featured first, fallback to first. */
function pickRepresentativePalettes(): {
  palette: ColorPalette;
  category: string;
}[] {
  const out: { palette: ColorPalette; category: string }[] = [];
  for (const cat of COLOR_THEME_CATEGORIES) {
    const inCategory = COLOR_THEME_DEFINITIONS.filter(
      (d) => d.category === cat.id,
    );
    const featured =
      inCategory.find(
        (d) => 'featured' in d && (d as { featured?: boolean }).featured,
      ) ?? inCategory[0];
    if (featured) {
      out.push({ palette: featured.id, category: cat.id });
    }
  }
  return out;
}

function buildItem(
  palette: ColorPalette,
  heroVisual: HeroVisualId,
  now: string,
): ThemeStyleLibraryItem {
  const appearanceOverrides = normalizeThemeAppearanceOverrides(undefined);
  const styleMeta = getThemeStyleMeta(palette, appearanceOverrides);
  const heroDef = getHeroVisualDefinition(heroVisual);
  const signature = makeSignature(palette, heroVisual);

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
    status: 'draft',
    validationStatus: 'unknown',
    validationErrors: [],
    certificationStatus: 'warning',
    routeAuditSummary: [],
    debugTags: ['seeded'],
    sourcePath: 'apps/api/src/modules/admin/theme-style-defaults.ts',
    voteCount: 0,
    savedBy: [],
    createdBy: SYSTEM_SEED_ACTOR,
    updatedBy: SYSTEM_SEED_ACTOR,
    lastAction: 'saved',
    revisionCreated: 1,
    revisionUpdated: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export interface GenerateDefaultsOptions {
  /** ISO timestamp for createdAt/updatedAt. Defaults to current time. */
  now?: string;
  /** Maximum items to generate. Cap at MAX_THEME_STYLE_ITEMS. */
  maxItems?: number;
}

/**
 * Generate the default 144 (palette × hero) seed items via round-robin.
 * Hero priority: dense-cockpit + centered-mark first (the user-facing
 * Pro/Mark switcher), then the remaining 7 in defined order.
 */
export function generateDefaultThemeStyleItems(
  options: GenerateDefaultsOptions = {},
): ThemeStyleLibraryItem[] {
  const now = options.now ?? new Date().toISOString();
  const maxItems = options.maxItems ?? 200;
  const palettes = pickRepresentativePalettes();
  const heroVariants = [...HERO_VISUAL_IDS];

  const heroPriority: HeroVisualId[] = [
    'dense-cockpit',
    'centered-mark',
    ...heroVariants.filter(
      (h: HeroVisualId) => h !== 'dense-cockpit' && h !== 'centered-mark',
    ),
  ];

  const items: ThemeStyleLibraryItem[] = [];
  outer: for (const { palette } of palettes) {
    for (const hero of heroPriority) {
      if (items.length >= maxItems) break outer;
      items.push(buildItem(palette, hero, now));
    }
  }

  return items;
}
