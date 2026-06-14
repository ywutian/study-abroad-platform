'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { PredictionResultRow } from './PredictionResultRow';
import { PredictionResultTierGroup } from './PredictionResultTierGroup';
import type { PredictionResult, TierType } from './types';

interface PredictionResultListProps {
  results: PredictionResult[];
  selectedId: string | null;
  onSelect: (schoolId: string) => void;
}

// Reach first (most attention), then match, safety, and finally the schools we
// couldn't estimate. Within a group, higher probability sorts first.
const TIER_ORDER: TierType[] = ['reach', 'match', 'safety', 'unavailable'];

/**
 * The "scan" surface of the workbench: every predicted school as a compact,
 * fixed-shape row, grouped by tier. Selecting a row drives the detail pane.
 *
 * This list deliberately renders ONLY {@link PredictionResultRow}s — no
 * expandable cards, no async sub-panels, no height animation and no nested
 * `overflow-auto` virtualizer. That is what structurally kills the old
 * overlap/clip bug: there is no variable-height content here for a windowed
 * surface to mis-measure. The column that wraps this list owns the scroll.
 */
export function PredictionResultList({ results, selectedId, onSelect }: PredictionResultListProps) {
  const t = useTranslations('prediction');

  const grouped = useMemo(() => {
    return TIER_ORDER.map((tier) => {
      const items = results
        .filter((r) => (r.tier ?? 'unavailable') === tier)
        .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1));
      return { tier, items };
    }).filter((g) => g.items.length > 0);
  }, [results]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-subtitle flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          {t('results')}
        </h2>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {results.length}
        </Badge>
      </div>

      {grouped.map(({ tier, items }) => (
        <PredictionResultTierGroup key={tier} tier={tier} count={items.length}>
          {items.map((result) => (
            <PredictionResultRow
              key={result.schoolId}
              result={result}
              isSelected={selectedId === result.schoolId}
              onSelect={() => onSelect(result.schoolId)}
            />
          ))}
        </PredictionResultTierGroup>
      ))}
    </div>
  );
}
