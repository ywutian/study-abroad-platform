export const US_NEWS_RANKING_SOURCE = 'US_NEWS' as const;
export const US_NEWS_CORE_RANKING_LIST = 'US_NEWS_CORE' as const;

/** All ranking sources surfaced to users. US News stays the primary badge source. */
export const SCHOOL_RANKING_SOURCES = ['US_NEWS', 'QS', 'THE', 'ARWU', 'FORBES', 'WSJ'] as const;

export const SCHOOL_RANKING_LISTS = [
  'NATIONAL_UNIVERSITY',
  'LIBERAL_ARTS',
  'REGIONAL_UNIVERSITY',
  'ART_DESIGN',
  'MUSIC',
  'ENGINEERING_NO_PHD',
] as const;

/** One global/national list per non-US-News source. */
export const GLOBAL_RANKING_LISTS = [
  'QS_WORLD',
  'THE_WORLD',
  'ARWU_WORLD',
  'FORBES_AMERICA',
  'WSJ_US',
] as const;

export type SchoolRankingSource = (typeof SCHOOL_RANKING_SOURCES)[number];
export type SchoolRankingList = (typeof SCHOOL_RANKING_LISTS)[number];
export type SchoolRankingListSelection = typeof US_NEWS_CORE_RANKING_LIST | SchoolRankingList;
export type SchoolRankingConfidence = 'verified' | 'fallback';

export interface SchoolRanking {
  source: SchoolRankingSource | string;
  list: SchoolRankingListSelection | string;
  rank: number;
  year: number;
  sourceUrl?: string | null;
  confidence?: SchoolRankingConfidence;
}

export interface RankingListOption {
  source: SchoolRankingSource;
  list: SchoolRankingListSelection;
  labelKey: string;
  year: number | null;
  count: number;
  verifiedCount: number;
  fallbackCount: number;
  isDefault: boolean;
}

export const RANKING_LIST_LABEL_KEYS: Record<SchoolRankingListSelection | string, string> = {
  US_NEWS_CORE: 'core',
  NATIONAL_UNIVERSITY: 'nationalUniversity',
  LIBERAL_ARTS: 'liberalArts',
  REGIONAL_UNIVERSITY: 'regionalUniversity',
  ART_DESIGN: 'artDesign',
  MUSIC: 'music',
  PERFORMING_ARTS: 'performingArts',
  ENGINEERING_NO_PHD: 'engineering',
  ENGINEERING_UNDERGRAD: 'engineering',
  ENGINEERING_GRADUATE: 'engineering',
  CS: 'cs',
  CS_GRADUATE: 'cs',
  BUSINESS: 'business',
  MBA: 'business',
  QS_WORLD: 'qsWorld',
  THE_WORLD: 'theWorld',
  ARWU_WORLD: 'arwuWorld',
  FORBES_AMERICA: 'forbesAmerica',
  WSJ_US: 'wsjUs',
};

export const RANKING_SOURCE_LABELS: Record<string, string> = {
  US_NEWS: 'US News',
  'US News': 'US News',
  QS: 'QS',
  THE: 'THE',
  ARWU: 'ARWU',
  FORBES: 'Forbes',
  WSJ: 'WSJ',
};

/** Display order for the multi-source rankings panel (US News first). */
const RANKING_SOURCE_DISPLAY_ORDER: Record<string, number> = {
  US_NEWS: 0,
  QS: 1,
  THE: 2,
  ARWU: 3,
  FORBES: 4,
  WSJ: 5,
};

const RANKING_LIST_SELECTION_SET = new Set<string>([
  US_NEWS_CORE_RANKING_LIST,
  ...SCHOOL_RANKING_LISTS,
]);

const RANKING_LIST_DISPLAY_PRIORITY: Record<string, number> = {
  NATIONAL_UNIVERSITY: 0,
  LIBERAL_ARTS: 0,
  REGIONAL_UNIVERSITY: 2,
  ART_DESIGN: 3,
  MUSIC: 3,
  PERFORMING_ARTS: 3,
  ENGINEERING_NO_PHD: 3,
  ENGINEERING_UNDERGRAD: 3,
  CS: 4,
  CS_GRADUATE: 4,
  BUSINESS: 4,
  MBA: 4,
  ENGINEERING_GRADUATE: 4,
};

export function normalizeRankingSource(source?: string | null): string {
  return source === 'US News' ? US_NEWS_RANKING_SOURCE : (source ?? '');
}

export function getRankingSourceLabel(source: string): string {
  return RANKING_SOURCE_LABELS[source] ?? source;
}

export function isRankingListSelection(list?: string | null): list is SchoolRankingListSelection {
  return Boolean(list && RANKING_LIST_SELECTION_SET.has(list));
}

