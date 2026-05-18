'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  createLegacyUsNewsRanking,
  getRankingListLabelKey,
  getRankingSourceLabel,
  groupRankingsBySource,
  type SchoolRanking,
} from '@/lib/utils/ranking';
import type { SchoolDetail } from './types';

interface SchoolRankingsPanelProps {
  school: Pick<SchoolDetail, 'rankings' | 'usNewsRank' | 'qsRank'>;
}

/** Builds a legacy QS row when the school only has the flat `qsRank` field. */
function createLegacyQsRanking(qsRank?: number): SchoolRanking | null {
  if (!Number.isFinite(qsRank) || !qsRank || qsRank <= 0) return null;
  return {
    source: 'QS',
    list: 'QS_WORLD',
    rank: qsRank,
    year: 2025,
    confidence: 'fallback',
  };
}

/**
 * Multi-source rankings panel for the school detail page.
 * Lists one best row per source (US News, QS, THE, ARWU, Forbes, WSJ),
 * falling back to the legacy flat `usNewsRank` / `qsRank` fields.
 */
export function SchoolRankingsPanel({ school }: SchoolRankingsPanelProps) {
  const t = useTranslations();

  const rows = [...(school.rankings ?? [])];
  const hasSource = (source: string) => rows.some((r) => r.source === source);

  if (!hasSource('US_NEWS')) {
    const legacy = createLegacyUsNewsRanking(school.usNewsRank);
    if (legacy) rows.push(legacy);
  }
  if (!hasSource('QS')) {
    const legacy = createLegacyQsRanking(school.qsRank);
    if (legacy) rows.push(legacy);
  }

  const grouped = groupRankingsBySource(rows);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">{t('school.rankings.title')}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('school.rankings.description')}
      </p>

      {grouped.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{t('school.rankings.empty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {grouped.map((r) => {
            const sourceLabel = getRankingSourceLabel(r.source);
            const isFallback = r.confidence === 'fallback';
            const listLabel = t(`common.rankingList.${getRankingListLabelKey(r.list)}` as never);
            return (
              <li key={r.source} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {sourceLabel}
                    </span>
                    {isFallback && (
                      <Badge variant="outline" className="shrink-0 text-2xs text-muted-foreground">
                        {t('common.rankingFallbackShort')}
                      </Badge>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {listLabel} · {t('school.rankings.year', { year: r.year })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    #{r.rank}
                  </span>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('school.rankings.sourceLink', { source: sourceLabel })}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
