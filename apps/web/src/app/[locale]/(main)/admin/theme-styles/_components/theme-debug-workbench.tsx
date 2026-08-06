'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Code2,
  Download,
  Eye,
  Palette,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';
import {
  COLOR_PALETTE_STORAGE_KEY,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_HERO_VISUAL_ID,
  HERO_VISUAL_STORAGE_KEY,
  THEME_APPEARANCE_CSS_VAR_NAMES,
  THEME_APPEARANCE_OVERRIDES_STORAGE_KEY,
  adminRoutes,
  getThemeAppearanceOverrideCssVars,
  getThemePreview,
  normalizeThemeAppearanceOverrides,
  parseColorPalette,
  parseHeroVisualId,
  type ColorPalette,
  type HeroVisualId,
  type ThemeCertificationResponse,
  type ThemeMatrixEntry,
  type ThemeStyleLibraryItem,
  type ThemeStyleLibraryResponse,
} from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CardSkeleton } from '@/components/ui/loading-state';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import {
  THEME_APPEARANCE_OVERRIDES_EVENT,
  applyThemeAppearanceOverrides,
} from '@/hooks/use-theme-appearance-overrides';
import { useColorPalette } from '@/hooks/use-color-palette';
import { useHeroVisual } from '@/hooks/use-hero-visual';

const CORE_CSS_VARS = [
  '--ds-primary',
  '--ds-background',
  '--ds-foreground',
  '--theme-card-bg',
  '--theme-radius-card',
  '--theme-button-default-bg',
  '--theme-button-default-fg',
  '--theme-button-secondary-bg',
  '--theme-button-secondary-fg',
  '--theme-button-danger-bg',
  '--theme-button-warning-bg',
  '--theme-button-success-bg',
] as const;

const STYLE_STATUS_KEYS = new Set(['draft', 'approved', 'active', 'archived', 'verified']);
const STYLE_VALIDATION_KEYS = new Set(['unknown', 'passed', 'warning', 'failed']);

type LocalDebugSnapshot = {
  palette: string;
  heroVisual: string;
  mode: string;
  localStorage: Record<string, string | null>;
  cssVars: Record<string, string>;
  viewport: string;
};

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getLabels(item: ThemeStyleLibraryItem, labelLocale: 'zh' | 'en') {
  return {
    palette: labelLocale === 'zh' ? item.paletteLabelZh : item.paletteLabelEn,
    paletteDescription:
      labelLocale === 'zh' ? item.paletteDescriptionZh : item.paletteDescriptionEn,
    hero: labelLocale === 'zh' ? item.heroVisualLabelZh : item.heroVisualLabelEn,
    heroDescription:
      labelLocale === 'zh' ? item.heroVisualDescriptionZh : item.heroVisualDescriptionEn,
  };
}

