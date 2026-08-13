'use client';

import {
  COLOR_THEME_CATEGORIES,
  COLOR_THEME_DEFINITIONS,
  type ColorPalette,
  type ColorThemeCategory,
  EXPERIMENTAL_COLOR_PALETTE_IDS,
  FEATURED_COLOR_PALETTE_IDS,
  getColorThemeCategoryLabel,
  getColorThemeDefinition,
  getColorThemeDescription,
  getColorThemeLabel,
  getThemePreview,
  getThemeStyleMeta,
  HERO_VISUAL_DEFINITIONS,
  type HeroVisualDefinition,
  type HeroVisualId,
  normalizeThemeAppearanceOverrides,
  parseColorPalette,
  resolveThemeAppearanceControls,
  THEME_APPEARANCE_PRESETS,
  THEME_BUTTON_PRESETS,
  THEME_CARD_PRESETS,
  THEME_DENSITY_PRESETS,
  THEME_MOTION_PRESETS,
  THEME_RADIUS_PRESETS,
  THEME_SHADOW_PRESETS,
  adminRoutes,
  type ThemeAppearanceNumericKey,
  type ThemeAppearanceOverrides,
  type ThemeAppearancePresetId,
} from '@study-abroad/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock3,
  Layers3,
  Palette,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Lightbulb,
  Star,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth';
import { useColorPalette } from '@/hooks/use-color-palette';
import { useHeroVisual } from '@/hooks/use-hero-visual';
import { useThemeAppearanceOverrides } from '@/hooks/use-theme-appearance-overrides';
import { apiClient } from '@/lib/api';
import { usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

type ColorPaletteMenuProps = {
  className?: string;
  align?: 'start' | 'center' | 'end';
};

type ThemeGroupId =
  'featured' | 'recent' | 'favorites' | 'more' | 'experimental' | 'all' | ColorThemeCategory;
type StudioPanel = 'themes' | 'customize';

const RECENT_THEMES_KEY = 'color-palette-recents';
const FAVORITE_THEMES_KEY = 'color-palette-favorites';

const numericControls: ThemeAppearanceNumericKey[] = [
  'clarity',
  'frost',
  'glow',
  'texture',
  'contrast',
  'saturation',
  'colorPresence',
];

const heroPreviewStyles: Record<
  HeroVisualDefinition['tone'],
  { canvas: string; panel: string; accent: string; ink: string; glow: string }
> = {
  classic: {
    canvas: '#f8fafc',
    panel: '#ffffff',
    accent: '#2563eb',
    ink: '#0f172a',
    glow: 'rgba(96,165,250,0.34)',
  },
  command: {
    canvas: '#f7f8fb',
    panel: '#ffffff',
    accent: '#d5a94f',
    ink: '#111827',
    glow: 'rgba(221,184,90,0.28)',
  },
  brand: {
    canvas: '#11100f',
    panel: '#1b1713',
    accent: '#ddb85a',
    ink: '#fff7ea',
    glow: 'rgba(221,184,90,0.34)',
  },
  'dark-tech': {
    canvas: '#050505',
    panel: '#111111',
    accent: '#6574ff',
    ink: '#ffffff',
    glow: 'rgba(101,116,255,0.42)',
  },
  aura: {
    canvas: '#fbfbff',
    panel: '#ffffff',
    accent: '#ff5aa5',
    ink: '#151515',
    glow: 'rgba(255,90,165,0.32)',
  },
  editorial: {
    canvas: '#f7f1e6',
    panel: '#fff9ef',
    accent: '#1d1813',
    ink: '#1d1813',
    glow: 'rgba(221,184,90,0.2)',
  },
  minimal: {
    canvas: '#f8fafc',
    panel: '#ffffff',
    accent: '#111827',
    ink: '#111827',
    glow: 'rgba(15,23,42,0.12)',
  },
};

function readPaletteList(key: string): ColorPalette[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? parseColorPalette(item) : null))
      .filter((item): item is ColorPalette => Boolean(item));
  } catch {
    return [];
  }
}

function writePaletteList(key: string, values: ColorPalette[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* private browsing / quota */
  }
}

