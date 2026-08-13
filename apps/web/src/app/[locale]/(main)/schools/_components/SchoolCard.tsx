'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  Award,
  Building,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MapPin,
  Plus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { SchoolLogo } from '@/components/features';
import {
  getSchoolEnrollmentCount,
  getSchoolFieldSource,
  getSupplementalCampusLifeGrades,
  getTrustedValue,
  hasVerifiedFieldSource,
} from '@/components/features/schools/school-display-utils';
import { IndexGroup } from '@/components/features/schools/IndexIndicators';
import { Link } from '@/lib/i18n/navigation';
import { cn, formatAcceptanceRate, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { type SchoolRankingList } from '@/components/features/schools/school-filters';
import { type School } from './schools-types';

export type SchoolCardViewMode = 'list' | 'grid';
export type SchoolCardDensity = 'comfortable' | 'compact';

interface SchoolCardProps {
  school: School;
  viewMode: SchoolCardViewMode;
  density?: SchoolCardDensity;
  hasAuth: boolean;
  isSelected: boolean;
  isAdded: boolean;
  onToggleSelection: (school: School, checked: boolean) => void;
  onAddToList: (schoolId: string, round: string) => void;
  isAddingToList: boolean;
  preferredRankingList?: SchoolRankingList;
  priorityMedia?: boolean;
}

const ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const;
type HeroMediaSize = 'list' | 'grid' | 'gridCompact';

const HERO_MEDIA_FRAME_CLASSES: Record<HeroMediaSize, string> = {
  list: 'h-[180px] w-full sm:w-[280px]',
  grid: 'h-40 w-full',
  gridCompact: 'h-32 w-full',
};

function schoolHue(school: { id: string; country?: string }) {
  const seed = (school.country ?? '') + school.id;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function toWikimediaThumbnailSize(url: string, width: 500): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.hostname !== 'upload.wikimedia.org') return url;
  const segments = parsed.pathname.split('/').filter(Boolean);
  const thumbIndex = segments.findIndex((segment) => segment === 'thumb');
  if (thumbIndex < 0) return url;
  const thumbnailSegment = segments[segments.length - 1];
  const fileMatch = thumbnailSegment.match(/^\d+px-(.+)$/);
  if (!fileMatch) return url;
  segments[segments.length - 1] = `${width}px-${fileMatch[1]}`;
  parsed.pathname = `/${segments.join('/')}`;
  return parsed.toString();
}

