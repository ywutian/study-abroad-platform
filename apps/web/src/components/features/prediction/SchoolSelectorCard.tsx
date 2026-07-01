'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calculator, CheckCircle, Loader2, RefreshCw, School, Search, X } from 'lucide-react';
import { cn, getSchoolName, formatAcceptanceRate } from '@/lib/utils';
import { useSchoolSearch } from '@/hooks/use-school-search';
import { TIER_CONFIG } from './constants';
import type { SchoolSearchItem, TierType } from './types';

interface SchoolSelectorCardProps {
  selectedSchools: SchoolSearchItem[];
  onAdd: (school: SchoolSearchItem) => void;
  onRemove: (schoolId: string) => void;
  /** Bulk clear the calculation list (one tap instead of removing each). */
  onClearAll?: () => void;
  /** Re-import all schools from the user's saved school list. */
  onImportList?: () => void;
  importListCount?: number;
  onPredict: () => void;
  isPredicting: boolean;
  /** True when the profile is below the prediction-eligibility bar. */
  profileBlocked?: boolean;
  predictionTiers?: Partial<Record<string, TierType>>;
  hasPredictions?: boolean;
  className?: string;
  compact?: boolean;
}

export function SchoolSelectorCard({
  selectedSchools,
  onAdd,
  onRemove,
  onClearAll,
  onImportList,
  importListCount = 0,
  onPredict,
  isPredicting,
  profileBlocked = false,
  predictionTiers = {},
  hasPredictions = false,
  className,
  compact = false,
}: SchoolSelectorCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults, isLoading: searchLoading } = useSchoolSearch(searchQuery);

  const disabledIds = new Set(selectedSchools.map((s) => s.id));

  const handleSelect = useCallback(
    (school: SchoolSearchItem) => {
      onAdd(school);
      setSearchQuery('');
    },
    [onAdd]
  );

  return (
    <Card className={cn('mb-6 overflow-visible', compact && 'gap-4 py-4', className)}>
      <CardHeader className={cn(compact && 'px-4')}>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            {compact ? t('prediction.calculationList') : t('prediction.selectSchools')}
          </CardTitle>
          {compact && (
            <Badge variant="secondary" className="shrink-0">
              {t('prediction.selectorProgress', { count: selectedSchools.length })}
            </Badge>
          )}
        </div>
        {!compact && <CardDescription>{t('prediction.searchSchoolsDesc')}</CardDescription>}
      </CardHeader>
      <CardContent className={cn('space-y-4', compact && 'px-4')}>
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('prediction.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />

          {/* Search results dropdown */}
          {searchQuery.trim().length >= 1 && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg">
              <ScrollArea className="max-h-60">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : searchResults?.items && searchResults.items.length > 0 ? (
                  <div className="p-1">
                    {searchResults.items.map((school) => {
                      const isSelected = disabledIds.has(school.id);
                      return (
                        <button
                          key={school.id}
                          onClick={() => handleSelect(school)}
                          disabled={isSelected}
                          className={cn(
                            'w-full flex items-center justify-between p-2 rounded-md text-left',
                            'hover:bg-muted transition-colors',
                            isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div>
                            <p className="font-medium">{getSchoolName(school, locale)}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              <RankingBadge
                                rankings={school.rankings}
                                usNewsRank={school.usNewsRank}
                                variant="plain"
                              />
                              {school.acceptanceRate &&
                                t('prediction.acceptanceRateLabel', {
                                  rate: formatAcceptanceRate(school.acceptanceRate).replace(
                                    '%',
                                    ''
                                  ),
                                })}
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">
                    {t('prediction.noSchoolsFound')}
                  </p>
                )}
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Bulk controls: import the whole saved list in one tap / clear in one tap,
            so testing schools outside the list doesn't mean deleting each one. */}
        {(onImportList || onClearAll) && (
          <div className="flex flex-wrap items-center gap-2">
            {onImportList && importListCount > 0 && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onImportList}>
                <School className="h-3.5 w-3.5" />
                {t('prediction.importSchoolList', { count: importListCount })}
              </Button>
            )}
            {onClearAll && selectedSchools.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={onClearAll}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {t('prediction.clearAll')}
              </Button>
            )}
          </div>
        )}

        {/* Selected school list */}
        {selectedSchools.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('prediction.selectedCount', { count: selectedSchools.length })}
            </p>
            <div
              className={cn(
                compact ? 'max-h-72 space-y-2 overflow-auto pr-1' : 'flex flex-wrap gap-2'
              )}
            >
              {selectedSchools.map((school) => {
                const tier = predictionTiers[school.id];
                if (!compact) {
                  return (
                    <Badge
                      key={school.id}
                      variant="secondary"
                      className="flex items-center gap-1 py-1.5 px-3"
                    >
                      {getSchoolName(school, locale)}
                      <RankingBadge
                        rankings={school.rankings}
                        usNewsRank={school.usNewsRank}
                        variant="plain"
                      />
                      {tier && tier !== 'unavailable' && (
                        <span className="text-muted-foreground">
                          · {t(`prediction.tier.${tier}`)}
                        </span>
                      )}
                      <button
                        onClick={() => onRemove(school.id)}
                        className="-mr-2 ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive md:h-8 md:w-8"
                        aria-label={t('common.remove')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                }

                return (
                  <div
                    key={school.id}
                    className="flex items-center justify-between gap-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getSchoolName(school, locale)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <RankingBadge
                          rankings={school.rankings}
                          usNewsRank={school.usNewsRank}
                          variant="plain"
                        />
                        {tier && tier !== 'unavailable' && (
                          <Badge
                            variant="outline"
                            className={cn('h-5 px-1.5 text-2xs', TIER_CONFIG[tier].badge)}
                          >
                            {t(`prediction.tier.${tier}`)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(school.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('common.remove')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          onClick={onPredict}
          disabled={isPredicting || selectedSchools.length === 0 || profileBlocked}
          className="w-full"
        >
          {isPredicting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('prediction.loading.analyzing')}
            </>
          ) : (
            <>
              {hasPredictions ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              {hasPredictions ? t('prediction.rerunPrediction') : t('prediction.runPrediction')}
            </>
          )}
        </Button>
        {profileBlocked && !isPredicting && (
          <p className="mt-2 text-xs text-warning">{t('prediction.profileInsufficientHint')}</p>
        )}
      </CardContent>
    </Card>
  );
}
