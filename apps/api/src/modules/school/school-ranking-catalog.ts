type RankingSource = 'US_NEWS' | string;

export interface CatalogRanking {
  source: RankingSource;
  list: string;
  rank: number;
  year?: number | null;
  sourceUrl?: string | null;
  confidence?: 'verified' | 'fallback';
}

export interface SchoolCatalogRankingInput {
  name: string;
  usNewsRank?: number | null;
  institutionType?: string | null;
  rankings?: CatalogRanking[] | null;
}

export const US_NEWS_RANKING_SOURCE = 'US_NEWS' as const;
export const US_NEWS_CORE_RANKING_LIST = 'US_NEWS_CORE';

export const CATALOG_RANKING_LISTS = [
  'NATIONAL_UNIVERSITY',
  'LIBERAL_ARTS',
  'REGIONAL_UNIVERSITY',
  'ART_DESIGN',
  'MUSIC',
  'ENGINEERING_NO_PHD',
] as const;

export type CatalogRankingList = (typeof CATALOG_RANKING_LISTS)[number];
export type RankingListSelection =
  | typeof US_NEWS_CORE_RANKING_LIST
  | CatalogRankingList;

const CATALOG_RANKING_LIST_SET = new Set<string>(CATALOG_RANKING_LISTS);
const RANKING_LIST_SELECTION_SET = new Set<string>([
  US_NEWS_CORE_RANKING_LIST,
  ...CATALOG_RANKING_LISTS,
]);
const CORE_RANKING_LIST_SET = new Set<string>([
  'NATIONAL_UNIVERSITY',
  'LIBERAL_ARTS',
]);

export const RANKING_LIST_LABEL_KEYS: Record<RankingListSelection, string> = {
  US_NEWS_CORE: 'core',
  NATIONAL_UNIVERSITY: 'nationalUniversity',
  LIBERAL_ARTS: 'liberalArts',
  REGIONAL_UNIVERSITY: 'regionalUniversity',
  ART_DESIGN: 'artDesign',
  MUSIC: 'music',
  ENGINEERING_NO_PHD: 'engineering',
};

const RANKING_LIST_PRIORITY: Record<string, number> = {
  NATIONAL_UNIVERSITY: 0,
  LIBERAL_ARTS: 0,
  REGIONAL_UNIVERSITY: 2,
  ART_DESIGN: 3,
  MUSIC: 3,
  ENGINEERING_NO_PHD: 3,
};

const RANKING_LIST_TIE_BREAKER: Record<string, number> = {
  NATIONAL_UNIVERSITY: 0,
  LIBERAL_ARTS: 1,
  REGIONAL_UNIVERSITY: 2,
  ENGINEERING_NO_PHD: 3,
  ART_DESIGN: 4,
  MUSIC: 5,
};

const FALLBACK_PRIORITY = 8;
const MISSING_RANK_PRIORITY = 99;
const MISSING_RANK_VALUE = 1_000_000;

const LIST_SOURCE_URL: Record<CatalogRankingList, string | null> = {
  NATIONAL_UNIVERSITY:
    'https://www.usnews.com/best-colleges/rankings/national-universities',
  LIBERAL_ARTS:
    'https://www.usnews.com/best-colleges/rankings/national-liberal-arts-colleges',
  REGIONAL_UNIVERSITY:
    'https://www.usnews.com/best-colleges/rankings/regional-universities',
  ART_DESIGN:
    'https://www.usnews.com/best-graduate-schools/top-fine-arts-schools',
  MUSIC: null,
  ENGINEERING_NO_PHD:
    'https://www.usnews.com/best-colleges/rankings/engineering-overall',
};

const LIST_INSTITUTION_TYPE: Record<CatalogRankingList, string> = {
  NATIONAL_UNIVERSITY: 'RESEARCH_UNIVERSITY',
  LIBERAL_ARTS: 'LIBERAL_ARTS',
  REGIONAL_UNIVERSITY: 'SPECIALTY',
  ART_DESIGN: 'ART_DESIGN',
  MUSIC: 'MUSIC_CONSERVATORY',
  ENGINEERING_NO_PHD: 'SPECIALTY',
};

const LIST_IS_PRIVATE_DEFAULT: Record<CatalogRankingList, boolean | null> = {
  NATIONAL_UNIVERSITY: null,
  LIBERAL_ARTS: true,
  REGIONAL_UNIVERSITY: null,
  ART_DESIGN: true,
  MUSIC: true,
  ENGINEERING_NO_PHD: true,
};

function normalizeSchoolName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const LIBERAL_ARTS_SCHOOLS = [
  'Williams College',
  'Amherst College',
  'Swarthmore College',
  'Pomona College',
  'Wellesley College',
  'Bowdoin College',
  'Middlebury College',
  'Carleton College',
  'Claremont McKenna College',
  'Hamilton College',
  'Haverford College',
  'Vassar College',
  'Davidson College',
  'Washington and Lee University',
  'Smith College',
  'Grinnell College',
  'Colgate University',
  'Colby College',
  'Bates College',
  'Barnard College',
  'Harvey Mudd College',
];