function HeroVisualPreview({ tone }: { tone: HeroVisualDefinition['tone'] }) {
  const style = heroPreviewStyles[tone];

  return (
    <div
      className="relative h-20 overflow-hidden rounded-[var(--theme-radius-card)] border"
      style={{
        background: style.canvas,
        borderColor: tone === 'brand' || tone === 'dark-tech' ? '#2b2b2b' : '#d7dde6',
      }}
    >
      <div
        className="absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl"
        style={{ background: style.glow }}
      />
      <div
        className="absolute left-3 top-3 h-12 w-20 rounded-lg border shadow-sm"
        style={{
          background: style.panel,
          borderColor:
            tone === 'brand' || tone === 'dark-tech' ? 'rgba(255,255,255,0.12)' : '#d7dde6',
        }}
      >
        <div className="flex gap-1 p-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
        </div>
        <div
          className="mx-2 mt-1 h-1.5 rounded-full"
          style={{ background: style.ink, opacity: 0.18 }}
        />
        <div className="mx-2 mt-1.5 h-1.5 w-8 rounded-full" style={{ background: style.accent }} />
      </div>
      <div
        className="absolute bottom-3 right-3 h-8 w-8 rounded-full border shadow-sm"
        style={{
          background: style.panel,
          borderColor:
            tone === 'brand' || tone === 'dark-tech' ? 'rgba(255,255,255,0.14)' : '#d7dde6',
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: style.accent, opacity: tone === 'minimal' ? 1 : 0.72 }}
        />
      </div>
      <div
        className="absolute bottom-4 left-28 h-2 w-12 rounded-full"
        style={{ background: style.accent }}
      />
      <div
        className="absolute bottom-7 left-28 h-2 w-16 rounded-full"
        style={{
          background: style.ink,
          opacity: tone === 'brand' || tone === 'dark-tech' ? 0.34 : 0.12,
        }}
      />
    </div>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <label className="grid gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="rounded-[var(--theme-radius-badge)] border bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-2xs uppercase tracking-[0.14em] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </label>
  );
}

