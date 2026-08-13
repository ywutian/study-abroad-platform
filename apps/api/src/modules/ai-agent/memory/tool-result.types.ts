type ToolResultItem = {
  schoolName?: string;
  school?: { name?: string };
  category?: string;
  tasks?: unknown;
  prediction?: unknown;
};

export interface ParsedToolResult extends Array<ToolResultItem> {
  success?: boolean;
  event?: { id: string; category: string; title: string };
  timeline?: unknown[];
  keyDates?: unknown;
  current?: { probability?: number; tier?: string };
  history?: unknown[];
  school?: { name?: string };
  totalSchools?: number;
  avgProbability?: number;
  tierDistribution?: { reach?: number; match?: number; safety?: number };
  cases?: ToolResultItem[];
  similarCases?: ToolResultItem[];
  total?: number;
  explanation?: unknown;
  caseId?: string;
  schoolName?: string;
  keyFactors?: string[];
}
