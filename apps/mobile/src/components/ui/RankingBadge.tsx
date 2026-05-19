import React from 'react';
import { Badge } from './Badge';
import {
  createLegacyUsNewsRanking,
  getDisplayRankings,
  getRankingListLabelKey,
  getRankingSourceLabel,
  type SchoolRanking,
  type SchoolRankingListSelection,
} from '@study-abroad/shared/ranking';

const LABELS: Record<string, string> = {
  core: 'Legacy',
  nationalUniversity: 'National',
  liberalArts: 'Liberal Arts',
  regionalUniversity: 'Regional',
  artDesign: 'Art & Design',
  music: 'Music',
  engineering: 'Engineering',
  qsWorld: 'World',
  theWorld: 'World',
  arwuWorld: 'World',
  forbesAmerica: 'America',
  wsjUs: 'US',
};

/** Shared list-label lookup for the multi-source rankings list. */
export function getRankingListShortLabel(list: string): string {
  return LABELS[getRankingListLabelKey(list)] ?? list;
}

interface RankingBadgeProps {
  rankings?: SchoolRanking[] | null;
  usNewsRank?: number | null;
  preferredRankingList?: SchoolRankingListSelection;
}

export function RankingBadge({ rankings, usNewsRank, preferredRankingList }: RankingBadgeProps) {
  const fallback = createLegacyUsNewsRanking(usNewsRank);
  const display = getDisplayRankings(
    rankings?.length ? rankings : fallback ? [fallback] : [],
    preferredRankingList
  )[0];

  if (!display) return null;

  const source = getRankingSourceLabel(display.source);
  const label =
    display.confidence === 'fallback' ? 'Legacy' : LABELS[getRankingListLabelKey(display.list)];

  return (
    <Badge variant={display.confidence === 'fallback' ? 'warning' : 'secondary'}>
      {source} {label} #{display.rank}
    </Badge>
  );
}