const ART_DESIGN_SCHOOLS = [
  'Rhode Island School of Design',
  'Pratt Institute',
  'School of the Art Institute of Chicago',
  'California Institute of the Arts',
  'ArtCenter College of Design',
  'Savannah College of Art and Design',
  'Maryland Institute College of Art',
  'California College of the Arts',
];

const MUSIC_SCHOOLS = [
  'The Juilliard School',
  'Berklee College of Music',
  'Curtis Institute of Music',
  'New England Conservatory',
  'Manhattan School of Music',
];

const ENGINEERING_NO_PHD_SCHOOLS = [
  'Rose-Hulman Institute of Technology',
  'Cooper Union',
  'Olin College of Engineering',
];

const REGIONAL_UNIVERSITY_SCHOOLS = [
  'California Polytechnic State University, San Luis Obispo',
];

const CURATED_RANKING_LIST_BY_NAME = new Map<string, CatalogRankingList>([
  ...LIBERAL_ARTS_SCHOOLS.map(
    (name) => [normalizeSchoolName(name), 'LIBERAL_ARTS'] as const,
  ),
  ...ART_DESIGN_SCHOOLS.map(
    (name) => [normalizeSchoolName(name), 'ART_DESIGN'] as const,
  ),
  ...MUSIC_SCHOOLS.map((name) => [normalizeSchoolName(name), 'MUSIC'] as const),
  ...ENGINEERING_NO_PHD_SCHOOLS.map(
    (name) => [normalizeSchoolName(name), 'ENGINEERING_NO_PHD'] as const,
  ),
  ...REGIONAL_UNIVERSITY_SCHOOLS.map(
    (name) => [normalizeSchoolName(name), 'REGIONAL_UNIVERSITY'] as const,
  ),
]);

export function resolveFallbackRankingList(
  school: Pick<SchoolCatalogRankingInput, 'name' | 'institutionType'>,
): CatalogRankingList {
  const curated = CURATED_RANKING_LIST_BY_NAME.get(
    normalizeSchoolName(school.name),
  );
  if (curated) return curated;

  switch (school.institutionType) {
    case 'LIBERAL_ARTS':
      return 'LIBERAL_ARTS';
    case 'ART_DESIGN':
      return 'ART_DESIGN';
    case 'MUSIC_CONSERVATORY':
      return 'MUSIC';
    case 'SPECIALTY':
      return 'ENGINEERING_NO_PHD';
    case 'RESEARCH_UNIVERSITY':
    default:
      return 'NATIONAL_UNIVERSITY';
  }
}

export function getRankingListSourceUrl(
  list: CatalogRankingList,
): string | null {
  return LIST_SOURCE_URL[list];
}

export function getInstitutionTypeForRankingList(
  list: CatalogRankingList,
): string {
  return LIST_INSTITUTION_TYPE[list];
}

export function getPrivateDefaultForRankingList(
  list: CatalogRankingList,
): boolean | null {
  return LIST_IS_PRIVATE_DEFAULT[list];
}

export function isCatalogRankingList(list: string): boolean {
  return CATALOG_RANKING_LIST_SET.has(list);
}

export function isRankingListSelection(
  list: string,
): list is RankingListSelection {
  return RANKING_LIST_SELECTION_SET.has(list);
}

export function normalizeRankingListSelection(
  list?: string | null,
): RankingListSelection {
  return list && isRankingListSelection(list)
    ? list
    : US_NEWS_CORE_RANKING_LIST;
}

export function isConcreteRankingList(
  list: RankingListSelection,
): list is CatalogRankingList {
  return list !== US_NEWS_CORE_RANKING_LIST;
}

function isCoreConcreteList(list: string): boolean {
  return CORE_RANKING_LIST_SET.has(list);
}

function getRankingListPriority(list: string): number {
  return RANKING_LIST_PRIORITY[list] ?? FALLBACK_PRIORITY;
}

function getRankingListTieBreaker(list: string): number {
  return RANKING_LIST_TIE_BREAKER[list] ?? FALLBACK_PRIORITY;
}

function isFiniteRank(rank: unknown): rank is number {
  return typeof rank === 'number' && Number.isFinite(rank) && rank > 0;
}