function canUseOptimizedCover(url: string): boolean {
  try {
    return new URL(url).hostname === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

function HeroGradient({
  hue,
  initial,
  size,
}: {
  hue: number;
  initial: string;
  size: HeroMediaSize;
}) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden',
        HERO_MEDIA_FRAME_CLASSES[size]
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 45%) 0%, hsl(${(hue + 30) % 360} 75% 60%) 100%)`,
      }}
      aria-hidden="true"
    >
      <span
        className={cn(
          'select-none leading-none text-white/30 transition-transform duration-500 group-hover:scale-110',
          size === 'list' ? 'text-display-hero' : size === 'grid' ? 'text-7xl' : 'text-6xl'
        )}
      >
        {initial}
      </span>
    </div>
  );
}

function SchoolHeroMedia({
  coverUrl,
  schoolName,
  sourceUrl,
  sourceQuality,
  sourceType,
  hue,
  initial,
  size,
  priority,
}: {
  coverUrl?: string | null;
  schoolName: string;
  sourceUrl?: string | null;
  sourceQuality?: string;
  sourceType?: string | null;
  hue: number;
  initial: string;
  size: HeroMediaSize;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!coverUrl || failed) {
    return <HeroGradient hue={hue} initial={initial} size={size} />;
  }

  const displayUrl = toWikimediaThumbnailSize(coverUrl, 500);
  const imageClassName =
    'h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]';

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-muted',
        HERO_MEDIA_FRAME_CLASSES[size]
      )}
    >
      {canUseOptimizedCover(displayUrl) ? (
        <Image
          src={displayUrl}
          alt={schoolName}
          fill
          sizes={
            size === 'list'
              ? '(min-width: 640px) 280px, 100vw'
              : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
          }
          quality={75}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          unoptimized
          onError={() => setFailed(true)}
          title={sourceUrl ?? sourceType ?? undefined}
          data-source-url={sourceUrl ?? undefined}
          data-source-quality={sourceQuality}
          data-source-type={sourceType ?? undefined}
          className={imageClassName}
        />
      ) : (
        <Image
          src={displayUrl}
          alt={schoolName}
          fill
          sizes={
            size === 'list'
              ? '(min-width: 640px) 280px, 100vw'
              : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
          }
          priority={priority}
          unoptimized
          onError={() => setFailed(true)}
          title={sourceUrl ?? sourceType ?? undefined}
          data-source-url={sourceUrl ?? undefined}
          data-source-quality={sourceQuality}
          data-source-type={sourceType ?? undefined}
          className={imageClassName}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5" />
    </div>
  );
}

export function SchoolCard({
  school,
  viewMode,
  density = 'comfortable',
  hasAuth,
  isSelected,
  isAdded,
  onToggleSelection,
  onAddToList,
  isAddingToList,
  preferredRankingList,
  priorityMedia,
}: SchoolCardProps) {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();

  const schoolName = getSchoolName(school, locale);
  const subName = getSchoolSubName(school, locale);
  const initial = schoolName.charAt(0).toUpperCase();
  const hue = schoolHue(school);
  const campusCover = school.media?.campusCover;
  const campusCoverUrl = campusCover?.url ?? null;
  const campusCoverSourceUrl = campusCover?.sourcePageUrl ?? campusCover?.originalUrl ?? null;
  const campusCoverSourceQuality = campusCoverSourceUrl
    ? 'approved_media_source'
    : campusCoverUrl
      ? 'approved_media_source_unavailable'
      : 'missing_media_source';
  const logoUrl = school.media?.logo?.url ?? school.logoUrl;

  const acceptanceSource = getSchoolFieldSource(school, 'acceptanceRate');
  const enrollmentSource = getSchoolFieldSource(school, 'totalEnrollment', 'studentCount');
  const enrollmentCount = hasVerifiedFieldSource(school, 'totalEnrollment', 'studentCount')
    ? getSchoolEnrollmentCount(school)
    : undefined;
  const trustedEnrollment = getTrustedValue(
    school,
    enrollmentCount,
    'totalEnrollment',
    'studentCount'
  );
  const trustedAcceptance = getTrustedValue(school, school.acceptanceRate, 'acceptanceRate');
  const isVerified = Boolean(acceptanceSource ?? enrollmentSource);
  const campusGrades = getSupplementalCampusLifeGrades(school);

  const locationParts = [school.city, school.state, school.country].filter(Boolean).join(', ');
  const typeLabel = school.isPrivate
    ? t('private')
    : school.isPrivate === false
      ? t('public')
      : null;

  const detailHref = `/schools/${school.id}`;
  const websiteUrl = school.website?.trim();

  const isCompact = density === 'compact';

  const fitScorePill = school.fitScore != null && (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full bg-background/90 font-bold text-blue-700 shadow-sm backdrop-blur-sm dark:text-blue-300',
        viewMode === 'grid' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span
        className={cn('rounded-full bg-blue-500', viewMode === 'grid' ? 'h-1.5 w-1.5' : 'h-2 w-2')}
      />
      {t('fitScoreMatch', { score: Math.round(school.fitScore) })}
    </div>
  );

  const selectionCheckbox = hasAuth && (
    <div className="absolute left-3 top-3 z-10">
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onToggleSelection(school, checked === true)}
        disabled={isAdded}
        aria-label={schoolName}
        className="bg-background/80 backdrop-blur-sm"
      />
    </div>
  );

  const trustMetric = (
    <div className="flex flex-col">
      <span
        className={cn(
          'mb-0.5 font-semibold uppercase tracking-wider text-muted-foreground',
          viewMode === 'grid' ? 'text-2xs' : 'text-xs'
        )}
      >
        {t('trustLabel')}
      </span>
      <span
        className={cn(
          'flex items-center gap-1 font-medium',
          isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
        )}
      >
        <CheckCircle2 className={cn(viewMode === 'grid' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        {isVerified ? tc('verified') : tc('estimated')}
      </span>
    </div>
  );

  const acceptanceMetric = (
    <div className="flex flex-col">
      <span
        className={cn(
          'mb-0.5 font-semibold uppercase tracking-wider text-muted-foreground',
          viewMode === 'grid' ? 'text-2xs' : 'text-xs'
        )}
      >
        {t('acceptanceRate')}
      </span>
      <span
        className={cn(
          'font-medium',
          trustedAcceptance != null && trustedAcceptance < 15
            ? 'text-rose-500 dark:text-rose-400'
            : trustedAcceptance != null && trustedAcceptance < 30
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-foreground'
        )}
      >
        {trustedAcceptance != null ? formatAcceptanceRate(trustedAcceptance) : tc('notAvailable')}
      </span>
    </div>
  );

  const studentsMetric = (
    <div className="flex flex-col">
      <span
        className={cn(
          'mb-0.5 font-semibold uppercase tracking-wider text-muted-foreground',
          viewMode === 'grid' ? 'text-2xs' : 'text-xs'
        )}
      >
        {t('students')}
      </span>
      <span className="font-medium text-foreground">
        {trustedEnrollment ? format.number(trustedEnrollment, 'standard') : tc('notAvailable')}
      </span>
    </div>
  );

  const visitButton = websiteUrl ? (
    <Button
      variant="ghost"
      size={viewMode === 'grid' ? 'sm' : 'default'}
      asChild
      className={cn(
        'min-w-0 gap-1.5 font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300',
        viewMode === 'grid' ? 'h-8 flex-1 shrink px-2 text-xs' : 'flex-1 px-3 sm:flex-none'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink className={viewMode === 'grid' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {viewMode === 'grid' ? t('visitSiteShort') : t('visitSite')}
      </a>
    </Button>
  ) : (
    <Button
      variant="ghost"
      size={viewMode === 'grid' ? 'sm' : 'default'}
      disabled
      title={t('visitSiteUnavailable')}
      className={cn(
        'min-w-0 gap-1.5 font-medium text-muted-foreground',
        viewMode === 'grid' ? 'h-8 flex-1 shrink px-2 text-xs' : 'flex-1 px-3 sm:flex-none'
      )}
    >
      <ExternalLink className={viewMode === 'grid' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {viewMode === 'grid' ? t('visitSiteShort') : t('visitSite')}
    </Button>
  );

  const addButton = !hasAuth ? (
    <Button
      variant="default"
      size={viewMode === 'grid' ? 'sm' : 'default'}
      asChild
      className={cn(
        'min-w-0 gap-1 bg-blue-600 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
        viewMode === 'grid' ? 'h-8 flex-1 shrink text-xs' : 'flex-1 sm:flex-none'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Link href={detailHref}>
        {t('viewDetails')}
        <ChevronRight className={viewMode === 'grid' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </Link>
    </Button>
  ) : isAdded ? (
    <Button
      variant="secondary"
      size={viewMode === 'grid' ? 'sm' : 'default'}
      disabled
      className={cn(
        'min-w-0 font-medium',
        viewMode === 'grid' ? 'h-8 flex-1 shrink text-xs' : 'flex-1 sm:flex-none'
      )}
    >
      <Check className={cn('mr-1', viewMode === 'grid' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      {t('added')}
    </Button>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size={viewMode === 'grid' ? 'sm' : 'default'}
          disabled={isAddingToList}
          className={cn(
            'min-w-0 gap-1 bg-blue-600 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
            viewMode === 'grid' ? 'h-8 flex-1 shrink text-xs' : 'flex-1 sm:flex-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {viewMode === 'grid' ? (
            <>
              <Plus className="h-3.5 w-3.5" />
              {t('addShort')}
            </>
          ) : (
            <>
              {t('addToList')}
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {ROUNDS.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => onAddToList(school.id, r)}
            disabled={isAddingToList}
          >
            {t(`rounds.${r}` as Parameters<typeof t>[0])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (viewMode === 'grid') {
    return (
      <Card
        className={cn(
          'group relative flex h-full min-w-0 flex-col overflow-hidden p-0 transition-all duration-200',
          'hover:border-blue-500/45 hover:shadow-md dark:hover:border-blue-400/45',
          isSelected && 'border-blue-500/45 ring-2 ring-blue-500/25 dark:border-blue-400/45'
        )}
      >
        {selectionCheckbox}

        <div className="relative">
          <SchoolHeroMedia
            coverUrl={campusCoverUrl}
            schoolName={schoolName}
            sourceUrl={campusCoverSourceUrl}
            sourceQuality={campusCoverSourceQuality}
            sourceType={campusCover?.sourceType ?? null}
            hue={hue}
            initial={initial}
            size={isCompact ? 'gridCompact' : 'grid'}
            priority={priorityMedia}
          />
          {fitScorePill && <div className="absolute right-2 top-2 z-10">{fitScorePill}</div>}
        </div>

        <Link
          href={detailHref}
          className="relative z-10 -mt-6 mb-2 block px-4"
          aria-label={schoolName}
        >
          <SchoolLogo
            logoUrl={logoUrl}
            website={school.website}
            name={schoolName}
            size="md"
            className="border border-border/40 bg-background shadow-md"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col px-4 pb-4">
          <Link href={detailHref} className="mb-2 block min-w-0">
            <h3 className="mb-1 line-clamp-1 text-base font-bold leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {schoolName}
            </h3>
            {subName && (
              <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">{subName}</p>
            )}
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationParts || tc('notAvailable')}</span>
              </span>
              {typeLabel && (
                <span className="flex items-center gap-1">
                  <Building className="h-3 w-3 shrink-0" />
                  {typeLabel}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <RankingBadge
                rankings={school.rankings}
                usNewsRank={school.usNewsRank}
                variant="amber"
                preferredRankingList={preferredRankingList}
                className="max-w-full shrink truncate"
              />
              {school.hasEarlyDecision && (
                <Badge variant="outline" className="text-2xs">
                  ED
                </Badge>
              )}
            </div>
            {campusGrades.hasGrades && (
              <IndexGroup
                safetyGrade={campusGrades.safetyGrade}
                lifeGrade={campusGrades.lifeGrade}
                foodGrade={campusGrades.foodGrade}
                size="sm"
                className="mt-2 flex-wrap gap-2"
              />
            )}
          </Link>

          <div className="mt-auto flex min-w-0 flex-col gap-3 border-t border-border/60 pt-3 text-xs">
            <div className="grid min-w-0 grid-cols-3 gap-2">
              {acceptanceMetric}
              {studentsMetric}
              {trustMetric}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {visitButton}
              {addButton}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden p-0 transition-all duration-200 sm:flex-row',
        'hover:border-blue-500/45 hover:shadow-md dark:hover:border-blue-400/45',
        isSelected && 'border-blue-500/45 ring-2 ring-blue-500/25 dark:border-blue-400/45'
      )}
    >
      {selectionCheckbox}

      <div className="relative">
        <SchoolHeroMedia
          coverUrl={campusCoverUrl}
          schoolName={schoolName}
          sourceUrl={campusCoverSourceUrl}
          sourceQuality={campusCoverSourceQuality}
          sourceType={campusCover?.sourceType ?? null}
          hue={hue}
          initial={initial}
          size="list"
          priority={priorityMedia}
        />
        <Link
          href={detailHref}
          className="absolute bottom-4 left-4 z-10"
          aria-label={schoolName}
          onClick={(e) => e.stopPropagation()}
        >
          <SchoolLogo
            logoUrl={logoUrl}
            website={school.website}
            name={schoolName}
            size="md"
            className="border border-border/40 bg-background shadow-md"
          />
        </Link>
        {fitScorePill && <div className="absolute right-3 top-3 z-10">{fitScorePill}</div>}
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col', isCompact ? 'p-4' : 'p-5')}>
        <Link href={detailHref} className={cn('block min-w-0', isCompact ? 'mb-2' : 'mb-3')}>
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <h3
              className={cn(
                'line-clamp-1 font-bold leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400',
                isCompact ? 'text-lg' : 'text-xl'
              )}
            >
              {schoolName}
            </h3>
            <RankingBadge
              rankings={school.rankings}
              usNewsRank={school.usNewsRank}
              variant="amber"
              preferredRankingList={preferredRankingList}
              className="max-w-full shrink truncate"
            />
          </div>
          {subName && (
            <p className="mb-1.5 line-clamp-1 text-sm text-muted-foreground">{subName}</p>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{locationParts || tc('notAvailable')}</span>
            </span>
            {typeLabel && (
              <>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 shrink-0" />
                  {typeLabel}
                </span>
              </>
            )}
            {(school.testingPolicy === 'OPTIONAL' || school.testOptional) && (
              <>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <Badge variant="outline" className="h-5 px-1.5 text-2xs">
                  {t('list.testOptional')}
                </Badge>
              </>
            )}
            {school.hasEarlyDecision && (
              <>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <Badge variant="outline" className="h-5 px-1.5 text-2xs">
                  ED
                </Badge>
              </>
            )}
          </div>
        </Link>

        {campusGrades.hasGrades && (
          <IndexGroup
            safetyGrade={campusGrades.safetyGrade}
            lifeGrade={campusGrades.lifeGrade}
            foodGrade={campusGrades.foodGrade}
            size="sm"
            className={cn(isCompact ? 'mb-3 gap-2' : 'mb-4 gap-3')}
          />
        )}

        <div className="mt-auto flex min-w-0 flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-muted-foreground" />
              {acceptanceMetric}
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {studentsMetric}
            </div>
            {trustMetric}
          </div>
          <div className="flex items-center gap-3">
            {visitButton}
            {addButton}
          </div>
        </div>
      </div>
    </Card>
  );
}
