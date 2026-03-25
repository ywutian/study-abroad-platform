export interface SchoolRanking {
  source: string;
  list: string;
  rank: number;
  year: number;
}

/** Ranking list label map — keys match backend SchoolRanking.list values */
export const RANKING_LIST_KEYS: Record<string, string> = {
  NATIONAL_UNIVERSITY: 'nationalUniversity',
  LIBERAL_ARTS: 'liberalArts',
  ART_DESIGN: 'artDesign',
  ENGINEERING_NO_PHD: 'engineering',
  CS: 'cs',
  BUSINESS: 'business',
};

/** Get the best (lowest rank) ranking per list for display */
export function getDisplayRankings(rankings?: SchoolRanking[]): SchoolRanking[] {
  if (!rankings?.length) return [];
  const bestByList = new Map<string, SchoolRanking>();
  for (const r of rankings) {
    const existing = bestByList.get(r.list);
    if (!existing || r.rank < existing.rank) {
      bestByList.set(r.list, r);
    }
  }
  return Array.from(bestByList.values()).sort((a, b) => a.rank - b.rank);
}