export function normalizeRankingListSelection(list?: string | null): SchoolRankingListSelection {
  return isRankingListSelection(list) ? list : US_NEWS_CORE_RANKING_LIST;
}

export function isConcreteRankingList(list: SchoolRankingListSelection): list is SchoolRankingList {
  return list !== US_NEWS_CORE_RANKING_LIST;
}

export function getRankingListLabelKey(list?: string | null): string {
  return RANKING_LIST_LABEL_KEYS[list ?? ''] ?? 'nationalUniversity';
}

function getRankingDisplayPriority(list: string): number {
  return RANKING_LIST_DISPLAY_PRIORITY[list] ?? 9;
}

function getPreferredRankingPriority(
  list: string,
  preferredRankingList?: SchoolRankingListSelection
): number {
  if (!preferredRankingList || preferredRankingList === US_NEWS_CORE_RANKING_LIST) {
    return 0;
  }
  return list === preferredRankingList ? -1 : 0;
}

export function normalizeSchoolRanking(ranking: SchoolRanking): SchoolRanking {
  return {
    ...ranking,
    source: normalizeRankingSource(ranking.source),
    confidence: ranking.confidence ?? 'verified',
  };
}

export function getDisplayRankings(
  rankings?: SchoolRanking[] | null,
  preferredRankingList?: SchoolRankingListSelection
): SchoolRanking[] {
  if (!rankings?.length) return [];

  const bestBySourceAndList = new Map<string, SchoolRanking>();
  for (const input of rankings) {
    if (!Number.isFinite(input.rank) || input.rank <= 0) continue;
    const ranking = normalizeSchoolRanking(input);
    const key = `${ranking.source}:${ranking.list}`;
    const existing = bestBySourceAndList.get(key);
    if (
      !existing ||
      ranking.rank < existing.rank ||
      (ranking.rank === existing.rank && ranking.year > existing.year)
    ) {
      bestBySourceAndList.set(key, ranking);
    }
  }

  return Array.from(bestBySourceAndList.values()).sort((a, b) => {
    const preferredDelta =
      getPreferredRankingPriority(String(a.list), preferredRankingList) -
      getPreferredRankingPriority(String(b.list), preferredRankingList);
    if (preferredDelta !== 0) return preferredDelta;

    const priorityDelta =
      getRankingDisplayPriority(String(a.list)) - getRankingDisplayPriority(String(b.list));
    if (priorityDelta !== 0) return priorityDelta;

    const rankDelta = a.rank - b.rank;
    if (rankDelta !== 0) return rankDelta;

    return b.year - a.year;
  });
}

export function createLegacyUsNewsRanking(usNewsRank?: number | null): SchoolRanking | null {
  if (!Number.isFinite(usNewsRank) || !usNewsRank || usNewsRank <= 0) {
    return null;
  }
  return {
    source: US_NEWS_RANKING_SOURCE,
    list: US_NEWS_CORE_RANKING_LIST,
    rank: usNewsRank,
    year: 2025,
    confidence: 'fallback',
  };
}

export function formatRankingForPlainText(ranking?: SchoolRanking | null): string | null {
  if (!ranking) return null;
  const source = getRankingSourceLabel(ranking.source);
  const list = ranking.list === US_NEWS_CORE_RANKING_LIST ? 'legacy' : ranking.list;
  const suffix = ranking.confidence === 'fallback' ? ' fallback' : '';
  return `${source} ${list} #${ranking.rank}${suffix}`;
}

/**
 * Collapses a school's rankings to one best row per source for the
 * multi-source detail-page panel. Best = lowest rank, newest year on a tie.
 * Sorted by RANKING_SOURCE_DISPLAY_ORDER (US News first).
 */
export function groupRankingsBySource(rankings?: SchoolRanking[] | null): SchoolRanking[] {
  if (!rankings?.length) return [];

  const bestBySource = new Map<string, SchoolRanking>();
  for (const input of rankings) {
    if (!Number.isFinite(input.rank) || input.rank <= 0) continue;
    const ranking = normalizeSchoolRanking(input);
    const existing = bestBySource.get(ranking.source);
    if (
      !existing ||
      ranking.rank < existing.rank ||
      (ranking.rank === existing.rank && ranking.year > existing.year)
    ) {
      bestBySource.set(ranking.source, ranking);
    }
  }

  return Array.from(bestBySource.values()).sort(
    (a, b) =>
      (RANKING_SOURCE_DISPLAY_ORDER[a.source] ?? 99) -
      (RANKING_SOURCE_DISPLAY_ORDER[b.source] ?? 99)
  );
}
