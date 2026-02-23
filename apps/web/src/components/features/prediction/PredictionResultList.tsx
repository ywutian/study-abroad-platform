'use client';

import { useState, useMemo, useDeferredValue, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { TIER_CONFIG } from './constants';
import { PredictionResultCard } from './PredictionResultCard';
import type { PredictionResult, TierType } from './types';

interface PredictionResultListProps {
  results: PredictionResult[];
  expandedId: string | null;
  onToggleExpand: (schoolId: string) => void;
  onResultReported?: (schoolId: string, result: string) => void;
  onRefresh?: (schoolId: string) => void;
  refreshingSchoolId?: string | null;
}

type SortBy = 'probability' | 'tier' | 'confidence';
type FilterTier = TierType | 'all';

const TIER_ORDER: Record<string, number> = { reach: 0, match: 1, safety: 2 };
const CONFIDENCE_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

const VIRTUALIZATION_THRESHOLD = 15;

export function PredictionResultList({
  results,
  expandedId,
  onToggleExpand,
  onResultReported,
  onRefresh,
  refreshingSchoolId,
}: PredictionResultListProps) {
  const t = useTranslations('prediction');
  const [sortBy, setSortBy] = useState<SortBy>('probability');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');

  // Defer sort/filter for responsive UI during rapid toggling
  const deferredSortBy = useDeferredValue(sortBy);
  const deferredFilterTier = useDeferredValue(filterTier);

  const filteredAndSorted = useMemo(() => {
    let items =
      deferredFilterTier === 'all' ? results : results.filter((r) => r.tier === deferredFilterTier);

    items = [...items].sort((a, b) => {
      switch (deferredSortBy) {
        case 'probability':
          return b.probability - a.probability;
        case 'tier':
          return (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3);
        case 'confidence':
          return (CONFIDENCE_ORDER[b.confidence] ?? 0) - (CONFIDENCE_ORDER[a.confidence] ?? 0);
        default:
          return 0;
      }
    });

    return items;
  }, [results, deferredSortBy, deferredFilterTier]);

  const tierCounts = useMemo(() => {
    const counts = { reach: 0, match: 0, safety: 0 };
    results.forEach((r) => {
      if (r.tier in counts) counts[r.tier]++;
    });
    return counts;
  }, [results]);

  const useVirtual = filteredAndSorted.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-subtitle flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          {t('results')}
        </h2>

        {/* Sort controls */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t('sort.probability').replace(/^By /, 'Sort by ')}
        >
          {(['probability', 'tier', 'confidence'] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              aria-pressed={sortBy === s}
              aria-label={t(`sort.${s}`)}
            >
              <Badge
                variant={sortBy === s ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
              >
                {t(`sort.${s}`)}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by tier">
        <button
          onClick={() => setFilterTier('all')}
          aria-pressed={filterTier === 'all'}
          aria-label={`${t('filter.all')} (${results.length})`}
        >
          <Badge
            variant={filterTier === 'all' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
          >
            {t('filter.all')} ({results.length})
          </Badge>
        </button>
        {(['reach', 'match', 'safety'] as TierType[]).map((tier) => {
          const config = TIER_CONFIG[tier];
          return (
            <button
              key={tier}
              onClick={() => setFilterTier(filterTier === tier ? 'all' : tier)}
              aria-pressed={filterTier === tier}
              aria-label={`${t(`tier.${tier}`)} (${tierCounts[tier]})`}
            >
              <Badge
                variant="outline"
                className={cn('cursor-pointer text-xs', filterTier === tier && config.badge)}
              >
                {t(`tier.${tier}`)} ({tierCounts[tier]})
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {t('resultsAnnouncement', { count: filteredAndSorted.length, sort: t(`sort.${sortBy}`) })}
      </div>

      {/* Result cards — virtualized for large lists, staggered for small */}
      {useVirtual ? (
        <VirtualizedResultList
          items={filteredAndSorted}
          expandedId={expandedId}
          onToggleExpand={onToggleExpand}
          onResultReported={onResultReported}
          onRefresh={onRefresh}
          refreshingSchoolId={refreshingSchoolId}
        />
      ) : (
        <StaggerContainer staggerDelay={0.05} className="space-y-4">
          {filteredAndSorted.map((result) => (
            <StaggerItem key={result.schoolId}>
              <PredictionResultCard
                result={result}
                isExpanded={expandedId === result.schoolId}
                onToggleExpand={() => onToggleExpand(result.schoolId)}
                onResultReported={onResultReported}
                onRefresh={onRefresh}
                isRefreshing={refreshingSchoolId === result.schoolId}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {filteredAndSorted.length === 0 && results.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{t('noResultsForFilter')}</p>
      )}
    </div>
  );
}

/** Windowed rendering for large result sets */
function VirtualizedResultList({
  items,
  expandedId,
  onToggleExpand,
  onResultReported,
  onRefresh,
  refreshingSchoolId,
}: {
  items: PredictionResult[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onResultReported?: (schoolId: string, result: string) => void;
  onRefresh?: (schoolId: string) => void;
  refreshingSchoolId?: string | null;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Expanded cards are taller
      return items[index].schoolId === expandedId ? 600 : 200;
    },
    overscan: 3,
    gap: 16,
  });

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const result = items[virtualItem.index];
          return (
            <div
              key={result.schoolId}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <PredictionResultCard
                result={result}
                isExpanded={expandedId === result.schoolId}
                onToggleExpand={() => onToggleExpand(result.schoolId)}
                onResultReported={onResultReported}
                onRefresh={onRefresh}
                isRefreshing={refreshingSchoolId === result.schoolId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