function readDebugSnapshot(): LocalDebugSnapshot | null {
  if (typeof window === 'undefined') return null;
  const root = document.documentElement;
  const computed = window.getComputedStyle(root);
  return {
    palette: root.getAttribute('data-color-palette') ?? '',
    heroVisual: root.getAttribute('data-hero-visual') ?? '',
    mode: root.classList.contains('dark') ? 'dark' : 'light',
    localStorage: {
      [COLOR_PALETTE_STORAGE_KEY]: localStorage.getItem(COLOR_PALETTE_STORAGE_KEY),
      [HERO_VISUAL_STORAGE_KEY]: localStorage.getItem(HERO_VISUAL_STORAGE_KEY),
      [THEME_APPEARANCE_OVERRIDES_STORAGE_KEY]: localStorage.getItem(
        THEME_APPEARANCE_OVERRIDES_STORAGE_KEY
      ),
    },
    cssVars: Object.fromEntries(
      CORE_CSS_VARS.map((name) => [name, computed.getPropertyValue(name)])
    ),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

function persistOverridesForPalette(
  palette: ColorPalette,
  overrides: ThemeStyleLibraryItem['appearanceOverrides']
) {
  const normalized = normalizeThemeAppearanceOverrides(overrides);
  const raw = localStorage.getItem(THEME_APPEARANCE_OVERRIDES_STORAGE_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  if (Object.keys(normalized).length > 0) {
    map[palette] = normalized;
  } else {
    delete map[palette];
  }
  localStorage.setItem(THEME_APPEARANCE_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  applyThemeAppearanceOverrides(palette, normalized);
  window.dispatchEvent(new Event(THEME_APPEARANCE_OVERRIDES_EVENT));
}

function clearLocalThemeState(
  setPalette: (next: ColorPalette) => void,
  setHeroVisual: (next: HeroVisualId) => void
) {
  setPalette(DEFAULT_COLOR_PALETTE);
  setHeroVisual(DEFAULT_HERO_VISUAL_ID);
  localStorage.removeItem(THEME_APPEARANCE_OVERRIDES_STORAGE_KEY);
  for (const name of THEME_APPEARANCE_CSS_VAR_NAMES) {
    document.documentElement.style.removeProperty(name);
  }
  window.dispatchEvent(new Event(THEME_APPEARANCE_OVERRIDES_EVENT));
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ThemeDebugWorkbench() {
  const t = useTranslations('admin.themeStyles');
  const locale = useLocale();
  const labelLocale = locale.startsWith('zh') ? 'zh' : 'en';
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { setPalette } = useColorPalette();
  const { setHeroVisual } = useHeroVisual();
  const [previewItem, setPreviewItem] = useState<ThemeStyleLibraryItem | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [appliedItem, setAppliedItem] = useState<ThemeStyleLibraryItem | null>(null);
  const [debugSnapshot, setDebugSnapshot] = useState<LocalDebugSnapshot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminThemeStyles'],
    queryFn: () => apiClient.get<ThemeStyleLibraryResponse>(adminRoutes.themeStyles()),
  });

  const { data: diagnosticsData } = useQuery({
    queryKey: ['adminThemeStyleDiagnostics'],
    queryFn: () =>
      apiClient.get<Pick<ThemeStyleLibraryResponse, 'revision' | 'checksum' | 'diagnostics'>>(
        adminRoutes.themeStyleDiagnostics()
      ),
  });

  const { data: certificationData, isLoading: isCertificationLoading } = useQuery({
    queryKey: ['adminThemeStyleCertification'],
    queryFn: () => apiClient.get<ThemeCertificationResponse>(adminRoutes.themeStyleCertification()),
  });

  const patchMutation = useMutation({
    mutationFn: (item: ThemeStyleLibraryItem) =>
      apiClient.patch(adminRoutes.themeStyleById(item.id), {
        expectedRevision: data?.revision,
        status: 'verified',
        validationStatus: 'passed',
        validationErrors: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminThemeStyles'] });
      queryClient.invalidateQueries({ queryKey: ['adminThemeStyleDiagnostics'] });
    },
  });

  const items = data?.items ?? [];
  const compareItems = compareIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ThemeStyleLibraryItem => Boolean(item));
  const diagnostics = diagnosticsData?.diagnostics ?? data?.diagnostics;

  useEffect(() => {
    setDebugSnapshot(readDebugSnapshot());
  }, [appliedItem, data?.revision]);

  const applyItemLocally = (item: ThemeStyleLibraryItem) => {
    const palette = parseColorPalette(item.palette);
    const heroVisual = parseHeroVisualId(item.heroVisual);
    setPalette(palette);
    setHeroVisual(heroVisual);
    persistOverridesForPalette(palette, item.appearanceOverrides);
    setAppliedItem(item);
    setDebugSnapshot(readDebugSnapshot());
  };

  const exportDiagnostics = (item?: ThemeStyleLibraryItem) => {
    const snapshot = readDebugSnapshot();
    const cssVarPreview = item
      ? getThemeAppearanceOverrideCssVars(
          parseColorPalette(item.palette),
          normalizeThemeAppearanceOverrides(item.appearanceOverrides)
        )
      : {};
    downloadJson(`theme-style-diagnostics-${item?.signature ?? data?.revision ?? 'local'}.json`, {
      item,
      library: {
        revision: data?.revision,
        checksum: data?.checksum,
        diagnostics,
      },
      certification: item?.certificationResult ?? certificationData,
      currentUrl: window.location.href,
      locale,
      adminEmail: user?.email,
      exportedAt: new Date().toISOString(),
      localSnapshot: snapshot,
      resolvedOverrideVars: cssVarPreview,
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current.slice(-1), id];
    });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Palette}
        variant="admin"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportDiagnostics()}>
              <Download className="h-4 w-4" />
              {t('exportDiagnostics')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                clearLocalThemeState(setPalette, setHeroVisual);
                setAppliedItem(null);
                setDebugSnapshot(readDebugSnapshot());
              }}
            >
              <RotateCcw className="h-4 w-4" />
              {t('resetLocal')}
            </Button>
          </div>
        }
      />

      {appliedItem ? (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{t('localDebugging')}</Badge>
                <span className="font-medium">{getLabels(appliedItem, labelLocale).palette}</span>
                <span className="text-sm text-muted-foreground">
                  {getLabels(appliedItem, labelLocale).hero}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {appliedItem.sourcePath
                  ? t('sourcePath', { value: appliedItem.sourcePath })
                  : t('localOnly')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                clearLocalThemeState(setPalette, setHeroVisual);
                setAppliedItem(null);
                setDebugSnapshot(readDebugSnapshot());
              }}
            >
              <RotateCcw className="h-4 w-4" />
              {t('resetLocal')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <ThemeCertificationMatrix
            data={certificationData}
            isLoading={isCertificationLoading}
            labelLocale={labelLocale}
          />

          {compareItems.length > 0 ? (
            <CompareWorkbench
              items={compareItems}
              labelLocale={labelLocale}
              onClear={() => setCompareIds([])}
            />
          ) : null}

          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <CardSkeleton key={item} />
              ))}
            </div>
          ) : items.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <StyleLibraryCard
                  key={item.id}
                  item={item}
                  labelLocale={labelLocale}
                  isCompared={compareIds.includes(item.id)}
                  isApplied={appliedItem?.id === item.id}
                  isVerifying={patchMutation.isPending}
                  certificationEntry={certificationData?.matrix?.find(
                    (entry) =>
                      entry.palette === item.palette && entry.heroVisual === item.heroVisual
                  )}
                  onPreview={() => setPreviewItem(item)}
                  onApply={() => applyItemLocally(item)}
                  onCompare={() => toggleCompare(item.id)}
                  onExport={() => exportDiagnostics(item)}
                  onVerify={() => patchMutation.mutate(item)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium">{t('emptyTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('emptyDescription')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DiagnosticsPanel
          response={data}
          diagnostics={diagnostics}
          snapshot={debugSnapshot}
          onRefresh={() => setDebugSnapshot(readDebugSnapshot())}
        />
      </div>

      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {previewItem ? getLabels(previewItem, labelLocale).palette : ''}
            </DialogTitle>
            <DialogDescription>
              {previewItem ? getLabels(previewItem, labelLocale).paletteDescription : ''}
            </DialogDescription>
          </DialogHeader>
          {previewItem ? <PreviewMatrix item={previewItem} labelLocale={labelLocale} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ThemeCertificationMatrix({
  data,
  isLoading,
  labelLocale,
}: {
  data?: ThemeCertificationResponse;
  isLoading: boolean;
  labelLocale: 'zh' | 'en';
}) {
  const t = useTranslations('admin.themeStyles');
  const highlights = useMemo(() => {
    const entries = data?.matrix ?? [];
    const defaultEntry = entries.find((entry) => entry.isDefault);
    const brandEntry = entries.find(
      (entry) => entry.isBrandVisual && entry.palette === data?.defaultPalette
    );
    const reviewEntries = entries
      .filter((entry) => entry.certification.status !== 'passed')
      .sort((a, b) => a.certification.score - b.certification.score)
      .slice(0, 4);
    return [defaultEntry, brandEntry, ...reviewEntries].filter(
      (entry, index, list): entry is ThemeMatrixEntry =>
        Boolean(entry) && list.findIndex((item) => item?.id === entry?.id) === index
    );
  }, [data]);
  const buttonVariantCount = data?.diagnostics.buttonVariantCount ?? 8;

  if (isLoading) return <CardSkeleton />;

  return (
    <Card className="border-primary/20 bg-[color:var(--theme-card-bg)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t('themeMatrix')}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t('themeMatrixDescription')}</p>
          </div>
          {data ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{t('matrixPassed', { count: data.passed })}</Badge>
              <Badge variant="warning">{t('matrixWarning', { count: data.warning })}</Badge>
              <Badge variant={data.failed ? 'destructive' : 'outline'}>
                {t('matrixFailed', { count: data.failed })}
              </Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data ? (
          <>
            <div className="grid gap-3 md:grid-cols-5">
              <InfoBlock label={t('defaultPalette')} value={data.defaultPalette} />
              <InfoBlock label={t('defaultHero')} value={data.defaultHeroVisual} />
              <InfoBlock label={t('matrixTotal')} value={String(data.total)} />
              <InfoBlock label={t('matrixIssues')} value={String(data.diagnostics.issueCount)} />
              <InfoBlock label={t('buttonVariants')} value={String(buttonVariantCount)} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {highlights.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {entry.isDefault ? (
                          <Badge variant="default">{t('defaultTheme')}</Badge>
                        ) : null}
                        {entry.isBrandVisual ? (
                          <Badge variant="outline">{t('brandVisual')}</Badge>
                        ) : null}
                        <Badge
                          variant={
                            entry.certification.status === 'passed'
                              ? 'success'
                              : entry.certification.status === 'warning'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {t(`certification.${entry.certification.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-2 truncate font-medium">
                        {labelLocale === 'zh' ? entry.paletteLabelZh : entry.paletteLabelEn}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {labelLocale === 'zh' ? entry.heroVisualLabelZh : entry.heroVisualLabelEn}
                      </p>
                    </div>
                    <span className="text-xl font-semibold tabular-nums">
                      {entry.certification.score}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>
                      {t('tokensShort', {
                        value: Math.round(entry.certification.tokenCompleteness * 100),
                      })}
                    </span>
                    <span>
                      {t('contrastShort', {
                        value: Math.round(entry.certification.contrastScore * 100),
                      })}
                    </span>
                    <span>
                      {t('routesShort', {
                        value: Math.round(entry.certification.routeCoverage * 100),
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('themeMatrixUnavailable')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StyleLibraryCard({
  item,
  labelLocale,
  isCompared,
  isApplied,
  isVerifying,
  certificationEntry,
  onPreview,
  onApply,
  onCompare,
  onExport,
  onVerify,
}: {
  item: ThemeStyleLibraryItem;
  labelLocale: 'zh' | 'en';
  isCompared: boolean;
  isApplied: boolean;
  isVerifying: boolean;
  certificationEntry?: ThemeMatrixEntry;
  onPreview: () => void;
  onApply: () => void;
  onCompare: () => void;
  onExport: () => void;
  onVerify: () => void;
}) {
  const t = useTranslations('admin.themeStyles');
  const locale = useLocale();
  const labels = getLabels(item, labelLocale);
  const preview = getThemePreview(item.palette, item.appearanceOverrides);
  const rawStatus = String(item.status ?? '');
  const rawValidationStatus = String(item.validationStatus ?? '');
  const status = STYLE_STATUS_KEYS.has(rawStatus) ? rawStatus : 'draft';
  const validationStatus = STYLE_VALIDATION_KEYS.has(rawValidationStatus)
    ? rawValidationStatus
    : 'unknown';
  const certification = item.certificationResult ?? certificationEntry?.certification;
  const certificationStatus = item.certificationStatus ?? certification?.status ?? 'warning';
  const certificationScore = certification?.score ?? 0;
  const routeCoverage = certification
    ? Math.round(certification.routeCoverage * 100)
    : Math.round((item.routeAuditSummary?.length ? 1 : 0) * 100);

  return (
    <Card className={cn('relative', isApplied && 'border-primary/40 ring-2 ring-primary/15')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant={status === 'verified' ? 'success' : 'outline'}>
                {t(`status.${status}`)}
              </Badge>
              <Badge variant={validationStatus === 'passed' ? 'success' : 'secondary'}>
                {t(`validation.${validationStatus}`)}
              </Badge>
              <Badge variant={certificationStatus === 'passed' ? 'success' : 'warning'}>
                {t(`certification.${certificationStatus}`)}
              </Badge>
            </div>
            <CardTitle className="truncate text-base">{labels.palette}</CardTitle>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {labels.paletteDescription}
            </p>
          </div>
          <Badge variant="default" className="shrink-0 gap-1">
            <Star className="h-3 w-3" />
            {item.voteCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="overflow-hidden rounded-[var(--theme-radius-card)] border p-3"
          style={{
            background: preview.canvas,
            borderColor: preview.border,
            color: preview.foreground,
          }}
        >
          <div
            className="rounded-[var(--theme-radius-card)] border p-3"
            style={{ background: preview.surface, borderColor: preview.border }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{labels.hero}</p>
                <p className="mt-1 line-clamp-1 text-xs opacity-70">{labels.heroDescription}</p>
              </div>
              <span
                className="h-8 w-8 rounded-[var(--theme-radius-button)]"
                style={{ background: preview.primary }}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <div className="h-2 rounded-full" style={{ background: preview.heroPanel }} />
              <div className="h-2 w-2/3 rounded-full" style={{ background: preview.accent }} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label={t('palette')} value={item.palette} />
          <InfoBlock label={t('heroVisual')} value={labels.hero} hint={labels.heroDescription} />
          <InfoBlock label={t('certificationScore')} value={`${certificationScore}/100`} />
          <InfoBlock label={t('routeCoverage')} value={`${routeCoverage}%`} />
          <InfoBlock
            label={t('buttonContrast')}
            value={
              certification?.contrastSummary
                ? certification.contrastSummary.minimumTextContrast.toFixed(2)
                : '-'
            }
          />
          <InfoBlock
            label={t('surfaceContrast')}
            value={
              certification?.contrastSummary
                ? certification.contrastSummary.minimumSurfaceContrast.toFixed(2)
                : '-'
            }
          />
        </div>

        {certification?.issues.length ? (
          <div className="rounded-[var(--theme-radius-card)] border bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning">{t('certificationIssues')}</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {certification.issues.slice(0, 3).map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  {issue.code}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{item.styleMeta.radiusPreset}</Badge>
          <Badge variant="outline">{item.styleMeta.densityPreset}</Badge>
          <Badge variant="outline">{item.styleMeta.buttonPreset}</Badge>
          <Badge variant="outline">{item.styleMeta.cardPreset}</Badge>
          <Badge variant="outline">{item.styleMeta.shadowPreset}</Badge>
          <Badge variant="outline">{item.styleMeta.motionPreset}</Badge>
        </div>

        <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <UserRound className="h-4 w-4 text-primary" />
            {t('savedBy')}
          </div>
          <div className="space-y-2">
            {item.savedBy.map((entry) => (
              <div
                key={entry.userId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">{entry.email}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(entry.savedAt, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <span>{t('updatedAt', { value: formatDate(item.updatedAt, locale) })}</span>
          {item.sourcePath ? <span>{t('sourcePath', { value: item.sourcePath })}</span> : null}
        </div>

        <Separator />

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-4 w-4" />
            {t('preview')}
          </Button>
          <Button
            type="button"
            variant={isApplied ? 'default' : 'outline'}
            size="sm"
            onClick={onApply}
          >
            <Palette className="h-4 w-4" />
            {isApplied ? t('applied') : t('applyLocal')}
          </Button>
          <Button
            type="button"
            variant={isCompared ? 'default' : 'outline'}
            size="sm"
            onClick={onCompare}
          >
            <Scale className="h-4 w-4" />
            {isCompared ? t('comparing') : t('compare')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            {t('exportDiagnostics')}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="sm:col-span-2"
            disabled={isVerifying}
            onClick={onVerify}
          >
            <ShieldCheck className="h-4 w-4" />
            {status === 'verified' ? t('verified') : t('markVerified')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareWorkbench({
  items,
  labelLocale,
  onClear,
}: {
  items: ThemeStyleLibraryItem[];
  labelLocale: 'zh' | 'en';
  onClear: () => void;
}) {
  const t = useTranslations('admin.themeStyles');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            {t('compareWorkbench')}
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t('clearCompare')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <PreviewPanel key={item.id} item={item} labelLocale={labelLocale} compact />
        ))}
        {items.length < 2 ? (
          <div className="flex min-h-40 items-center justify-center rounded-[var(--theme-radius-card)] border border-dashed text-sm text-muted-foreground">
            {t('compareNeedsTwo')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PreviewMatrix({
  item,
  labelLocale,
}: {
  item: ThemeStyleLibraryItem;
  labelLocale: 'zh' | 'en';
}) {
  const t = useTranslations('admin.themeStyles');
  return (
    <Tabs defaultValue="desktop">
      <TabsList>
        <TabsTrigger value="desktop">{t('desktopPreview')}</TabsTrigger>
        <TabsTrigger value="mobile">{t('mobilePreview')}</TabsTrigger>
        <TabsTrigger value="tokens">{t('tokensPreview')}</TabsTrigger>
      </TabsList>
      <TabsContent value="desktop" className="mt-4">
        <PreviewPanel item={item} labelLocale={labelLocale} />
      </TabsContent>
      <TabsContent value="mobile" className="mt-4">
        <div className="mx-auto max-w-sm">
          <PreviewPanel item={item} labelLocale={labelLocale} compact />
        </div>
      </TabsContent>
      <TabsContent value="tokens" className="mt-4">
        <pre className="max-h-80 overflow-auto rounded-[var(--theme-radius-card)] border bg-muted/30 p-4 text-xs">
          {JSON.stringify(
            {
              palette: item.palette,
              heroVisual: item.heroVisual,
              appearanceOverrides: item.appearanceOverrides,
              styleMeta: item.styleMeta,
            },
            null,
            2
          )}
        </pre>
      </TabsContent>
    </Tabs>
  );
}

function PreviewPanel({
  item,
  labelLocale,
  compact,
}: {
  item: ThemeStyleLibraryItem;
  labelLocale: 'zh' | 'en';
  compact?: boolean;
}) {
  const labels = getLabels(item, labelLocale);
  const preview = getThemePreview(item.palette, item.appearanceOverrides);

  return (
    <div
      className={cn(
        'rounded-[var(--theme-radius-card)] border p-4',
        compact ? 'min-h-52' : 'min-h-72'
      )}
      style={{ background: preview.canvas, borderColor: preview.border, color: preview.foreground }}
    >
      <div className="grid gap-4">
        <div
          className="rounded-[var(--theme-radius-card)] border p-4 shadow-sm"
          style={{ background: preview.surface, borderColor: preview.border }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.12em] opacity-60">{labels.hero}</div>
              <div className="mt-2 text-xl font-semibold">{labels.palette}</div>
              <p className="mt-2 max-w-lg text-sm opacity-70">{labels.paletteDescription}</p>
            </div>
            <span
              className="h-12 w-12 rounded-[var(--theme-radius-button)]"
              style={{ background: preview.primary }}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[preview.primary, preview.accent, preview.heroPanel].map((color, index) => (
            <div
              key={`${item.id}-${index}`}
              className="rounded-[var(--theme-radius-card)] border p-3"
              style={{ background: preview.surface, borderColor: preview.border }}
            >
              <div className="h-2 rounded-full" style={{ background: color }} />
              <div
                className="mt-3 h-2 w-2/3 rounded-full opacity-50"
                style={{ background: preview.foreground }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiagnosticsPanel({
  response,
  diagnostics,
  snapshot,
  onRefresh,
}: {
  response?: ThemeStyleLibraryResponse;
  diagnostics?: ThemeStyleLibraryResponse['diagnostics'];
  snapshot: LocalDebugSnapshot | null;
  onRefresh: () => void;
}) {
  const t = useTranslations('admin.themeStyles');
  const missingVars = useMemo(() => {
    if (!snapshot) return [];
    return Object.entries(snapshot.cssVars)
      .filter(([, value]) => !value.trim())
      .map(([key]) => key);
  }, [snapshot]);

  return (
    <aside className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2 className="h-4 w-4 text-primary" />
              {t('diagnostics')}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('diagnostics')}
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <InfoBlock label={t('revision')} value={String(response?.revision ?? '-')} />
            <InfoBlock label={t('items')} value={String(response?.total ?? '-')} />
          </div>
          <div className="space-y-2 text-sm">
            <DebugRow label={t('parseStatus')} value={diagnostics?.parseStatus ?? '-'} />
            <DebugRow label={t('checksumStatus')} value={diagnostics?.checksumStatus ?? '-'} />
            <DebugRow
              label={t('duplicates')}
              value={String(diagnostics?.duplicateSignatureCount ?? 0)}
            />
            <DebugRow label={t('discarded')} value={String(diagnostics?.discardedItemCount ?? 0)} />
          </div>
          {diagnostics?.issues?.length ? (
            <div className="rounded-[var(--theme-radius-card)] border bg-warning/10 p-3 text-sm">
              <p className="font-medium text-warning">{t('diagnosticIssues')}</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {diagnostics.issues.slice(0, 5).map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    {issue.code}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[var(--theme-radius-card)] border bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {t('diagnosticsClean')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('localSnapshot')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot ? (
            <>
              <DebugRow label="palette" value={snapshot.palette || '-'} />
              <DebugRow label="hero" value={snapshot.heroVisual || '-'} />
              <DebugRow label="mode" value={snapshot.mode} />
              <DebugRow label="viewport" value={snapshot.viewport} />
              <Separator />
              <div className="space-y-2">
                {Object.entries(snapshot.cssVars).map(([key, value]) => (
                  <DebugRow key={key} label={key} value={value.trim() || '-'} />
                ))}
              </div>
              {missingVars.length ? (
                <Badge variant="warning">{t('missingVars', { count: missingVars.length })}</Badge>
              ) : null}
              <Textarea
                readOnly
                value={JSON.stringify(snapshot.localStorage, null, 2)}
                className="min-h-32 font-mono text-xs"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noLocalSnapshot')}</p>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function InfoBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
      {hint ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="max-w-[190px] break-words text-right font-medium">{value}</span>
    </div>
  );
}