function SegmentControl<T extends string>({
  label,
  values,
  value,
  onChange,
  getLabel,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (value: T) => string;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((item) => {
          const active = item === value;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={cn(
                'rounded-[var(--theme-radius-button)] border px-3 py-2 text-xs font-medium transition',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-[color:var(--theme-control-bg)] text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {getLabel(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ColorPaletteMenu({ className }: ColorPaletteMenuProps) {
  const t = useTranslations('ui.colorPalette');
  const locale = useLocale();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { palette, setPalette } = useColorPalette();
  const { heroVisual, setHeroVisual } = useHeroVisual();
  const labelLocale = locale.startsWith('zh') ? 'zh' : 'en';
  const {
    overridesByPalette,
    currentOverrides,
    setCurrentOverrides,
    replaceCurrentOverrides,
    resetCurrentOverrides,
    resetAllOverrides,
  } = useThemeAppearanceOverrides(palette);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<ThemeGroupId>('featured');
  const [activePanel, setActivePanel] = useState<StudioPanel>('themes');
  const [recentThemes, setRecentThemes] = useState<ColorPalette[]>([]);
  const [favoriteThemes, setFavoriteThemes] = useState<ColorPalette[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedOverrides = normalizeThemeAppearanceOverrides(currentOverrides);
  const selectedPreview = getThemePreview(palette, selectedOverrides);
  const selectedDefinition = getColorThemeDefinition(palette);
  const selectedStyle = getThemeStyleMeta(palette, selectedOverrides);
  const selectedControls = resolveThemeAppearanceControls(palette, selectedOverrides);
  const selectedHeroVisual = HERO_VISUAL_DEFINITIONS.find(
    (definition) => definition.id === heroVisual
  );
  const canSaveToAdminLibrary = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const saveThemeStyleMutation = useMutation({
    mutationFn: () =>
      apiClient.post(adminRoutes.themeStyles(), {
        palette,
        heroVisual,
        appearanceOverrides: selectedOverrides,
        sourcePath: pathname,
      }),
    onSuccess: () => {
      toast.success(t('saveToAdminSuccess'));
      queryClient.invalidateQueries({ queryKey: ['adminThemeStyles'] });
    },
    onError: () => {
      toast.error(t('saveToAdminError'));
    },
  });

  useEffect(() => {
    if (!open) return;
    setRecentThemes(readPaletteList(RECENT_THEMES_KEY));
    setFavoriteThemes(readPaletteList(FAVORITE_THEMES_KEY));
  }, [open]);

  const groups = useMemo(
    () => [
      { id: 'featured' as const, label: t('featured'), icon: Lightbulb },
      { id: 'recent' as const, label: t('recent'), icon: Clock3 },
      { id: 'favorites' as const, label: t('favorites'), icon: Star },
      { id: 'more' as const, label: t('more'), icon: Palette },
      { id: 'experimental' as const, label: t('experimental'), icon: SlidersHorizontal },
      { id: 'all' as const, label: t('all'), icon: null },
      ...COLOR_THEME_CATEGORIES.map((category) => ({
        id: category.id,
        label: getColorThemeCategoryLabel(category.id, labelLocale),
        icon: null,
      })),
    ],
    [labelLocale, t]
  );

  const activeThemeIds = useMemo(() => {
    const allThemeIds = COLOR_THEME_DEFINITIONS.map((theme) => theme.id as ColorPalette);
    if (activeGroup === 'recent') return recentThemes;
    if (activeGroup === 'favorites') return favoriteThemes;
    if (activeGroup === 'featured') return FEATURED_COLOR_PALETTE_IDS;
    if (activeGroup === 'experimental') return EXPERIMENTAL_COLOR_PALETTE_IDS;
    if (activeGroup === 'more') {
      const hiddenFromMore = new Set([
        ...FEATURED_COLOR_PALETTE_IDS,
        ...EXPERIMENTAL_COLOR_PALETTE_IDS,
      ]);
      return allThemeIds.filter((id) => !hiddenFromMore.has(id));
    }
    if (activeGroup === 'all') return allThemeIds;
    return COLOR_THEME_DEFINITIONS.filter((theme) => theme.category === activeGroup).map(
      (theme) => theme.id as ColorPalette
    );
  }, [activeGroup, favoriteThemes, recentThemes]);

  const filteredThemes = useMemo(() => {
    const sourceThemeIds = normalizedQuery
      ? COLOR_THEME_DEFINITIONS.map((theme) => theme.id as ColorPalette)
      : activeThemeIds;
    const definitions = sourceThemeIds
      .map((id) => getColorThemeDefinition(id))
      .filter((theme, index, all) => all.findIndex((item) => item.id === theme.id) === index);

    if (!normalizedQuery) return definitions;

    return definitions.filter((theme) => {
      const label = getColorThemeLabel(theme.id as ColorPalette, labelLocale);
      const description = getColorThemeDescription(theme.id as ColorPalette, labelLocale);
      return `${theme.id} ${theme.category} ${label} ${description}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [activeThemeIds, labelLocale, normalizedQuery]);

  const handleSelect = (id: ColorPalette) => {
    setPalette(id);
    setActivePanel('customize');
    const nextRecent = [id, ...recentThemes.filter((item) => item !== id)].slice(0, 12);
    setRecentThemes(nextRecent);
    writePaletteList(RECENT_THEMES_KEY, nextRecent);
  };

  const toggleFavorite = (id: ColorPalette) => {
    const nextFavorites = favoriteThemes.includes(id)
      ? favoriteThemes.filter((item) => item !== id)
      : [id, ...favoriteThemes].slice(0, 32);
    setFavoriteThemes(nextFavorites);
    writePaletteList(FAVORITE_THEMES_KEY, nextFavorites);
  };

  const applyPreset = (id: ThemeAppearancePresetId) => {
    replaceCurrentOverrides(THEME_APPEARANCE_PRESETS[id]);
  };

  const updateNumeric = (key: ThemeAppearanceNumericKey, value: number) => {
    setCurrentOverrides({ [key]: value } satisfies ThemeAppearanceOverrides);
  };

  const updateStyle = (patch: ThemeAppearanceOverrides) => {
    setCurrentOverrides(patch);
  };

  const presetIds = Object.keys(THEME_APPEARANCE_PRESETS) as ThemeAppearancePresetId[];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('rounded-[var(--theme-radius-button)]', className)}
          aria-label={t('menuLabel')}
          suppressHydrationWarning
        >
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="top-2 bottom-2 h-[calc(100dvh-1rem)] max-h-none w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] min-w-0 translate-y-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] gap-0 overflow-hidden !bg-[color:var(--theme-popover-bg)] p-0 text-popover-foreground !backdrop-blur-none sm:top-4 sm:bottom-4 sm:h-[calc(100dvh-2rem)] sm:w-[min(1480px,calc(100vw-2rem))] sm:max-w-[min(1480px,calc(100vw-2rem))]"
        showCloseButton
      >
        <DialogHeader className="min-w-0 overflow-hidden border-b border-border bg-[color:var(--theme-popover-bg)] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl">{t('studioTitle')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('studioDesc', { count: COLOR_THEME_DEFINITIONS.length })}
              </DialogDescription>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] px-3 py-2 text-xs text-muted-foreground">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: selectedPreview.primary }}
              />
              <span className="truncate">{getColorThemeLabel(palette, labelLocale)}</span>
            </div>
          </div>

          <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder', { count: COLOR_THEME_DEFINITIONS.length })}
                className="h-11 w-full rounded-[var(--theme-radius-input)] border border-input bg-[color:var(--theme-control-bg)] pl-10 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <div className="text-xs text-muted-foreground xl:self-center">
              {t('themesCount', { count: filteredThemes.length })}
            </div>
          </div>

          <div className="mt-3 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-2">
            {groups.map((group) => {
              const Icon = group.icon;
              const active = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    setActiveGroup(group.id);
                    setActivePanel('themes');
                  }}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--theme-radius-button)] border px-3 text-xs font-medium transition',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-[color:var(--theme-control-bg)] text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {group.label}
                </button>
              );
            })}
          </div>

          <div className="mt-1 grid min-w-0 grid-cols-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setActivePanel('themes')}
              className={cn(
                'rounded-[var(--theme-radius-button)] px-3 py-2 text-xs font-medium',
                activePanel === 'themes'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {t('themesTab')}
            </button>
            <button
              type="button"
              onClick={() => setActivePanel('customize')}
              className={cn(
                'rounded-[var(--theme-radius-button)] px-3 py-2 text-xs font-medium',
                activePanel === 'customize'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {t('customizeTab')}
            </button>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 min-w-0 grid-cols-1 overflow-hidden bg-[color:var(--theme-canvas-soft)] lg:grid-cols-[minmax(0,1fr)_390px]">
          <div
            className={cn(
              'min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5',
              activePanel === 'customize' && 'hidden lg:block'
            )}
          >
            <section className="mb-4 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] p-3 shadow-[var(--theme-card-shadow)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Layers3 className="h-3.5 w-3.5" />
                    {t('heroVisualTitle')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t('heroVisualDesc')}
                  </p>
                </div>
                {selectedHeroVisual ? (
                  <span className="w-fit rounded-[var(--theme-radius-badge)] border bg-[color:var(--theme-control-bg)] px-2 py-1 text-2xs font-medium text-muted-foreground">
                    {labelLocale === 'zh' ? selectedHeroVisual.labelZh : selectedHeroVisual.labelEn}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
                {HERO_VISUAL_DEFINITIONS.map((definition) => {
                  const active = heroVisual === definition.id;
                  const label = labelLocale === 'zh' ? definition.labelZh : definition.labelEn;
                  const description =
                    labelLocale === 'zh' ? definition.descriptionZh : definition.descriptionEn;

                  return (
                    <button
                      key={definition.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setHeroVisual(definition.id as HeroVisualId)}
                      className={cn(
                        'grid gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-2 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        active && 'border-primary ring-2 ring-primary/20'
                      )}
                    >
                      <HeroVisualPreview tone={definition.tone} />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {label}
                          </div>
                          <p className="mt-1 line-clamp-2 text-2xs leading-4 text-muted-foreground">
                            {description}
                          </p>
                        </div>
                        {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {filteredThemes.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-[var(--theme-radius-card)] border border-dashed bg-[color:var(--theme-card-bg)] text-sm text-muted-foreground">
                {t('noResults')}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredThemes.map((theme) => {
                  const id = theme.id as ColorPalette;
                  const themeOverrides = normalizeThemeAppearanceOverrides(overridesByPalette[id]);
                  const preview = getThemePreview(id, themeOverrides);
                  const active = palette === id;
                  const favorite = favoriteThemes.includes(id);

                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelect(id)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        handleSelect(id);
                      }}
                      className={cn(
                        'group grid min-h-[176px] overflow-hidden rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] text-left shadow-[var(--theme-card-shadow)] transition hover:border-primary/50 hover:shadow-[var(--theme-card-hover-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        active && 'border-primary ring-2 ring-primary/25'
                      )}
                    >
                      <div
                        className="relative h-24 overflow-hidden border-b p-3"
                        style={{ background: preview.canvas, borderColor: preview.border }}
                      >
                        <div
                          className="h-full rounded-[var(--theme-radius-card)] border p-2 shadow-sm"
                          style={{ background: preview.surface, borderColor: preview.border }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                              <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                            </div>
                            <div
                              className="h-4 w-14 rounded-full"
                              style={{ background: preview.primary }}
                            />
                          </div>
                          <div className="mt-3 grid gap-1.5">
                            {[0, 1, 2].map((rowIndex) => (
                              <div key={rowIndex} className="flex items-center gap-2">
                                <div
                                  className="h-2 flex-1 rounded-full"
                                  style={{ background: preview.heroPanel }}
                                />
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${28 + rowIndex * 12}%`,
                                    background: rowIndex === 1 ? preview.accent : preview.primary,
                                    opacity: rowIndex === 0 ? 0.42 : 1,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div
                          className="absolute right-5 top-5 h-3 w-3 rounded-full shadow-sm"
                          style={{ background: preview.accent }}
                        />
                      </div>
                      <div className="grid gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {getColorThemeLabel(id, labelLocale)}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {getColorThemeCategoryLabel(theme.category, labelLocale)}
                            </div>
                          </div>
                          <span className="flex items-center gap-1">
                            {active ? <Check className="h-4 w-4 text-primary" /> : null}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleFavorite(id);
                              }}
                              aria-label={favorite ? t('removeFavorite') : t('setFavorite')}
                              className={cn(
                                'rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground',
                                favorite && 'text-warning'
                              )}
                            >
                              <Star className={cn('h-3.5 w-3.5', favorite && 'fill-current')} />
                            </button>
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {getColorThemeDescription(id, labelLocale)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-2xs uppercase tracking-[0.12em] text-muted-foreground">
                          <span className="rounded-[var(--theme-radius-badge)] border px-1.5 py-0.5">
                            {preview.style.buttonPreset}
                          </span>
                          <span className="rounded-[var(--theme-radius-badge)] border px-1.5 py-0.5">
                            {preview.style.cardPreset}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside
            className={cn(
              'min-h-0 min-w-0 overflow-y-auto border-t border-border bg-[color:var(--theme-surface)] p-4 sm:p-5 lg:border-l lg:border-t-0',
              activePanel === 'themes' && 'hidden lg:block'
            )}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t('customizeTitle')}
            </div>

            <div
              className="mt-3 overflow-hidden rounded-[var(--theme-radius-card)] border shadow-[var(--theme-card-shadow)]"
              style={{ background: selectedPreview.canvas, borderColor: selectedPreview.border }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: selectedPreview.foreground }}
                    >
                      {getColorThemeLabel(palette, labelLocale)}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: selectedPreview.foreground }}>
                      {getColorThemeCategoryLabel(selectedDefinition.category, labelLocale)}
                    </div>
                  </div>
                  <div
                    className="h-9 w-9 rounded-full"
                    style={{ background: selectedPreview.accent }}
                  />
                </div>
                <div
                  className="mt-5 rounded-[var(--theme-radius-card)] border p-3"
                  style={{
                    background: selectedPreview.surface,
                    borderColor: selectedPreview.border,
                  }}
                >
                  <div
                    className="h-2 w-20 rounded-full"
                    style={{ background: selectedPreview.primary }}
                  />
                  <div className="mt-3 grid gap-2">
                    <div
                      className="h-8 rounded-[var(--theme-radius-button)]"
                      style={{ background: selectedPreview.primary }}
                    />
                    <div
                      className="h-8 rounded-[var(--theme-radius-button)] border"
                      style={{
                        background: selectedPreview.heroPanel,
                        borderColor: selectedPreview.border,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <section className="mt-5 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Layers3 className="h-3.5 w-3.5" />
                  {t('heroVisualTitle')}
                </div>
                {selectedHeroVisual ? (
                  <span className="truncate rounded-[var(--theme-radius-badge)] border bg-[color:var(--theme-control-bg)] px-2 py-1 text-2xs font-medium text-muted-foreground">
                    {labelLocale === 'zh' ? selectedHeroVisual.labelZh : selectedHeroVisual.labelEn}
                  </span>
                ) : null}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{t('heroVisualDesc')}</p>
              <div className="grid gap-2">
                {HERO_VISUAL_DEFINITIONS.map((definition) => {
                  const active = heroVisual === definition.id;
                  const label = labelLocale === 'zh' ? definition.labelZh : definition.labelEn;
                  const description =
                    labelLocale === 'zh' ? definition.descriptionZh : definition.descriptionEn;

                  return (
                    <button
                      key={definition.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setHeroVisual(definition.id as HeroVisualId)}
                      className={cn(
                        'grid gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-2 text-left transition hover:border-primary/50',
                        active && 'border-primary ring-2 ring-primary/20'
                      )}
                    >
                      <HeroVisualPreview tone={definition.tone} />
                      <div className="flex items-start justify-between gap-3 px-1 pb-1">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {label}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {description}
                          </p>
                        </div>
                        {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 grid gap-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                {t('presetTitle')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {presetIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyPreset(id)}
                    className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-primary/50"
                  >
                    {t(`presets.${id}`)}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Layers3 className="h-3.5 w-3.5" />
                {t('textureTitle')}
              </div>
              {numericControls.map((key) => (
                <RangeControl
                  key={key}
                  label={t(`controls.${key}`)}
                  value={selectedControls[key]}
                  minLabel={t(`controlMin.${key}`)}
                  maxLabel={t(`controlMax.${key}`)}
                  onChange={(value) => updateNumeric(key, value)}
                />
              ))}
            </section>

            <section className="mt-5 grid gap-5">
              <SegmentControl
                label={t('styleLabels.radius')}
                values={THEME_RADIUS_PRESETS}
                value={selectedStyle.radiusPreset}
                onChange={(value) => updateStyle({ radiusPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
              <SegmentControl
                label={t('styleLabels.density')}
                values={THEME_DENSITY_PRESETS}
                value={selectedStyle.densityPreset}
                onChange={(value) => updateStyle({ densityPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
              <SegmentControl
                label={t('styleLabels.button')}
                values={THEME_BUTTON_PRESETS}
                value={selectedStyle.buttonPreset}
                onChange={(value) => updateStyle({ buttonPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
              <SegmentControl
                label={t('styleLabels.card')}
                values={THEME_CARD_PRESETS}
                value={selectedStyle.cardPreset}
                onChange={(value) => updateStyle({ cardPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
              <SegmentControl
                label={t('styleLabels.shadow')}
                values={THEME_SHADOW_PRESETS}
                value={selectedStyle.shadowPreset}
                onChange={(value) => updateStyle({ shadowPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
              <SegmentControl
                label={t('styleLabels.motion')}
                values={THEME_MOTION_PRESETS}
                value={selectedStyle.motionPreset}
                onChange={(value) => updateStyle({ motionPreset: value })}
                getLabel={(value) => t(`styleValues.${value}`)}
              />
            </section>

            <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4">
              {canSaveToAdminLibrary ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="col-span-2"
                  onClick={() => saveThemeStyleMutation.mutate()}
                  disabled={saveThemeStyleMutation.isPending}
                >
                  <Star className="h-3.5 w-3.5" />
                  {saveThemeStyleMutation.isPending ? t('savingToAdmin') : t('saveToAdmin')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={resetCurrentOverrides}>
                <RotateCcw className="h-3.5 w-3.5" />
                {t('resetTheme')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetAllOverrides}>
                <RotateCcw className="h-3.5 w-3.5" />
                {t('resetAll')}
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