export function getCatalogRanking(
  school: SchoolCatalogRankingInput,
  selection: RankingListSelection = US_NEWS_CORE_RANKING_LIST,
): CatalogRanking | null {
  if (isConcreteRankingList(selection)) {
    const matching = (school.rankings ?? [])
      .filter((ranking): ranking is CatalogRanking =>
        Boolean(
          ranking?.list === selection &&
          isFiniteRank(ranking.rank) &&
          isUsNewsSource(ranking.source),
        ),
      )
      .slice()
      .sort((a, b) => {
        const rankDelta = a.rank - b.rank;
        if (rankDelta !== 0) return rankDelta;
        return (b.year ?? 0) - (a.year ?? 0);
      });

    if (matching.length > 0) {
      return {
        ...matching[0],
        confidence: matching[0].confidence ?? 'verified',
      };
    }

    if (
      isFiniteRank(school.usNewsRank) &&
      resolveFallbackRankingList(school) === selection
    ) {
      return {
        source: US_NEWS_RANKING_SOURCE,
        list: selection,
        rank: school.usNewsRank,
        year: 2025,
        sourceUrl: null,
        confidence: 'fallback',
      };
    }

    return null;
  }

  const ranked = (school.rankings ?? [])
    .filter((ranking): ranking is CatalogRanking =>
      Boolean(
        ranking?.list &&
        isCoreConcreteList(ranking.list) &&
        isFiniteRank(ranking.rank) &&
        isUsNewsSource(ranking.source),
      ),
    )
    .slice()
    .sort((a, b) => {
      const priorityDelta =
        getRankingListPriority(a.list) - getRankingListPriority(b.list);
      if (priorityDelta !== 0) return priorityDelta;

      const rankDelta = a.rank - b.rank;
      if (rankDelta !== 0) return rankDelta;

      const listDelta =
        getRankingListTieBreaker(a.list) - getRankingListTieBreaker(b.list);
      if (listDelta !== 0) return listDelta;

      return (b.year ?? 0) - (a.year ?? 0);
    });

  if (ranked.length > 0) {
    return { ...ranked[0], confidence: ranked[0].confidence ?? 'verified' };
  }

  if (!isFiniteRank(school.usNewsRank)) return null;

  const fallbackList = resolveFallbackRankingList(school);
  if (!isCoreConcreteList(fallbackList)) return null;

  return {
    source: US_NEWS_RANKING_SOURCE,
    list: fallbackList,
    rank: school.usNewsRank,
    year: 2025,
    sourceUrl: null,
    confidence: 'fallback',
  };
}

export function getCatalogRankSortValue(
  school: SchoolCatalogRankingInput,
  selection: RankingListSelection = US_NEWS_CORE_RANKING_LIST,
): number | null {
  const ranking = getCatalogRanking(school, selection);
  if (!ranking) return null;
  return getRankingListPriority(ranking.list) * 10_000 + ranking.rank;
}

export function getCoreRankingForRange(
  school: SchoolCatalogRankingInput,
): CatalogRanking | null {
  const ranked = (school.rankings ?? [])
    .filter((ranking): ranking is CatalogRanking =>
      Boolean(
        ranking?.list &&
        isCoreConcreteList(ranking.list) &&
        isFiniteRank(ranking.rank) &&
        isUsNewsSource(ranking.source),
      ),
    )
    .slice()
    .sort((a, b) => {
      const rankDelta = a.rank - b.rank;
      if (rankDelta !== 0) return rankDelta;
      const listDelta =
        getRankingListTieBreaker(a.list) - getRankingListTieBreaker(b.list);
      if (listDelta !== 0) return listDelta;
      return (b.year ?? 0) - (a.year ?? 0);
    });

  if (ranked.length > 0) {
    return { ...ranked[0], confidence: ranked[0].confidence ?? 'verified' };
  }

  const fallbackList = resolveFallbackRankingList(school);
  if (!isCoreConcreteList(fallbackList) || !isFiniteRank(school.usNewsRank)) {
    return null;
  }

  return {
    source: US_NEWS_RANKING_SOURCE,
    list: fallbackList,
    rank: school.usNewsRank,
    year: 2025,
    sourceUrl: null,
    confidence: 'fallback',
  };
}

export function compareSchoolsByCatalogRank(
  a: SchoolCatalogRankingInput,
  b: SchoolCatalogRankingInput,
  selection: RankingListSelection = US_NEWS_CORE_RANKING_LIST,
): number {
  const rankingA = getCatalogRanking(a, selection);
  const rankingB = getCatalogRanking(b, selection);

  const priorityA = rankingA
    ? getRankingListPriority(rankingA.list)
    : MISSING_RANK_PRIORITY;
  const priorityB = rankingB
    ? getRankingListPriority(rankingB.list)
    : MISSING_RANK_PRIORITY;
  if (priorityA !== priorityB) return priorityA - priorityB;

  const rankA = rankingA?.rank ?? MISSING_RANK_VALUE;
  const rankB = rankingB?.rank ?? MISSING_RANK_VALUE;
  if (rankA !== rankB) return rankA - rankB;

  if (rankingA && rankingB) {
    const listDelta =
      getRankingListTieBreaker(rankingA.list) -
      getRankingListTieBreaker(rankingB.list);
    if (listDelta !== 0) return listDelta;
  }

  return a.name.localeCompare(b.name);
}

function isUsNewsSource(source: unknown): boolean {
  return source === US_NEWS_RANKING_SOURCE || source === 'US News';
}
